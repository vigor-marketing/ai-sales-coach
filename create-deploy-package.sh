#!/bin/bash
# =====================================================
# 创建部署包（在本地运行）
# =====================================================

echo "创建部署包..."
PROJECT_DIR="C:/Users/Monk Chen/WorkBuddy/2026-07-03-15-41-15"
OUTPUT="/tmp/ai-sales-coach-deploy.tar.gz"

# 确保是最新构建
cd "$PROJECT_DIR/apps/server"
"C:/Users/Monk Chen/.workbuddy/binaries/node/versions/22.22.2/node.exe" ./node_modules/typescript/bin/tsc 2>/dev/null
echo "后端编译完成"

cd "$PROJECT_DIR/apps/web"
"C:/Users/Monk Chen/.workbuddy/binaries/node/versions/22.22.2/node.exe" ./node_modules/vite/bin/vite.js build 2>/dev/null
echo "前端构建完成"

# 打包（排除无用文件）
cd "$PROJECT_DIR"
tar czf "$OUTPUT" \
    --exclude='node_modules' \
    --exclude='.pnpm-store' \
    --exclude='.workbuddy' \
    --exclude='apps/web/node_modules' \
    --exclude='apps/server/node_modules' \
    --exclude='apps/web/dist' \
    --exclude='*.db' \
    --exclude='.git' \
    --exclude='backups' \
    --exclude='uploads' \
    apps/web/dist \
    apps/server/dist \
    apps/server/prisma \
    apps/server/package.json \
    apps/web/package.json \
    package.json \
    pnpm-lock.yaml \
    pnpm-workspace.yaml \
    setup-server.sh \
    auto-deploy.sh \
    deploy.sh \
    serve-static-5174.js \
    restart.cmd

echo ""
echo "================================================"
echo "  ✅ 部署包已创建: $OUTPUT"
echo "  大小: $(ls -lh $OUTPUT | awk '{print $5}')"
echo "================================================"
echo ""
echo "上传到服务器:"
echo "  scp $OUTPUT root@你的IP:/opt/"
echo ""
echo "解压:"
echo "  ssh root@你的IP 'mkdir -p /opt/ai-sales-coach && tar xzf /opt/ai-sales-coach-deploy.tar.gz -C /opt/ai-sales-coach'"
echo ""
echo "运行部署:"
echo "  ssh root@你的IP 'bash /opt/ai-sales-coach/setup-server.sh'"
echo ""
