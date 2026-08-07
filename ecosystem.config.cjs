// ── PM2 ecosystem config ─────────────────────────────────────────────────
// IMPORTANT: Always start via `pm2 start ecosystem.config.cjs`, NOT
// `pm2 start dist/index.js`. The env block below provides essential
// environment variable fallbacks that are not included in direct-start mode.
// ────────────────────────────────────────────────────────────────────────────
module.exports = {
  apps: [{
    name: 'ai-sales-coach',
    cwd: './apps/server',
    script: './dist/index.js',
    // Auto-restart when memory exceeds 500 MB (mitigates memory leak)
    max_memory_restart: '500M',
    // Merge logs from all instances into one file
    merge_logs: true,
    env: {
      NODE_ENV: 'production',
      JWT_SECRET: 'df1fec78cb074653262a2e1f25f242d635db659412eed7d459d0c00c3d998c3fcce3ff6a8693107146b598abb3b9c189',
    },
  }]
};
