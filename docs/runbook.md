# AI 销售陪练运行手册

## 部署

生产目录为 `/opt/ai-sales-coach`，服务由 PM2 托管，监听端口 `3000`。业务上传文件存放在独立持久化目录：`/opt/瑞兰特AI培训系统/数据/uploads`。

```bash
cd /opt/ai-sales-coach
pnpm --filter @ai-sales-coach/server db:generate
pnpm --filter @ai-sales-coach/server build
pnpm --filter @ai-sales-coach/web build
pm2 restart ai-sales-coach
curl -fsS http://127.0.0.1:3000/api/health
```

避免在服务器执行 `git reset --hard`。不得影响同实例上的 EDMP UAT 服务。

## 健康检查

```bash
curl -fsS http://127.0.0.1:3000/api/health
```

预期包含：`ok: true`、`appId: ai-sales-coach`、`version`、`time`。工作台接入部署后还应验证 CSP 的 `frame-ancestors` 只包含正式工作台域名。

## 备份与恢复

- SQLite 数据库：每日 03:00 通过 `/opt/ai-sales-coach/backup-db.sh` 备份，保留最近 7 个副本。
- 上传文件：独立目录，不随代码自动部署覆盖；历史文件已归档到私有对象存储。
- 恢复前：停止应用写入、备份当前数据库、恢复目标 `dev.db`、核对上传文件，再重启 PM2。

## 故障处理

1. 健康检查失败：查看 `pm2 logs ai-sales-coach --lines 100` 与端口监听状态。
2. 前端资源 404：核对 Vite `APP_BASE_PATH` 与 Express 静态资源路径；工作台子路径必须以 `/apps/ai-sales-coach/` 访问。
3. iframe 被拒绝：核对 `FRAME_ANCESTORS` / `WORKBENCH_ORIGIN` 是否为工作台正式来源，且响应中没有 `X-Frame-Options`。
4. 模型异常：检查部署环境中的模型配置，不要将 API Key 输出到日志或提交到代码仓库。
5. 上传异常：核对 `UPLOADS_DIR` 目录存在且 `ubuntu` 用户有读写权限。

## 删除流程

管理员删除会话或报告时，服务会删除关联会话、评分和消息并写审计日志。若接入对象存储、搜索或向量索引，删除工作流必须同步清理其副本，并将各步骤结果写入审计记录。
