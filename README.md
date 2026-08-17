# AI 销售陪练

面向销售团队的角色化 AI 陪练系统。前端采用 React + Vite，服务端采用 Express + Prisma + SQLite。

## 工作台接入

- 应用标识：`ai-sales-coach`
- 嵌入入口：`/apps/ai-sales-coach/`
- 健康检查：`GET /api/health`
- 工作台接入、事件和运行说明见 [`docs/`](./docs)。

## 本地运行

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @ai-sales-coach/server db:generate
pnpm dev
```

默认前端地址为 `http://localhost:5173`，API 服务地址为 `http://localhost:3000`。

## 构建

```bash
pnpm --filter @ai-sales-coach/server build
pnpm --filter @ai-sales-coach/web build
```

## 环境变量

复制 `apps/server/.env.example` 并仅在部署环境填入真实值。不要提交 `.env`、数据库、上传文件、对话文本、录音或任何密钥。

## 容器构建

```bash
docker build -t ai-sales-coach:latest .
docker run --env-file apps/server/.env -p 3000:3000 ai-sales-coach:latest
```

> 生产环境使用持久化的 `UPLOADS_DIR`，并由部署平台注入模型与 OIDC 密钥。
