import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router: Router = Router();
const prisma = new PrismaClient();

// GET /api/stats/analytics - Cross-session analytics
router.get('/', async (req: Request, res: Response) => {
  try {
    const reports = await prisma.report.findMany({
      include: {
        session: {
          include: {
            role: { select: { name: true, position: true, region: true } },
            scenario: { select: { title: true, category: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (reports.length === 0) {
      return res.json({
        overview: { totalReports: 0, averageScore: 0, bestScore: 0, worstScore: 0 },
        roleAnalytics: [],
        scenarioAnalytics: [],
        dimensionAverages: [],
        scoreTrend: [],
      });
    }

    // ─── Per-role averages ───
    const roleMap = new Map<string, { scores: number[]; count: number; positions: string[]; scenarios: string[] }>();
    // ─── Per-scenario averages ───
    const scenarioMap = new Map<string, { scores: number[]; count: number }>();
    // ─── Per-dimension averages ───
    const dimMap = new Map<string, number[]>();
    // ─── Score trend ───
    const trend: { date: string; score: number }[] = [];

    for (const r of reports) {
      const roleName = r.session?.role?.name || '未知角色';
      const scenarioTitle = r.session?.scenario?.title || '未知场景';
      const score = r.overallScore ?? 0;

      // Role
      if (!roleMap.has(roleName)) roleMap.set(roleName, { scores: [], count: 0, positions: [], scenarios: [] });
      const rm = roleMap.get(roleName)!;
      rm.scores.push(score);
      rm.count++;
      if (r.session?.role?.position) rm.positions.push(r.session.role.position);
      rm.scenarios.push(scenarioTitle);

      // Scenario
      if (!scenarioMap.has(scenarioTitle)) scenarioMap.set(scenarioTitle, { scores: [], count: 0 });
      const sm = scenarioMap.get(scenarioTitle)!;
      sm.scores.push(score);
      sm.count++;

      // Trend
      trend.push({ date: r.createdAt.toISOString().slice(0, 10), score });

      // Dimensions
      try {
        const dims = JSON.parse(r.radarData || '[]');
        for (const d of dims) {
          if (!dimMap.has(d.dimension)) dimMap.set(d.dimension, []);
          dimMap.get(d.dimension)!.push(d.score);
        }
      } catch {}
    }

    const scores = reports.map(r => r.overallScore ?? 0);

    const roleAnalytics = Array.from(roleMap.entries())
      .map(([name, data]) => ({
        role: name,
        position: [...new Set(data.positions)].join(', '),
        scenario: [...new Set(data.scenarios)].join(', '),
        avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
        count: data.count,
        bestScore: Math.max(...data.scores),
        worstScore: Math.min(...data.scores),
      }))
      .sort((a, b) => a.avgScore - b.avgScore); // weakest first

    const scenarioAnalytics = Array.from(scenarioMap.entries())
      .map(([title, data]) => ({
        scenario: title,
        avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
        count: data.count,
      }))
      .sort((a, b) => a.avgScore - b.avgScore);

    const dimensionAverages = Array.from(dimMap.entries())
      .map(([dim, vals]) => ({
        dimension: dim,
        avgScore: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
        count: vals.length,
      }))
      .sort((a, b) => a.avgScore - b.avgScore);

    res.json({
      overview: {
        totalReports: reports.length,
        averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        bestScore: Math.max(...scores),
        worstScore: Math.min(...scores),
      },
      roleAnalytics,
      scenarioAnalytics,
      dimensionAverages,
      scoreTrend: trend,
    });
  } catch (err) {
    console.error('[analytics]', err);
    res.status(500).json({ error: '分析失败' });
  }
});

export default router;
