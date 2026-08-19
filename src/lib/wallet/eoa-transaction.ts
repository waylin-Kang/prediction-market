import type { Address, Hex } from 'viem'

import { toHex } from 'viem'

export interface RpcWalletProvider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>
}

export function isRpcWalletProvider(value: unknown): value is RpcWalletProvider {
  return Boolean(value) && typeof value === 'object' && typeof (value as { request?: unknown }).request === 'function'
}

export function isEmbeddedWalletProvider(value: unknown): value is RpcWalletProvider {
  if (!isRpcWalletProvider(value)) {
    return false
  }

  const candidate = value as {
    connectEmail?: unknown
    connectSocial?: unknown
    getEmail?: unknown
    switchNetwork?: unknown
    constructor?: { name?: string }
  }

  return (
    candidate.constructor?.name === 'W3mFrameProvider' ||
    (typeof candidate.connectEmail === 'function' &&
      typeof candidate.connectSocial === 'function' &&
      typeof candidate.getEmail === 'function' &&
      typeof candidate.switchNetwork === 'function')
  )
}

export function resolveWalletChainId(value: number | string | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const normalized = value.includes(':') ? value.slice(value.lastIndexOf(':') + 1) : value
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function buildRpcWalletTransactionRequest(params: {
  from: Address
  to: Address
  data: Hex
  value?: bigint
  gas?: bigint
}) {
  return {
    from: params.from,
    to: params.to,
    data: params.data,
    value: toHex(params.value ?? 0n),
    ...(typeof params.gas === 'bigint' ? { gas: toHex(params.gas) } : {}),
  }
}

export function readWalletTransactionHash(value: unknown): Hex {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('Wallet provider returned an invalid transaction hash.')
  }
  return value as Hex
}
