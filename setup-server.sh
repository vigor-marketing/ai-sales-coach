#!/bin/bash
# =====================================================
# 阿里云一键部署脚本 - AI销售陪练系统
# 运行：在服务器上 bash setup-server.sh
# =====================================================

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

DEPLOY_DIR="/opt/ai-sales-coach"
cd "$DEPLOY_DIR"

echo "================================================"
echo "   AI销售陪练系统 - 服务器部署"
echo "   服务器: $(curl -s http://checkip.amazonaws.com 2>/dev/null || echo '获取中...')"
echo "================================================"

# ----- 1. 安装 Node.js 22 -----
info "安装 Node.js 22..."
if command -v node &> /dev/null && [[ "$(node -v)" == v22* ]]; then
    log "Node.js $(node -v) 已存在"
else
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt install -y nodejs
    log "Node.js $(node -v) 安装完成"
fi

# ----- 2. 安装 PM2 + pnpm -----
info "安装 PM2 和 pnpm..."
npm install -g pm2 pnpm 2>/dev/null
log "PM2 + pnpm 就绪"

# ----- 3. 安装项目依赖 -----
info "安装项目依赖..."
cd "$DEPLOY_DIR"
pnpm install --prod 2>/dev/null || npm install --production
log "依赖安装完成"

# ----- 4. 配置环境变量 -----
info "配置环境变量..."
cd "$DEPLOY_DIR/apps/server"
if [ ! -f ".env" ]; then
    JWT_SECRET=$(openssl rand -hex 32)
    cat > .env << EOF
DATABASE_URL="file:./dev.db"
JWT_SECRET="${JWT_SECRET}"
OPENAI_API_KEY="sk-your-api-key"
OPENAI_BASE_URL="https://api.deepseek.com/v1"
OPENAI_MODEL="deepseek-chat"
PORT=3000
EOF
    log ".env 已生成"
    warn "========================================"
    warn "  ⚠️  必须修改 API Key！"
    warn "  nano $DEPLOY_DIR/apps/server/.env"
    warn "  把 OPENAI_API_KEY 改为你的真实 Key"
    warn "========================================"
fi

# ----- 5. 初始化数据库 -----
info "初始化数据库..."
npx prisma db push 2>/dev/null || true
log "数据库就绪"

cd "$DEPLOY_DIR"

# ----- 6. PM2 启动 -----
info "启动服务..."
cd "$DEPLOY_DIR/apps/server"
pm2 delete ai-sales-coach 2>/dev/null || true
pm2 start dist/index.js --name "ai-sales-coach" -- --port 3000
pm2 save 2>/dev/null || true
pm2 startup systemd -u root 2>/dev/null || true
cd "$DEPLOY_DIR"

# ----- 7. 验证 -----
sleep 3
echo ""
if curl -s http://localhost:3000/api/health 2>/dev/null | grep -q "ok"; then
    PUBLIC_IP=$(curl -s http://checkip.amazonaws.com 2>/dev/null || echo "$SERVER_IP")
    echo "================================================"
    echo -e "${GREEN}   ✅ 部署成功！${NC}"
    echo "================================================"
    echo ""
    echo "   访问地址: http://${PUBLIC_IP:-47.94.132.203}:3000"
    echo "   登录账号: vigor@example.com / 668668abcx"
    echo ""
    echo "  管理命令："
    echo "  pm2 status                # 查看状态"
    echo "  pm2 logs ai-sales-coach   # 查看日志"
    echo "  pm2 restart ai-sales-coach # 重启服务"
    echo ""
else
    warn "服务启动中，检查日志：pm2 logs ai-sales-coach"
fi
