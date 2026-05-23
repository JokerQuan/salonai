# 第 0 天 0B 工程基线设计

## 目标

在 0A 脚手架之后，完成 SalonAI 最小可运行工程基线。

0B 要证明 Web、API、CLI、共享类型、Prisma、OpenAPI、Orval、HTTP 调试脚本和本地基础设施能通过一条 health check 链路连起来。0B 不实现业务 Agent 能力。

## 范围

包含：

- 根目录 workspace scripts：安装、开发、构建、测试、lint、格式化、Prisma migration、API client 生成。
- NestJS API health endpoint。
- Swagger / OpenAPI 文档生成。
- Vite React health 状态页。
- Vite 本地开发代理：`/api/*` 转发到本地 API 服务。
- 基于 Commander 的 CLI health 命令。
- `packages/shared` 中的 health schema 和 TypeScript 类型。
- Orval 配置，生成目标为 `packages/api-client`。
- 最小 Prisma schema 和 migration 链路。
- 本地 Docker Compose 服务：PostgreSQL、Redis、Milvus、Langfuse。
- `docs/http/health.http` 手动验证脚本。

不包含：

- Model Gateway。
- SSE streaming。
- Agent Runtime。
- Tool Registry。
- RAG 文档处理或检索。
- 鉴权和租户。
- 生产部署加固。
- API 面向浏览器的跨域访问。

## 架构

API 是后端边界。它提供 `GET /health` 和 Swagger JSON。Web 使用相对 API 路径，本地开发时由 Vite proxy 转发浏览器请求。CLI 直接访问 API URL，因为 CLI 不受浏览器 CORS 限制。

`packages/shared` 负责 health response 契约。API、Web、CLI 都复用同一个响应结构，避免 Day 1 继续堆手写重复类型。

`packages/api-client` 由 Orval 根据 OpenAPI 生成。0B 只需要证明生成链路可用；Web 可以先使用一个小的 direct fetch 调 health，后续再把稳定 REST API 切到生成 client / Query hooks。

## 本地请求模型

0B 中 API 不启用 CORS。

浏览器本地请求走同源开发代理：

```text
Browser -> http://localhost:5173/api/health -> Vite proxy -> http://localhost:3000/health
```

CLI 和 HTTP 脚本直接请求 API：

```text
CLI  -> http://localhost:3000/health
HTTP -> http://localhost:3000/health
```

未来生产部署优先走同源反向代理，例如 `/api/* -> api:3000`。如果未来确实需要浏览器跨域访问，必须通过显式 allowlist 开启 CORS，并且默认关闭。

## 组件设计

### 根 workspace

根目录 `package.json` 协调 workspace 命令：

- `dev` 同时启动 API 和 Web。
- `build` 构建 workspace packages 和 apps。
- `test` 运行可用测试。
- `lint` 运行 lint 检查。
- `format` 执行 Prettier。
- `db:migrate` 执行 Prisma migration。
- `api:generate` 生成 `packages/api-client`。

### API

`apps/api` 保留 NestJS scaffold，并新增：

- `GET /health`。
- Swagger setup。
- 稳定 OpenAPI JSON 地址。
- 不写 `app.enableCors()`。

health response 包含：

- `status: "ok"`。
- `service: "salonai-api"`。
- `timestamp`，请求时生成。
- `version`，来自稳定应用常量或 package version。

### Web

`apps/web` 替换 Vite 初始页面，改成简单的 API health 状态页。

页面只展示：

- API 状态。
- service 名称。
- timestamp。
- loading 和 error 状态。

Vite dev server 将 `/api` 代理到 `http://localhost:3000`。

### CLI

`apps/cli` 使用 Commander。

第一个命令是：

```bash
salonai health
```

它读取 `SALONAI_API_URL`，默认值为 `http://localhost:3000`，调用 `/health`，并输出简洁状态行。

### Shared Package

`packages/shared` 提供：

- health response 的 zod schema。
- 从 schema 推导出的 TypeScript type。

API 可以使用该类型，Web / CLI 可以在展示前校验运行时响应。

### Prisma

0B 使用 PostgreSQL 初始化 Prisma 和最小 schema。schema 的目的只是证明 migration 和 client generation 链路可用。业务表从后续模块开始增加。

### Docker Compose

`infra/docker-compose.yml` 定义本地服务：

- PostgreSQL。
- Redis。
- Milvus。
- Langfuse 以及 Langfuse 必需的依赖服务。

根目录 Docker 命令可以指向该 compose 文件；如果日常使用更顺手，也可以增加根目录 `docker-compose.yml` 作为入口。

## 错误处理

API health 只要 API 进程存活，就返回正常 JSON。0B 不要求 health 检查每一个依赖服务。

Web 展示三种状态：

- 请求中的 loading。
- 响应校验通过后的 healthy。
- fetch 失败或响应校验失败后的 unavailable。

CLI 成功获取并校验 health response 时退出码为 `0`；API 不可用或响应无效时退出码为 `1`。

## 测试和验收

0B 完成后必须用新命令验证：

```bash
pnpm install
pnpm test
pnpm dev
pnpm db:migrate
pnpm api:generate
docker compose up
```

额外手动检查：

- 打开 Web，确认通过 Vite proxy 获取 API health 成功。
- 运行 `salonai health` 或等价 package script，确认 CLI 能获取 API health。
- 使用 HTTP client 运行 `docs/http/health.http`，确认 API health 成功。
- 打开 Swagger，确认 `/health` 出现在 API 文档中。

## 提交策略

阶段任务完成前不单独提交设计记录。0B 完成并验证后，统一提交本阶段改动。

0B 内部实施时仍按小步推进：

1. 根 workspace 和 shared package 基线。
2. API health 和 Swagger。
3. Web 和 CLI health。
4. Prisma、Orval、Docker Compose 和 HTTP 脚本。

每一步都要保持当前触达的链路可验证。
