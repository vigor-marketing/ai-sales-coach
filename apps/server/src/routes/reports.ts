import { Router, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router: Router = Router();

router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const where = req.user!.role === 'ADMIN' ? {} : { userId: req.user!.id };
    const reports = await prisma.report.findMany({
      where,
      include: {
        session: {
          include: { role: true, scenario: true, user: { select: { name: true } } }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(reports);
  } catch (error) {
    console.error('Failed to fetch reports:', error);
    res.status(500).json({ error: '获取报告列表失败' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    // First try by report ID, then fall back to session ID
    let report = await prisma.report.findUnique({
      where: { id: req.params.id },
      include: { session: { include: { role: true, scenario: true, messages: true, user: { select: { name: true } } } } },
    });
    if (!report) {
      // Fallback: look up report by sessionId (Dashboard uses session ID)
      report = await prisma.report.findUnique({
        where: { sessionId: req.params.id },
        include: { session: { include: { role: true, scenario: true, messages: true, user: { select: { name: true } } } } },
      });
    }
    if (!report) return res.status(404).json({ error: '报告未找到' });
    if (req.user!.role !== 'ADMIN' && report.userId !== req.user!.id) {
      return res.status(403).json({ error: '无权限查看' });
    }
    res.json(report);
  } catch (error) {
    console.error('Failed to fetch report:', error);
    res.status(500).json({ error: '获取报告详情失败' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: '仅管理员可删除报告' });
    }
    const report = await prisma.report.findUnique({
      where: { id: req.params.id },
      include: { session: true },
    });
    if (!report) return res.status(404).json({ error: '报告未找到' });

    // Delete associated data
    const sessionId = report.sessionId;
    await prisma.evaluation.deleteMany({ where: { sessionId } });
    await prisma.message.deleteMany({ where: { sessionId } });
    await prisma.report.delete({ where: { id: req.params.id } });
    await prisma.trainingSession.delete({ where: { id: sessionId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete report:', error);
    res.status(500).json({ error: '删除报告失败' });
  }
});

export default router;
