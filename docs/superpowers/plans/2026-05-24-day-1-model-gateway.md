# Day 1 Model Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 SalonAI Day 1 的 NestJS Model Gateway，让 API 通过根目录 `.env` 中的真实 OpenAI-compatible provider 完成一次非流式模型调用，并记录模型调用日志、token、成本估算、延迟和 Langfuse generation；mock provider 只作为测试和兜底路径。

**Architecture:** `apps/api` 新增 `ModelGatewayModule`，controller 只处理 HTTP/Swagger/DTO，service 负责优先创建/选择真实 `OPENAI_COMPATIBLE` `ModelConfig`、调用 provider、记录 `ModelCall` 和 Langfuse generation。API 显式加载项目根目录 `.env`；`packages/shared` 定义跨 API/Web/CLI 复用的请求、响应、usage、cost schema；Web 通过 Orval 生成的 TanStack Query mutation hook 调用非流式接口。

**Tech Stack:** NestJS、NestJS Config、dotenv、Prisma、PostgreSQL、Zod、class-validator、Swagger/OpenAPI、Orval React Query、TanStack Query、Langfuse JS/TS SDK v5、OpenAI-compatible chat completions HTTP API。

---

## 文件结构

- Modify: `package.json`，保持 `api:generate`、`db:migrate`、`ci` 命令可用。
- Modify: `.env.example`，增加模型网关和 Langfuse 环境变量示例。
- Modify: `prisma/schema.prisma`，新增 `ModelConfig`、`ModelCall`、`ModelProviderKind`、`ModelCallStatus`。
- Create: `packages/shared/src/model-gateway.ts`，模型网关 schema、类型、token 估算、成本估算。
- Create: `packages/shared/src/model-gateway.test.ts`，shared 契约和成本计算测试。
- Modify: `packages/shared/src/index.ts`，导出模型网关契约。
- Modify: `apps/api/package.json`，增加 Prisma、NestJS Config、dotenv、class-validator、Langfuse/OpenTelemetry 依赖。
- Create: `apps/api/src/config/env.ts`，从项目根目录 `.env` 加载环境变量。
- Modify: `apps/api/src/main.ts`，增加 ValidationPipe，并在入口注册 Langfuse OpenTelemetry。
- Modify: `apps/api/src/app.module.ts`，导入 PrismaModule 和 ModelGatewayModule。
- Create: `apps/api/src/prisma/prisma.module.ts`，Prisma NestJS module。
- Create: `apps/api/src/prisma/prisma.service.ts`，Prisma lifecycle service。
- Create: `apps/api/src/observability/langfuse.instrumentation.ts`，Langfuse span processor 初始化。
- Create: `apps/api/src/model-gateway/model-gateway.module.ts`，模型网关 module。
- Create: `apps/api/src/model-gateway/dto/model-gateway.dto.ts`，Swagger 和 validation DTO。
- Create: `apps/api/src/model-gateway/providers/model-provider.types.ts`，provider interface、输入输出类型、错误类型。
- Create: `apps/api/src/model-gateway/providers/mock-model.provider.ts`，deterministic mock provider。
- Create: `apps/api/src/model-gateway/providers/mock-model.provider.spec.ts`，mock provider 单测。
- Create: `apps/api/src/model-gateway/providers/openai-compatible.provider.ts`，OpenAI-compatible provider。
- Create: `apps/api/src/model-gateway/providers/openai-compatible.provider.spec.ts`，OpenAI-compatible provider 单测。
- Create: `apps/api/src/model-gateway/providers/model-provider.service.ts`，provider registry。
- Create: `apps/api/src/model-gateway/model-gateway.service.ts`，模型调用编排、日志和 Langfuse generation。
- Create: `apps/api/src/model-gateway/model-gateway.service.spec.ts`，service 编排单测。
- Create: `apps/api/src/model-gateway/model-gateway.controller.ts`，REST API。
- Create: `apps/api/src/model-gateway/model-gateway.controller.spec.ts`，controller 单测。
- Modify: `orval.config.ts`，把稳定 REST API client 改为 React Query hooks 输出。
- Modify: `packages/api-client/package.json`，增加 TanStack Query peer/dependency。
- Modify: `packages/api-client/src/index.ts`，导出生成 client。
- Create: `packages/api-client/src/fetcher.ts`，Orval custom mutator，统一把 Web 请求前缀到 `/api`。
- Modify: `apps/web/package.json`，增加 `@salonai/api-client` 和 `@tanstack/react-query`。
- Modify: `apps/web/src/main.tsx`，增加 QueryClientProvider。
- Modify: `apps/web/src/App.tsx`，增加 Model Gateway 非流式调用面板。
- Modify: `apps/web/src/App.css`，补充模型网关面板样式。
- Create: `docs/http/model-gateway.http`，模型网关 HTTP 调试脚本。
- Create: `docs/badcases/day-1.md`，Day1 bad case 记录。
- Create: `docs/interview/day-1-model-gateway.md`，Day1 面试表达。

## Task 1: Shared 模型网关契约

**Files:**
- Create: `packages/shared/src/model-gateway.test.ts`
- Create: `packages/shared/src/model-gateway.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: 写 shared 契约失败测试**

Create `packages/shared/src/model-gateway.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  calculateCostEstimate,
  estimateChatInputTokens,
  modelGatewayRequestSchema,
  modelGatewayResponseSchema,
} from './model-gateway.js';

describe('modelGatewayRequestSchema', () => {
  it('accepts a minimal chat completion request', () => {
    const request = modelGatewayRequestSchema.parse({
      messages: [{ role: 'user', content: '用一句话介绍模型网关' }],
    });

    expect(request.temperature).toBe(0.2);
    expect(request.maxOutputTokens).toBe(512);
    expect(request.traceName).toBe('model-gateway.completion');
  });

  it('rejects empty message lists', () => {
    expect(() => modelGatewayRequestSchema.parse({ messages: [] })).toThrow();
  });
});

describe('modelGatewayResponseSchema', () => {
  it('accepts a logged model response', () => {
    const response = modelGatewayResponseSchema.parse({
      id: 'cmpl_day1_mock',
      modelCallId: 'call_day1_mock',
      providerKind: 'MOCK',
      model: 'mock-salonai-day1',
      outputText: 'Mock response: 用一句话介绍模型网关',
      usage: { inputTokens: 8, outputTokens: 9, totalTokens: 17 },
      costEstimate: { inputUsd: 0, outputUsd: 0, totalUsd: 0 },
      latencyMs: 12,
      langfuseTraceId: null,
      langfuseGenerationId: null,
      createdAt: '2026-05-24T00:00:00.000Z',
    });

    expect(response.providerKind).toBe('MOCK');
  });
});

describe('token and cost helpers', () => {
  it('estimates input tokens from chat content', () => {
    expect(
      estimateChatInputTokens([
        { role: 'system', content: '你是 SalonAI 助手' },
        { role: 'user', content: '解释模型网关' },
      ]),
    ).toBeGreaterThan(0);
  });

  it('calculates cost from per-1k token prices', () => {
    expect(
      calculateCostEstimate(
        { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
        { inputTokenPriceUsdPer1K: 0.01, outputTokenPriceUsdPer1K: 0.03 },
      ),
    ).toEqual({ inputUsd: 0.01, outputUsd: 0.015, totalUsd: 0.025 });
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run:

```bash
pnpm --filter @salonai/shared test -- model-gateway
```

Expected: FAIL，原因是 `packages/shared/src/model-gateway.ts` 还不存在。

- [ ] **Step 3: 实现 shared 契约和 helper**

Create `packages/shared/src/model-gateway.ts`:

```ts
import { z } from 'zod';

export const modelProviderKindSchema = z.enum(['MOCK', 'OPENAI_COMPATIBLE']);

export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1),
});

export const modelGatewayRequestSchema = z.object({
  modelConfigId: z.string().min(1).optional(),
  messages: z.array(chatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).default(0.2),
  maxOutputTokens: z.number().int().min(1).max(4096).default(512),
  traceName: z.string().min(1).max(120).default('model-gateway.completion'),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const tokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});

export const costEstimateSchema = z.object({
  inputUsd: z.number().nonnegative(),
  outputUsd: z.number().nonnegative(),
  totalUsd: z.number().nonnegative(),
});

export const modelGatewayResponseSchema = z.object({
  id: z.string().min(1),
  modelCallId: z.string().min(1),
  providerKind: modelProviderKindSchema,
  model: z.string().min(1),
  outputText: z.string(),
  usage: tokenUsageSchema,
  costEstimate: costEstimateSchema,
  latencyMs: z.number().int().nonnegative(),
  langfuseTraceId: z.string().nullable(),
  langfuseGenerationId: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const modelConfigSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  providerKind: modelProviderKindSchema,
  model: z.string(),
  enabled: z.boolean(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ModelProviderKind = z.infer<typeof modelProviderKindSchema>;
export type ModelGatewayRequest = z.infer<typeof modelGatewayRequestSchema>;
export type TokenUsage = z.infer<typeof tokenUsageSchema>;
export type CostEstimate = z.infer<typeof costEstimateSchema>;
export type ModelGatewayResponse = z.infer<typeof modelGatewayResponseSchema>;
export type ModelConfigSummary = z.infer<typeof modelConfigSummarySchema>;

export type ModelPricing = {
  inputTokenPriceUsdPer1K: number;
  outputTokenPriceUsdPer1K: number;
};

export function estimateTextTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

export function estimateChatInputTokens(messages: ChatMessage[]): number {
  return messages.reduce((total, message) => {
    return total + estimateTextTokens(`${message.role}: ${message.content}`);
  }, 0);
}

export function calculateCostEstimate(usage: TokenUsage, pricing: ModelPricing): CostEstimate {
  const inputUsd = roundUsd((usage.inputTokens / 1000) * pricing.inputTokenPriceUsdPer1K);
  const outputUsd = roundUsd((usage.outputTokens / 1000) * pricing.outputTokenPriceUsdPer1K);

  return {
    inputUsd,
    outputUsd,
    totalUsd: roundUsd(inputUsd + outputUsd),
  };
}

function roundUsd(value: number): number {
  return Number(value.toFixed(8));
}
```

- [ ] **Step 4: 导出 shared 契约**

Modify `packages/shared/src/index.ts`:

```ts
export * from './health.js';
export * from './model-gateway.js';
```

- [ ] **Step 5: 运行测试确认 GREEN**

Run:

```bash
pnpm --filter @salonai/shared test -- model-gateway
```

Expected: PASS，4 tests pass。

- [ ] **Step 6: 记录 shared 契约变更范围**

Run:

```bash
git status --short packages/shared/src/model-gateway.ts packages/shared/src/model-gateway.test.ts packages/shared/src/index.ts
```

Expected: shows the three shared files as changed or untracked. Do not run `git add` or `git commit` yet; Day1 完整验收后再统一处理 git。

## Task 2: Prisma 模型和 PrismaModule

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `.env.example`
- Modify: `apps/api/package.json`
- Create: `apps/api/src/prisma/prisma.module.ts`
- Create: `apps/api/src/prisma/prisma.service.ts`

- [ ] **Step 1: 安装 API 数据层依赖**

Run:

```bash
pnpm add --filter api @prisma/client
```

Expected: `apps/api/package.json` 增加 `@prisma/client`。

- [ ] **Step 2: 先验证 schema 尚未覆盖 Day1 模型**

Run:

```bash
rg -n "ModelConfig|ModelCall|ModelProviderKind|ModelCallStatus" prisma/schema.prisma
```

Expected: no matches。

- [ ] **Step 3: 写 Prisma schema**

Replace `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

enum ModelProviderKind {
  MOCK
  OPENAI_COMPATIBLE
}

enum ModelCallStatus {
  SUCCESS
  ERROR
}

model MigrationSmoke {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
}

model ModelConfig {
  id                       String            @id @default(cuid())
  name                     String            @unique
  providerKind             ModelProviderKind
  model                    String
  baseUrl                  String?
  apiKeyEnvName            String?
  enabled                  Boolean           @default(true)
  priority                 Int               @default(100)
  inputTokenPriceUsdPer1K  Decimal           @default(0) @db.Decimal(12, 8)
  outputTokenPriceUsdPer1K Decimal           @default(0) @db.Decimal(12, 8)
  createdAt                DateTime          @default(now())
  updatedAt                DateTime          @updatedAt
  calls                    ModelCall[]

  @@index([enabled, priority])
  @@index([providerKind])
}

model ModelCall {
  id                    String            @id @default(cuid())
  modelConfigId         String?
  modelConfig           ModelConfig?      @relation(fields: [modelConfigId], references: [id], onDelete: SetNull)
  tenantId              String?
  userId                String?
  providerKind          ModelProviderKind
  model                 String
  status                ModelCallStatus
  inputTokens           Int               @default(0)
  outputTokens          Int               @default(0)
  totalTokens           Int               @default(0)
  costUsd               Decimal           @default(0) @db.Decimal(12, 8)
  latencyMs             Int               @default(0)
  langfuseTraceId       String?
  langfuseGenerationId  String?
  errorCode             String?
  errorMessage          String?
  metadata              Json?
  createdAt             DateTime          @default(now())

  @@index([createdAt])
  @@index([tenantId, createdAt])
  @@index([modelConfigId, createdAt])
  @@index([status, createdAt])
}
```

- [ ] **Step 4: 更新根目录环境变量示例**

Modify `.env.example`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/salonai?schema=public"
SALONAI_API_URL="http://localhost:3000"

OPENAI_COMPATIBLE_BASE_URL="https://api.openai.com/v1"
OPENAI_COMPATIBLE_API_KEY=""
OPENAI_COMPATIBLE_MODEL="gpt-4o-mini"

LANGFUSE_SECRET_KEY=""
LANGFUSE_PUBLIC_KEY=""
LANGFUSE_BASE_URL="https://cloud.langfuse.com"
```

Expected: `.env.example` stays at the repository root. Do not create `apps/api/.env`; Day1 API will explicitly load the repository root `.env`.

- [ ] **Step 5: 验证 Prisma schema**

Run:

```bash
pnpm exec prisma validate --schema prisma/schema.prisma
```

Expected: PASS，Prisma schema is valid。

- [ ] **Step 6: 生成 migration**

Run:

```bash
pnpm db:migrate --name day1_model_gateway
```

Expected: migration created under `prisma/migrations/*_day1_model_gateway` and Prisma Client generated。

- [ ] **Step 7: 写 Prisma service**

Create `apps/api/src/prisma/prisma.service.ts`:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

Create `apps/api/src/prisma/prisma.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 8: 记录数据模型变更范围**

Run:

```bash
git status --short .env.example prisma/schema.prisma prisma/migrations apps/api/package.json apps/api/src/prisma
```

Expected: shows Prisma, env example and PrismaModule files as changed or untracked. Do not run `git add` or `git commit` yet; Day1 完整验收后再统一处理 git。

## Task 3: Mock provider 和 provider registry

**Files:**
- Create: `apps/api/src/model-gateway/providers/model-provider.types.ts`
- Create: `apps/api/src/model-gateway/providers/mock-model.provider.ts`
- Create: `apps/api/src/model-gateway/providers/mock-model.provider.spec.ts`
- Create: `apps/api/src/model-gateway/providers/model-provider.service.ts`

- [ ] **Step 1: 写 mock provider 失败测试**

Create `apps/api/src/model-gateway/providers/mock-model.provider.spec.ts`:

```ts
import { ModelProviderKind } from '@prisma/client';
import { MockModelProvider } from './mock-model.provider';

describe('MockModelProvider', () => {
  it('returns deterministic output and estimated usage', async () => {
    const provider = new MockModelProvider();

    const result = await provider.generate({
      config: {
        id: 'cfg_mock',
        providerKind: ModelProviderKind.MOCK,
        model: 'mock-salonai-day1',
        baseUrl: null,
        apiKeyEnvName: null,
      },
      messages: [{ role: 'user', content: '介绍模型网关' }],
      temperature: 0.2,
      maxOutputTokens: 128,
    });

    expect(result.outputText).toBe('Mock response: 介绍模型网关');
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(result.usage.outputTokens).toBeGreaterThan(0);
    expect(result.usage.totalTokens).toBe(result.usage.inputTokens + result.usage.outputTokens);
    expect(result.raw).toEqual({ provider: 'mock' });
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run:

```bash
pnpm --filter api test -- mock-model.provider
```

Expected: FAIL，原因是 provider 文件还不存在。

- [ ] **Step 3: 实现 provider interface**

Create `apps/api/src/model-gateway/providers/model-provider.types.ts`:

```ts
import type { ModelProviderKind } from '@prisma/client';
import type { ChatMessage, TokenUsage } from '@salonai/shared';

export type ProviderModelConfig = {
  id: string;
  providerKind: ModelProviderKind;
  model: string;
  baseUrl: string | null;
  apiKeyEnvName: string | null;
};

export type ProviderGenerateInput = {
  config: ProviderModelConfig;
  messages: ChatMessage[];
  temperature: number;
  maxOutputTokens: number;
};

export type ProviderGenerateResult = {
  outputText: string;
  usage: TokenUsage;
  raw: unknown;
};

export interface ModelProvider {
  readonly kind: ModelProviderKind;
  generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult>;
}

export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}
```

- [ ] **Step 4: 实现 mock provider 和 registry**

Create `apps/api/src/model-gateway/providers/mock-model.provider.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ModelProviderKind } from '@prisma/client';
import { estimateChatInputTokens, estimateTextTokens } from '@salonai/shared';
import type { ModelProvider, ProviderGenerateInput, ProviderGenerateResult } from './model-provider.types';

@Injectable()
export class MockModelProvider implements ModelProvider {
  readonly kind = ModelProviderKind.MOCK;

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    const lastUserMessage =
      [...input.messages].reverse().find((message) => message.role === 'user')?.content ??
      input.messages.at(-1)?.content ??
      '';
    const outputText = `Mock response: ${lastUserMessage}`;
    const inputTokens = estimateChatInputTokens(input.messages);
    const outputTokens = estimateTextTokens(outputText);

    return {
      outputText,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      raw: { provider: 'mock' },
    };
  }
}
```

Create `apps/api/src/model-gateway/providers/model-provider.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ModelProviderKind } from '@prisma/client';
import { MockModelProvider } from './mock-model.provider';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';
import type { ModelProvider } from './model-provider.types';

@Injectable()
export class ModelProviderService {
  private readonly providers: Map<ModelProviderKind, ModelProvider>;

  constructor(
    mockProvider: MockModelProvider,
    openAiCompatibleProvider: OpenAiCompatibleProvider,
  ) {
    this.providers = new Map<ModelProviderKind, ModelProvider>([
      [mockProvider.kind, mockProvider],
      [openAiCompatibleProvider.kind, openAiCompatibleProvider],
    ]);
  }

  getProvider(kind: ModelProviderKind): ModelProvider {
    const provider = this.providers.get(kind);

    if (!provider) {
      throw new Error(`No model provider registered for ${kind}`);
    }

    return provider;
  }
}
```

- [ ] **Step 5: 运行测试确认 GREEN**

Run:

```bash
pnpm --filter api test -- mock-model.provider
```

Expected: PASS。

## Task 4: OpenAI-compatible provider

**Files:**
- Create: `apps/api/src/model-gateway/providers/openai-compatible.provider.ts`
- Create: `apps/api/src/model-gateway/providers/openai-compatible.provider.spec.ts`

- [ ] **Step 1: 写 OpenAI-compatible provider 失败测试**

Create `apps/api/src/model-gateway/providers/openai-compatible.provider.spec.ts`:

```ts
import { ModelProviderKind } from '@prisma/client';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';
import { ProviderRequestError } from './model-provider.types';

describe('OpenAiCompatibleProvider', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.OPENAI_COMPATIBLE_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENAI_COMPATIBLE_API_KEY = originalEnv;
  });

  it('calls an OpenAI-compatible chat completions endpoint', async () => {
    process.env.OPENAI_COMPATIBLE_API_KEY = 'test-key';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '模型网关统一了模型调用入口。' } }],
        usage: { prompt_tokens: 12, completion_tokens: 9, total_tokens: 21 },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new OpenAiCompatibleProvider();
    const result = await provider.generate({
      config: {
        id: 'cfg_openai',
        providerKind: ModelProviderKind.OPENAI_COMPATIBLE,
        model: 'gpt-4o-mini',
        baseUrl: 'https://api.example.test/v1',
        apiKeyEnvName: 'OPENAI_COMPATIBLE_API_KEY',
      },
      messages: [{ role: 'user', content: '介绍模型网关' }],
      temperature: 0.2,
      maxOutputTokens: 128,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer test-key',
          'content-type': 'application/json',
        }),
      }),
    );
    expect(result.outputText).toBe('模型网关统一了模型调用入口。');
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 9, totalTokens: 21 });
  });

  it('throws a typed provider error when the API key is missing', async () => {
    delete process.env.OPENAI_COMPATIBLE_API_KEY;
    const provider = new OpenAiCompatibleProvider();

    await expect(
      provider.generate({
        config: {
          id: 'cfg_openai',
          providerKind: ModelProviderKind.OPENAI_COMPATIBLE,
          model: 'gpt-4o-mini',
          baseUrl: 'https://api.example.test/v1',
          apiKeyEnvName: 'OPENAI_COMPATIBLE_API_KEY',
        },
        messages: [{ role: 'user', content: '介绍模型网关' }],
        temperature: 0.2,
        maxOutputTokens: 128,
      }),
    ).rejects.toEqual(new ProviderRequestError('Missing API key env OPENAI_COMPATIBLE_API_KEY', 'missing_api_key'));
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run:

```bash
pnpm --filter api test -- openai-compatible.provider
```

Expected: FAIL，原因是 provider 文件还不存在。

- [ ] **Step 3: 实现 OpenAI-compatible provider**

Create `apps/api/src/model-gateway/providers/openai-compatible.provider.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ModelProviderKind } from '@prisma/client';
import { estimateChatInputTokens, estimateTextTokens } from '@salonai/shared';
import {
  ModelProvider,
  ProviderGenerateInput,
  ProviderGenerateResult,
  ProviderRequestError,
} from './model-provider.types';

type OpenAiCompatibleResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

@Injectable()
export class OpenAiCompatibleProvider implements ModelProvider {
  readonly kind = ModelProviderKind.OPENAI_COMPATIBLE;

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    const baseUrl = input.config.baseUrl ?? process.env.OPENAI_COMPATIBLE_BASE_URL;
    const model = input.config.model || process.env.OPENAI_COMPATIBLE_MODEL;
    const apiKeyEnvName = input.config.apiKeyEnvName ?? 'OPENAI_COMPATIBLE_API_KEY';
    const apiKey = process.env[apiKeyEnvName];

    if (!baseUrl) {
      throw new ProviderRequestError('Missing OpenAI-compatible base URL', 'missing_base_url');
    }

    if (!model) {
      throw new ProviderRequestError('Missing OpenAI-compatible model', 'missing_model');
    }

    if (!apiKey) {
      throw new ProviderRequestError(`Missing API key env ${apiKeyEnvName}`, 'missing_api_key');
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: input.messages,
        temperature: input.temperature,
        max_tokens: input.maxOutputTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ProviderRequestError(
        `OpenAI-compatible provider failed with ${response.status}: ${errorText}`,
        'provider_http_error',
      );
    }

    const body = (await response.json()) as OpenAiCompatibleResponse;
    const outputText = body.choices?.[0]?.message?.content ?? '';
    const inputTokens = body.usage?.prompt_tokens ?? estimateChatInputTokens(input.messages);
    const outputTokens = body.usage?.completion_tokens ?? estimateTextTokens(outputText);
    const totalTokens = body.usage?.total_tokens ?? inputTokens + outputTokens;

    return {
      outputText,
      usage: { inputTokens, outputTokens, totalTokens },
      raw: body,
    };
  }
}
```

- [ ] **Step 4: 运行测试确认 GREEN**

Run:

```bash
pnpm --filter api test -- openai-compatible.provider
```

Expected: PASS。

- [ ] **Step 5: 记录 provider 层变更范围**

Run:

```bash
git status --short apps/api/src/model-gateway/providers
```

Expected: shows provider files as changed or untracked. Do not run `git add` or `git commit` yet; Day1 完整验收后再统一处理 git。

## Task 5: ModelGatewayService、日志和 Langfuse generation

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/src/config/env.ts`
- Create: `apps/api/src/observability/langfuse.instrumentation.ts`
- Create: `apps/api/src/model-gateway/model-gateway.service.ts`
- Create: `apps/api/src/model-gateway/model-gateway.service.spec.ts`

- [ ] **Step 1: 安装配置、validation 和 Langfuse 依赖**

Run:

```bash
pnpm add --filter api @nestjs/config dotenv class-validator class-transformer @langfuse/tracing @langfuse/otel @opentelemetry/sdk-node
```

Expected: dependencies added。

- [ ] **Step 2: 写 service 编排失败测试**

Create `apps/api/src/model-gateway/model-gateway.service.spec.ts`:

```ts
import { BadGatewayException } from '@nestjs/common';
import { ModelCallStatus, ModelProviderKind } from '@prisma/client';
import { ModelGatewayService } from './model-gateway.service';
import { ProviderRequestError } from './providers/model-provider.types';

describe('ModelGatewayService', () => {
  it('creates a default OpenAI-compatible config, calls provider, and records a successful model call', async () => {
    const modelConfig = {
      id: 'cfg_real',
      name: 'day1-openai-compatible',
      providerKind: ModelProviderKind.OPENAI_COMPATIBLE,
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.example.test/v1',
      apiKeyEnvName: 'OPENAI_COMPATIBLE_API_KEY',
      inputTokenPriceUsdPer1K: { toNumber: () => 0.00015 },
      outputTokenPriceUsdPer1K: { toNumber: () => 0.0006 },
      enabled: true,
    };
    const prisma = {
      modelConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(modelConfig),
      },
      modelCall: {
        create: jest.fn().mockResolvedValue({
          id: 'call_real',
          createdAt: new Date('2026-05-24T00:00:00.000Z'),
        }),
      },
    };
    const provider = {
      generate: jest.fn().mockResolvedValue({
        outputText: '模型网关统一了模型调用入口。',
        usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
        raw: { provider: 'openai-compatible' },
      }),
    };
    const modelProviderService = { getProvider: jest.fn().mockReturnValue(provider) };
    const configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          OPENAI_COMPATIBLE_BASE_URL: 'https://api.example.test/v1',
          OPENAI_COMPATIBLE_MODEL: 'gpt-4o-mini',
        };
        return values[key];
      }),
    };
    const service = new ModelGatewayService(prisma as never, modelProviderService as never, configService as never);

    const response = await service.complete({
      messages: [{ role: 'user', content: '介绍模型网关' }],
      temperature: 0.2,
      maxOutputTokens: 128,
      traceName: 'model-gateway.test',
    });

    expect(modelProviderService.getProvider).toHaveBeenCalledWith(ModelProviderKind.OPENAI_COMPATIBLE);
    expect(prisma.modelConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'day1-openai-compatible',
          providerKind: ModelProviderKind.OPENAI_COMPATIBLE,
          model: 'gpt-4o-mini',
          baseUrl: 'https://api.example.test/v1',
          apiKeyEnvName: 'OPENAI_COMPATIBLE_API_KEY',
        }),
      }),
    );
    expect(prisma.modelCall.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ModelCallStatus.SUCCESS,
          modelConfigId: 'cfg_real',
          inputTokens: 10,
          outputTokens: 8,
          totalTokens: 18,
        }),
      }),
    );
    expect(response.modelCallId).toBe('call_real');
    expect(response.providerKind).toBe(ModelProviderKind.OPENAI_COMPATIBLE);
    expect(response.outputText).toBe('模型网关统一了模型调用入口。');
  });

  it('records an error model call when the provider fails', async () => {
    const modelConfig = {
      id: 'cfg_openai',
      name: 'openai',
      providerKind: ModelProviderKind.OPENAI_COMPATIBLE,
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.example.test/v1',
      apiKeyEnvName: 'OPENAI_COMPATIBLE_API_KEY',
      inputTokenPriceUsdPer1K: { toNumber: () => 0.00015 },
      outputTokenPriceUsdPer1K: { toNumber: () => 0.0006 },
      enabled: true,
    };
    const prisma = {
      modelConfig: {
        findFirst: jest.fn().mockResolvedValue(modelConfig),
        findUnique: jest.fn().mockResolvedValue(modelConfig),
      },
      modelCall: {
        create: jest.fn().mockResolvedValue({
          id: 'call_error',
          createdAt: new Date('2026-05-24T00:00:00.000Z'),
        }),
      },
    };
    const provider = {
      generate: jest.fn().mockRejectedValue(new ProviderRequestError('Missing API key env OPENAI_COMPATIBLE_API_KEY', 'missing_api_key')),
    };
    const modelProviderService = { getProvider: jest.fn().mockReturnValue(provider) };
    const configService = { get: jest.fn() };
    const service = new ModelGatewayService(prisma as never, modelProviderService as never, configService as never);

    await expect(
      service.complete({
        messages: [{ role: 'user', content: '介绍模型网关' }],
        temperature: 0.2,
        maxOutputTokens: 128,
        traceName: 'model-gateway.test',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(prisma.modelCall.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ModelCallStatus.ERROR,
          errorCode: 'missing_api_key',
        }),
      }),
    );
  });
});
```

- [ ] **Step 3: 运行测试确认 RED**

Run:

```bash
pnpm --filter api test -- model-gateway.service
```

Expected: FAIL，原因是 service 文件还不存在。

- [ ] **Step 4: 写根目录 .env loader**

Create `apps/api/src/config/env.ts`:

```ts
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { config } from 'dotenv';

const cwd = process.cwd();
const rootEnvPath = cwd.endsWith(`${sep}apps${sep}api`)
  ? resolve(cwd, '..', '..', '.env')
  : resolve(cwd, '.env');

export const ENV_FILE_PATHS = [rootEnvPath];

export function loadRootEnv(): string | undefined {
  const envPath = ENV_FILE_PATHS.find((candidate) => existsSync(candidate));

  if (!envPath) {
    return undefined;
  }

  config({ path: envPath, override: false });
  return envPath;
}
```

- [ ] **Step 5: 写 Langfuse instrumentation**

Create `apps/api/src/observability/langfuse.instrumentation.ts`:

```ts
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';

let sdk: NodeSDK | undefined;

export function startLangfuseInstrumentation(): NodeSDK | undefined {
  if (sdk) {
    return sdk;
  }

  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    return undefined;
  }

  sdk = new NodeSDK({
    spanProcessors: [new LangfuseSpanProcessor()],
  });
  sdk.start();
  return sdk;
}

export async function shutdownLangfuseInstrumentation(): Promise<void> {
  await sdk?.shutdown();
  sdk = undefined;
}
```

- [ ] **Step 6: 实现 ModelGatewayService**

Create `apps/api/src/model-gateway/model-gateway.service.ts`:

```ts
import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModelCallStatus, ModelProviderKind, Prisma } from '@prisma/client';
import { calculateCostEstimate, modelGatewayRequestSchema, ModelGatewayRequest, ModelGatewayResponse } from '@salonai/shared';
import { getActiveTraceId, startActiveObservation, startObservation } from '@langfuse/tracing';
import { PrismaService } from '../prisma/prisma.service';
import { ModelProviderService } from './providers/model-provider.service';
import { ProviderRequestError } from './providers/model-provider.types';

type ModelConfigForCall = {
  id: string;
  name: string;
  providerKind: ModelProviderKind;
  model: string;
  baseUrl: string | null;
  apiKeyEnvName: string | null;
  inputTokenPriceUsdPer1K: { toNumber(): number };
  outputTokenPriceUsdPer1K: { toNumber(): number };
  enabled: boolean;
};

@Injectable()
export class ModelGatewayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modelProviderService: ModelProviderService,
    private readonly configService: ConfigService,
  ) {}

  async listEnabledConfigs() {
    const configs = await this.prisma.modelConfig.findMany({
      where: { enabled: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        providerKind: true,
        model: true,
        enabled: true,
      },
    });

    if (configs.length > 0) {
      return configs;
    }

    const defaultConfig = await this.ensureDefaultOpenAiCompatibleConfig();
    return [
      {
        id: defaultConfig.id,
        name: defaultConfig.name,
        providerKind: defaultConfig.providerKind,
        model: defaultConfig.model,
        enabled: defaultConfig.enabled,
      },
    ];
  }

  async complete(input: ModelGatewayRequest): Promise<ModelGatewayResponse> {
    const request = modelGatewayRequestSchema.parse(input);
    const config = await this.resolveModelConfig(request.modelConfigId);
    const provider = this.modelProviderService.getProvider(config.providerKind);
    const startedAt = performance.now();
    let langfuseTraceId: string | null = null;
    let langfuseGenerationId: string | null = null;

    try {
      const providerResult = await startActiveObservation(request.traceName, async (span) => {
        span.update({
          input: {
            modelConfigId: config.id,
            providerKind: config.providerKind,
            model: config.model,
            messages: request.messages,
          },
          metadata: request.metadata,
        });

        const generation = startObservation(
          'model-gateway.generate',
          {
            model: config.model,
            input: request.messages,
            modelParameters: {
              temperature: request.temperature,
              maxOutputTokens: request.maxOutputTokens,
            },
          },
          { asType: 'generation' },
        );
        langfuseTraceId = getActiveTraceId() ?? null;
        langfuseGenerationId = generation.id ?? null;

        try {
          const result = await provider.generate({
            config,
            messages: request.messages,
            temperature: request.temperature,
            maxOutputTokens: request.maxOutputTokens,
          });

          generation
            .update({
              usageDetails: {
                input: result.usage.inputTokens,
                output: result.usage.outputTokens,
                total: result.usage.totalTokens,
              },
              output: { content: result.outputText },
            })
            .end();

          span.update({ output: { content: result.outputText } });
          return result;
        } catch (error) {
          generation
            .update({
              output: {
                error: error instanceof Error ? error.message : 'Unknown provider error',
              },
            })
            .end();
          throw error;
        }
      });

      const latencyMs = Math.round(performance.now() - startedAt);
      const costEstimate = calculateCostEstimate(providerResult.usage, {
        inputTokenPriceUsdPer1K: config.inputTokenPriceUsdPer1K.toNumber(),
        outputTokenPriceUsdPer1K: config.outputTokenPriceUsdPer1K.toNumber(),
      });
      const call = await this.prisma.modelCall.create({
        data: {
          modelConfigId: config.id,
          providerKind: config.providerKind,
          model: config.model,
          status: ModelCallStatus.SUCCESS,
          inputTokens: providerResult.usage.inputTokens,
          outputTokens: providerResult.usage.outputTokens,
          totalTokens: providerResult.usage.totalTokens,
          costUsd: new Prisma.Decimal(costEstimate.totalUsd),
          latencyMs,
          langfuseTraceId,
          langfuseGenerationId,
          metadata: request.metadata ?? Prisma.JsonNull,
        },
      });

      return {
        id: `cmpl_${call.id}`,
        modelCallId: call.id,
        providerKind: config.providerKind,
        model: config.model,
        outputText: providerResult.outputText,
        usage: providerResult.usage,
        costEstimate,
        latencyMs,
        langfuseTraceId,
        langfuseGenerationId,
        createdAt: call.createdAt.toISOString(),
      };
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startedAt);
      await this.prisma.modelCall.create({
        data: {
          modelConfigId: config.id,
          providerKind: config.providerKind,
          model: config.model,
          status: ModelCallStatus.ERROR,
          latencyMs,
          langfuseTraceId,
          langfuseGenerationId,
          errorCode: error instanceof ProviderRequestError ? error.code : 'model_gateway_error',
          errorMessage: error instanceof Error ? error.message : 'Unknown model gateway error',
          metadata: request.metadata ?? Prisma.JsonNull,
        },
      });

      throw new BadGatewayException('Model gateway call failed');
    }
  }

  private async resolveModelConfig(modelConfigId?: string): Promise<ModelConfigForCall> {
    if (modelConfigId) {
      const config = await this.prisma.modelConfig.findUnique({ where: { id: modelConfigId } });

      if (!config || !config.enabled) {
        throw new BadGatewayException('Model config is not available');
      }

      return config as ModelConfigForCall;
    }

    const config = await this.prisma.modelConfig.findFirst({
      where: { enabled: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    return (config ?? (await this.ensureDefaultOpenAiCompatibleConfig())) as ModelConfigForCall;
  }

  private async ensureDefaultOpenAiCompatibleConfig(): Promise<ModelConfigForCall> {
    const existing = await this.prisma.modelConfig.findFirst({
      where: { name: 'day1-openai-compatible' },
    });

    if (existing) {
      return existing as ModelConfigForCall;
    }

    const baseUrl = this.configService.get<string>('OPENAI_COMPATIBLE_BASE_URL') ?? null;
    const model = this.configService.get<string>('OPENAI_COMPATIBLE_MODEL') ?? '';

    return (await this.prisma.modelConfig.create({
      data: {
        name: 'day1-openai-compatible',
        providerKind: ModelProviderKind.OPENAI_COMPATIBLE,
        model,
        baseUrl,
        apiKeyEnvName: 'OPENAI_COMPATIBLE_API_KEY',
        priority: 1,
        inputTokenPriceUsdPer1K: new Prisma.Decimal(0),
        outputTokenPriceUsdPer1K: new Prisma.Decimal(0),
      },
    })) as ModelConfigForCall;
  }
}
```

- [ ] **Step 7: 运行 service 测试确认 GREEN**

Run:

```bash
pnpm --filter api test -- model-gateway.service
```

Expected: PASS。

## Task 6: Controller、DTO、Swagger/OpenAPI

**Files:**
- Create: `apps/api/src/model-gateway/dto/model-gateway.dto.ts`
- Create: `apps/api/src/model-gateway/model-gateway.controller.ts`
- Create: `apps/api/src/model-gateway/model-gateway.controller.spec.ts`
- Create: `apps/api/src/model-gateway/model-gateway.module.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: 写 controller 失败测试**

Create `apps/api/src/model-gateway/model-gateway.controller.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ModelProviderKind } from '@prisma/client';
import { ModelGatewayController } from './model-gateway.controller';
import { ModelGatewayService } from './model-gateway.service';

describe('ModelGatewayController', () => {
  it('delegates completion requests to ModelGatewayService', async () => {
    const service = {
      complete: jest.fn().mockResolvedValue({
        id: 'cmpl_call_real',
        modelCallId: 'call_real',
        providerKind: ModelProviderKind.OPENAI_COMPATIBLE,
        model: 'gpt-4o-mini',
        outputText: '模型网关统一了模型调用入口。',
        usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
        costEstimate: { inputUsd: 0, outputUsd: 0, totalUsd: 0 },
        latencyMs: 1,
        langfuseTraceId: null,
        langfuseGenerationId: null,
        createdAt: '2026-05-24T00:00:00.000Z',
      }),
      listEnabledConfigs: jest.fn().mockResolvedValue([
        {
          id: 'cfg_real',
          name: 'day1-openai-compatible',
          providerKind: ModelProviderKind.OPENAI_COMPATIBLE,
          model: 'gpt-4o-mini',
          enabled: true,
        },
      ]),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModelGatewayController],
      providers: [{ provide: ModelGatewayService, useValue: service }],
    }).compile();
    const controller = module.get(ModelGatewayController);

    await expect(
      controller.createCompletion({
        messages: [{ role: 'user', content: '介绍模型网关' }],
        temperature: 0.2,
        maxOutputTokens: 128,
      }),
    ).resolves.toEqual(expect.objectContaining({ modelCallId: 'call_real' }));
    await expect(controller.listConfigs()).resolves.toHaveLength(1);
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run:

```bash
pnpm --filter api test -- model-gateway.controller
```

Expected: FAIL，原因是 controller 文件还不存在。

- [ ] **Step 3: 写 DTO**

Create `apps/api/src/model-gateway/dto/model-gateway.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModelProviderKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ChatMessageDto {
  @ApiProperty({ enum: ['system', 'user', 'assistant'] })
  @IsIn(['system', 'user', 'assistant'])
  role!: 'system' | 'user' | 'assistant';

  @ApiProperty({ example: '用一句话介绍模型网关' })
  @IsString()
  content!: string;
}

export class CreateModelCompletionDto {
  @ApiProperty({ type: [ChatMessageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  @ApiPropertyOptional({ example: 'clw_model_config_id' })
  @IsOptional()
  @IsString()
  modelConfigId?: string;

  @ApiPropertyOptional({ example: 0.2, minimum: 0, maximum: 2, default: 0.2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({ example: 512, minimum: 1, maximum: 4096, default: 512 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4096)
  maxOutputTokens?: number;

  @ApiPropertyOptional({ example: 'model-gateway.completion' })
  @IsOptional()
  @IsString()
  traceName?: string;

  @ApiPropertyOptional({ example: { source: 'web-day1' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string | number | boolean>;
}

export class TokenUsageDto {
  @ApiProperty({ example: 10 })
  inputTokens!: number;

  @ApiProperty({ example: 8 })
  outputTokens!: number;

  @ApiProperty({ example: 18 })
  totalTokens!: number;
}

export class CostEstimateDto {
  @ApiProperty({ example: 0 })
  inputUsd!: number;

  @ApiProperty({ example: 0 })
  outputUsd!: number;

  @ApiProperty({ example: 0 })
  totalUsd!: number;
}

export class ModelCompletionResponseDto {
  @ApiProperty({ example: 'cmpl_call_real' })
  id!: string;

  @ApiProperty({ example: 'call_real' })
  modelCallId!: string;

  @ApiProperty({ enum: ModelProviderKind, example: ModelProviderKind.OPENAI_COMPATIBLE })
  providerKind!: ModelProviderKind;

  @ApiProperty({ example: 'gpt-4o-mini' })
  model!: string;

  @ApiProperty({ example: '模型网关统一了模型调用入口。' })
  outputText!: string;

  @ApiProperty({ type: TokenUsageDto })
  usage!: TokenUsageDto;

  @ApiProperty({ type: CostEstimateDto })
  costEstimate!: CostEstimateDto;

  @ApiProperty({ example: 12 })
  latencyMs!: number;

  @ApiProperty({ nullable: true, example: null })
  langfuseTraceId!: string | null;

  @ApiProperty({ nullable: true, example: null })
  langfuseGenerationId!: string | null;

  @ApiProperty({ example: '2026-05-24T00:00:00.000Z' })
  createdAt!: string;
}

export class ModelConfigSummaryDto {
  @ApiProperty({ example: 'cfg_real' })
  id!: string;

  @ApiProperty({ example: 'day1-openai-compatible' })
  name!: string;

  @ApiProperty({ enum: ModelProviderKind, example: ModelProviderKind.OPENAI_COMPATIBLE })
  providerKind!: ModelProviderKind;

  @ApiProperty({ example: 'gpt-4o-mini' })
  model!: string;

  @ApiProperty({ example: true })
  enabled!: boolean;
}
```

- [ ] **Step 4: 写 controller 和 module**

Create `apps/api/src/model-gateway/model-gateway.controller.ts`:

```ts
import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModelGatewayService } from './model-gateway.service';
import {
  CreateModelCompletionDto,
  ModelCompletionResponseDto,
  ModelConfigSummaryDto,
} from './dto/model-gateway.dto';

@ApiTags('model-gateway')
@Controller('model-gateway')
export class ModelGatewayController {
  constructor(private readonly modelGatewayService: ModelGatewayService) {}

  @Get('configs')
  @ApiOperation({ operationId: 'listModelConfigs', summary: 'List enabled model configs' })
  @ApiOkResponse({ type: [ModelConfigSummaryDto] })
  listConfigs(): Promise<ModelConfigSummaryDto[]> {
    return this.modelGatewayService.listEnabledConfigs();
  }

  @Post('completions')
  @ApiOperation({ operationId: 'createModelCompletion', summary: 'Create a non-streaming model completion' })
  @ApiCreatedResponse({ type: ModelCompletionResponseDto })
  createCompletion(@Body() body: CreateModelCompletionDto): Promise<ModelCompletionResponseDto> {
    return this.modelGatewayService.complete({
      modelConfigId: body.modelConfigId,
      messages: body.messages,
      temperature: body.temperature,
      maxOutputTokens: body.maxOutputTokens,
      traceName: body.traceName,
      metadata: body.metadata,
    });
  }
}
```

Create `apps/api/src/model-gateway/model-gateway.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ModelGatewayController } from './model-gateway.controller';
import { ModelGatewayService } from './model-gateway.service';
import { MockModelProvider } from './providers/mock-model.provider';
import { ModelProviderService } from './providers/model-provider.service';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';

@Module({
  controllers: [ModelGatewayController],
  providers: [
    ModelGatewayService,
    ModelProviderService,
    MockModelProvider,
    OpenAiCompatibleProvider,
  ],
  exports: [ModelGatewayService],
})
export class ModelGatewayModule {}
```

- [ ] **Step 5: 接入 AppModule 和 main.ts**

Modify `apps/api/src/app.module.ts`:

```ts
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ENV_FILE_PATHS } from './config/env';
import { HealthController } from './health/health.controller';
import { ModelGatewayModule } from './model-gateway/model-gateway.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV_FILE_PATHS,
    }),
    PrismaModule,
    ModelGatewayModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
```

Modify `apps/api/src/main.ts`:

```ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { loadRootEnv } from './config/env';
import { shutdownLangfuseInstrumentation, startLangfuseInstrumentation } from './observability/langfuse.instrumentation';

loadRootEnv();
const langfuseSdk = startLangfuseInstrumentation();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SalonAI API')
    .setDescription('SalonAI Agent API')
    .setVersion('0.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'openapi.json',
  });

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();

process.once('SIGTERM', () => {
  void shutdownLangfuseInstrumentation().finally(() => process.exit(0));
});

process.once('SIGINT', () => {
  void shutdownLangfuseInstrumentation().finally(() => process.exit(0));
});

void langfuseSdk;
```

- [ ] **Step 6: 运行 API 单测**

Run:

```bash
pnpm --filter api test -- model-gateway
```

Expected: PASS。

- [ ] **Step 7: 记录 API 模型网关变更范围**

Run:

```bash
git status --short apps/api/src/main.ts apps/api/src/app.module.ts apps/api/src/config apps/api/src/observability apps/api/src/model-gateway apps/api/package.json
```

Expected: shows API model gateway files as changed or untracked. Do not run `git add` or `git commit` yet; Day1 完整验收后再统一处理 git。

## Task 7: Orval React Query hooks 和 Web 调用面板

**Files:**
- Modify: `orval.config.ts`
- Modify: `packages/api-client/package.json`
- Modify: `packages/api-client/src/index.ts`
- Create: `packages/api-client/src/fetcher.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`

- [ ] **Step 1: 安装 Web 和 API client 依赖**

Run:

```bash
pnpm add --filter web @salonai/api-client@workspace:* @tanstack/react-query
pnpm add --filter @salonai/api-client @tanstack/react-query
```

Expected: `apps/web/package.json` and `packages/api-client/package.json` updated。

- [ ] **Step 2: 修改 Orval 输出为 React Query hooks**

Modify `orval.config.ts`:

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  salonai: {
    input: 'http://localhost:3000/openapi.json',
    output: {
      mode: 'split',
      target: 'packages/api-client/src/generated/salonai.ts',
      schemas: 'packages/api-client/src/generated/model',
      client: 'react-query',
      clean: true,
      override: {
        mutator: {
          path: 'packages/api-client/src/fetcher.ts',
          name: 'salonaiFetch',
        },
      },
    },
  },
});
```

Modify `packages/api-client/src/index.ts`:

```ts
export * from './generated/salonai';
export * from './generated/model';
```

Create `packages/api-client/src/fetcher.ts`:

```ts
export type BodyType<BodyData> = BodyData;

type FetchMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type FetchOptions<TBody> = {
  method: FetchMethod;
  params?: Record<string, string | number | boolean | undefined>;
  body?: TBody;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

export type ErrorType<ErrorData> = Error & { data?: ErrorData; status?: number };

export async function salonaiFetch<TResponse, TBody = unknown>(
  url: string,
  options: FetchOptions<TBody>,
): Promise<TResponse> {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(options.params ?? {})) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  const targetUrl = `/api${url}${queryString.length > 0 ? `?${queryString}` : ''}`;

  const response = await fetch(targetUrl, {
    method: options.method,
    headers: {
      'content-type': 'application/json',
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  const text = await response.text();
  const data = text.length > 0 ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const error = new Error(`SalonAI request failed with ${response.status}`) as ErrorType<unknown>;
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as TResponse;
}
```

- [ ] **Step 3: 启动 API 并重新生成 client**

Run:

```bash
pnpm --filter api start:dev
```

Expected: API listening on `http://localhost:3000`。

In another terminal:

```bash
pnpm api:generate
```

Expected: generated client exports `useListModelConfigs` and `useCreateModelCompletion`。

- [ ] **Step 4: 给 Web 增加 QueryClientProvider**

Modify `apps/web/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 5: 写 Web 模型调用面板**

Modify `apps/web/src/App.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useCreateModelCompletion, useListModelConfigs } from '@salonai/api-client';
import { healthResponseSchema, modelGatewayResponseSchema, type HealthResponse } from '@salonai/shared';
import './App.css';

type HealthState =
  | { status: 'loading' }
  | { status: 'healthy'; data: HealthResponse }
  | { status: 'unavailable'; message: string };

async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health');

  if (!response.ok) {
    throw new Error(`Health request failed with ${response.status}`);
  }

  return healthResponseSchema.parse(await response.json());
}

function App() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });
  const [prompt, setPrompt] = useState('用一句话介绍 SalonAI 的模型网关');
  const configsQuery = useListModelConfigs({
    query: {
      queryKey: ['model-gateway-configs'],
    },
  });
  const completionMutation = useCreateModelCompletion();
  const completion =
    completionMutation.data === undefined
      ? null
      : modelGatewayResponseSchema.parse(completionMutation.data);

  useEffect(() => {
    let cancelled = false;

    fetchHealth()
      .then((data) => {
        if (!cancelled) {
          setHealth({ status: 'healthy', data });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setHealth({
            status: 'unavailable',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app-shell">
      <section className="health-panel">
        <p className="eyebrow">SalonAI Engineering Baseline</p>
        <h1>Day 1 Model Gateway</h1>

        {health.status === 'loading' && <p className="status muted">Checking API...</p>}

        {health.status === 'healthy' && (
          <dl className="health-grid">
            <div>
              <dt>Status</dt>
              <dd className="ok">{health.data.status}</dd>
            </div>
            <div>
              <dt>Service</dt>
              <dd>{health.data.service}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{health.data.version}</dd>
            </div>
            <div>
              <dt>Timestamp</dt>
              <dd>{health.data.timestamp}</dd>
            </div>
          </dl>
        )}

        {health.status === 'unavailable' && (
          <p className="status error">API unavailable: {health.message}</p>
        )}
      </section>

      <section className="gateway-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Non-streaming completion</p>
            <h2>Model Gateway</h2>
          </div>
          <span className="provider-pill">
            {configsQuery.data?.[0]
              ? `${configsQuery.data[0].providerKind} · ${configsQuery.data[0].model}`
              : 'OPENAI_COMPATIBLE'}
          </span>
        </div>

        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          aria-label="Model prompt"
        />

        <button
          type="button"
          onClick={() =>
            completionMutation.mutate({
              data: {
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.2,
                maxOutputTokens: 256,
                traceName: 'web.day1.model-gateway',
                metadata: { source: 'web' },
              },
            })
          }
          disabled={completionMutation.isPending || prompt.trim().length === 0}
        >
          {completionMutation.isPending ? 'Running...' : 'Run model gateway'}
        </button>

        {completionMutation.isError && (
          <p className="status error">Model call failed: {completionMutation.error.message}</p>
        )}

        {completion && (
          <div className="completion-result">
            <p>{completion.outputText}</p>
            <dl className="health-grid compact">
              <div>
                <dt>Model</dt>
                <dd>{completion.model}</dd>
              </div>
              <div>
                <dt>Latency</dt>
                <dd>{completion.latencyMs} ms</dd>
              </div>
              <div>
                <dt>Tokens</dt>
                <dd>{completion.usage.totalTokens}</dd>
              </div>
              <div>
                <dt>Cost</dt>
                <dd>${completion.costEstimate.totalUsd.toFixed(8)}</dd>
              </div>
            </dl>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
```

- [ ] **Step 6: 补充 Web 样式**

Append to `apps/web/src/App.css`:

```css
.gateway-panel {
  width: min(920px, calc(100vw - 32px));
  margin: 24px auto 0;
  padding: 24px;
  border: 1px solid #d8dee9;
  border-radius: 8px;
  background: #ffffff;
  color: #1f2937;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.panel-header h2 {
  margin: 4px 0 0;
  font-size: 24px;
}

.provider-pill {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 13px;
  font-weight: 700;
}

.gateway-panel textarea {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 12px;
  font: inherit;
  color: #111827;
  background: #f8fafc;
}

.gateway-panel button {
  margin-top: 12px;
  min-height: 40px;
  border: 0;
  border-radius: 8px;
  padding: 0 16px;
  background: #0f766e;
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
}

.gateway-panel button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.completion-result {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid #e5e7eb;
}

.compact {
  margin-top: 12px;
}
```

- [ ] **Step 7: 运行 Web build**

Run:

```bash
pnpm --filter web build
```

Expected: PASS。

- [ ] **Step 8: 记录 API client 和 Web 调用面板变更范围**

Run:

```bash
git status --short orval.config.ts packages/api-client apps/web
```

Expected: shows API client and Web files as changed or untracked. Do not run `git add` or `git commit` yet; Day1 完整验收后再统一处理 git。

## Task 8: HTTP 脚本、Day1 记录和整体验收

**Files:**
- Create: `docs/http/model-gateway.http`
- Create: `docs/badcases/day-1.md`
- Create: `docs/interview/day-1-model-gateway.md`

- [ ] **Step 1: 写 HTTP 调试脚本**

Create `docs/http/model-gateway.http`:

```http
### List enabled model configs
GET http://localhost:3000/model-gateway/configs
Accept: application/json

### Create real model completion
POST http://localhost:3000/model-gateway/completions
Content-Type: application/json
Accept: application/json

{
  "messages": [
    {
      "role": "system",
      "content": "你是 SalonAI 的模型网关调试助手。"
    },
    {
      "role": "user",
      "content": "用一句话介绍模型网关的价值。"
    }
  ],
  "temperature": 0.2,
  "maxOutputTokens": 256,
  "traceName": "http.day1.model-gateway",
  "metadata": {
    "source": "http"
  }
}
```

- [ ] **Step 2: 写 bad case 记录**

Create `docs/badcases/day-1.md`:

```markdown
# Day 1 Bad Case: Model Gateway

## Case

OpenAI-compatible provider 没有配置 API key 时，真实模型调用失败。

## Root Cause

provider 需要通过 `apiKeyEnvName` 读取环境变量。缺少环境变量时不能继续调用外部模型。

## Expected Behavior

API 返回 502，`ModelCall` 记录 `status=ERROR`、`errorCode=missing_api_key`、`errorMessage`，不会把空响应当成成功结果。

## Regression Check

Run:

```bash
pnpm --filter api test -- openai-compatible.provider model-gateway.service
```
```

- [ ] **Step 3: 写面试表达**

Create `docs/interview/day-1-model-gateway.md`:

```markdown
# Day 1 Interview Notes: Model Gateway

## 为什么需要模型网关

模型网关把业务代码和具体模型 provider 解耦。业务侧只提交 messages、temperature、maxOutputTokens，网关负责选择模型配置、调用 provider、记录 token、成本、延迟和 trace。

## 多模型 fallback 怎么设计

Day 1 先实现 provider 抽象和启用配置的优先级选择。fallback 可以在同一个抽象上扩展：当主 provider 抛出可重试错误时，按 `priority` 选择下一个 enabled config，并把每一次尝试写入 `ModelCall`。

## 成本如何统计

provider 优先读取真实 usage；没有 usage 时使用保守 token 估算。成本按 `inputTokenPriceUsdPer1K` 和 `outputTokenPriceUsdPer1K` 计算，并随 `ModelCall` 保存，后续可按用户、租户、模型配置聚合。

## 为什么 provider 要抽象

不同模型供应商的鉴权、URL、字段、usage 结构和错误格式不同。抽象后，Agent Runtime、Web、CLI 不需要知道供应商细节，也便于测试 mock provider 和接入新的 OpenAI-compatible provider。
```

- [ ] **Step 4: 启动依赖并迁移数据库**

Run:

```bash
docker compose -f infra/docker-compose.yml up -d postgres
pnpm db:migrate
```

Expected: PostgreSQL running and migrations applied。

- [ ] **Step 5: 确认根目录 .env 已提供真实验收变量**

Run:

```bash
pnpm --filter api start:dev
```

Expected: API starts without asking for `apps/api/.env`. The API process reads the repository root `.env`, which must contain `OPENAI_COMPATIBLE_BASE_URL`, `OPENAI_COMPATIBLE_MODEL`, `OPENAI_COMPATIBLE_API_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_BASE_URL`。

Stop the dev server with `Ctrl-C` after confirming startup.

- [ ] **Step 6: 运行完整质量检查**

Run:

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec prisma validate --schema prisma/schema.prisma
```

Expected: all commands PASS。

- [ ] **Step 7: 验证 OpenAPI 和 Orval**

Run:

```bash
pnpm --filter api start:dev
```

In another terminal:

```bash
pnpm api:generate
rg -n "useCreateModelCompletion|useListModelConfigs" packages/api-client/src/generated
```

Expected: generated React Query hooks are present。

- [ ] **Step 8: 验证 HTTP 真实模型 completion**

Run the second request in `docs/http/model-gateway.http`.

Expected response includes:

```json
{
  "providerKind": "OPENAI_COMPATIBLE",
  "model": "the model configured in OPENAI_COMPATIBLE_MODEL",
  "usage": {
    "totalTokens": 1
  },
  "costEstimate": {
    "totalUsd": 0
  }
}
```

The exact token count can be greater than `1`; the important check is that `totalTokens` is positive and `modelCallId` is present.

- [ ] **Step 9: 验证数据库 ModelCall 成功记录**

Run:

```bash
docker compose -f infra/docker-compose.yml exec postgres psql -U postgres -d salonai -c 'select "id", "providerKind", "model", "status", "inputTokens", "outputTokens", "totalTokens", "costUsd", "latencyMs", "langfuseTraceId", "langfuseGenerationId" from "ModelCall" order by "createdAt" desc limit 1;'
```

Expected: `ModelCall` contains a `SUCCESS` row for the real HTTP request. It has `providerKind=OPENAI_COMPATIBLE`, positive `inputTokens`, positive `outputTokens`, positive `totalTokens`, nonnegative `costUsd`, nonnegative `latencyMs`, and nonempty `modelCallId` from the API response.

- [ ] **Step 10: 验证 Langfuse generation**

Run one `POST /model-gateway/completions` request.

Expected: Langfuse project shows a trace named `http.day1.model-gateway` with a `model-gateway.generate` generation containing model, input, output and usage details.

- [ ] **Step 11: 验证 Web 非流式调用**

Run:

```bash
pnpm dev
```

Open `http://localhost:5173`.

Expected:
- health panel is healthy。
- model gateway panel lists `OPENAI_COMPATIBLE` provider and the configured model。
- clicking `Run model gateway` renders output text, model, latency, token count and cost。

- [ ] **Step 12: 记录 Day1 文档和验收记录变更范围**

Run:

```bash
git status --short docs/http/model-gateway.http docs/badcases/day-1.md docs/interview/day-1-model-gateway.md
```

Expected: shows Day1 docs as changed or untracked. Do not run `git add` or `git commit` yet; Day1 完整验收后再统一处理 git。

## 自查

**Spec coverage:** Day1 的 `ModelGatewayModule`、`ModelProviderService`、OpenAI-compatible provider、Mock provider、model config 表、model call 日志、Langfuse generation、Swagger/OpenAPI、Orval hooks、`docs/http/model-gateway.http` 都有对应任务。全文里的共享 schema、API client 自动生成、Web 使用 TanStack Query、`.http` 调试脚本、每日 bad case、面试表达也已纳入。

**Placeholder scan:** 计划没有空白实现步骤；每个新增文件都有明确路径、命令或代码块；真实模型和 Langfuse 是 Day1 必须验收项，mock provider 只用于单测和兜底调试。

**Type consistency:** API、Prisma 和 shared 都使用 `MOCK` / `OPENAI_COMPATIBLE`；REST operationId 固定为 `listModelConfigs` 和 `createModelCompletion`，用于稳定生成 `useListModelConfigs` 和 `useCreateModelCompletion`。
