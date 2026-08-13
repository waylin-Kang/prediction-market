# Kuest Prediction Market 本地部署教程

本文适用于 Windows 环境，介绍如何在本地启动 Kuest Prediction Market。项目自带 Docker 部署文件，推荐优先使用 Docker；如果需要调试 Next.js 代码，也可以使用 Node.js + pnpm 运行。

## 1. 项目组成

本项目不是纯前端项目，本地运行至少涉及以下组件：

- Next.js Web 服务，默认端口 `3000`
- PostgreSQL 17 数据库
- 数据库 migration，共 57 个 SQL 文件
- Kuest CLOB、Relayer、Gamma、Data API 等外部服务
- Polygon 或 Polygon Amoy 链上 RPC
- Supabase Storage 或 S3 兼容对象存储（上传图片时需要）

本地开发建议使用 Polygon Amoy 测试网，避免直接使用真实资金。

## 2. 环境要求

项目版本要求以 `package.json` 和 `.nvmrc` 为准：

```text
Node.js: 24.x
pnpm: 11.18.0
PostgreSQL: 17
Docker Desktop: 支持 Docker Compose
```

检查 Docker：

```powershell
docker --version
docker compose version
```

如果 `docker compose version` 不可用，请先升级 Docker Desktop。

## 3. 创建环境变量文件

在项目根目录执行：

```powershell
cd F:\code\prediction-market
Copy-Item .env.example .env
```

生成随机密钥。下面命令执行两次，分别用于 `BETTER_AUTH_SECRET` 和 `CRON_SECRET`：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

编辑项目根目录下的 `.env`：

```dotenv
# Kuest CLOB 凭证
KUEST_ADDRESS="你的 Polygon 钱包地址"
KUEST_API_KEY="你的 Kuest API Key"
KUEST_API_SECRET="你的 Kuest API Secret"
KUEST_PASSPHRASE="你的 Kuest Passphrase"

# 管理员钱包；多个地址使用英文逗号分隔
ADMIN_WALLETS="你的管理员钱包地址"

# Docker 容器映射出的本地地址
SITE_URL="http://localhost:3000"

# Reown AppKit 项目 ID
REOWN_APPKIT_PROJECT_ID="你的 Reown Project ID"

# 随机生成，建议至少 32 个字符
BETTER_AUTH_SECRET="随机生成的密钥"
CRON_SECRET="随机生成的密钥"

# PostgreSQL 容器配置
POSTGRES_DB="kuest"
POSTGRES_USER="kuest"
POSTGRES_PASSWORD="本地数据库密码"

# Docker 中 Web 容器访问数据库时，主机名必须是 postgres
POSTGRES_URL="postgres://kuest:本地数据库密码@postgres:5432/kuest"

# Polygon Amoy 测试网
CHAIN_ID="80002"
POLYGON_RPC_URL="https://rpc-amoy.polygon.technology"

# 本地暂不使用图片对象存储时可开启
DISABLE_IMAGE_OPTIMIZATION="true"

# Supabase 和 S3 二选一；只测试页面时可以暂时留空
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
S3_BUCKET=""
S3_ENDPOINT=""
S3_REGION=""
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_PUBLIC_URL=""
S3_FORCE_PATH_STYLE="true"
```

### 3.1 获取 Kuest 凭证

项目的 `.env.example` 要求通过 EVM 钱包连接以下地址获取 Kuest CLOB 凭证：

<https://auth.kuest.com>

没有这些凭证时，页面可能仍然可以启动，但登录、下单、交易和 Relayer 相关功能不能完整使用。

### 3.2 获取 Reown Project ID

访问：

<https://dashboard.reown.com/>

创建项目后，将 Project ID 填入 `REOWN_APPKIT_PROJECT_ID`。

## 4. Docker 方式部署（推荐）

### 4.1 启动 PostgreSQL

```powershell
cd F:\code\prediction-market
docker compose -f infra/docker/docker-compose.yml --profile local-postgres up -d postgres
```

查看状态：

```powershell
docker compose -f infra/docker/docker-compose.yml ps
```

查看数据库日志：

```powershell
docker logs -f kuest-postgres
```

看到 `database system is ready to accept connections` 后，说明数据库已准备就绪。

### 4.2 构建 Web 镜像

```powershell
docker compose -f infra/docker/docker-compose.yml build web
```

首次构建会安装依赖、执行 Next.js production build，并生成 standalone 服务，可能需要较长时间。

### 4.3 启动 Web 服务

```powershell
docker compose -f infra/docker/docker-compose.yml up -d web
```

查看日志：

```powershell
docker logs -f kuest-web
```

浏览器访问：

<http://localhost:3000>

### 4.4 执行数据库迁移

Web 容器启动后执行：

```powershell
docker compose -f infra/docker/docker-compose.yml run --rm web node scripts/migrate.ts
```

迁移脚本会连接数据库并依次执行 `src/lib/db/migrations/` 下的 SQL 文件。成功时应看到类似输出：

```text
Connected to database successfully
Found 57 migration files
All migrations applied successfully
```

迁移完成后重启 Web：

```powershell
docker compose -f infra/docker/docker-compose.yml restart web
```

## 5. 验证部署

查看容器状态：

```powershell
docker compose -f infra/docker/docker-compose.yml ps
```

检查首页响应：

```powershell
Invoke-WebRequest http://localhost:3000
```

检查 Web 日志：

```powershell
docker logs kuest-web --tail 200
```

建议按以下顺序验证：

1. 首页可以打开。
2. 钱包可以连接。
3. 管理员钱包可以进入管理页面。
4. 数据库中已经有用户和市场相关表。
5. 市场同步接口可以正常调用。
6. 使用 Amoy 测试网测试交易流程。

## 6. 本地同步市场数据

本地使用普通 PostgreSQL 时，迁移脚本不会自动创建 Supabase Cron 定时任务。因此，市场、解析、体育比分等同步任务需要手动调用或配置外部定时任务。

同步市场：

```powershell
$headers = @{
  Authorization = "Bearer 你的CRON_SECRET"
}

Invoke-WebRequest `
  -Uri "http://localhost:3000/api/sync/events" `
  -Headers $headers `
  -Method GET
```

同步解析结果：

```powershell
Invoke-WebRequest `
  -Uri "http://localhost:3000/api/sync/resolution" `
  -Headers $headers `
  -Method GET
```

同步体育比分：

```powershell
Invoke-WebRequest `
  -Uri "http://localhost:3000/api/sync/sports-scores" `
  -Headers $headers `
  -Method GET
```

生产环境可以使用 Windows 任务计划程序、Linux cron、Cloud Scheduler、Supabase pg_cron 或 Kubernetes CronJob 调用这些接口。

## 7. 纯 Node.js + pnpm 运行方式

如果需要调试 Next.js 源代码，可以不使用 Web 容器，仅使用 Docker 提供 PostgreSQL。

### 7.1 安装 Node.js 24

项目 `.nvmrc` 当前为 `24.16.0`。使用 nvm-windows 时：

```powershell
nvm install 24.16.0
nvm use 24.16.0
node --version
```

启用 pnpm：

```powershell
corepack enable
corepack prepare pnpm@11.18.0 --activate
pnpm --version
```

如果 Corepack 遇到 Windows 权限问题，可以使用管理员 PowerShell，或直接执行：

```powershell
npm install -g pnpm@11.18.0
```

### 7.2 修改本机数据库地址

本机运行 Next.js 时，`.env` 中的数据库主机名要从 `postgres` 改为 `localhost`：

```dotenv
POSTGRES_URL="postgres://kuest:本地数据库密码@localhost:5432/kuest"
```

### 7.3 安装依赖和启动

```powershell
pnpm install --frozen-lockfile
pnpm db:push
pnpm dev
```

访问：

<http://localhost:3000>

测试 production build：

```powershell
pnpm build
pnpm start
```

## 8. 常用命令

启动全部本地服务：

```powershell
docker compose -f infra/docker/docker-compose.yml --profile local-postgres up -d
```

停止服务但保留数据库数据：

```powershell
docker compose -f infra/docker/docker-compose.yml down
```

重新构建 Web：

```powershell
docker compose -f infra/docker/docker-compose.yml build --no-cache web
docker compose -f infra/docker/docker-compose.yml up -d web
```

进入数据库：

```powershell
docker exec -it kuest-postgres psql -U kuest -d kuest
```

在 `psql` 中查看数据表：

```sql
\dt
```

退出：

```sql
\q
```

## 9. 常见问题

### `POSTGRES_URL is not set`

确认 `.env` 位于项目根目录：

```text
F:\code\prediction-market\.env
```

Docker Web 容器使用：

```dotenv
POSTGRES_URL="postgres://kuest:密码@postgres:5432/kuest"
```

本机 pnpm 使用：

```dotenv
POSTGRES_URL="postgres://kuest:密码@localhost:5432/kuest"
```

### Web 无法连接 PostgreSQL

Docker 容器内不能使用 `localhost` 访问另一个容器。Docker 方式必须使用：

```dotenv
POSTGRES_URL="postgres://kuest:密码@postgres:5432/kuest"
```

### 页面能打开但没有市场数据

依次检查：

1. 是否执行了数据库迁移。
2. 是否手动调用 `/api/sync/events`。
3. `POLYGON_RPC_URL` 是否可用。
4. Kuest CLOB、Gamma、Data API 是否可以访问。
5. `CRON_SECRET` 是否与请求中的 Bearer Token 一致。

### 图片上传失败

上传资源需要配置 Supabase Storage 或 S3 兼容对象存储。只测试页面时可以暂时使用：

```dotenv
DISABLE_IMAGE_OPTIMIZATION="true"
```

### 端口被占用

检查端口：

```powershell
Get-NetTCPConnection -LocalPort 3000,5432 -ErrorAction SilentlyContinue
```

如果需要将宿主机端口改成 `3001`，修改 Compose 文件中的映射：

```yaml
ports:
  - "3001:3000"
```

然后访问 <http://localhost:3001>。

## 10. 安全注意事项

- `.env` 包含 API 密钥、数据库密码和认证密钥，不要提交到 Git。
- 不要在测试环境使用真实资金或生产私钥。
- 不要把 PostgreSQL 端口暴露到公网。
- 不要频繁修改 `BETTER_AUTH_SECRET`，否则用户会话和加密凭证会失效。
- 正式部署前，应验证订单、成交、余额、结算和同步任务的一致性。

