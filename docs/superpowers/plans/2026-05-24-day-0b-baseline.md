# Day 0B Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 SalonAI 的最小可运行工程基线，让 Web、API、CLI、Prisma、OpenAPI、Orval、HTTP 调试脚本和 Docker 本地依赖通过 health check 闭环。

**Architecture:** API 提供 `/health` 和 OpenAPI 文档；Web 通过 Vite proxy 请求 `/api/health`，服务端不启用 CORS；CLI 使用 Commander 直接请求 API。共享 health 契约放在 `packages/shared`，Orval 从 API OpenAPI 生成 `packages/api-client`。

**Tech Stack:** pnpm workspace、TypeScript、NestJS、React/Vite、Commander、Zod、Prisma、PostgreSQL、Redis、Milvus、Langfuse、Swagger/OpenAPI、Orval。

---

## 文件结构

- Modify: `package.json`，根 workspace scripts 和 dev dependencies。
- Modify: `pnpm-workspace.yaml`，保持 workspace 和 `allowBuilds`。
- Create: `packages/shared/package.json`，共享包 manifest。
- Create: `packages/shared/tsconfig.json`，共享包 TypeScript 配置。
- Create: `packages/shared/src/health.ts`，health schema 和类型。
- Create: `packages/shared/src/index.ts`，共享包出口。
- Modify: `apps/api/package.json`，增加 Swagger 和 shared workspace 依赖。
- Modify: `apps/api/src/main.ts`，增加 Swagger，不启用 CORS。
- Modify: `apps/api/src/app.module.ts`，挂载 health controller。
- Create: `apps/api/src/health/health.controller.ts`，API health endpoint。
- Create: `apps/api/src/health/health.controller.spec.ts`，health controller 单测。
- Modify: `apps/web/package.json`，增加 shared workspace 依赖。
- Modify: `apps/web/vite.config.ts`，增加 `/api` proxy。
- Replace: `apps/web/src/App.tsx`，health 状态页。
- Replace: `apps/web/src/App.css`，health 状态页样式。
- Modify: `apps/cli/package.json`，增加 Commander、tsx、shared workspace 依赖和 `salonai` bin。
- Create: `apps/cli/src/index.ts`，CLI 入口。
- Create: `apps/cli/src/health.ts`，CLI health 实现。
- Create: `apps/cli/tsconfig.json`，CLI TypeScript 配置。
- Create: `prisma/schema.prisma`，最小 Prisma schema。
- Create: `prisma.config.ts`，Prisma 7 CLI 配置。
- Create: `.env.example`，本地默认环境变量模板。
- Create: `orval.config.ts`，OpenAPI client 生成配置。
- Create: `packages/api-client/package.json`，生成包 manifest。
- Create: `packages/api-client/src/index.ts`，生成前占位出口。
- Create: `docs/http/health.http`，health 手动调试脚本。
- Create: `infra/docker-compose.yml`，本地 PostgreSQL、Redis、Milvus、Langfuse。
- Create: `infra/postgres/init/01-create-databases.sql`，为 SalonAI 创建 `salonai` 数据库。

## Task 1: 根 workspace 和 shared health 契约

**Files:**
- Modify: `package.json`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/health.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: 安装根开发依赖**

Run:

```bash
pnpm add -D -w concurrently prettier prisma orval
```

Expected: 安装成功，`package.json` 和 `pnpm-lock.yaml` 更新。

- [ ] **Step 2: 写 shared health 测试**

Create `packages/shared/src/health.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health';

describe('healthResponseSchema', () => {
  it('accepts a valid health response', () => {
    const result = healthResponseSchema.parse({
      status: 'ok',
      service: 'salonai-api',
      timestamp: '2026-05-24T00:00:00.000Z',
      version: '0.0.0',
    });

    expect(result.status).toBe('ok');
  });

  it('rejects invalid status values', () => {
    expect(() =>
      healthResponseSchema.parse({
        status: 'down',
        service: 'salonai-api',
        timestamp: '2026-05-24T00:00:00.000Z',
        version: '0.0.0',
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 3: 运行测试确认 RED**

Run:

```bash
pnpm --filter @salonai/shared test
```

Expected: FAIL，原因是 `packages/shared/package.json` 或 `health.ts` 尚不存在。

- [ ] **Step 4: 实现 shared package**

Create `packages/shared/package.json`:

```json
{
  "name": "@salonai/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.0.15"
  }
}
```

Create `packages/shared/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

Create `packages/shared/src/health.ts`:

```ts
import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('salonai-api'),
  timestamp: z.string().datetime(),
  version: z.string().min(1),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
```

Create `packages/shared/src/index.ts`:

```ts
export * from './health';
```

- [ ] **Step 5: 更新根 scripts**

Modify `package.json` scripts:

```json
{
  "scripts": {
    "dev": "concurrently -n api,web -c cyan,magenta \"pnpm --filter api start:dev\" \"pnpm --filter web dev\"",
    "build": "pnpm -r --if-present build",
    "test": "pnpm -r --if-present test",
    "lint": "pnpm -r --if-present lint",
    "format": "prettier --write .",
    "db:migrate": "prisma migrate dev --schema prisma/schema.prisma",
    "api:generate": "orval --config orval.config.ts",
    "cli:health": "pnpm --filter cli health",
    "docker:up": "docker compose -f infra/docker-compose.yml up"
  }
}
```

- [ ] **Step 6: 运行测试确认 GREEN**

Run:

```bash
pnpm --filter @salonai/shared test
```

Expected: PASS，2 tests pass。

## Task 2: API health 和 Swagger

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/src/health/health.controller.ts`
- Create: `apps/api/src/health/health.controller.spec.ts`

- [ ] **Step 1: 安装 API 依赖**

Run:

```bash
pnpm add --filter api @salonai/shared@workspace:* @nestjs/swagger swagger-ui-express
pnpm add -D --filter api @types/swagger-ui-express
```

Expected: 安装成功。

- [ ] **Step 2: 写 health controller 测试**

Create `apps/api/src/health/health.controller.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { healthResponseSchema } from '@salonai/shared';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns a valid health response', () => {
    const response = controller.getHealth();

    expect(healthResponseSchema.parse(response)).toEqual(response);
    expect(response.status).toBe('ok');
    expect(response.service).toBe('salonai-api');
  });
});
```

- [ ] **Step 3: 运行测试确认 RED**

Run:

```bash
pnpm --filter api test -- health.controller.spec.ts
```

Expected: FAIL，原因是 `HealthController` 尚不存在。

- [ ] **Step 4: 实现 health controller**

Create `apps/api/src/health/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@salonai/shared';

const API_VERSION = '0.0.0';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({
    description: 'SalonAI API health status',
    schema: {
      example: {
        status: 'ok',
        service: 'salonai-api',
        timestamp: '2026-05-24T00:00:00.000Z',
        version: API_VERSION,
      },
    },
  })
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'salonai-api',
      timestamp: new Date().toISOString(),
      version: API_VERSION,
    };
  }
}
```

Modify `apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';

@Module({
  imports: [],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
```

Modify `apps/api/src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SalonAI API')
    .setDescription('SalonAI Agent API')
    .setVersion('0.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  app.getHttpAdapter().get('/openapi.json', (_request, response) => {
    response.json(document);
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **Step 5: 运行 API 测试确认 GREEN**

Run:

```bash
pnpm --filter api test -- health.controller.spec.ts
```

Expected: PASS，health controller test pass。

## Task 3: Web health 页和 Vite proxy

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/vite.config.ts`
- Replace: `apps/web/src/App.tsx`
- Replace: `apps/web/src/App.css`

- [ ] **Step 1: 安装 Web workspace 依赖**

Run:

```bash
pnpm add --filter web @salonai/shared@workspace:*
```

Expected: 安装成功。

- [ ] **Step 2: 配置 Vite proxy**

Modify `apps/web/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

- [ ] **Step 3: 替换 Web health 页面**

Replace `apps/web/src/App.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { healthResponseSchema, type HealthResponse } from '@salonai/shared';
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
        <h1>Day 0B Health Check</h1>

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
    </main>
  );
}

export default App;
```

Replace `apps/web/src/App.css`:

```css
.app-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px;
  background: #f7f7f4;
  color: #1f2933;
}

.health-panel {
  width: min(720px, 100%);
  border: 1px solid #d8ddd2;
  border-radius: 8px;
  background: #ffffff;
  padding: 32px;
  box-shadow: 0 12px 32px rgb(31 41 51 / 8%);
}

.eyebrow {
  margin: 0 0 12px;
  color: #5b6b73;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0;
}

.health-panel h1 {
  margin: 0 0 24px;
  font-size: 2rem;
  line-height: 1.2;
}

.health-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin: 0;
}

.health-grid div {
  border: 1px solid #e3e7df;
  border-radius: 8px;
  padding: 16px;
}

.health-grid dt {
  margin-bottom: 8px;
  color: #5b6b73;
  font-size: 0.875rem;
}

.health-grid dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-weight: 600;
}

.status {
  margin: 0;
  font-weight: 600;
}

.muted {
  color: #5b6b73;
}

.ok {
  color: #047857;
}

.error {
  color: #b42318;
}
```

- [ ] **Step 4: 运行 Web 构建检查**

Run:

```bash
pnpm --filter web build
```

Expected: PASS，Vite build succeeds。

## Task 4: Commander CLI health

**Files:**
- Modify: `apps/cli/package.json`
- Create: `apps/cli/tsconfig.json`
- Create: `apps/cli/src/health.ts`
- Create: `apps/cli/src/index.ts`

- [ ] **Step 1: 安装 CLI 依赖**

Run:

```bash
pnpm add --filter cli @salonai/shared@workspace:* commander
pnpm add -D --filter cli tsx typescript vitest
```

Expected: 安装成功。

- [ ] **Step 2: 写 CLI health URL 测试**

Create `apps/cli/src/health.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildHealthUrl } from './health';

describe('buildHealthUrl', () => {
  it('uses the default local API URL', () => {
    expect(buildHealthUrl(undefined)).toBe('http://localhost:3000/health');
  });

  it('trims trailing slashes from custom API URL', () => {
    expect(buildHealthUrl('http://localhost:4000/')).toBe('http://localhost:4000/health');
  });
});
```

- [ ] **Step 3: 运行测试确认 RED**

Run:

```bash
pnpm --filter cli test
```

Expected: FAIL，原因是 `apps/cli/src/health.ts` 尚不存在。

- [ ] **Step 4: 实现 CLI**

Modify `apps/cli/package.json`:

```json
{
  "name": "cli",
  "version": "1.0.0",
  "description": "",
  "type": "module",
  "bin": {
    "salonai": "./src/index.ts"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "health": "tsx src/index.ts health",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@salonai/shared": "workspace:*",
    "commander": "^14.0.2"
  },
  "devDependencies": {
    "tsx": "^4.21.0",
    "typescript": "^5.9.3",
    "vitest": "^4.0.15"
  }
}
```

Create `apps/cli/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

Create `apps/cli/src/health.ts`:

```ts
import { healthResponseSchema } from '@salonai/shared';

const DEFAULT_API_URL = 'http://localhost:3000';

export function buildHealthUrl(apiUrl: string | undefined): string {
  const baseUrl = (apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, '');
  return `${baseUrl}/health`;
}

export async function runHealthCommand(apiUrl = process.env.SALONAI_API_URL): Promise<void> {
  const healthUrl = buildHealthUrl(apiUrl);
  const response = await fetch(healthUrl);

  if (!response.ok) {
    throw new Error(`Health request failed with ${response.status}`);
  }

  const health = healthResponseSchema.parse(await response.json());
  console.log(`${health.service} ${health.status} ${health.version} ${health.timestamp}`);
}
```

Create `apps/cli/src/index.ts`:

```ts
#!/usr/bin/env node
import { Command } from 'commander';
import { runHealthCommand } from './health';

const program = new Command();

program.name('salonai').description('SalonAI command line tools').version('0.0.0');

program
  .command('health')
  .description('Check the SalonAI API health endpoint')
  .action(async () => {
    try {
      await runHealthCommand();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`SalonAI API unavailable: ${message}`);
      process.exitCode = 1;
    }
  });

program.parseAsync();
```

- [ ] **Step 5: 运行 CLI 测试确认 GREEN**

Run:

```bash
pnpm --filter cli test
```

Expected: PASS，2 tests pass。

## Task 5: Prisma、Orval、HTTP 脚本

**Files:**
- Create: `.env.example`
- Create: `prisma/schema.prisma`
- Create: `orval.config.ts`
- Create: `packages/api-client/package.json`
- Create: `packages/api-client/src/index.ts`
- Create: `docs/http/health.http`

- [ ] **Step 1: 安装 Prisma client**

Run:

```bash
pnpm add -w @prisma/client
```

Expected: 安装成功。

- [ ] **Step 2: 写 Prisma schema**

Create `.env.example`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/salonai?schema=public"
SALONAI_API_URL="http://localhost:3000"
```

Create `prisma.config.ts`:

```ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

model MigrationSmoke {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
}
```

- [ ] **Step 3: 写 Orval 配置**

Create `orval.config.ts`:

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  salonai: {
    input: 'http://localhost:3000/openapi.json',
    output: {
      mode: 'split',
      target: 'packages/api-client/src/generated/salonai.ts',
      schemas: 'packages/api-client/src/generated/model',
      client: 'fetch',
      clean: true,
    },
  },
});
```

Create `packages/api-client/package.json`:

```json
{
  "name": "@salonai/api-client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

Create `packages/api-client/src/index.ts`:

```ts
export {};
```

- [ ] **Step 4: 写 HTTP 调试脚本**

Create `docs/http/health.http`:

```http
### SalonAI API health
GET http://localhost:3000/health
Accept: application/json

### SalonAI OpenAPI JSON
GET http://localhost:3000/openapi.json
Accept: application/json
```

- [ ] **Step 5: API 运行后验证 Orval**

Run API in one terminal:

```bash
pnpm --filter api start:dev
```

Run in another terminal:

```bash
pnpm api:generate
```

Expected: PASS，生成 `packages/api-client/src/generated` 文件。

## Task 6: Docker Compose 本地依赖

**Files:**
- Create: `infra/docker-compose.yml`
- Create: `infra/postgres/init/01-create-databases.sql`

- [ ] **Step 1: 写 Postgres init SQL**

Create `infra/postgres/init/01-create-databases.sql`:

```sql
CREATE DATABASE salonai;
```

- [ ] **Step 2: 写 Docker Compose**

Create `infra/docker-compose.yml`:

```yaml
services:
  postgres:
    image: docker.io/postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
      TZ: UTC
      PGTZ: UTC
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - salonai_postgres_data:/var/lib/postgresql/data
      - ./postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 3s
      timeout: 3s
      retries: 10

  redis:
    image: docker.io/redis:7
    restart: unless-stopped
    command: ["redis-server", "--requirepass", "myredissecret", "--maxmemory-policy", "noeviction"]
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - salonai_redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "myredissecret", "ping"]
      interval: 3s
      timeout: 10s
      retries: 10

  clickhouse:
    image: docker.io/clickhouse/clickhouse-server
    restart: unless-stopped
    user: "101:101"
    environment:
      CLICKHOUSE_DB: default
      CLICKHOUSE_USER: clickhouse
      CLICKHOUSE_PASSWORD: clickhouse
    ports:
      - "127.0.0.1:8123:8123"
      - "127.0.0.1:9002:9000"
    volumes:
      - langfuse_clickhouse_data:/var/lib/clickhouse
      - langfuse_clickhouse_logs:/var/log/clickhouse-server
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:8123/ping || exit 1"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 1s

  langfuse-minio:
    image: cgr.dev/chainguard/minio
    restart: unless-stopped
    entrypoint: sh
    command: -c 'mkdir -p /data/langfuse && minio server --address ":9000" --console-address ":9001" /data'
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: miniosecret
    ports:
      - "127.0.0.1:9090:9000"
      - "127.0.0.1:9092:9001"
    volumes:
      - langfuse_minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 1s
      timeout: 5s
      retries: 5
      start_period: 1s

  langfuse-worker:
    image: docker.io/langfuse/langfuse-worker:3
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      clickhouse:
        condition: service_healthy
      langfuse-minio:
        condition: service_healthy
    ports:
      - "127.0.0.1:3030:3030"
    environment: &langfuse-env
      NEXTAUTH_URL: http://localhost:3001
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/postgres
      SALT: salonai-local-salt
      ENCRYPTION_KEY: "0000000000000000000000000000000000000000000000000000000000000000"
      TELEMETRY_ENABLED: "false"
      LANGFUSE_ENABLE_EXPERIMENTAL_FEATURES: "false"
      CLICKHOUSE_MIGRATION_URL: clickhouse://clickhouse:9000
      CLICKHOUSE_URL: http://clickhouse:8123
      CLICKHOUSE_USER: clickhouse
      CLICKHOUSE_PASSWORD: clickhouse
      CLICKHOUSE_CLUSTER_ENABLED: "false"
      LANGFUSE_USE_AZURE_BLOB: "false"
      LANGFUSE_USE_OCI_NATIVE_OBJECT_STORAGE: "false"
      LANGFUSE_S3_EVENT_UPLOAD_BUCKET: langfuse
      LANGFUSE_S3_EVENT_UPLOAD_REGION: auto
      LANGFUSE_S3_EVENT_UPLOAD_ACCESS_KEY_ID: minio
      LANGFUSE_S3_EVENT_UPLOAD_SECRET_ACCESS_KEY: miniosecret
      LANGFUSE_S3_EVENT_UPLOAD_ENDPOINT: http://langfuse-minio:9000
      LANGFUSE_S3_EVENT_UPLOAD_FORCE_PATH_STYLE: "true"
      LANGFUSE_S3_EVENT_UPLOAD_PREFIX: events/
      LANGFUSE_S3_MEDIA_UPLOAD_BUCKET: langfuse
      LANGFUSE_S3_MEDIA_UPLOAD_REGION: auto
      LANGFUSE_S3_MEDIA_UPLOAD_ACCESS_KEY_ID: minio
      LANGFUSE_S3_MEDIA_UPLOAD_SECRET_ACCESS_KEY: miniosecret
      LANGFUSE_S3_MEDIA_UPLOAD_ENDPOINT: http://localhost:9090
      LANGFUSE_S3_MEDIA_UPLOAD_FORCE_PATH_STYLE: "true"
      LANGFUSE_S3_MEDIA_UPLOAD_PREFIX: media/
      LANGFUSE_S3_BATCH_EXPORT_ENABLED: "false"
      LANGFUSE_S3_BATCH_EXPORT_BUCKET: langfuse
      LANGFUSE_S3_BATCH_EXPORT_PREFIX: exports/
      LANGFUSE_S3_BATCH_EXPORT_REGION: auto
      LANGFUSE_S3_BATCH_EXPORT_ENDPOINT: http://langfuse-minio:9000
      LANGFUSE_S3_BATCH_EXPORT_EXTERNAL_ENDPOINT: http://localhost:9090
      LANGFUSE_S3_BATCH_EXPORT_ACCESS_KEY_ID: minio
      LANGFUSE_S3_BATCH_EXPORT_SECRET_ACCESS_KEY: miniosecret
      LANGFUSE_S3_BATCH_EXPORT_FORCE_PATH_STYLE: "true"
      REDIS_HOST: redis
      REDIS_PORT: "6379"
      REDIS_AUTH: myredissecret
      REDIS_TLS_ENABLED: "false"

  langfuse-web:
    image: docker.io/langfuse/langfuse:3
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      clickhouse:
        condition: service_healthy
      langfuse-minio:
        condition: service_healthy
    ports:
      - "127.0.0.1:3001:3000"
    environment:
      <<: *langfuse-env
      NEXTAUTH_SECRET: salonai-local-nextauth-secret

  milvus-etcd:
    container_name: milvus-etcd
    image: quay.io/coreos/etcd:v3.5.25
    environment:
      - ETCD_AUTO_COMPACTION_MODE=revision
      - ETCD_AUTO_COMPACTION_RETENTION=1000
      - ETCD_QUOTA_BACKEND_BYTES=4294967296
      - ETCD_SNAPSHOT_COUNT=50000
    volumes:
      - milvus_etcd_data:/etcd
    command: etcd -advertise-client-urls=http://milvus-etcd:2379 -listen-client-urls http://0.0.0.0:2379 --data-dir /etcd
    healthcheck:
      test: ["CMD", "etcdctl", "endpoint", "health"]
      interval: 30s
      timeout: 20s
      retries: 3

  milvus-minio:
    container_name: milvus-minio
    image: minio/minio:RELEASE.2024-12-18T13-15-44Z
    environment:
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    ports:
      - "127.0.0.1:9100:9000"
      - "127.0.0.1:9101:9001"
    volumes:
      - milvus_minio_data:/minio_data
    command: minio server /minio_data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  milvus-standalone:
    container_name: milvus-standalone
    image: milvusdb/milvus:v3.0-beta
    command: ["milvus", "run", "standalone"]
    security_opt:
      - seccomp:unconfined
    environment:
      ETCD_ENDPOINTS: milvus-etcd:2379
      MINIO_ADDRESS: milvus-minio:9000
      MQ_TYPE: woodpecker
    volumes:
      - milvus_data:/var/lib/milvus
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9091/healthz"]
      interval: 30s
      start_period: 90s
      timeout: 20s
      retries: 3
    ports:
      - "127.0.0.1:19530:19530"
      - "127.0.0.1:9091:9091"
    depends_on:
      - milvus-etcd
      - milvus-minio

volumes:
  salonai_postgres_data:
  salonai_redis_data:
  langfuse_clickhouse_data:
  langfuse_clickhouse_logs:
  langfuse_minio_data:
  milvus_etcd_data:
  milvus_minio_data:
  milvus_data:
```

- [ ] **Step 3: 验证 Docker daemon**

Run:

```bash
docker info --format '{{.ServerVersion}}'
```

Expected: prints Docker server version from OrbStack.

- [ ] **Step 4: 启动本地依赖**

Run:

```bash
docker compose -f infra/docker-compose.yml up
```

Expected: PostgreSQL、Redis、Milvus、Langfuse 相关容器启动；Langfuse Web 可从 `http://localhost:3001` 打开。

## Task 7: 端到端验证

**Files:**
- No new files.

- [ ] **Step 1: 安装验证**

Run:

```bash
pnpm install
```

Expected: exit 0，no ignored build scripts error。

- [ ] **Step 2: 测试验证**

Run:

```bash
pnpm test
```

Expected: shared、api、cli tests pass。

- [ ] **Step 3: 数据库迁移验证**

Ensure local `.env` contains:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/salonai?schema=public"
```

Run:

```bash
pnpm db:migrate
```

Expected: migration succeeds and Prisma client is generated。

- [ ] **Step 4: API / Web 联动验证**

Run:

```bash
pnpm dev
```

Expected:

- API listens on `http://localhost:3000`。
- Web listens on `http://localhost:5173`。
- Web page shows `salonai-api ok` via `/api/health` proxy。

- [ ] **Step 5: CLI 验证**

Run:

```bash
pnpm cli:health
```

Expected: prints `salonai-api ok 0.0.0 <timestamp>`。

- [ ] **Step 6: OpenAPI / Orval 验证**

With API running, run:

```bash
pnpm api:generate
```

Expected: generated API client files appear under `packages/api-client/src/generated`。

## 自查清单

- 设计记录要求都有对应任务。
- 服务端没有启用 CORS。
- Browser 请求只走 Vite proxy。
- CLI 和 HTTP 脚本直接请求 API。
- `packages/shared` 提供 health 契约。
- `pnpm test` 覆盖 shared、api、cli 的最小行为。
- Docker Compose 明确避开 API `3000` 端口冲突。
- 阶段任务完成后再统一提交。
