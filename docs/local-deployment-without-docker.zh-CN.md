# Kuest Prediction Market 纯本机部署教程（Windows，无 Docker）

本文介绍如何在 Windows 上不使用 Docker，直接使用本机 PostgreSQL、Node.js 和 pnpm 运行 Kuest Prediction Market。

适用场景：

- 需要调试 Next.js、React 或 TypeScript 源码。
- 不希望安装或使用 Docker Desktop。
- 只需要本地开发和测试环境。

本文不包含生产环境高可用部署。预测市场涉及钱包、订单、链上结算和资金安全，生产环境需要额外配置 HTTPS、定时任务、对象存储、监控和密钥管理。

## 一、整体架构

纯本机运行时，服务关系如下：

```text
浏览器
  |
  | http://localhost:3000
  v
Next.js 开发服务（pnpm dev）
  |
  | localhost:5432
  v
PostgreSQL 17
  |
  +-- Kuest CLOB / Relayer
  +-- Gamma / Data API
  +-- Polygon 或 Polygon Amoy RPC
  +-- Supabase Storage 或 S3（上传资源时需要）
```

本项目代码声明的版本：

```text
Node.js: 24.x
pnpm: 11.18.0
PostgreSQL: 17
```

## 二、安装基础软件

### 2.1 安装 Node.js 24

项目根目录的 `.nvmrc` 当前指定为 `24.16.0`。推荐安装 nvm-windows，然后执行：

```powershell
nvm install 24.16.0
nvm use 24.16.0
node --version
```

确认输出为 `v24.x`，不要使用 Node.js 22 或更低版本作为长期运行环境。

如果不使用 nvm，可以直接安装 Node.js 24 LTS/Current 版本：

<https://nodejs.org/>

### 2.2 安装 pnpm 11

项目的 `package.json` 指定了 pnpm 版本。优先使用 Corepack：

```powershell
corepack enable
corepack prepare pnpm@11.18.0 --activate
pnpm --version
```

如果 Corepack 在 Windows 上出现权限错误，可以用管理员 PowerShell，或者直接安装：

```powershell
npm install --global pnpm@11.18.0
pnpm --version
```

### 2.3 安装 PostgreSQL 17

从 PostgreSQL 官方网站下载安装包：

<https://www.postgresql.org/download/windows/>

安装时建议保留以下组件：

- PostgreSQL Server
- pgAdmin 4
- Command Line Tools

安装过程中设置数据库超级用户 `postgres` 的密码。请记住这个密码，后续创建数据库和排查连接问题会用到。

建议使用默认端口：

```text
5432
```

安装完成后，确认 PostgreSQL 服务正在运行：

```powershell
Get-Service *postgres*
```

如果服务已安装但未运行，可以在“服务”管理器中启动 PostgreSQL 服务。

## 三、创建本地数据库

下面提供两种方式。选择其中一种即可。

### 3.1 使用 SQL Shell 或 psql

打开 PowerShell，使用 `postgres` 管理员账户连接：

```powershell
psql -U postgres -h localhost -p 5432
```

如果系统提示找不到 `psql`，使用 PostgreSQL 安装目录中的完整路径。典型路径如下：

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -p 5432
```

在 `psql` 中执行以下 SQL。示例使用数据库用户 `kuest`、数据库 `kuest` 和密码 `change-this-password`，请替换为自己的强密码：

```sql
CREATE USER kuest WITH PASSWORD 'change-this-password';
CREATE DATABASE kuest OWNER kuest;
GRANT ALL PRIVILEGES ON DATABASE kuest TO kuest;
```

退出：

```sql
\q
```

如果用户或数据库已经存在，重复执行会报错，可以忽略，或者使用 pgAdmin 检查现有配置。

### 3.2 使用 pgAdmin 4

1. 打开 pgAdmin 4。
2. 连接本地 PostgreSQL Server。
3. 右键 `Login/Group Roles`，创建用户 `kuest`。
4. 为用户设置密码，并允许登录。
5. 右键 `Databases`，创建数据库 `kuest`。
6. 将数据库 Owner 设置为 `kuest`。

最后确认以下连接参数：

```text
主机：localhost
端口：5432
数据库：kuest
用户：kuest
密码：你创建的密码
```

## 四、获取项目代码并安装依赖

如果代码还没有下载：

```powershell
cd F:\code
git clone <项目仓库地址> prediction-market
```

如果代码已经存在：

```powershell
cd F:\code\prediction-market
```

确认当前 Node 和 pnpm：

```powershell
node --version
pnpm --version
```

安装依赖：

```powershell
pnpm install --frozen-lockfile
```

如果安装过程中出现网络或权限问题，先确认：

- Node.js 版本为 24.x。
- pnpm 版本为 11.18.0。
- PowerShell 可以访问 npm registry。
- 项目目录没有被杀毒软件锁定。

## 五、配置 `.env`

在项目根目录创建环境变量文件：

```powershell
cd F:\code\prediction-market
Copy-Item .env.example .env
```

编辑：

```text
F:\code\prediction-market\.env
```

纯本机运行必须使用 `localhost` 连接数据库，不能使用 Docker 的 `postgres` 主机名。

### 5.1 最小本地配置

```dotenv
# Kuest 平台凭证
KUEST_ADDRESS="你的 Polygon 钱包地址"
KUEST_API_KEY="你的 Kuest API Key"
KUEST_API_SECRET="你的 Kuest API Secret"
KUEST_PASSPHRASE="你的 Kuest Passphrase"

# 管理员钱包地址，多个地址用英文逗号分隔
ADMIN_WALLETS="你的管理员钱包地址"

# 必须设置；Next.js 会用它生成登录域名、回调地址和 canonical URL
SITE_URL="http://localhost:3000"

# Reown 钱包连接项目 ID
REOWN_APPKIT_PROJECT_ID="你的 Reown Project ID"

# 生成随机值，不要使用示例字符串
BETTER_AUTH_SECRET="至少32字符的随机字符串"
CRON_SECRET="至少16字符的随机字符串"

# 本机 PostgreSQL
POSTGRES_URL="postgres://kuest:你的数据库密码@localhost:5432/kuest"

# Polygon Amoy 测试网
CHAIN_ID="80002"
POLYGON_RPC_URL="https://rpc-amoy.polygon.technology"

# 本地调试阶段可以关闭图片优化
DISABLE_IMAGE_OPTIMIZATION="true"

# 不使用 Supabase 时保持为空；如果使用 S3，则按下面的 S3 配置方式填写
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

### 5.2 生成安全密钥

使用 Node.js 生成随机密钥：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

执行两次，分别填入：

```dotenv
BETTER_AUTH_SECRET="..."
CRON_SECRET="..."
```

不要频繁修改 `BETTER_AUTH_SECRET`。修改后，已有登录会话和加密的用户交易凭证可能失效。

### 5.3 Kuest 凭证是否必需

这些值不是本地生成的，需要通过 Kuest 的授权流程获取：

<https://auth.kuest.com>

通常需要使用 Polygon EVM 钱包连接并授权。没有这些凭证时，项目可能仍能启动并显示部分页面，但以下功能可能不可用：

- Kuest CLOB 交易
- 下单和撤单
- Relayer 操作
- 余额或存款相关流程
- 部分平台级交易接口

不要把钱包私钥填到 `KUEST_API_SECRET` 或 `KUEST_PASSPHRASE` 中。

### 5.4 Reown Project ID

钱包连接使用 Reown AppKit。访问以下地址创建项目：

<https://dashboard.reown.com/>

将项目 ID 填入：

```dotenv
REOWN_APPKIT_PROJECT_ID="..."
```

## 六、执行数据库迁移

在项目根目录执行：

```powershell
cd F:\code\prediction-market
pnpm db:push
```

迁移脚本会：

1. 连接 `POSTGRES_URL` 指定的数据库。
2. 创建 `migrations` 追踪表。
3. 执行 `src/lib/db/migrations/` 下尚未执行的 SQL 文件。
4. 记录已执行的 migration 版本。

成功时应看到类似输出：

```text
Connecting to database...
Connected to database successfully
Found 57 migration files
All migrations applied successfully
```

如果显示：

```text
Skipping db:push because required env vars are missing
```

说明当前 PowerShell 或项目没有读取到 `POSTGRES_URL`。检查 `.env` 文件位置和内容。

可以先检查 `.env` 中是否存在该变量：

```powershell
Get-Content .env | Select-String "POSTGRES_URL"
```

不要把数据库密码输出到公开日志或提交到 Git。

## 七、启动开发服务

迁移成功后启动 Next.js 开发服务：

```powershell
pnpm dev
```

正常情况下终端会显示本地地址：

```text
http://localhost:3000
```

浏览器打开：

<http://localhost:3000>

停止服务：

```text
Ctrl + C
```

开发模式支持修改代码后自动刷新。

## 八、验证数据库和应用

### 8.1 验证 PostgreSQL 端口

```powershell
Test-NetConnection localhost -Port 5432
```

成功时应看到：

```text
TcpTestSucceeded : True
```

### 8.2 验证应用端口

```powershell
Test-NetConnection localhost -Port 3000
```

### 8.3 验证首页

```powershell
Invoke-WebRequest http://localhost:3000
```

### 8.4 查看数据库表

```powershell
psql -U kuest -h localhost -p 5432 -d kuest
```

在 `psql` 中执行：

```sql
\dt
```

如果迁移成功，应能看到用户、市场、订单、任务等相关表。

## 九、同步市场数据

纯本机 PostgreSQL 模式不会自动创建 Supabase pg_cron 调度任务。首次启动后，需要手动调用同步接口，或者在 Windows 任务计划程序中配置定时任务。

### 9.1 手动同步市场

PowerShell：

```powershell
$headers = @{
  Authorization = "Bearer 你的CRON_SECRET"
}

Invoke-WebRequest `
  -Uri "http://localhost:3000/api/sync/events" `
  -Headers $headers `
  -Method GET
```

### 9.2 手动同步解析结果

```powershell
Invoke-WebRequest `
  -Uri "http://localhost:3000/api/sync/resolution" `
  -Headers $headers `
  -Method GET
```

### 9.3 手动同步体育比分

```powershell
Invoke-WebRequest `
  -Uri "http://localhost:3000/api/sync/sports-scores" `
  -Headers $headers `
  -Method GET
```

### 9.4 配置 Windows 任务计划程序

可以使用 Windows 任务计划程序周期性执行 PowerShell 脚本。

创建脚本文件：

```text
F:\code\prediction-market\scripts\local-sync-events.ps1
```

内容：

```powershell
$cronSecret = "你的CRON_SECRET"
$headers = @{ Authorization = "Bearer $cronSecret" }

Invoke-WebRequest `
  -Uri "http://localhost:3000/api/sync/events" `
  -Headers $headers `
  -Method GET
```

然后在“任务计划程序”中：

1. 创建基本任务。
2. 设置每 10 分钟或每小时执行。
3. 程序填写 `powershell.exe`。
4. 参数填写：

```text
-ExecutionPolicy Bypass -File "F:\code\prediction-market\scripts\local-sync-events.ps1"
```

本地开发不需要一开始就配置所有同步任务，建议先手动验证 `/api/sync/events`。

## 十、对象存储配置

只查看页面时，可以暂时不配置对象存储。如果需要管理员上传 Logo、市场图片或其他资源，需要配置 Supabase Storage 或 S3 兼容服务。

### 10.1 Supabase 模式

```dotenv
SUPABASE_URL="https://你的项目.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="你的 service role key"
```

两个变量必须同时设置，不能只设置其中一个。

### 10.2 S3 模式

```dotenv
S3_BUCKET="kuest-assets"
S3_ENDPOINT="https://你的S3服务地址"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID="你的访问密钥"
S3_SECRET_ACCESS_KEY="你的私密密钥"
S3_PUBLIC_URL="https://你的公开资源地址"
S3_FORCE_PATH_STYLE="true"
```

Supabase 和 S3 不要同时配置，否则项目会优先使用 Supabase 模式。

## 十一、生产模式本地测试

确认开发模式正常后，可以测试 production build：

```powershell
pnpm build
pnpm start
```

访问：

<http://localhost:3000>

停止 production 服务：

```text
Ctrl + C
```

如果 `pnpm build` 报错，优先检查：

- Node.js 是否为 24.x。
- `.env` 是否包含 `SITE_URL`、`POSTGRES_URL` 和 `REOWN_APPKIT_PROJECT_ID`。
- 数据库是否已完成 `pnpm db:push`。
- 外部 API 是否可以访问。
- 图片远程域名是否配置正确。

## 十二、常见问题

### 12.1 `SITE_URL is required`

在项目根目录 `.env` 中添加：

```dotenv
SITE_URL=http://localhost:3000
```

如果使用 PowerShell 临时设置：

```powershell
$env:SITE_URL = "http://localhost:3000"
pnpm dev
```

### 12.2 `POSTGRES_URL is not set`

确认使用的是本机数据库地址：

```dotenv
POSTGRES_URL="postgres://kuest:密码@localhost:5432/kuest"
```

纯本机部署不要写成：

```dotenv
POSTGRES_URL="postgres://kuest:密码@postgres:5432/kuest"
```

`postgres` 只适用于 Docker Compose 中的服务名。

### 12.3 `password authentication failed for user kuest`

检查：

1. PostgreSQL 服务是否运行。
2. 用户名是否为 `kuest`。
3. 数据库密码是否与创建用户时一致。
4. `.env` 中密码是否包含特殊字符。

如果密码中包含 `@`、`#`、`:`、`/` 等字符，需要进行 URL 编码，或者本地开发阶段先使用不含这些特殊字符的强密码。

### 12.4 `database "kuest" does not exist`

使用 `postgres` 管理员账户创建数据库：

```sql
CREATE DATABASE kuest OWNER kuest;
```

### 12.5 `pnpm` 找不到或版本不对

```powershell
npm install --global pnpm@11.18.0
pnpm --version
```

### 12.6 页面可以打开但没有市场

检查：

1. 是否执行 `pnpm db:push`。
2. 是否调用 `/api/sync/events`。
3. `CRON_SECRET` 是否正确。
4. Kuest Data/Gamma API 是否可访问。
5. RPC 是否可访问。

### 12.7 钱包可以连接但不能交易

通常需要检查：

- `REOWN_APPKIT_PROJECT_ID` 是否正确。
- `CHAIN_ID` 是否与钱包网络一致。
- `POLYGON_RPC_URL` 是否可用。
- Kuest API 凭证是否已经申请并填写。
- 钱包是否切换到 Polygon Amoy。
- 测试钱包是否有 Amoy 测试币。

## 十三、推荐启动顺序

每次本地启动可按以下顺序执行：

```powershell
cd F:\code\prediction-market

# 确认版本
node --version
pnpm --version

# 确认 PostgreSQL 正在运行
Test-NetConnection localhost -Port 5432

# 如果依赖尚未安装
pnpm install --frozen-lockfile

# 数据库迁移；已有迁移会自动跳过
pnpm db:push

# 启动开发服务器
pnpm dev
```

浏览器访问：

<http://localhost:3000>

## 十四、安全注意事项

- `.env` 含有 API 密钥、数据库密码和认证密钥，不要提交到 Git。
- 不要将钱包私钥填入 Kuest API 配置项。
- 不要在主网使用本地测试配置进行真实交易。
- 不要把 PostgreSQL 5432 端口暴露到公网。
- 不要在聊天、截图或日志中公开 `KUEST_API_SECRET`、`KUEST_PASSPHRASE`、`BETTER_AUTH_SECRET` 和 `CRON_SECRET`。
- 正式部署前，应补充 HTTPS、外部定时任务、对象存储、备份、监控和访问控制。

