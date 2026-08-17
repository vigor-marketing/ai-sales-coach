# AI 销售陪练工作台接入改造进度

## 已完成的源码改造

- 增加根目录 `app.manifest.json`，声明应用 ID、工作台入口、健康检查、嵌入来源与事件。
- 增加 `Dockerfile`、根 `README.md`、根和前端 `.env.example`，补齐 GitHub 审查入口。
- 增加工作台接入文档、OpenAPI 契约、事件定义和运行手册：
  - `docs/workbench-integration.md`
  - `docs/api.openapi.yaml`
  - `docs/events.md`
  - `docs/runbook.md`
- 前端支持 `APP_BASE_PATH=/apps/ai-sales-coach`：Vite 静态资源、React Router basename、Axios API 地址、错误上报和上传地址均可使用工作台子路径。
- 服务端同时兼容既有 `/api` 和工作台子路径下的 `/apps/ai-sales-coach/api`。
- 健康检查升级为 `{ ok, appId, version, time, traceId }`。
- iframe 响应头改为由 `FRAME_ANCESTORS` / `WORKBENCH_ORIGIN` 控制，移除 `X-Frame-Options`，不允许通配符嵌入。
- 增加 OIDC Bearer token 后端校验与用户声明映射；默认仍为 `AUTH_MODE=local`，待取得正式 Keycloak 参数后才可切换到 `oidc`。
- 增加团队字段 Prisma 迁移、按个人/小组/管理范围过滤的 `/api/v1/coaching-*` 只读接口。
- 增加 trace ID、统一错误结构、审计日志、会话完成事件，以及模型输入中的手机号、邮箱、身份证号、银行卡号遮蔽。
- 上传接口保持业务独立持久化目录，进一步限制单文件和文件类型并记录审计日志。

## 验证结果

- 子路径前端隔离构建成功；输出资源路径为 `/apps/ai-sales-coach/assets/...`。
- 敏感信息遮蔽逻辑已执行验证，四类常见标识均被替换。
- 新增配置和工作台后端模块未产生单独 TypeScript 类型错误。
- Prisma 迁移在隔离 SQLite 数据库中成功应用：初始迁移与 `20260805154000_workbench_integration` 均通过。

## 当前阻塞项

1. Windows 环境的安全删除机制阻断 Prisma 生成目录重建，导致主工作区完整后端编译无法完成；这也是现有项目的环境问题，不是新增模块的类型错误。
2. Git 索引写入同样被本地安全删除机制阻止，因此本轮改造尚未提交、推送或部署，线上服务未改变。
3. 正式 `WORKBENCH_ORIGIN`、OIDC Issuer、客户端密钥和事件接收地址尚未提供；代码中只保留安全示例值，不能切换到强制 OIDC。

## 下一步

- 在可正常写入 Prisma 生成目录的环境执行锁定版 Prisma 5.22.0 的 `prisma generate`、完整后端构建、前端构建。
- 写入正式工作台域名与 OIDC 参数后，将 `AUTH_MODE` 切换为 `oidc`，再执行嵌入和权限回归测试。
- 解除 Git 索引写入阻塞后，仅提交本次列出的源码和文档文件，排除既有构建产物、业务上传、私钥与 GitHub 发布临时目录。
