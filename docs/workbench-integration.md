# AI 销售陪练工作台接入说明

## 应用信息

- 应用 ID：`ai-sales-coach`
- 入口路径：`/apps/ai-sales-coach/`
- 健康检查：`GET /api/health`
- 只读对外 API：`/api/v1/coaching-sessions`、`/api/v1/coaching-sessions/{id}`、`/api/v1/coaching-summary`
- 完成事件：`coaching.session.completed.v1`

## 部署变量

部署时必须将示例域名替换为正式工作台域名：

```dotenv
APP_BASE_PATH=/apps/ai-sales-coach
PUBLIC_APP_URL=https://workbench.company.com/apps/ai-sales-coach
WORKBENCH_ORIGIN=https://workbench.company.com
FRAME_ANCESTORS='self' https://workbench.company.com
OIDC_ISSUER=https://auth.company.com/realms/vigor
OIDC_CLIENT_ID=ai-sales-coach
OIDC_CLIENT_SECRET=__SET_IN_DEPLOYMENT_ONLY__
OIDC_REDIRECT_URI=https://workbench.company.com/apps/ai-sales-coach/auth/callback
```

`OIDC_CLIENT_SECRET`、模型密钥、数据库和上传文件仅能保留在部署环境，禁止提交到 GitHub。

## 身份与权限

当前版本保留既有本地账号作为迁移回退机制，并在配置 OIDC 后由后端验证 Bearer access token。OIDC token 至少需要提供用户 ID、部门、角色和销售小组声明。

- 销售员：仅能访问自己的会话、评分和建议。
- 销售组长：仅能访问自身及同一销售小组的汇总与获授权详情。
- 销售经理、分管销售副总经理、总经理：按工作台注入的角色与组织范围访问汇总数据。
- 本地 `ADMIN`：仅在 OIDC 切换完成前用于既有系统管理；不得用于绕过工作台数据范围。

## 数据范围与生命周期

- 陪练会话、评分归属于陪练系统；工作台仅读取经权限过滤的摘要、评分和建议。
- 原始对话文本、录音及附件不会通过对外 API 默认返回。
- 上传文件位于部署服务器持久化目录 `UPLOADS_DIR`；生产目录为 `/opt/瑞兰特AI培训系统/数据/uploads`，并受认证保护。
- 历史上传已归档于私有对象存储前缀 `瑞兰特AI培训系统/上传文件/`。
- 默认保留策略：会话、评分和文本保留 180 天；上传附件保留 180 天；管理员删除后同步删除业务记录与本地对象，并保留审计结果。对象存储/搜索索引接入后，删除任务必须同步扩展至对应副本。
- 可下载角色：拥有原始会话访问权限的本人和明确授权的管理角色；工作台只使用摘要接口。

## 安全边界

- 只允许 `WORKBENCH_ORIGIN` 作为 iframe 父页面，响应头由 `FRAME_ANCESTORS` 生成。
- 禁止 `frame-ancestors *`，不使用已废弃的 `X-Frame-Options: ALLOW-FROM`。
- 模型调用在服务端执行。系统在发送内容前遮蔽常见手机号、邮箱、身份证号和银行卡号；AI 输出明确是建议，不会自动修改客户、合同、提成或其他业务数据。
- 访问、查看、下载、删除、上传和模型调用应记录审计事件；当前发布事件与接口契约见 `events.md`、`api.openapi.yaml`。

## 验收方式

1. 使用正式工作台域名设置 `FRAME_ANCESTORS` 和 Vite 的 `APP_BASE_PATH` 后部署。
2. 打开 `/apps/ai-sales-coach/`，检查静态资源、路由跳转和页面刷新。
3. 检查 `GET /api/health` 返回 `ok`、应用 ID、版本和时间。
4. 用销售员身份访问，确认无法读取他人的 `/api/v1/coaching-sessions/{id}`。
5. 在完成会话后核对 `coaching.session.completed.v1` 审计记录不包含全文和附件。
