# 瑞兰特AI培训系统：上传文件 COS 迁移完成 ✅

## 目标

将 AI 陪练系统后续通过系统上传的文件统一写入服务器独立存储空间，而不再保存在自动部署的程序目录中。

## 最终存储路径

```text
/opt/瑞兰特AI培训系统/数据/uploads
```

## 覆盖的上传入口

| 功能 | API | 存储结果 |
|---|---|---|
| 陪练对话附件 | `POST /api/upload` | 独立上传目录 |
| 知识库文档 | `POST /api/knowledge/upload` | 独立上传目录 |
| 已上传文件访问 | `GET /uploads/:filename` | 从独立上传目录读取，仍需登录认证 |

## 实现方式

- 新增统一存储工具：`apps/server/src/utils/storage.ts`
- 使用服务器环境变量 `UPLOADS_DIR` 配置绝对路径。
- 生产环境已配置为 `/opt/瑞兰特AI培训系统/数据/uploads`。
- 程序源代码和上传数据彻底分离，后续 Git 自动部署不会覆盖上传文件。
- 代码已提交并推送至 Gitee：`3a51fcb feat: persist uploads in dedicated storage`。

## 验证结果

- 后端 TypeScript 类型检查与编译成功。
- PM2 `ai-sales-coach` 已重启并保存启动状态，端口 `3000` 正常监听。
- 健康检查返回 `{"status":"ok"}`。
- 使用真实管理员登录和 `POST /api/upload` 执行端到端测试：
  - 文件仅写入独立上传目录；
  - 未写入旧的 `/opt/ai-sales-coach/apps/server/uploads`；
  - 测试文件已在验证后清理；
  - 独立目录保留原有 29 个业务文件。

## COS 迁移结果

- 已复用现有传统 CloudBase COS 桶：`6d6f-monktestcloud-d8gnzlwaw449aa8b8-1459141414`，没有新建任何桶。
- 已将独立上传目录中的 **29 个业务文件**完整迁移至：`瑞兰特AI培训系统/上传文件/`。
- 已在云端逐项核对对象数量、名称和文件大小；迁移结果为 **29/29 成功**。
- 未改动既有 `sales-commission/*`、`vigor/*` 对象，也没有将桶或文件设为公开读取。

## 安全与运维说明

- 上传目录仅允许 `ubuntu` 用户/组访问，目录权限 `750`。
- `/uploads` 继续受现有登录认证保护，没有开放为匿名静态文件。
- 当前未调整数据库所在路径；本次仅将“系统上传的文件”统一迁入独立空间，并将历史文件归档到既有 COS。
- 服务器上未保留 CloudBase API Key 或腾讯云临时密钥；不在代码、Git 或文档中记录这些敏感信息。
- 后续新增上传类型时，必须复用 `getUploadsDir()` / `ensureUploadsDir()`，不能再次使用 `process.cwd()/uploads`。
