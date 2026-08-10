# 工作台接入说明

## 部署前配置

工作台通过同域反向代理将本模块挂载到 `/apps/ai-sales-coach/`。生产环境必须配置：

```env
NODE_ENV=production
JWT_SECRET=<至少 32 个字符的随机密钥>
FRAME_ANCESTORS="'self' https://<workbench-domain>"
VITE_APP_BASE_PATH=/apps/ai-sales-coach/
```

只有在工作台不使用同域反向代理、而是让浏览器跨域调用 API 时，才额外配置：

```env
CORS_ORIGIN=https://<workbench-domain>
```

## 验收

1. `GET /api/health` 返回 200。
2. 从允许的工作台域名 iframe 打开模块成功；其他域名被 CSP `frame-ancestors` 阻止。
3. `/apps/ai-sales-coach/training` 刷新后仍正确加载，前端请求发送到 `/apps/ai-sales-coach/api/*` 并由反向代理转发为模块 `/api/*`。
4. 未登录访问分析接口返回 401；普通用户只能取得自己的会话和分析数据。
5. 配置缺失 `JWT_SECRET`、生产环境缺失 `FRAME_ANCESTORS` 或包含通配符时，服务拒绝启动。

## 后续工作

本版本仅保留并加固现有本地 JWT 登录，以避免在工作台 OIDC 未建立前破坏现有用户。工作台上线前，必须替换为 OIDC Authorization Code + PKCE，并根据组织、部门与小组声明执行数据范围授权。
