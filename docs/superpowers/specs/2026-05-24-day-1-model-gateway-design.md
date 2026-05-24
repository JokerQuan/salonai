# Day 1 Model Gateway Design

## 目标

Day1 实现 SalonAI 的 NestJS Model Gateway。真实 OpenAI-compatible provider 是主路径，mock provider 是测试和兜底路径。

Day1 完成时，API 必须能通过根目录 `.env` 中的真实模型配置完成一次非流式模型调用，并且 Langfuse 里能看到对应 generation。mock provider 不替代真实验收，只用于单测、无密钥本地调试和故障定位。

## 范围

包含：

- `ModelGatewayModule`。
- `ModelGatewayController`。
- `ModelGatewayService`。
- `ModelProviderService`。
- OpenAI-compatible provider。
- Mock provider。
- `ModelConfig` Prisma 模型。
- `ModelCall` Prisma 模型。
- token、latency、cost estimate 记录。
- Langfuse trace / generation 接入。
- Swagger / OpenAPI DTO。
- Orval 生成 Web 可用的 React Query hooks。
- Web 端非流式模型调用面板。
- `docs/http/model-gateway.http` 调试脚本。
- Day1 bad case 和面试表达文档。

不包含：

- SSE streaming。
- 多模型 fallback 执行链。
- Prompt 版本管理。
- Conversation / Message 持久化。
- Agent Runtime。
- Tool Registry。
- 租户和鉴权。
- 成本 dashboard。

## 已确认决策

### 真实 provider 是默认主路径

如果数据库里没有 enabled `ModelConfig`，API 启动后的首次模型调用会优先基于根目录 `.env` 创建 `OPENAI_COMPATIBLE` 配置。mock config 不作为默认 enabled 主配置。

Day1 验收必须用真实 provider 跑通：

1. API 返回真实模型结果。
2. `ModelCall` 写入成功日志。
3. Langfuse 能看到 generation。
4. Web 能通过生成 hooks 调用非流式接口。

### 根目录 `.env` 是环境入口

环境变量统一放在项目根目录 `.env`。API 通过配置模块显式读取根目录 `.env`。Day1 不要求 `apps/api/.env`，也不把它作为默认配置位置。

需要的变量：

```env
OPENAI_COMPATIBLE_BASE_URL=
OPENAI_COMPATIBLE_MODEL=
OPENAI_COMPATIBLE_API_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_BASE_URL=
```

`.env.example` 提交变量名和示例，不提交真实密钥。

### Langfuse 优先承载 LLMOps

平台内部只保存业务必要记录：模型配置、模型调用日志、token、cost、latency、Langfuse id 和错误信息。

完整 generation 详情由 Langfuse 承载，包括 model、input messages、output text、usage 和 metadata。这样符合全文设计里的原则：LLMOps 不从零造大平台。

## 架构

```text
Web
  -> Orval React Query hook
  -> POST /api/model-gateway/completions
  -> Vite proxy
  -> NestJS ModelGatewayController
  -> ModelGatewayService
  -> ModelProviderService
  -> OpenAiCompatibleProvider
  -> OpenAI-compatible /chat/completions

ModelGatewayService
  -> Prisma ModelConfig
  -> Prisma ModelCall
  -> Langfuse trace / generation
```

API 内部分层：

- `ModelGatewayController`：HTTP、DTO、Swagger/OpenAPI。
- `ModelGatewayService`：模型配置选择、provider 调用编排、latency/token/cost 统计、`ModelCall` 写入、Langfuse generation。
- `ModelProviderService`：根据 `ModelProviderKind` 返回 provider。
- `OpenAiCompatibleProvider`：读取根目录 `.env` 暴露的配置，调用 OpenAI-compatible chat completions API。
- `MockModelProvider`：返回 deterministic response，服务单测和无密钥调试。

## 数据模型

### ModelConfig

`ModelConfig` 保存可调用模型配置：

- `id`
- `name`
- `providerKind`
- `model`
- `baseUrl`
- `apiKeyEnvName`
- `enabled`
- `priority`
- `inputTokenPriceUsdPer1K`
- `outputTokenPriceUsdPer1K`
- `createdAt`
- `updatedAt`

Day1 暂不实现多模型 fallback 链，但保留 `priority`，为后续 fallback、成本路由和模型灰度做准备。

### ModelCall

`ModelCall` 记录每次模型调用：

- `id`
- `modelConfigId`
- `tenantId`
- `userId`
- `providerKind`
- `model`
- `status`
- `inputTokens`
- `outputTokens`
- `totalTokens`
- `costUsd`
- `latencyMs`
- `langfuseTraceId`
- `langfuseGenerationId`
- `errorCode`
- `errorMessage`
- `metadata`
- `createdAt`

Day1 可以先让 `tenantId` 和 `userId` 为空，后续 Day29 多租户和鉴权再接入。

## API 设计

### GET /model-gateway/configs

返回 enabled 模型配置摘要，用于 Web 展示当前 provider/model，也用于 HTTP 调试确认真实 provider 是否启用。

响应字段：

- `id`
- `name`
- `providerKind`
- `model`
- `enabled`

### POST /model-gateway/completions

创建一次非流式模型调用。

请求字段：

- `modelConfigId?`
- `messages`
- `temperature`
- `maxOutputTokens`
- `traceName`
- `metadata?`

响应字段：

- `id`
- `modelCallId`
- `providerKind`
- `model`
- `outputText`
- `usage.inputTokens`
- `usage.outputTokens`
- `usage.totalTokens`
- `costEstimate.inputUsd`
- `costEstimate.outputUsd`
- `costEstimate.totalUsd`
- `latencyMs`
- `langfuseTraceId`
- `langfuseGenerationId`
- `createdAt`

Day1 只实现非流式接口。Day2 的 SSE streaming 不复用这个 REST 响应形态。

## 错误处理

如果真实 provider 缺少 base URL、model、API key，或 provider 返回非 2xx：

1. API 返回 502。
2. `ModelCall` 写入 `status=ERROR`。
3. `errorCode` 使用稳定机器可读值，例如 `missing_api_key`、`missing_base_url`、`provider_http_error`。
4. `errorMessage` 保存可排查原因。
5. Langfuse generation 如果已经创建，需要结束并记录错误输出。

这些错误不算 Day1 验收通过，但必须可观测、可复盘。

## Web 设计

Web 在 Day0 health panel 基础上增加 Model Gateway 面板：

- 展示当前 enabled provider/model。
- 输入 prompt。
- 通过 Orval 生成的 React Query mutation hook 调用 `POST /model-gateway/completions`。
- 展示 `outputText`、model、latency、token、cost。

常规 REST API 使用 Orval 生成 hooks。SSE、文件上传进度、CLI streaming 等协议型接口留到后续手写 client。

## 测试策略

### 自动化测试

- shared：schema、token 估算、cost 计算。
- mock provider：deterministic output 和 usage。
- OpenAI-compatible provider：使用 mock fetch 验证 URL、headers、body、usage 映射和错误处理，不在单测里打真实 API。
- service：成功时写入 `ModelCall(SUCCESS)`，失败时写入 `ModelCall(ERROR)`。
- controller：验证 controller 调 service，DTO 能进入 OpenAPI。
- build/typecheck：确保 Web、API、shared、api-client 编译通过。

### 手动验收

必须完成：

1. 根目录 `.env` 已包含真实 `OPENAI_COMPATIBLE_*` 和 `LANGFUSE_*`。
2. `pnpm db:migrate` 成功。
3. `pnpm --filter api start:dev` 成功。
4. `docs/http/model-gateway.http` 的真实调用请求返回真实模型输出。
5. 数据库 `ModelCall` 有 `SUCCESS` 记录，且 token、latency、cost 字段非空。
6. Langfuse 页面能看到对应 trace/generation。
7. `pnpm api:generate` 后，Web 使用生成 hook 调用成功。
8. Web 页面展示真实模型输出、model、latency、token、cost。

## 文档沉淀

- `docs/http/model-gateway.http`：真实模型调用和 config 查询脚本。
- `docs/badcases/day-1.md`：记录缺少 API key、provider 失败或 Langfuse 未显示 generation 的排查过程。
- `docs/interview/day-1-model-gateway.md`：回答为什么需要模型网关、provider 为什么抽象、成本如何统计、fallback 怎么演进。

## 后续演进

Day2 在此基础上增加 SSE streaming。Day3 增加 Prompt 版本和结构化输出。Day5 把业务 trace 和 Langfuse 链接整理到 trace 页面。Day13 基于 `ModelCall` 继续做限流、缓存和成本统计。
