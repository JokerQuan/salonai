# 第 0 天面试沉淀：工程基线

## 一句话介绍

第 0 天完成的是 SalonAI 的工程地基：用 pnpm workspace 管理 TypeScript 全栈项目，用 NestJS 承载 API，用 React/Vite 承载 Web，用 Commander 承载 CLI，用 Prisma 管理数据库迁移，用 OpenAPI/Orval 建立类型安全联调链路，并用 Docker Compose 启动本地依赖。

## 为什么选 TypeScript 全栈

SalonAI 的核心复杂度不只在模型调用，而在 Agent Runtime、工具协议、上下文构建、RAG、评测和前后端联调。TypeScript 全栈可以让 schema、类型、工具定义和 API 契约在 Web、API、CLI、共享包之间复用，减少重复定义和跨语言转换成本。

对这个项目来说，TypeScript 的优势是反馈快：接口字段变更可以在编译阶段暴露，CLI 和 Web 可以共享同一套 health 契约，后续 Agent 工具 schema 也能复用到前端调试面板和服务端执行器。

## 为什么选 NestJS 而不是 Express

Express 足够轻，但 SalonAI 后续会有 Model Gateway、Conversation、Tool Registry、Agent Runtime、Knowledge、Memory、Eval、Security、Observability 等模块。NestJS 的模块、Provider、依赖注入和测试结构更适合把这些能力拆成清晰边界。

我选择 NestJS 是为了让项目从第一天就具备可扩展的工程骨架，而不是在业务复杂起来之后再补模块化。第 0 天只暴露了 `/health` 和 OpenAPI，但目录和启动方式已经为后续模块预留好了位置。

## 为什么选 Prisma

Prisma 负责数据库 schema、migration 和类型生成，适合在 42 天项目里快速建立可维护的数据模型。Agent 工程里会出现大量结构化记录，例如 model call、tool call、agent run、eval result、audit log，如果没有明确 schema，很容易变成难以追踪的日志堆。

第 0 天只做最小 schema 和迁移，目的不是提前设计完所有表，而是先证明 PostgreSQL、Prisma CLI、migration 路径和本地环境能跑通。后续每个业务模块再增量扩展数据模型。

## 为什么 LLMOps 不从零手写

SalonAI 的目标是展示 Agent 工程能力，而不是把时间消耗在自研完整观测平台上。Langfuse 已经提供 trace、generation、prompt、score、dataset 等 LLMOps 基础能力，可以把时间集中到业务 Agent、工具调用、RAG、评测和安全上。

平台内部仍会保留业务侧的 AgentRun、AgentStep、ToolCall、AuditLog、EvalResult 等数据，用来支撑权限、安全和产品体验；Langfuse 则负责模型调用观测和评测链路展示。

## 为什么用 OpenAPI / Orval 做类型安全联调

前后端常规 REST API 不手写请求胶水，而是由 NestJS Swagger 生成 OpenAPI，再用 Orval 生成 `packages/api-client`。这样接口字段变更会进入类型系统，Web 端后续可以直接使用生成 client 或 TanStack Query hooks。

第 0 天已经验证了 `/openapi.json` 和 `pnpm api:generate` 链路。后续新增 REST API 时，流程应该是先补 DTO 和 Swagger 描述，再生成 client，让联调文档和前端类型同步更新。

## 第 0 天可以怎么讲

我先搭了一个最小但完整的工程闭环：Web 通过 Vite proxy 调 NestJS `/health`，CLI 也能请求同一个 health endpoint；API 通过 Swagger 暴露 OpenAPI，Orval 根据 OpenAPI 生成前端 client；Prisma 连接本地 PostgreSQL 并能执行 migration；Docker Compose 启动 PostgreSQL、Redis、Milvus 和 Langfuse。这样后续每天新增 Agent 能力时，都能落到同一个工程基线上验证。
