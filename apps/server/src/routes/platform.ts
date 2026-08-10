import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { adminOnly, authMiddleware } from '../middleware/auth.js';
import { toPlatformEvent } from '../services/platformEvents.js';

const router: Router = Router();
router.use(authMiddleware, adminOnly);

// 仅供工作台受控服务拉取。当前本地 JWT 管理员是临时边界；正式环境需替换为 OIDC 服务身份。
router.get('/events', async (req, res) => {
  try {
    const requestedLimit = Number(req.query.limit || 100);
    if (!Number.isInteger(requestedLimit)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'limit 必须是整数' }, requestId: 'req_invalid' });
    }
    const limit = Math.max(1, Math.min(requestedLimit, 100));
    const after = typeof req.query.after === 'string' ? req.query.after.replace(/^evt_/, '') : '';
    const events = await prisma.platformEvent.findMany({ orderBy: { createdAt: 'asc' } });
    const start = after ? Math.max(0, events.findIndex((event) => event.id === after) + 1) : 0;
    const items = events.slice(start, start + limit).map(toPlatformEvent);
    const data: { items: ReturnType<typeof toPlatformEvent>[]; nextCursor?: string } = { items };
    if (start + limit < events.length) data.nextCursor = `evt_${events[start + limit - 1].id}`;
    return res.json({ data, requestId: `req_${Date.now().toString(36)}` });
  } catch (error) {
    console.error('Get platform events error:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '读取训练事件失败' }, requestId: `req_${Date.now().toString(36)}` });
  }
});

export default router;
