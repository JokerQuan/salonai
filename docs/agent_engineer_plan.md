# 全日制 Agent 工程学习计划：TypeScript + NestJS 优化版

适用状态：离职全日制学习，每天可投入 8-10 小时，并使用 coding agent 做开发实战。  
目标周期：42 天，6 周完成一个可上线、可演示、可面试深挖的 SalonAI。  
主栈选择：TypeScript 全栈、NestJS 后端、Prisma ORM、LangChain.js / LangGraph.js。  
后期增强：时间充裕时补 Python Worker，用于 PDF 深解析、复杂 rerank、离线评测或模型实验。

## 一、这版计划的优化点

相比上一版，这份计划做了四个关键优化：

1. **TypeScript 全栈化**  
   前端、后端、Agent Runtime、CLI、测试脚本统一使用 TypeScript。这样可以复用类型、schema、工具定义和校验逻辑，减少跨语言心智切换。

2. **NestJS + Prisma 工程化**  
   后端使用 NestJS 模块化组织能力：Model Gateway、Conversation、Tool Registry、Agent Runtime、RAG、Memory、Eval、Security、Audit。Prisma 负责数据库 schema、迁移和类型生成。

3. **LLMOps 不从零造大平台**  
   Trace、Prompt 版本、LLM 调用观测、评测运行记录优先接入 Langfuse。平台内部只保留必要的业务 trace、tool audit、bad case、eval case，不把 42 天浪费在完整观测系统 UI 上。

4. **Web + CLI 双端体验**  
   Web 端负责产品化体验，CLI 端负责极客体验和 AI Coding / Ops Agent 演示。同一套 Agent Runtime 同时服务 Web 和 CLI，是你作为前端工程师转 Agent 工程的亮点。

核心目标不变：深入理解 + 可落地 + 可部署上线 + 面试能讲工程。

## 二、最终交付物

42 天后你应该拥有：

1. 一个线上可访问的 SalonAI Web 应用。
2. 一个可安装或本地运行的 `salonai` CLI。
3. 三个核心业务 Agent：
   - Knowledge Agent：企业知识库 RAG。
   - Workflow Agent：多工具订单 / 客服 / 工单处理。
   - CodingOps Agent：代码诊断 + 运维日志分析。
4. 一个 NestJS Agent API 服务。
5. 一套可复用 Agent Runtime。
6. 一套 Tool Registry 和工具权限体系。
7. 一套 RAG Pipeline：解析、chunk、embedding、hybrid retrieval、rerank、引用、评测。
8. 一套 Memory 和 Context Builder。
9. 一套 LangGraph.js 工作流：checkpoint、interrupt、resume、人机确认。
10. 一套安全体系：租户隔离、工具 scope、Prompt Injection 测试、脱敏、审计。
11. 一套 Eval 回归脚本，可接入 CI。
12. Langfuse 观测：trace、span、prompt、model cost、eval run。
13. Docker Compose 本地和云端部署。
14. README、架构图、部署文档、评测报告、压测报告、面试稿。

最终表达：

> 我基于 TypeScript 全栈实现了一个 SalonAI：用 NestJS 承载 Agent API 和 Runtime，用 Prisma 管理业务数据，用 LangChain.js / LangGraph.js 实现工具调用、RAG、状态机和人机协同，用 Langfuse 做 LLMOps 观测和评测，用 Web + CLI 双端复用同一套 Agent Runtime，并部署上线。

## 三、总体架构

## 3.1 Monorepo 结构

建议使用 pnpm workspace：

```text
salonai/
  apps/
    web/                  # React + TanStack Router
    api/                  # NestJS API + Agent Runtime
    cli/                  # Node.js CLI
  packages/
    shared/               # 共享类型、zod schema、常量
    api-client/           # OpenAPI 生成的前端请求和 TanStack Query hooks
    agent-core/           # Agent Runtime、tool protocol、context builder
    rag-core/             # chunk、retrieval、rerank、eval helpers
    eval-core/            # eval case、judge、report
    eslint-config/
    tsconfig/
  prisma/
    schema.prisma
    migrations/
    seed.ts
  infra/
    docker-compose.yml
    docker-compose.prod.yml
    nginx/
  docs/
    architecture/
      snapshots/
    deployment/
    interview/
    teaching/
    badcases/
    evals/
    adr/
    http/
  scripts/
    run-evals.ts
    load-test.ts
    seed-demo-data.ts
```

设计原则：

1. `packages/shared` 放类型和 schema，前后端共用。
2. `packages/api-client` 放 OpenAPI 生成的类型安全请求函数和 TanStack Query hooks。
3. `packages/agent-core` 放不依赖 NestJS 的纯 Agent 逻辑，CLI 和 API 都能复用。
4. `apps/api` 负责 HTTP、鉴权、数据库、队列、审计、NestJS DI。
5. `apps/web` 负责产品体验和可视化。
6. `apps/cli` 负责终端交互，调用同一套 API 或直接复用 agent-core。

## 3.1.1 API 类型自动生成

为了压缩开发时间，前后端 API 不手写胶水代码。

推荐链路：

1. NestJS 使用 `@nestjs/swagger` 生成 OpenAPI。
2. DTO 使用 class-validator 或 zod-to-openapi，和 `packages/shared` 的 schema 保持一致。
3. 使用 Orval 从 OpenAPI 生成前端 client。
4. Orval 输出 TanStack Query hooks 到 `packages/api-client`。
5. Web 端稳定 REST API 全部使用生成 hooks。
6. SSE、文件上传进度、CLI streaming 这类特殊通道保留手写 client。

验收标准：

1. 新增一个 REST API 后，能通过 `pnpm api:generate` 生成前端类型和 hooks。
2. 前端不手写常规 `fetch` / `axios` 请求。
3. 接口字段变更能在 TypeScript 编译阶段暴露。
4. OpenAPI 文档可作为面试展示材料和联调文档。

## 3.2 前端技术栈

推荐：

1. React + TypeScript。
2. TanStack Router：路由状态、搜索参数、深链接。
3. TanStack Query：服务端状态、缓存、重试。
4. Zustand：对话流、本地 UI 状态、SSE session 状态。
5. shadcn/ui 或 Radix UI：快速出专业界面。
6. Monaco Editor：Prompt、JSON、代码 diff、工具 schema 展示。
7. Recharts / ECharts：成本、延迟、评测指标。
8. EventSource 或 fetch stream 封装 SSE。

核心页面：

1. Chat Workspace：通用对话和 Agent 执行。
2. Knowledge Base：文档上传、chunk、检索调试。
3. Tools：工具列表、schema、权限、调用测试。
4. Agents：Knowledge / Workflow / CodingOps 配置和运行。
5. Trace：本地业务 trace + 跳转 Langfuse。
6. Eval：eval cases、运行结果、回归趋势。
7. Admin：模型配置、租户、用户、成本、限流。
8. CLI Docs：展示 CLI 安装和使用方式。

高频流式状态建议：

1. SSE token 增量写入 Zustand，避免 Query cache 高频重渲染。
2. 完成后再同步最终消息到 TanStack Query。
3. tool_call、tool_result、approval_required、error、done 都作为 event 类型。
4. 每个 event 有 `traceId`、`runId`、`spanId`、`timestamp`。

状态分层原则：

1. 服务端状态：会话列表、历史消息、工具列表、权限、知识库、eval 结果，全部交给 TanStack Query。
2. 路由状态：当前 agent、knowledgeBaseId、traceId、evalRunId，交给 TanStack Router search params。
3. 本地瞬时状态：输入框、弹窗、展开状态、hover、临时筛选，放组件内或轻量 Zustand。
4. 高频流式状态：token buffer、stream status、当前 tool event、pending approval，放 Zustand。
5. 不用一个“大而全全局 store”管理所有业务数据，避免缓存、刷新和一致性问题混在一起。

## 3.3 后端技术栈

主栈：

1. NestJS。
2. Prisma。
3. PostgreSQL。
4. Redis。
5. Milvus。
6. LangChain.js。
7. LangGraph.js。
8. Langfuse SDK。
9. Zod：schema 校验和共享类型。
10. OpenAI / Anthropic / Gemini / 本地模型 provider 抽象。

NestJS 模块划分：

1. `AuthModule`：用户、租户、角色。
2. `ModelGatewayModule`：统一模型调用、provider、fallback、成本统计。
3. `ConversationModule`：会话、消息、SSE。
4. `PromptModule`：prompt 版本、变量、灰度。
5. `ToolModule`：Tool Registry、schema、权限、执行器。
6. `AgentModule`：Agent Runtime、ReAct、LangGraph workflow。
7. `KnowledgeModule`：文档、chunk、embedding、retrieval。
8. `MemoryModule`：短期记忆、长期记忆、用户偏好。
9. `EvalModule`：eval cases、eval runs、CI eval。
10. `SecurityModule`：prompt injection、脱敏、scope、audit。
11. `ObservabilityModule`：Langfuse、业务 trace、日志。
12. `CliModule`：CLI token、CLI session、任务提交。

## 3.4 Prisma 数据模型草案

核心实体：

```text
Tenant
User
ApiKey
Conversation
Message
Prompt
PromptVersion
ModelProvider
ModelCall
Tool
ToolCall
ToolApproval
AgentRun
AgentStep
Document
DocumentChunk
KnowledgeBase
Memory
Trace
Span
EvalDataset
EvalCase
EvalRun
EvalResult
BadCase
AuditLog
CostUsage
RateLimitRecord
```

关键设计：

1. 所有业务表尽量带 `tenantId`。
2. 工具调用必须记录 `userId`、`tenantId`、`toolName`、`scope`、`status`。
3. 写操作必须有 `idempotencyKey`。
4. RAG chunk 保存 `documentId`、`chunkIndex`、`source`、`page`、`section`、`hash`。
5. Memory 保存 `type`、`content`、`confidence`、`expiresAt`、`sourceMessageId`。
6. EvalResult 保存 `strategyConfig`，方便对比不同检索和 prompt。

## 3.5 LLMOps 方案

优先使用 Langfuse：

1. 开源，可自托管，适合作品集展示。
2. 支持 trace、span、generation、prompt、score、dataset。
3. 和 LangChain.js 集成方便。
4. 能减少你手写 Trace / Eval Center 的时间。

平台内部仍要保留：

1. 业务 AgentRun / AgentStep。
2. ToolCall / ToolApproval / AuditLog。
3. EvalCase / EvalRun / EvalResult。
4. BadCase。
5. Langfuse trace 链接。

LangSmith 作为可选加分：

1. 如果后期时间充裕，可以对比 Langfuse 和 LangSmith。
2. 面试表达：我知道工程上可以托管给成熟 LLMOps，而不是盲目造轮子。

## 3.6 CLI 形态

CLI 名称建议：`salonai`。

命令示例：

```bash
salonai chat
salonai ask "这份日志为什么报错？"
salonai rag query "如何申请退款？" --kb demo
salonai ops diagnose ./logs/error.log
salonai code diagnose --path ./demo-app --error ./error.log
salonai eval run smoke
salonai trace open <runId>
```

CLI 技术：

1. Commander 或 oclif。
2. Inquirer / prompts 做交互。
3. ora / cli-spinners 做运行状态。
4. chalk 做颜色。
5. 支持 SSE streaming 输出。
6. 支持 tool event 在终端展示。
7. 使用 API token 连接线上 SalonAI。

面试亮点：

> 同一套 Agent Runtime 能同时支撑 Web 产品化体验和 CLI 工程师体验。Web 适合业务用户，CLI 适合开发者和运维场景。

## 3.7 本地调试工具链

42 天周期里，不要把后端接口验证绑定到前端 UI 完成度上。

推荐调试链路：

1. `docs/http/*.http`：保存 JetBrains IDE / VS Code REST Client 可执行的 HTTP 请求。
2. Postman：用于验证 SSE、鉴权、文件上传、复杂环境变量。
3. CLI：用于验证线上 API、流式输出、工具事件。
4. Web：用于最终产品体验和面试演示。

必须沉淀的 `.http` 脚本：

1. `health.http`：健康检查。
2. `model-gateway.http`：模型调用和 fallback。
3. `sse-chat.http`：SSE 流式输出。
4. `tool-call.http`：Function Calling 和工具执行。
5. `rag-query.http`：RAG 检索和引用。
6. `approval.http`：人工确认和 resume。
7. `eval.http`：触发 eval run。

验收标准：

1. Day 2 前不依赖 Web UI，也能验证 SSE token 正常吐出。
2. 每个核心 API 都有可复用调试脚本。
3. 面试时能说明自己如何降低联调成本。

## 3.8 文档的二次杠杆

文档不只是复盘，也要直接变成教学材料和面试资产。

文档目录建议：

1. `docs/teaching/01-model-gateway.md`
2. `docs/teaching/02-sse-streaming.md`
3. `docs/teaching/03-function-calling.md`
4. `docs/teaching/04-react-agent-loop.md`
5. `docs/teaching/05-rag-pipeline.md`
6. `docs/teaching/06-langgraph-workflow.md`
7. `docs/teaching/07-agent-eval.md`
8. `docs/teaching/08-agent-security.md`

架构快照：

1. `docs/architecture/snapshots/week-01-model-gateway.md`
2. `docs/architecture/snapshots/week-02-tools-react.md`
3. `docs/architecture/snapshots/week-03-rag.md`
4. `docs/architecture/snapshots/week-04-langgraph-memory-cli.md`
5. `docs/architecture/snapshots/week-05-security-eval-deploy.md`
6. `docs/architecture/snapshots/week-06-productized-demo.md`

每个快照包含：

1. 当前架构图。
2. 新增模块。
3. 为什么架构变复杂。
4. 复杂度带来的收益。
5. 当前仍未解决的问题。

面试价值：

> 很多候选人只能展示最终架构，你可以展示架构如何从模型网关一步步演进到 Agent 平台。这个过程比最终图更能体现工程判断。

## 四、Coding Agent 工作流

## 4.1 每个模块的执行流程

1. 你先写模块设计。
2. 让 coding agent 挑问题。
3. 你确认数据模型和 API。
4. coding agent 写第一版。
5. 你亲自 review 核心逻辑。
6. coding agent 补测试和文档。
7. 你跑验证、记录 bad case、整理面试表达。

## 4.2 设计提示词

```text
你是资深 TypeScript 全栈 Agent 架构师。我要在 pnpm monorepo 中实现 [模块名]。
当前技术栈：
- Web: React + TanStack Router + TanStack Query + Zustand
- API: NestJS + Prisma + PostgreSQL + Redis
- Agent: LangChain.js + LangGraph.js
- Vector DB: Milvus
- LLMOps: Langfuse

请先输出设计，不要写代码：
1. 模块目标和非目标
2. NestJS module / service / controller 边界
3. Prisma 数据模型变化
4. shared zod schema 和 TypeScript 类型
5. API 设计
6. 状态流转
7. 错误处理
8. 安全风险
9. 可观测性和 Langfuse trace
10. 测试和验收标准
```

## 4.3 实现提示词

```text
根据确认的设计实现 [模块名]。
要求：
1. 遵循 monorepo 结构
2. NestJS 中按 module/service/controller/dto 分层
3. Prisma migration 清晰
4. shared 包中补 zod schema 和类型
5. 前端用 TanStack Query 获取服务端状态
6. 流式状态放 Zustand
7. 核心路径写测试
8. 接入 Langfuse trace 或预留 span
9. 不修改无关文件
10. 实现后给出验证命令
```

## 4.4 Review 提示词

```text
请以严格代码审查者身份审查这次改动，重点看：
1. 是否满足验收标准
2. NestJS 模块边界是否清晰
3. Prisma 模型是否有租户隔离和索引
4. zod schema 和前后端类型是否一致
5. 是否存在越权、注入、敏感信息泄露
6. 是否有工具调用幂等问题
7. 是否有 token 浪费和上下文膨胀
8. 是否缺少 trace、audit、测试
只输出问题、风险和建议。
```

## 4.5 每天必须亲自掌握的东西

coding agent 可以写代码，但你必须能讲清：

1. 为什么这个模块这样分层。
2. 数据模型为什么这样设计。
3. 哪些逻辑是确定性代码，哪些交给模型。
4. 哪些操作必须人工确认。
5. 失败怎么重试、降级、兜底。
6. 如何观测和回放。
7. 如何评测有没有退化。

## 五、42 天总节奏

压缩后的 6 周安排：

1. 第 0 天：工程基线。
2. 第 1 周：TS 全栈 LLM 应用底座。
3. 第 2 周：Tool Registry、Function Calling、ReAct、Workflow Agent。
4. 第 3 周：RAG 基础到进阶、Knowledge Agent。
5. 第 4 周：Memory、LangGraph.js、多 Agent、MCP、CLI。
6. 第 5 周：安全、评测自动化、Langfuse、性能、部署。
7. 第 6 周：业务场景补齐、作品集、模拟面试。

每日节奏：

1. 09:00-10:00：读文档和源码。
2. 10:00-11:00：写设计和验收标准。
3. 11:00-12:00：让 coding agent 评审设计并修正。
4. 13:30-16:00：coding agent 实现第一版。
5. 16:00-17:30：你亲自 review、改关键逻辑、补类型。
6. 17:30-18:30：测试、跑 eval、修 bug。
7. 20:00-21:00：Docker / 部署 / Langfuse trace 检查。
8. 21:00-22:00：bad case、面试表达、commit。

每天交付：

1. 一个可运行增量。
2. 一条验证记录。
3. 一条 bad case。
4. 一段面试表达。
5. 一个 git commit。

## 六、第 0 天：工程基线

目标：一天内搭好 TypeScript 全栈工程地基。

任务：

1. 初始化 pnpm monorepo。
2. 创建 `apps/web`。
3. 创建 `apps/api` NestJS。
4. 创建 `apps/cli`。
5. 创建 `packages/shared`。
6. 创建 `packages/agent-core`。
7. 创建 `packages/rag-core`。
8. 创建 `packages/eval-core`。
9. 配置 Prisma + PostgreSQL。
10. 配置 Redis。
11. 配置 Milvus。
12. 配置 Langfuse，本地或云端均可。
13. 写 Docker Compose。
14. 配置 eslint、prettier、tsconfig、vitest。
15. 配置 GitHub Actions 或本地 CI 脚本。
16. 配置 `@nestjs/swagger`。
17. 配置 Orval 生成 `packages/api-client`。
18. 建立 `docs/http` 调试脚本目录。
19. 建立 `docs/teaching` 和 `docs/architecture/snapshots`。

验收：

1. `pnpm dev` 能启动 web 和 api。
2. `pnpm db:migrate` 能跑 Prisma migration。
3. `pnpm test` 能跑空测试。
4. `docker compose up` 能启动 PostgreSQL、Redis、Milvus、Langfuse。
5. Web 能调用 API health check。
6. CLI 能调用 API health check。
7. `pnpm api:generate` 能从 OpenAPI 生成 API client。
8. `docs/http/health.http` 能直接验证 health check。

面试沉淀：

1. 为什么选 TypeScript 全栈。
2. 为什么选 NestJS 而不是 Express。
3. 为什么选 Prisma。
4. 为什么 LLMOps 不从零手写。
5. 为什么用 OpenAPI / Orval 做类型安全联调。

## 七、第 1 周：LLM 应用底座

目标：完成一个工程质量合格的 LLM Chat 底座，包括模型网关、SSE、Prompt 版本、结构化输出、Langfuse trace。

## Day 1：NestJS 模型网关

学习：

1. NestJS module / provider / controller。
2. LLM provider 抽象。
3. Langfuse generation 记录。

实战：

1. `ModelGatewayModule`。
2. `ModelProviderService`。
3. OpenAI-compatible provider。
4. Mock provider。
5. model config 表。
6. model call 日志。
7. Langfuse trace / generation。
8. Swagger/OpenAPI 装饰器。
9. Orval 生成前端 model gateway hooks。
10. `docs/http/model-gateway.http`。

验收：

1. API 能调用真实或 mock 模型。
2. 每次调用记录 model、latency、input tokens、output tokens、cost estimate。
3. Langfuse 能看到 generation。
4. OpenAPI 中能看到模型调用接口。
5. Web 端通过生成 hooks 调用非流式接口。

追问准备：

1. 为什么需要模型网关。
2. 多模型 fallback 怎么设计。
3. 成本如何统计。
4. 为什么 provider 要抽象。

## Day 2：SSE 流式输出

学习：

1. SSE 协议。
2. Web stream 状态管理。
3. NestJS streaming response。

实战：

1. `/conversations/:id/stream`。
2. SSE event 类型：token、tool_call、tool_result、approval_required、error、done。
3. 前端 Zustand stream store。
4. 停止生成。
5. 流式错误处理。
6. `docs/http/sse-chat.http` 或 Postman collection。
7. SSE 专用 client，不强行走 Orval。

验收：

1. Web Chat 能流式输出。
2. 停止生成后 UI 状态正确。
3. Langfuse 和本地日志能看到 cancelled。
4. 高频 token 不导致明显卡顿。
5. 不打开 Web UI，也能用 `.http` 或 Postman 验证 SSE。

追问准备：

1. SSE 和 WebSocket 如何选。
2. 流式输出如何取消。
3. 工具事件如何插入流。
4. 高并发长连接有什么风险。

## Day 3：Prompt 版本和结构化输出

学习：

1. Prompt 版本管理。
2. Structured Output。
3. Zod schema。

实战：

1. `PromptModule`。
2. `Prompt` / `PromptVersion` Prisma 模型。
3. prompt variable render。
4. 需求拆解助手。
5. zod 校验。
6. 解析失败 retry。
7. prompt 版本写入 Langfuse。

验收：

1. 同一任务可选择不同 prompt 版本。
2. 非 JSON 输出能被捕获。
3. 解析失败可自动重试一次。
4. 每次输出关联 promptVersionId。

追问准备：

1. 为什么 prompt 不能写死。
2. JSON mode 和 structured output 区别。
3. schema 校验为什么必要。
4. prompt 修改如何防回归。

## Day 4：Conversation 和 Message

学习：

1. 多轮对话数据结构。
2. 上下文窗口。
3. TanStack Router + Query。

实战：

1. `ConversationModule`。
2. Conversation / Message 表。
3. Web 会话列表、会话详情。
4. 刷新恢复。
5. 上下文拼接策略。
6. final message 持久化。

验收：

1. 刷新不丢消息。
2. 能查看本次请求携带哪些上下文。
3. 超长历史有截断策略。

追问准备：

1. 多轮上下文怎么管理。
2. 是否每次都发送全部历史。
3. 长对话怎么处理。

## Day 5：业务 Trace + Langfuse 链接

学习：

1. trace / span 概念。
2. Langfuse trace。
3. 业务 trace 和 LLMOps trace 的边界。

实战：

1. AgentRun / AgentStep 表雏形。
2. 本地 trace detail 页面。
3. 每个 run 关联 langfuseTraceId。
4. Web 提供跳转 Langfuse。
5. 基础 replay 元数据。

验收：

1. 一次 chat 能看到本地 run。
2. 能跳转 Langfuse 查看模型调用。
3. 能看到耗时、模型、prompt、错误。

追问准备：

1. 为什么不完全手写观测平台。
2. Agent 为什么需要每步 trace。
3. 失败回放需要保存什么。

## Day 6：Web 产品化打磨

任务：

1. Chat Workspace 页面打磨。
2. token / cost / latency 面板。
3. error / cancelled / retry 状态。
4. Prompt 版本选择器。
5. Langfuse trace 链接展示。

验收：

1. Demo 能像一个产品，而不是临时脚本。
2. 面试时能直观看到工程细节。

## Day 7：第一周部署和复盘

任务：

1. Docker Compose 跑完整本地环境。
2. 写第一版 README。
3. 写 ADR：为什么 TS 全栈、NestJS、Prisma、Langfuse。
4. 录 3 分钟演示。
5. 写第一周面试稿。
6. 写 `docs/teaching/01-model-gateway.md`。
7. 写 `docs/teaching/02-sse-streaming.md`。
8. 保存 `docs/architecture/snapshots/week-01-model-gateway.md`。

必须能回答：

1. 用户输入到模型输出完整链路。
2. SSE 如何实现。
3. Prompt 如何版本化。
4. Langfuse 在系统里做什么。
5. 为什么保留业务 trace，而不完全依赖外部工具。

## 八、第 2 周：工具调用与 Workflow Agent

目标：实现 Tool Registry、Function Calling、手搓 ReAct、写操作确认、幂等、工具失败处理。

## Day 8：Tool Registry

学习：

1. Function Calling。
2. tool schema。
3. Zod 到 JSON Schema。
4. read / write 工具权限。

实战：

1. `ToolModule`。
2. Tool 表。
3. Tool definition 放 `packages/agent-core`。
4. zod schema 生成 JSON Schema。
5. mock CRM、Order、Logistics 工具。
6. 工具列表和工具测试页面。

验收：

1. Web 能查看工具 schema。
2. API 能执行 mock 工具。
3. 工具有 scope：read、write、admin。

追问准备：

1. 工具 schema 如何设计。
2. 工具描述太长有什么问题。
3. read / write 工具为什么要分开。

## Day 9：Function Calling 闭环

实战：

1. 模型选择工具。
2. 后端执行工具。
3. tool result 回填模型。
4. final answer。
5. SSE 推送 tool_call / tool_result。
6. Langfuse span 记录工具调用。

验收：

1. 用户问订单状态，Agent 能调用用户、订单、物流工具。
2. 前端 timeline 展示每次工具调用。
3. Langfuse 能看到模型和工具 span。

追问准备：

1. Function Calling 是谁决策谁执行。
2. 多工具调用顺序如何确定。
3. 工具结果为什么不能原样塞回模型。

## Day 10：写操作、人机确认、幂等

实战：

1. 创建售后工单工具。
2. `ToolApproval` 表。
3. approval_required SSE event。
4. 前端确认弹窗。
5. idempotencyKey。
6. AuditLog。

验收：

1. 未确认不能创建工单。
2. 重复确认不会创建两次。
3. audit log 记录确认人、时间、入参摘要。

追问准备：

1. 高风险工具如何控制。
2. Agent 写操作如何避免误执行。
3. 幂等 key 如何设计。

## Day 11：手搓 ReAct Runtime

实战：

1. `packages/agent-core` 实现最小 ReAct loop。
2. state：task、steps、messages、toolCalls、observations、final。
3. maxSteps。
4. maxDuration。
5. repeatedToolCall 检测。
6. tool error retry。

验收：

1. 不依赖 LangGraph.js 跑完整 ReAct。
2. 每一步都能序列化到 AgentStep。
3. Web 能回放步骤。

追问准备：

1. ReAct 如何落地。
2. 如何避免无限循环。
3. 为什么要先手搓再上框架。

## Day 12：工具失败、降级、澄清

实战：

1. 工具超时。
2. 参数缺失。
3. 无结果。
4. fallback tool。
5. 用户澄清问题。
6. structured tool error。

验收：

1. 工具失败不导致 Agent 崩溃。
2. 参数缺失时能向用户提问。
3. trace 中能定位失败步骤。

追问准备：

1. 工具失败怎么处理。
2. Observe 无结果怎么办。
3. 如何设计兜底回复。

## Day 13：限流、缓存、成本

实战：

1. Redis token bucket。
2. 用户级限流。
3. 租户级限流。
4. 模型响应缓存策略说明。
5. CostUsage 表。
6. 成本面板初版。

验收：

1. 高频请求被限流。
2. 成本可按用户 / 租户统计。
3. 限流命中有审计日志。

追问准备：

1. 如何防止刷 token。
2. 限流算法如何选。
3. 成本如何归因。

## Day 14：Workflow Agent 部署和复盘

任务：

1. 部署 Workflow Agent。
2. 录演示：查询订单、查询物流、确认创建工单。
3. 写工具调用架构文档。
4. 写 ReAct 伪代码。
5. 写 `docs/teaching/03-function-calling.md`。
6. 写 `docs/teaching/04-react-agent-loop.md`。
7. 保存 `docs/architecture/snapshots/week-02-tools-react.md`。

必须能回答：

1. Tool Registry 如何设计。
2. Function Calling 完整闭环。
3. 写操作如何做人机确认。
4. ReAct loop 如何实现。
5. 工具失败如何处理。

## 九、第 3 周：RAG 基础到进阶

目标：完成 Knowledge Agent，覆盖文档上传、解析、chunk、embedding、向量检索、BM25、RRF、rerank、query rewrite、引用和评测。

## Day 15：文档上传与解析

学习：

1. RAG 全链路。
2. 文档解析。
3. metadata 设计。

实战：

1. `KnowledgeModule`。
2. KnowledgeBase / Document / DocumentChunk 表。
3. 上传 PDF / Markdown / TXT。
4. 基础解析。
5. chunk hash。
6. tenant isolation。

验收：

1. 上传后能看到 chunk 列表。
2. chunk 有 source、page、section、hash、tenantId。
3. 删除文档后 chunk 不再可检索。

追问准备：

1. 文档如何解析和存储。
2. metadata 为什么重要。
3. 删除一致性如何保证。

## Day 16：Embedding 与向量检索

实战：

1. Embedding provider 抽象。
2. Milvus collection。
3. topK vector search。
4. RAG prompt。
5. citations。
6. 检索调试页面。

验收：

1. 用户提问能召回 chunk。
2. 回答展示引用来源。
3. 能看到检索分数和 chunk 内容。

追问准备：

1. Embedding 模型如何选。
2. cosine / dot product / L2 区别。
3. topK 如何设置。

## Day 17：Chunk 策略与父子索引

实战：

1. fixed-size chunk。
2. semantic-ish chunk。
3. overlap。
4. parent-child chunk。
5. chunk strategy 对比页面。

验收：

1. 能对比不同 chunk 策略结果。
2. 父子索引能返回更完整上下文。

追问准备：

1. 如何避免语义切断。
2. chunk size 怎么定。
3. 父子索引为什么有用。

## Day 18：BM25 与混合检索

选择：

1. 时间紧：PostgreSQL full-text search 实现关键词召回。
2. 时间够：引入 Elasticsearch / OpenSearch。

主线推荐先用 PostgreSQL full-text，面试时说明可替换为 ES。

实战：

1. keyword retrieval。
2. vector retrieval。
3. RRF 融合。
4. vector / keyword / hybrid 切换。
5. 分数和来源展示。

验收：

1. 前端能切换三种检索策略。
2. 能看到融合前后排序变化。
3. 对关键词强相关问题，hybrid 优于纯向量。

追问准备：

1. 为什么引入 BM25 / 关键词检索。
2. RRF 怎么做。
3. 分数如何对齐。

## Day 19：Query Rewrite 与 Rerank

实战：

1. query rewrite。
2. multi-query retrieval。
3. rerank provider 抽象。
4. 可先用 LLM rerank，再补专用 reranker。
5. topK 截断。
6. context compression。

验收：

1. 模糊问题召回更稳定。
2. rerank 前后结果可视化。
3. 上下文超长时能裁剪。

追问准备：

1. query rewrite 解决什么问题。
2. rerank 返回几个 chunk。
3. 上下文过长怎么办。

## Day 20：RAG Eval 自动化

学习：

1. recall@k。
2. MRR。
3. answer groundedness。
4. Langfuse dataset / score。

实战：

1. `packages/eval-core`。
2. 30 条 RAG eval cases。
3. expected source 标注。
4. `pnpm eval:rag`。
5. 输出 markdown / json 报告。
6. 结果写入 Langfuse score。

验收：

1. 一键跑 RAG 评测。
2. 能比较 vector / hybrid / hybrid+rerank。
3. bad case 能转 eval case。

追问准备：

1. RAG 如何评测。
2. 检索和生成怎么分别评估。
3. 如何证明优化有效。

## Day 21：Knowledge Agent 部署和复盘

任务：

1. 部署 Knowledge Agent。
2. 写 RAG 架构文档。
3. 写 eval 报告。
4. 录演示：上传文档、提问、查看引用、查看 Langfuse。
5. 写 `docs/teaching/05-rag-pipeline.md`。
6. 保存 `docs/architecture/snapshots/week-03-rag.md`。

必须能回答：

1. RAG 完整链路。
2. chunk 策略。
3. hybrid retrieval。
4. query rewrite 和 rerank。
5. RAG eval。
6. RAG 和 fine-tuning 如何选。

## 十、第 4 周：Memory、LangGraph.js、多 Agent、MCP、CLI

目标：把系统升级为可恢复、可中断、可协作、可多端调用。

## Day 22：Memory 系统

实战：

1. Memory 表。
2. working memory。
3. conversation summary。
4. long-term memory。
5. user preference。
6. memory CRUD UI。
7. memory 写入过滤。

验收：

1. 用户偏好跨会话生效。
2. 用户能查看和删除记忆。
3. 敏感信息不写入长期记忆。

追问准备：

1. 短期记忆和长期记忆区别。
2. 什么信息进长期记忆。
3. 记忆如何去重和遗忘。

## Day 23：Context Builder

实战：

1. context builder。
2. token budget。
3. 历史消息裁剪。
4. summary 注入。
5. memory 注入。
6. RAG context 注入。
7. 最终上下文可视化。

验收：

1. 能展示最终传给模型的 context。
2. 超长对话不会塞满窗口。
3. RAG 和 memory 不互相污染。

追问准备：

1. 上下文过长怎么办。
2. 摘要丢细节怎么办。
3. 如何避免上下文污染。

## Day 24：LangGraph.js 工作流

学习：

1. LangGraph.js state。
2. node。
3. edge。
4. conditional routing。

实战：

1. 将 Workflow Agent 改成 LangGraph.js。
2. nodes：intent、queryUser、queryOrder、queryLogistics、approval、createTicket、final。
3. typed state。
4. graph visualization 数据导出。

验收：

1. LangGraph 版执行结果和手搓 runtime 一致。
2. 每个 node 耗时可见。
3. 可以解释 state 字段生命周期。

追问准备：

1. 为什么用 LangGraph。
2. node / edge / state 如何设计。
3. 什么情况下 LangGraph 是过度设计。

## Day 25：Checkpoint、Interrupt、Resume

实战：

1. checkpoint saver。
2. 写操作前 interrupt。
3. approval 后 resume。
4. resume 幂等。
5. checkpoint TTL。
6. checkpoint payload 控制。

验收：

1. 中断后刷新页面能恢复。
2. resume 不重复创建工单。
3. checkpoint 不保存大字段和敏感字段。

追问准备：

1. checkpoint 和 memory 区别。
2. interrupt 如何做人机协同。
3. threadId 和业务 id 如何区分。

## Day 26：多 Agent 协作

实战：

1. supervisor agent。
2. retriever agent。
3. tool agent。
4. summarizer agent。
5. rule router。
6. LLM router 对比。
7. 冲突仲裁。

验收：

1. 复杂任务能路由到不同 agent。
2. 能看到每个 agent 的 contribution。
3. router 失败有 fallback。

追问准备：

1. Single-Agent 和 Multi-Agent 如何选。
2. 为什么不用 Skill 封装一切。
3. 多 Agent 如何共享状态。

## Day 27：MCP、A2A、Skills

实战：

1. 接入一个 MCP server。
2. 将 MCP tool 包装到 Tool Registry。
3. 写一个 Skill 文档。
4. 写 MCP / Function Calling / Skill / A2A 对比文档。

验收：

1. Agent 能调用 MCP 暴露的工具。
2. 文档能讲清边界。

追问准备：

1. MCP 解决什么问题。
2. MCP 和 Function Calling 区别。
3. Skill 和 MCP 区别。
4. A2A 和 MCP 区别。

## Day 28：CLI 终端体验

实战：

1. `apps/cli`。
2. API token 登录。
3. `salonai chat`。
4. `salonai rag query`。
5. `salonai ops diagnose`。
6. CLI SSE streaming。
7. tool events 终端展示。
8. 写 `docs/teaching/06-langgraph-workflow.md`。
9. 保存 `docs/architecture/snapshots/week-04-langgraph-memory-cli.md`。

验收：

1. CLI 能调用线上或本地 API。
2. CLI 能流式输出。
3. CLI 能显示工具调用过程。
4. CLI 命令能复用 shared schema。

追问准备：

1. 为什么做 CLI。
2. Web 和 CLI 如何复用 Runtime。
3. CLI 适合哪些 Agent 场景。

## 十一、第 5 周：安全、Eval CI、观测、性能、部署

目标：把项目从能跑升级到能上线、能监控、能回归、能防风险。

## Day 29：权限和多租户

实战：

1. Tenant / User / Role。
2. API key。
3. Prisma tenant filter。
4. tool scope。
5. knowledge base tenant isolation。
6. 前端权限控制。

验收：

1. 用户不能检索其他租户文档。
2. 用户不能调用无权限工具。
3. 越权尝试写入 AuditLog。

追问准备：

1. Agent 如何安全传递用户身份。
2. 多租户 RAG 如何隔离。
3. Tool scope 如何设计。

## Day 30：Prompt Injection 和脱敏

实战：

1. prompt injection 测试集。
2. 输入检测。
3. RAG indirect injection 检测。
4. 系统指令保护。
5. PII 脱敏。
6. 输出安全过滤。
7. 违规停流。
8. 写 `docs/teaching/08-agent-security.md`。

验收：

1. 至少 20 条攻击样例。
2. 明显越权和泄密指令能拦截。
3. 安全命中写入 Langfuse score / metadata。

追问准备：

1. Prompt Injection 原理。
2. 防御性 prompt 是否足够。
3. RAG 间接注入怎么办。

## Day 31：SQL / Code / Ops 沙箱

实战：

1. Text2SQL read-only demo。
2. SQL 白名单或 AST 校验。
3. Ops 命令白名单。
4. Docker 沙箱执行简单命令。
5. 高危命令 approval。
6. 审计日志。

验收：

1. 禁止 drop / delete / update。
2. 禁止非白名单 shell。
3. 所有执行可回放。

追问准备：

1. Agent 生成 SQL 如何防注入。
2. 代码执行如何隔离。
3. 运维 Agent 如何避免误操作。

## Day 32：Eval Center 和 CI Eval

这一版重点不是做漂亮 UI，而是做自动化回归。

实战：

1. eval dataset 表。
2. eval case 表。
3. `pnpm eval:smoke`，10 条核心回归。
4. `pnpm eval:rag`，RAG 评测。
5. `pnpm eval:tools`，工具调用评测。
6. LLM-as-a-judge 基础版。
7. GitHub Actions 或本地 CI 运行 smoke eval。
8. Langfuse dataset / score 同步。
9. 写 `docs/teaching/07-agent-eval.md`。

验收：

1. 改 prompt 后能跑 smoke eval。
2. 严重回归会失败。
3. Eval report 有 markdown 输出。
4. BadCase 可以转 EvalCase。

追问准备：

1. Agent 如何做回归测试。
2. LLM-as-a-judge 有什么风险。
3. 如何防止修 A 坏 B。

## Day 33：Langfuse 深化和失败回放

实战：

1. trace hierarchy。
2. span metadata。
3. prompt version。
4. tool input / output 摘要。
5. retrieved chunks。
6. eval score。
7. replay 按钮。

验收：

1. 任意回答能追溯 prompt、chunk、tool、model。
2. 失败 case 能重跑。
3. Web 能跳转 Langfuse 对应 trace。

追问准备：

1. Agent 如何可观测。
2. 失败回放需要保存什么。
3. Langfuse 和业务数据库边界。

## Day 34：性能、成本、压测

实战：

1. embedding cache。
2. retrieval cache。
3. prompt caching 策略说明。
4. simple / complex model routing。
5. p95 latency。
6. token cost dashboard。
7. load test script。

验收：

1. 有压测报告。
2. 有成本报告。
3. 有模型路由规则。
4. p95 latency 能拆解到模型、检索、工具。

追问准备：

1. 端到端延迟如何优化。
2. token 成本如何控制。
3. QPS 上来怎么办。

## Day 35：云端部署

实战：

1. Docker Compose prod。
2. 环境变量。
3. 数据库 migration。
4. health check。
5. restart policy。
6. backup。
7. Nginx / HTTPS 可选。
8. CLI 连接线上 API。
9. 保存 `docs/architecture/snapshots/week-05-security-eval-deploy.md`。

验收：

1. 线上 Web 可访问。
2. CLI 可调用线上 Agent。
3. Langfuse 能看到线上 trace。
4. 三个 Agent 场景都可演示。

追问准备：

1. Docker 部署注意点。
2. 服务如何高可用。
3. 主模型挂了如何降级。

## 十二、第 6 周：场景补齐与面试包装

目标：把技术能力包装成业务方案和面试作品集。

## Day 36：内容审核 Agent

实战：

1. 文本审核。
2. 规则 + 模型双层判断。
3. 低置信度人工复核。
4. 审核原因展示。
5. bad case 回流。

面试重点：

1. 召回率和准确率如何权衡。
2. 漏审和误杀哪个代价更大。
3. 人工复核如何设计。

## Day 37：小红书 / 内容消费决策 Agent

实战：

1. 模拟 UGC 笔记知识库。
2. 用户需求澄清。
3. 推荐理由和引用来源。
4. UGC 可信度字段。
5. 用户反馈闭环。

面试重点：

1. 小红书 Agent 和通用 Agent 差异。
2. UGC 可信度如何处理。
3. 消费决策如何避免幻觉。

## Day 38：AI Coding Agent

实战：

1. 上传前端错误日志。
2. 检索相关文件。
3. 生成修复建议。
4. 展示 diff。
5. 执行测试命令。
6. CLI 触发诊断。

面试重点：

1. Coding Agent 上下文怎么管理。
2. AI 改代码如何验证。
3. Web 和 CLI 如何共用 Runtime。

## Day 39：运维 Agent

实战：

1. 日志查询工具。
2. 指标查询工具 mock。
3. 根因分析。
4. 修复建议。
5. 高危命令确认。
6. CLI ops diagnose。

面试重点：

1. 运维 Agent 为什么只读优先。
2. 命令执行如何白名单。
3. 审计和回滚怎么设计。

## Day 40：文档和作品集

产出：

1. README。
2. 在线 Demo 地址。
3. CLI 使用说明。
4. 架构图。
5. 数据流图。
6. Agent 执行流程图。
7. RAG 流程图。
8. 部署文档。
9. Eval 报告。
10. 压测报告。
11. bad case 报告。
12. Langfuse 截图或链接说明。
13. `docs/architecture/snapshots/week-06-productized-demo.md`。
14. `docs/teaching` 模块化教学材料目录。

每个项目说明包含：

1. 背景。
2. 架构。
3. 核心流程。
4. 难点。
5. 指标。
6. 风险控制。
7. 可改进点。

## Day 41：简历和面试稿

产出：

1. 简历项目描述。
2. 30 秒自我介绍。
3. 3 分钟项目介绍。
4. 10 分钟深挖版项目介绍。
5. 高频追问 100 题。
6. 每题回答要点。

核心表达：

> 我用 TypeScript 全栈实现了 SalonAI，采用 NestJS + Prisma 构建 Agent API 和业务数据层，用 LangChain.js / LangGraph.js 实现工具调用、RAG、状态机和人机协同，用 Langfuse 做 LLMOps 观测与评测，用 Web + CLI 双端复用同一套 Agent Runtime。这个项目重点不是调 API，而是解决 Agent 上线时的可靠性问题：工具调用是否可控，状态是否可恢复，权限是否安全，RAG 是否可评测，成本和延迟是否可观测。

## Day 42：模拟面试日

安排 4 场模拟：

1. Agent 架构和项目深挖。
2. RAG 专场。
3. 工程化、后端、部署、LLMOps 专场。
4. 前端差异化、CLI、AI Coding 专场。

最终验收：

1. 能 30 秒讲清 Agent。
2. 能 3 分钟讲清 SalonAI。
3. 能画完整架构图。
4. 能手写 ReAct loop。
5. 能讲 Function Calling 闭环。
6. 能讲 RAG 全链路和 eval。
7. 能讲 LangGraph checkpoint / interrupt。
8. 能讲 Prompt Injection 防护。
9. 能展示 Langfuse trace。
10. 能打开线上 Web 和 CLI 演示。

## 十三、CI Eval 设计

## 13.1 为什么必须做

Agent 开发最大的风险是非确定性回归：

1. 改 prompt 修复 A，破坏 B。
2. 改 chunk 策略提升召回，增加幻觉。
3. 改工具描述，模型开始误选工具。
4. 改上下文 builder，长期记忆污染回答。

所以第 5 周必须把 eval 脚本化，而不是只在 UI 上手动点。

## 13.2 Eval 分层

Smoke Eval：

1. 10 条核心 case。
2. 每次核心逻辑提交都跑。
3. 目标是发现严重回归。

RAG Eval：

1. 30-50 条知识库问答。
2. 指标：recall@k、MRR、source hit、groundedness。
3. 每次改 chunk、retrieval、rerank、prompt 后跑。

Tool Eval：

1. 20 条工具调用任务。
2. 指标：tool selection accuracy、param accuracy、tool success rate。
3. 每次改工具 schema 或描述后跑。

Agent Task Eval：

1. 复杂多步任务。
2. 指标：task success、step count、cost、latency、human fallback。
3. 每周跑一次。

## 13.3 CI 规则

建议：

1. PR 或本地 commit 前跑 `pnpm eval:smoke`。
2. RAG 改动跑 `pnpm eval:rag`。
3. Tool 改动跑 `pnpm eval:tools`。
4. eval 失败不一定阻塞所有提交，但必须写入报告。
5. 核心 smoke case 失败必须修复或明确记录原因。

输出：

1. `docs/evals/YYYY-MM-DD-report.md`。
2. Langfuse scores。
3. GitHub Actions artifact。

## 13.4 趣味性垂直评测集

为了避免长期对着报销制度、工单和日志产生疲劳，RAG 和 Agent Eval 可以引入高浓度垂直领域数据。但数据必须合规、可公开展示、可复现。

推荐数据集方向：

1. 金渐层猫舍知识库  
   用于测试 hybrid retrieval、实体属性检索、健康养护问答。  
   数据内容：品相鉴定、毛色遗传、繁育注意事项、疫苗、饮食、常见疾病、猫舍合同条款。

2. 虚构音乐资料库  
   用于测试意图识别、别名召回、实体链接、创作背景检索。  
   数据内容：虚构歌手、虚构专辑、虚构歌词摘要、歌曲风格、发行时间、创作背景。  
   注意：不直接使用受版权保护的真实歌词片段。可以使用歌曲名、公开元数据、你自己写的摘要，或完全虚构的歌词风格描述。

3. 长篇小说 / 博文知识库  
   用于测试长文本摘要、角色实体抽取、跨章节线索召回。  
   数据内容：自写短篇、公共领域文本、授权文章、虚构设定集。

4. 前端故障案例库  
   用于测试 CodingOps Agent。  
   数据内容：React hydration mismatch、SSE 断流、Vite 构建失败、TanStack Query 缓存错乱、Prisma migration 失败。

5. 运维事故复盘库  
   用于测试 Ops Agent。  
   数据内容：虚构事故时间线、指标变化、日志片段、根因、修复动作、复盘结论。

每个趣味数据集都要覆盖：

1. 精确关键词问题。
2. 语义改写问题。
3. 多跳问题。
4. 带噪声问题。
5. 长上下文问题。
6. 检索不到时的兜底问题。

面试表达：

> 我没有只用一套枯燥的制度文档评测 RAG，而是构造了多个垂直领域数据集，用来覆盖关键词召回、语义召回、多跳推理、长文本抽取和工具路由。这样可以更真实地暴露 Agent 的泛化问题。

## 十四、Python Worker 后期补充

主线不依赖 Python，但时间充裕后可以补一个 worker，作为能力加分。

适合放到 Python Worker 的任务：

1. 高质量 PDF 解析。
2. OCR。
3. 表格抽取。
4. 专用 reranker。
5. RAGAS / DeepEval 等评测。
6. 本地 embedding / rerank 模型。
7. 数据清洗批处理。

架构：

```text
NestJS API -> Redis Queue / HTTP -> Python Worker -> PostgreSQL / Milvus
```

面试表达：

> 主链路我用 TypeScript 保证研发效率和类型一致性；对于 Python 生态更强的离线任务，例如复杂文档解析和专用评测，我预留了 Worker 架构，可以异步扩展，不影响主 Agent Runtime。

## 十五、核心模块验收清单

## 15.1 TypeScript 全栈底座

必须完成：

1. pnpm monorepo。
2. React Web。
3. NestJS API。
4. CLI。
5. shared schema。
6. Prisma。
7. PostgreSQL。
8. Redis。
9. Milvus。
10. Langfuse。
11. OpenAPI。
12. Orval API client。
13. `.http` 调试脚本。
14. docs teaching 和 architecture snapshots。

能回答：

1. 为什么 TS 全栈。
2. 如何复用类型。
3. NestJS 模块边界。
4. Prisma 的优劣。
5. 为什么要自动生成 API client。
6. 服务端状态、路由状态、流式状态如何分层。

## 15.2 LLM 应用底座

必须完成：

1. Model Gateway。
2. SSE。
3. Stop generation。
4. Conversation。
5. Prompt version。
6. Structured output。
7. Langfuse trace。
8. cost / latency。

能回答：

1. SSE vs WebSocket。
2. 模型网关价值。
3. Prompt 如何回归。
4. Langfuse 解决什么问题。

## 15.3 Tool 和 Agent Runtime

必须完成：

1. Tool Registry。
2. zod -> JSON Schema。
3. Function Calling。
4. ReAct loop。
5. tool timeline。
6. approval。
7. idempotency。
8. audit。

能回答：

1. 工具 schema 如何设计。
2. Function Calling 完整流程。
3. 写操作如何控制风险。
4. ReAct 如何避免死循环。

## 15.4 RAG

必须完成：

1. document upload。
2. parse。
3. chunk。
4. metadata。
5. embedding。
6. vector search。
7. keyword search。
8. hybrid retrieval。
9. RRF。
10. rerank。
11. query rewrite。
12. citations。
13. RAG eval。

能回答：

1. chunk 策略。
2. BM25 / 关键词检索价值。
3. rerank 位置和 topK。
4. RAG 如何评测。

## 15.5 Memory 和 LangGraph

必须完成：

1. working memory。
2. summary。
3. long-term memory。
4. context builder。
5. LangGraph.js workflow。
6. checkpoint。
7. interrupt。
8. resume。

能回答：

1. memory 和 checkpoint 区别。
2. 上下文过长怎么办。
3. interrupt 如何做人机协同。
4. LangGraph 什么时候过度设计。

## 15.6 安全

必须完成：

1. tenant isolation。
2. role / scope。
3. prompt injection tests。
4. PII masking。
5. write confirmation。
6. SQL guard。
7. command whitelist。
8. audit log。

能回答：

1. 如何防越权。
2. 如何防 prompt injection。
3. 生成 SQL 如何防注入。
4. 运维命令如何控制风险。

## 15.7 Eval 和观测

必须完成：

1. Langfuse trace。
2. eval dataset。
3. smoke eval。
4. RAG eval。
5. tool eval。
6. LLM-as-judge。
7. bad case。
8. replay。

能回答：

1. Agent 如何评测。
2. 如何防回归。
3. LLM-as-judge 风险。
4. bad case 如何闭环。

## 十六、简历项目表达

## 16.1 SalonAI

基于 TypeScript 全栈构建 SalonAI 平台，采用 React + TanStack Router + TanStack Query + Zustand 实现 Web 端，采用 NestJS + Prisma + PostgreSQL + Redis 构建 API 和业务数据层，采用 LangChain.js / LangGraph.js 实现 Agent Runtime、工具调用、RAG、状态机和人机协同，接入 Langfuse 完成 LLM trace、prompt 版本、eval score 和成本观测。平台支持 Web 与 CLI 双端调用，并通过 Docker Compose 部署上线。

## 16.2 Knowledge Agent

实现企业知识库 RAG Agent，支持文档上传、解析、chunk、embedding、Milvus 向量检索、关键词召回、RRF 混合检索、query rewrite、rerank 和引用溯源。设计 document / chunk 元数据体系和租户隔离机制，构建 RAG eval 脚本，对比不同检索策略在 recall@k、MRR、source hit 和 groundedness 上的表现，并将结果同步到 Langfuse。

## 16.3 Workflow Agent

实现多工具工单 Agent，支持用户查询、订单查询、物流查询、工单创建等工具编排。通过 zod schema 统一前后端工具定义，基于 Function Calling 和 ReAct loop 完成多步工具调用，基于 LangGraph.js 实现 checkpoint、interrupt 和 resume。对写操作引入人工确认、idempotency key、scope 权限和审计日志，保障 Agent 执行的可靠性和安全性。

## 16.4 CodingOps Agent

实现面向前端项目和运维场景的 CodingOps Agent，支持错误日志分析、相关文件检索、修复建议生成、diff 展示、测试命令执行和运维诊断。提供 Web 与 CLI 双端入口，CLI 支持流式输出和工具调用事件展示。通过命令白名单、Docker 沙箱、审计日志和高危操作确认降低自动化执行风险。

## 十七、面试能力地图

任何题目都按这个结构回答：

1. 定义问题。
2. 讲架构。
3. 讲流程。
4. 讲异常。
5. 讲安全。
6. 讲评测。
7. 讲你项目里的实现。

八类能力：

1. Agent 架构：loop、state、planning、tools、memory。
2. RAG：chunk、embedding、hybrid、rerank、eval。
3. 工具调用：schema、权限、失败、幂等、确认。
4. 上下文：memory、summary、token budget、污染控制。
5. 框架：LangChain.js、LangGraph.js、MCP、A2A、Skills。
6. 安全：prompt injection、越权、脱敏、沙箱、审计。
7. 工程化：NestJS、Prisma、OpenAPI、Orval、SSE、Redis、Docker、Langfuse、CI Eval。
8. 差异化：Web 产品体验、CLI 终端体验、TypeScript 全栈、AI Coding。

## 十八、每天复盘模板

```text
日期：
今天模块：

1. 这个模块解决什么问题？
2. 为什么用 TypeScript / NestJS 这样实现？
3. Prisma 模型怎么设计？
4. Agent 中哪些步骤是确定性的？
5. 哪些步骤交给 LLM？
6. 失败怎么处理？
7. 安全风险是什么？
8. Langfuse 里能看到什么？
9. Eval 怎么验证？
10. 面试官会怎么追问？
```

## 十九、第二批建议采纳边界

已采纳：

1. OpenAPI + Orval 自动生成 API client 和 TanStack Query hooks。
2. TanStack Query / TanStack Router / Zustand 状态分层。
3. `.http` 脚本、Postman、CLI 多兵器协同调试。
4. `docs/teaching` 教学化沉淀。
5. `docs/architecture/snapshots` 周维度架构演进快照。
6. 趣味性垂直评测集，提高 RAG / Agent eval 的覆盖和学习可持续性。

调整后采纳：

1. 真实歌词片段不作为评测语料。  
   原因：歌词属于强版权内容，不适合放进公开作品集和 eval 数据。可以改成虚构音乐资料库、公开元数据、歌曲摘要、公共领域文本或自己写的风格片段。

2. API client 自动生成只覆盖稳定 REST API。  
   SSE、文件上传进度、CLI streaming 等协议型接口保留手写 client，因为它们更依赖事件语义和取消控制。

暂不采纳：

1. 完全依赖自动生成代码替代 shared schema。  
   原因：Agent 工具 schema、eval case schema、LLM structured output schema 仍然需要 `packages/shared` 作为跨 Web / API / CLI / agent-core 的领域契约。

## 二十、42 天后继续深化

如果主线完成后还有时间：

1. 补 Python Worker。
2. 接 OpenSearch 做真实 BM25。
3. 接专用 reranker。
4. 接 GitHub repo indexing。
5. 做更完整的 CLI install 包。
6. 接 Prometheus + Grafana。
7. 上 K8s。
8. 做 MCP server 而不仅是 MCP client。
9. 做多模态 RAG。
10. 扩充 eval dataset 到 100+ cases。
