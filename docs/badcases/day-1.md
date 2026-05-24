# 第 1 天 Bad Cases

## Bad Case 1：缺少模型 API key 时不能伪装成功

现象：OpenAI-compatible provider 没有配置 `OPENAI_COMPATIBLE_API_KEY` 时，真实模型调用失败。

原因：`ModelConfig.apiKeyEnvName` 指向的环境变量不存在，provider 无法构造鉴权请求。

修正：provider 抛出 `ProviderRequestError`，API 返回 502，并写入一条 `ModelCall` 错误记录：

```text
status=ERROR
errorCode=missing_api_key
```

经验：mock provider 只能服务测试和兜底，真实验收不能因为缺 key 自动降级成 mock 成功。

回归检查：

```bash
pnpm --filter api test -- openai-compatible.provider model-gateway.service
```

## Bad Case 2：Prisma 7 runtime 需要 driver adapter

现象：Nest API 启动时报错：

```text
PrismaClient needs to be constructed with a non-empty, valid PrismaClientOptions
```

继续尝试 `new PrismaClient({})` 后会得到：

```text
Using engine type "client" requires either "adapter" or "accelerateUrl"
```

原因：`prisma.config.ts` 的 `DATABASE_URL` 只服务 Prisma CLI，运行时 `PrismaClient` 仍需要 PostgreSQL driver adapter。

修正：安装 `@prisma/adapter-pg` 和 `pg`，在 `PrismaService` 中显式构造：

```ts
super({
  adapter: new PrismaPg({ connectionString }),
});
```

经验：迁移能跑不代表应用运行时能连库。Day1 这类基础设施改动必须做一次真实 Nest 启动验证。

## Bad Case 3：Web 代理层和本机代理会混淆 localhost 验证

现象：API 直连 `http://localhost:3000/health` 正常，但 Web 页面点击模型网关按钮时出现 `Failed to fetch`；同时 shell 里直接请求 `http://localhost:5173/api/health` 返回 502。

原因：这里有两个容易混在一起的问题：

1. Vite proxy target 使用 `localhost:3000` 时，在本地环境中可能解析到无法连接的地址。
2. shell 环境里设置了 `http_proxy` / `https_proxy`，curl 请求 localhost 时如果不显式绕过代理，结果会被本机代理影响。

修正：Vite proxy 明确指向 `http://127.0.0.1:3000`；shell 验证本地代理时使用：

```bash
curl --noproxy '*' http://localhost:5173/api/health
```

经验：前端本地联调要分别验证三层：浏览器到 Vite、Vite 到 API、API 到真实模型。看到 502 或 `Failed to fetch` 时，不要直接归因到后端。
