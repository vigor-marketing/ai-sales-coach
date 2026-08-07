#!/bin/bash
# =====================================================
# Git 自动部署 webhook 监听器
# 运行在服务器上，监听 GitHub/Gitee 的 push 事件
# =====================================================

DEPLOY_DIR="/opt/ai-sales-coach"
LOG_FILE="/var/log/ai-sales-coach-webhook.log"
PORT=4000  # webhook 监听端口

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

deploy() {
    log "========== 开始自动部署 =========="

    cd "$DEPLOY_DIR"

    # 拉取最新代码
    log "拉取最新代码..."
    git pull origin main 2>&1 | tee -a "$LOG_FILE"

    # 安装依赖
    log "安装依赖..."
    pnpm install --prod 2>/dev/null || npm install --production 2>/dev/null

    # 编译后端
    log "编译后端..."
    cd "$DEPLOY_DIR/apps/server"
    npx tsc 2>/dev/null || true

    # 构建前端
    log "构建前端..."
    cd "$DEPLOY_DIR/apps/web"
    npx vite build 2>/dev/null || true

    # 数据库更新
    cd "$DEPLOY_DIR/apps/server"
    npx prisma db push 2>/dev/null || true

    # 重启服务
    log "重启服务..."
    pm2 restart ai-sales-coach 2>/dev/null || true

    log "========== 部署完成 =========="
}

# 如果是手动调用
if [ "$1" = "deploy" ]; then
    deploy
    exit 0
fi

log "启动 Git Webhook 监听器 (端口 $PORT)..."

# 用 Node.js 启动一个简单的 webhook 服务器
node -e "
const http = require('http');
const { execSync } = require('child_process');

http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        const msg = '收到 Git push 通知，开始自动部署';
        console.log(msg);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK\\n');

        // 异步执行部署
        execSync('bash $0 deploy', {
            cwd: '$DEPLOY_DIR',
            stdio: 'inherit',
            timeout: 120000
        });
    });
}).listen($PORT, '0.0.0.0', () => {
    console.log('Webhook server running on port $PORT');
    console.log('Webhook URL: http://' + require('os').hostname() + ':$PORT/webhook');
});
" 2>&1 | tee -a "$LOG_FILE" &
