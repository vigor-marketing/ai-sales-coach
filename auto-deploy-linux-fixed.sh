#!/bin/bash
# Auto-deploy script for AI Sales Coach on Linux
# Runs git pull, rebuilds if needed, and restarts PM2
# FIX 2026-08-06: use 'origin' remote (server only has origin configured),
# and abort WITHOUT restart when git pull fails or no changes detected.

cd /opt/ai-sales-coach || exit 1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting auto-deploy..."

# Git pull (use the configured remote 'origin', branch master)
GIT_OUTPUT=$(git pull origin master 2>&1)
GIT_EXIT=$?
echo "$GIT_OUTPUT"

# If git pull failed (e.g. network, auth, dirty tree), abort WITHOUT restart
if [ $GIT_EXIT -ne 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Git pull FAILED (exit=$GIT_EXIT). Aborting without restart."
    exit 1
fi

# If nothing changed, skip rebuild and restart
if echo "$GIT_OUTPUT" | grep -q 'Already up to date'; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] No changes detected. Skipping rebuild and restart."
    exit 0
fi

# Check if server source files changed
if echo "$GIT_OUTPUT" | grep -qE 'apps/server/src/|apps/server/prisma/'; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server source changed, rebuilding..."
    cd /opt/ai-sales-coach/apps/server
    npx prisma generate 2>&1
    npx tsc 2>&1
    cd /opt/ai-sales-coach
fi

# Check if web source files changed
if echo "$GIT_OUTPUT" | grep -qE 'apps/web/src/'; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Web source changed, rebuilding..."
    cd /opt/ai-sales-coach/apps/web
    npx vite build 2>&1
    cd /opt/ai-sales-coach
fi

# Only reached here when there are real changes -> restart
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Changes detected. Restarting PM2..."
pm2 restart ai-sales-coach 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Auto-deploy complete."
