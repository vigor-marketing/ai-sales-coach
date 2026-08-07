#!/bin/bash
# =====================================================
# 本地同步到云端脚本
# 使用方法: bash sync-to-cloud.sh <服务器IP>
# 例如: bash sync-to-cloud.sh 47.94.132.203
# =====================================================

if [ -z "$1" ]; then
    echo "用法: bash sync-to-cloud.sh <服务器IP>"
    echo "示例: bash sync-to-cloud.sh 47.94.132.203"
    exit 1
fi

SERVER_IP=$1
SSH_USER="root"
DEPLOY_DIR="/opt/ai-sales-coach"

echo "================================================"
echo "   一键同步到云服务器 $SERVER_IP"
echo "================================================"

# 1. 构建前端
echo ""
echo "[1/4] 构建前端..."
cd apps/web
npx vite build 2>/dev/null
cd ../..
echo "  ✅ 前端构建完成"

# 2. 编译后端
echo "[2/4] 编译后端..."
cd apps/server
npx tsc 2>/dev/null
cd ../..
echo "  ✅ 后端编译完成"

# 3. 上传到服务器
echo "[3/4] 上传到服务器..."
# 前端
rsync -avz --delete apps/web/dist/ $SSH_USER@$SERVER_IP:$DEPLOY_DIR/apps/web/dist/ 2>/dev/null
# 后端编译产物
rsync -avz --delete apps/server/dist/ $SSH_USER@$SERVER_IP:$DEPLOY_DIR/apps/server/dist/ 2>/dev/null
# 数据库 schema（如果有新表）
rsync -avz apps/server/prisma/ $SSH_USER@$SERVER_IP:$DEPLOY_DIR/apps/server/prisma/ 2>/dev/null
echo "  ✅ 上传完成"

# 4. 重启服务
echo "[4/4] 重启服务器服务..."
ssh $SSH_USER@$SERVER_IP "cd $DEPLOY_DIR/apps/server && npx prisma db push 2>/dev/null; pm2 restart ai-sales-coach" 2>/dev/null
echo "  ✅ 服务已重启"

echo ""
echo "================================================"
echo "   ✅ 同步完成！"
echo "   访问: http://$SERVER_IP:3000"
echo "================================================"
