# 第 0 天 Bad Cases

## Bad Case 1：把 OpenAPI JSON 路由手写到 HTTP adapter 上

现象：`pnpm lint` 报 `apps/api/src/main.ts` 中 `response.json(document)` 是 `any` 类型的不安全调用。

原因：手写 `app.getHttpAdapter().get('/openapi.json', ...)` 时，回调参数没有进入 NestJS 的类型保护边界，ESLint 无法确认 `response` 类型。

修正：改用 `@nestjs/swagger` 的官方配置：

```ts
SwaggerModule.setup('docs', app, document, {
  jsonDocumentUrl: 'openapi.json',
});
```

经验：框架已有能力优先用框架能力。尤其是 OpenAPI、路由注册、序列化这种基础设施，不要为了快而绕过类型系统。

## Bad Case 2：Prisma migrate 在非 TTY 下卡在迁移名称输入

现象：执行 `pnpm db:migrate` 时，Prisma 已连接到 PostgreSQL，但停在 `Enter a name for the new migration`。

原因：首次 migration 需要名称，非 TTY session 无法继续交互输入。

修正：用非交互参数执行：

```bash
pnpm exec prisma migrate dev --schema prisma/schema.prisma --name init
```

经验：自动化脚本里尽量避免交互式命令。需要输入的参数应显式写进命令或脚本说明。

## Bad Case 3：把本地联调命令误当成稳定 CI 命令

现象：`pnpm api:generate` 当前依赖 `http://localhost:3000/openapi.json`，只有 API dev server 启动后才能成功。

原因：Orval 输入源是运行中的 HTTP OpenAPI 文档，而不是仓库内的静态 OpenAPI 文件。

修正：第 0 天本地 CI 先只覆盖不依赖服务的稳定门禁：

```bash
pnpm run ci
```

它会执行 lint、test、build 和 Prisma schema validate。`pnpm api:generate` 继续作为 API 启动后的联调验证命令。

经验：CI 命令应该默认可重复、可自动执行、少依赖外部运行状态。依赖本地服务的检查可以单独保留为运行时验证。
