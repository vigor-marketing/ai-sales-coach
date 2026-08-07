import { Router, Response } from 'express';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';
import fs from 'fs';
import path from 'path';

const router: Router = Router();
router.use(authMiddleware);

const DATA_DIR = path.resolve(process.cwd(), 'data/strategy-insights');

/**
 * GET /api/strategy - 获取所有角色策略洞察概览（管理员）
 */
router.get('/', adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const results: any[] = [];
    if (!fs.existsSync(DATA_DIR)) {
      res.json([]);
      return;
    }
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
        const role = await prisma.aiRole.findUnique({ where: { id: data.roleId }, select: { name: true, region: true, position: true } });
        results.push({
          roleId: data.roleId,
          roleName: role?.name || '未知角色',
          region: role?.region || '',
          position: role?.position || '',
          totalSessions: data.totalSessions || 0,
          lastUpdated: data.lastUpdated,
          insightCount: (data.insights || []).length,
          recentInsights: (data.insights || []).slice(-3).map((i: any) => ({
            category: i.category,
            content: i.content.slice(0, 80),
            createdAt: i.createdAt,
          })),
        });
      } catch { /* skip broken files */ }
    }
    results.sort((a, b) => b.lastUpdated?.localeCompare(a.lastUpdated || '') || 0);
    res.json(results);
  } catch (error) {
    console.error('Get strategies error:', error);
    res.status(500).json({ error: '获取策略洞察失败' });
  }
});

/**
 * GET /api/strategy/:roleId - 获取单个角色完整策略洞察
 */
router.get('/:roleId', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const filePath = path.join(DATA_DIR, `${req.params.roleId}.json`);
    if (!fs.existsSync(filePath)) {
      res.json({ roleId: req.params.roleId, totalSessions: 0, insights: [], dailySummaries: [] });
      return;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const role = await prisma.aiRole.findUnique({ where: { id: data.roleId }, select: { name: true, region: true, position: true } });
    res.json({ ...data, roleName: role?.name, region: role?.region, position: role?.position });
  } catch (error) {
    console.error('Get strategy error:', error);
    res.status(500).json({ error: '获取策略洞察详情失败' });
  }
});

export default router;
