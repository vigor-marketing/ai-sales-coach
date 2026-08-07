import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import os from 'os';
import { getUploadsDir } from './utils/storage.js';
import { fileURLToPath } from 'url';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { assertAuthConfiguration, authMiddleware } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import roleRoutes from './routes/roles.js';
import scenarioRoutes from './routes/scenarios.js';
import knowledgeRoutes from './routes/knowledge.js';
import trainingRoutes from './routes/training.js';
import reportRoutes from './routes/reports.js';
import uploadRoutes from './routes/upload.js';
import aiGenerateRoutes from './routes/aiGenerate.js';
import feedbackRoutes from './routes/feedback.js';
import strategyRoutes from './routes/strategy.js';
import analyticsRoutes from './routes/analytics.js';

// ── Path setup & .env loading (absolute path, independent of process.cwd()) ─
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
assertAuthConfiguration();

// ── Global crash handlers ──────────────────────────────────────────────────
// Node.js 15+ terminates on unhandled rejections. These log then exit
// gracefully so PM2 can restart cleanly.
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
  setTimeout(() => process.exit(1), 100);
});
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  setTimeout(() => process.exit(1), 100);
});

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';
const frameAncestors = process.env.FRAME_ANCESTORS?.trim();
const allowedOrigins = new Set(
  (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

if (isProduction && !frameAncestors) {
  throw new Error('FRAME_ANCESTORS is required in production to restrict iframe embedding.');
}
if (isProduction && frameAncestors?.includes('*')) {
  throw new Error('FRAME_ANCESTORS must not contain a wildcard in production.');
}

// Security headers. The legacy frame-denial header is omitted because it
// blocks every cross-origin iframe. Deployments can restrict parents through
// FRAME_ANCESTORS, for example: "'self' https://portal.example.com".
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (frameAncestors) {
    res.setHeader('Content-Security-Policy', 'frame-ancestors ' + frameAncestors);
  }
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    // Requests without Origin are same-origin, health probes, or server-to-server calls.
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Protected static files - match the shared persistent multer upload path
app.use('/uploads', authMiddleware, express.static(getUploadsDir()));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/scenarios', scenarioRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ai', aiGenerateRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/strategy', strategyRoutes);
app.use('/api/stats/analytics', analyticsRoutes);

// Serve static frontend files (no cache for index.html to ensure latest JS is fetched)
const staticPath = path.join(__dirname, '../../web/dist');
app.use(express.static(staticPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Frontend error report endpoint — auto-reported by ErrorBoundary
app.post('/api/errors/report', authMiddleware, (req, res) => {
  const { message, stack, url, timestamp } = req.body || {};
  console.error('\n========================================');
  console.error(`[CLIENT ERROR] ${new Date().toISOString()}`);
  console.error(`  URL:  ${url || 'unknown'}`);
  console.error(`  Msg:  ${message || 'no message'}`);
  console.error(`  Stack: ${(stack || '').split('\n').slice(0, 3).join('\n         ')}`);
  console.error('========================================\n');
  res.json({ ok: true });
});

// SPA fallback (no cache)
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(staticPath, 'index.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const server = app.listen(PORT, HOST, () => {
  const localIP = getLocalIP();
  console.log(`\n  🚀 Server running on:`);
  console.log(`     Local:   http://localhost:${PORT}`);
  console.log(`     Network: http://${localIP}:${PORT}\n`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`  端口 ${PORT} 已被占用，请关闭其他进程后重试`);
  } else {
    console.error('  服务启动失败:', err.message);
  }
  process.exit(1);
});

// 定时清理过期会话（每小时执行一次）
import('./services/cleanupService.js').then(m => {
  setInterval(() => {
    m.cleanupStaleSessions().catch(e => console.error('[AutoCleanup]', e));
  }, 60 * 60 * 1000); // 每小时
  // 启动时立即执行一次
  m.cleanupStaleSessions().catch(e => console.error('[AutoCleanup]', e));
  console.log('  ⏰ 过期会话自动清理已启动（每小时）');
}).catch(e => console.error('[AutoCleanup] 加载失败:', e));
