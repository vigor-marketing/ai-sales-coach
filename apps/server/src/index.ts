import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { getUploadsDir } from './utils/storage.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import { createTraceId, writeAuditLog } from './utils/audit.js';
import { APP_ID, APP_VERSION, getAllowedOrigins, getApiPaths, getAppBasePath, getAppStaticPath } from './config/app.js';
import authRoutes from './routes/auth.js';
import roleRoutes from './routes/roles.js';
import scenarioRoutes from './routes/scenarios.js';
import knowledgeRoutes from './routes/knowledge.js';
import trainingRoutes from './routes/training.js';
import reportRoutes from './routes/reports.js';
import uploadRoutes from './routes/upload.js';
import aiGenerateRoutes from './routes/aiGenerate.js';
import strategyRoutes from './routes/strategy.js';
import analyticsRoutes from './routes/analytics.js';
import workbenchRoutes from './routes/workbench.js';
import customerResearchRoutes from './routes/customerResearch.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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
const appBasePath = getAppBasePath();
const staticPath = getAppStaticPath(__dirname);
const allowedOrigins = getAllowedOrigins();
const frameAncestors = process.env.FRAME_ANCESTORS?.trim() || process.env.WORKBENCH_ORIGIN?.trim();

app.use((req, res, next) => {
  const traceId = req.header('X-Trace-Id') || createTraceId();
  res.locals.traceId = traceId;
  res.setHeader('X-Trace-Id', traceId);
  next();
});

app.use((_req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (frameAncestors) res.setHeader('Content-Security-Policy', `frame-ancestors ${frameAncestors};`);
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Trace-Id'],
  exposedHeaders: ['X-Trace-Id'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const apiRootPaths = getApiPaths();
for (const apiRoot of apiRootPaths) {
  app.get(`${apiRoot}/health`, (_req, res) => {
    res.json({ ok: true, appId: APP_ID, version: APP_VERSION, time: new Date().toISOString(), traceId: res.locals.traceId });
  });
  app.use(`${apiRoot}/auth`, authRoutes);
  app.use(`${apiRoot}/roles`, roleRoutes);
  app.use(`${apiRoot}/scenarios`, scenarioRoutes);
  app.use(`${apiRoot}/knowledge`, knowledgeRoutes);
  app.use(`${apiRoot}/training`, trainingRoutes);
  app.use(`${apiRoot}/reports`, reportRoutes);
  app.use(`${apiRoot}/upload`, uploadRoutes);
  app.use(`${apiRoot}/ai`, aiGenerateRoutes);
  app.use(`${apiRoot}/strategy`, strategyRoutes);
  app.use(`${apiRoot}/stats/analytics`, analyticsRoutes);
  app.use(`${apiRoot}/v1`, workbenchRoutes);
  app.use(`${apiRoot}/customer-research`, customerResearchRoutes);
  app.post(`${apiRoot}/errors/report`, (req, res) => {
    const { message, url } = req.body || {};
    writeAuditLog({ action: 'ai.invoked', traceId: res.locals.traceId, purpose: 'frontend-error-report', result: 'failure', metadata: { message: String(message || '').slice(0, 200), url } });
    res.json({ ok: true, traceId: res.locals.traceId });
  });
}

app.use('/uploads', authMiddleware, (req, res, next) => {
  const authReq = req as import('./middleware/auth.js').AuthRequest;
  writeAuditLog({ action: 'file.downloaded', traceId: res.locals.traceId, actorId: authReq.user?.id, objectId: req.path, purpose: 'protected-upload', result: 'success' });
  next();
}, express.static(getUploadsDir()));

const staticMiddleware = express.static(staticPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
});
if (appBasePath) app.use(appBasePath, staticMiddleware);
else app.use(staticMiddleware);

const spaPaths = [...new Set(['*', appBasePath ? `${appBasePath}/*` : '*'])];
for (const spaPath of spaPaths) {
  app.get(spaPath, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

const server = app.listen(PORT, HOST, () => {
  console.log(`Server running: http://${getLocalIP()}:${PORT}${appBasePath || '/'}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  console.error(err.code === 'EADDRINUSE' ? `端口 ${PORT} 已被占用` : `服务启动失败: ${err.message}`);
  process.exit(1);
});

import('./services/cleanupService.js').then(m => {
  setInterval(() => m.cleanupStaleSessions().catch(e => console.error('[AutoCleanup]', e)), 60 * 60 * 1000);
  m.cleanupStaleSessions().catch(e => console.error('[AutoCleanup]', e));
}).catch(e => console.error('[AutoCleanup] 加载失败:', e));
