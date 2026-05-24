# Day 1 面试表达：Model Gateway

## 为什么需要模型网关

模型网关把业务代码和具体模型 provider 解耦。业务侧只提交 `messages`、`temperature`、`maxOutputTokens`，网关负责选择模型配置、调用 provider、记录 token、成本、延迟和 trace。

## Day 1 做到了什么

Day 1 先实现非流式 completion 主链路：NestJS 暴露 `/model-gateway/completions`，默认使用根目录 `.env` 中的 OpenAI-compatible 配置发起真实模型调用，并把成功或失败都写入 `ModelCall`。

同时保留 deterministic mock provider，用于单测和兜底验证，但真实验收走 `OPENAI_COMPATIBLE`。

## 多模型 fallback 怎么设计

当前已经有 provider 抽象和 `ModelConfig.priority`。后续 fallback 可以在同一个抽象上扩展：当主 provider 抛出可重试错误时，按优先级选择下一个 enabled config，并把每一次尝试写入 `ModelCall`。

## 成本如何统计

provider 优先读取真实 usage；没有 usage 时使用保守 token 估算。成本按 `inputTokenPriceUsdPer1K` 和 `outputTokenPriceUsdPer1K` 计算，并随 `ModelCall` 保存，后续可按用户、租户、模型配置聚合。

## 为什么接 Langfuse

业务数据库保存稳定的审计与成本字段，Langfuse 保存 LLM 调用链路细节，包括 trace、generation、input、output 和 usage。这样既能满足产品侧统计，也能满足调试和 LLMOps 观察。

## 为什么前端用生成 hooks

NestJS 通过 Swagger 生成 OpenAPI，Orval 再生成 TanStack Query hooks。Web 不手写常规 REST fetch，接口字段变化会在 TypeScript 编译阶段暴露，减少前后端胶水代码的长期维护成本。
