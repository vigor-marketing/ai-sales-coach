import { Router, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth.js';

const router: Router = Router();

/**
 * POST /api/feedback - 提交反馈（无需登录）
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { type, content, contact } = req.body;
    if (!content || !content.trim()) {
      res.status(400).json({ error: '反馈内容不能为空' });
      return;
    }
    const validTypes = ['BUG', 'FEATURE', 'IMPROVEMENT', 'OTHER'];
    const feedback = await prisma.feedback.create({
      data: {
        type: validTypes.includes(type) ? type : 'OTHER',
        content: content.trim(),
        contact: contact || '',
        userId: (req as any).user?.id || null,
        status: 'PENDING',
      },
    });
    res.status(201).json(feedback);
  } catch (error) {
    console.error('Create feedback error:', error);
    res.status(500).json({ error: '提交反馈失败' });
  }
});

/**
 * GET /api/feedback - 获取反馈列表（管理员）
 */
router.get('/', authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const feedbacks = await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(feedbacks);
  } catch (error) {
    console.error('Get feedbacks error:', error);
    res.status(500).json({ error: '获取反馈列表失败' });
  }
});

/**
 * GET /api/feedback/stats - 反馈统计（管理员）
 */
router.get('/stats', authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const total = await prisma.feedback.count();
    const pending = await prisma.feedback.count({ where: { status: 'PENDING' } });
    const byType = await prisma.feedback.groupBy({
      by: ['type'],
      _count: true,
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayNew = await prisma.feedback.count({
      where: { createdAt: { gte: today } },
    });
    res.json({ total, pending, todayNew, byType });
  } catch (error) {
    console.error('Get feedback stats error:', error);
    res.status(500).json({ error: '获取反馈统计失败' });
  }
});

/**
 * PUT /api/feedback/:id - 更新反馈状态（管理员）
 */
router.put('/:id', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ['PENDING', 'REVIEWING', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: '无效的状态值' });
      return;
    }
    const feedback = await prisma.feedback.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(feedback);
  } catch (error) {
    console.error('Update feedback error:', error);
    res.status(500).json({ error: '更新反馈状态失败' });
  }
});

export default router;
