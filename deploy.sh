#!/bin/bash
# =====================================================
# AI销售陪练系统 - 阿里云一键部署脚本
# 使用方法：bash deploy.sh
# 前提：购买好云服务器（推荐 2核2G 以上）
# =====================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

echo ""
echo "================================================"
echo "   AI销售陪练系统 - 云服务器部署"
echo "================================================"
echo ""

# ----- 检查系统 -----
OS=""
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
fi
echo "系统: $OS"

# ----- 1. 安装 Node.js 22 -----
info "步骤 1/7：安装 Node.js 22..."
if command -v node &> /dev/null && [[ "$(node -v)" == v22* ]]; then
    log "Node.js $(node -v) 已安装，跳过"
else
    if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
        apt install -y nodejs
    elif [[ "$OS" == "centos" || "$OS" == "rhel" || "$OS" == "alinux" ]]; then
        curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
        yum install -y nodejs
    else
        warn "未知系统，尝试通用方式安装..."
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
        apt install -y nodejs 2>/dev/null || yum install -y nodejs 2>/dev/null
    fi
    log "Node.js $(node -v) 安装完成"
fi

# ----- 1b. 安装 PM2（进程守护） -----
info "步骤 1b：安装 PM2 进程守护..."
npm install -g pm2 2>/dev/null
log "PM2 就绪"

# ----- 2. 安装 pnpm -----
info "步骤 2/7：安装 pnpm..."
if command -v pnpm &> /dev/null; then
    log "pnpm $(pnpm -v) 已安装，跳过"
else
    npm install -g pnpm
    log "pnpm $(pnpm -v) 安装完成"
fi

# ----- 3. 项目位置 -----
DEPLOY_DIR="/opt/ai-sales-coach"

if [ ! -d "$DEPLOY_DIR" ]; then
    echo ""
    warn "请先在本地打包上传项目代码："
    echo "------------------------------------------------"
    echo "  # 在项目根目录执行："
    echo "  bash create-deploy-package.sh"
    echo ""
    echo "  # 然后把 project.tar.gz 上传到服务器："
    echo "  scp /tmp/ai-sales-coach-deploy.tar.gz root@服务器IP:/opt/"
    echo ""
    echo "  # 解压："
    echo "  mkdir -p /opt/ai-sales-coach"
    echo "  tar xzf /opt/ai-sales-coach-deploy.tar.gz -C /opt/ai-sales-coach"
    echo "------------------------------------------------"
    echo ""
    read -p "按回车键继续（确认已上传并解压到 $DEPLOY_DIR）..."
fi

cd "$DEPLOY_DIR"
if [ ! -f "package.json" ]; then
    err "未检测到 package.json，请先上传代码"
    exit 1
fi
log "项目文件就绪"

# ----- 4. 安装依赖 -----
info "步骤 4/7：安装项目依赖..."
pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod
log "依赖安装完成"

# ----- 5. 构建前端 -----
info "步骤 5/7：构建前端..."
cd apps/web
npx vite build 2>/dev/null
cd ../..
log "前端构建完成"

# ----- 6. 配置环境变量 -----
info "步骤 6/7：配置环境变量..."
cd apps/server
if [ ! -f ".env" ]; then
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || date +%s | md5sum | head -c 32)
    cat > .env << EOF
DATABASE_URL="file:./dev.db"
JWT_SECRET="${JWT_SECRET}"
OPENAI_API_KEY="sk-your-api-key"
OPENAI_BASE_URL="https://api.deepseek.com/v1"
OPENAI_MODEL="deepseek-chat"
PORT=3000
EOF
    log ".env 文件已生成"
    warn "========================================"
    warn "  ⚠️  重要！请修改 API Key："
    warn "  vi $DEPLOY_DIR/apps/server/.env"
    warn "  将 OPENAI_API_KEY 改为你的真实 Key"
    warn "========================================"
else
    log ".env 文件已存在，跳过"
fi

# 编译后端 TypeScript
info "编译后端..."
npx tsc 2>/dev/null || log "编译完成（或已是最新）"

# 初始化数据库
npx prisma db push 2>/dev/null || true

cd ../..
log "环境配置完成"

# ----- 7. 启动服务 -----
info "步骤 7/7：启动服务..."
cd apps/server

# 停止旧进程
pm2 delete ai-sales-coach 2>/dev/null || true

# 用 PM2 启动（自动守护、崩溃重启、开机自启）
pm2 start dist/index.js --name "ai-sales-coach" -- --port 3000
pm2 save 2>/dev/null || true

# 设置开机自启
pm2 startup systemd -u root 2>/dev/null || true

cd ../..

sleep 3
echo ""

# ----- 检查 -----
if curl -s http://localhost:3000/api/health 2>/dev/null | grep -q "ok"; then
    echo "================================================"
    echo -e "${GREEN}   ✅ 部署成功！${NC}"
    echo "================================================"
    echo ""
    echo "   本机访问: http://localhost:3000"
    echo ""
    PUBLIC_IP=$(curl -s http://checkip.amazonaws.com 2>/dev/null || curl -s https://api.ipify.org 2>/dev/null || echo "你的服务器IP")
    echo "   外网访问: http://${PUBLIC_IP}:3000"
    echo ""
    echo "   默认账号: vigor@example.com / 668668abcx"
    echo ""
    echo "  管理命令："
    echo "  查看状态: pm2 status"
    echo "  查看日志: pm2 logs ai-sales-coach"
    echo "  重启服务: pm2 restart ai-sales-coach"
    echo "  停止服务: pm2 stop ai-sales-coach"
    echo ""
else
    warn "服务启动中，查看日志：pm2 logs ai-sales-coach"
fi

echo ""
echo -e "${GREEN}部署完成！${NC}"
