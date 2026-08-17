import { Router, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { sendApiError } from '../utils/apiResponse.js';
import { writeAuditLog } from '../utils/audit.js';
import { canViewSessionOwner, canViewOrganizationSummary, getSessionScope } from '../services/workbench/coachingAccess.js';

const router: Router = Router();
router.use(authMiddleware);

function mapSession(session: {
  id: string;
  userId: string;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
  user: { teamId: string | null };
  report: { overallScore: number; recommendations: string } | null;
}) {
  return {
    session_id: session.id,
    user_id: session.userId,
    team_id: session.user.teamId,
    created_at: session.startedAt.toISOString(),
    completed_at: session.endedAt?.toISOString() || null,
    score: session.report?.overallScore ?? null,
    status: session.status,
    suggestion_summary: session.report?.recommendations.slice(0, 500) || null,
  };
}

router.get('/coaching-sessions', async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await prisma.trainingSession.findMany({
      where: getSessionScope(req.user!),
      include: { user: { select: { teamId: true } }, report: { select: { overallScore: true, recommendations: true } } },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
    writeAuditLog({ action: 'coaching.session.viewed', traceId: res.locals.traceId, actorId: req.user!.id, purpose: 'workbench-list', result: 'success' });
    res.json({ data: sessions.map(mapSession), traceId: res.locals.traceId });
  } catch {
    sendApiError(res, 500, 'COACHING_SESSIONS_UNAVAILABLE', '获取陪练会话失败');
  }
});

router.get('/coaching-sessions/:id', async (req: AuthRequest, res: Response) => {
  try {
    const session = await prisma.trainingSession.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { teamId: true } }, report: { select: { overallScore: true, recommendations: true } } },
    });
    if (!session) return sendApiError(res, 404, 'COACHING_SESSION_NOT_FOUND', '陪练会话不存在');
    if (!canViewSessionOwner(req.user!, session)) return sendApiError(res, 403, 'FORBIDDEN', '无权访问该陪练会话');

    writeAuditLog({ action: 'coaching.session.viewed', traceId: res.locals.traceId, actorId: req.user!.id, objectId: session.id, purpose: 'workbench-detail', result: 'success' });
    return res.json({ data: mapSession(session), traceId: res.locals.traceId });
  } catch {
    return sendApiError(res, 500, 'COACHING_SESSION_UNAVAILABLE', '获取陪练会话失败');
  }
});

router.get('/coaching-summary', async (req: AuthRequest, res: Response) => {
  try {
    const scope = getSessionScope(req.user!);
    const [totalSessions, completedSessions, scoreAggregate] = await Promise.all([
      prisma.trainingSession.count({ where: scope }),
      prisma.trainingSession.count({ where: { ...scope, status: 'COMPLETED' } }),
      prisma.report.aggregate({ where: scope.userId ? { userId: scope.userId } : scope.user ? { user: scope.user } : {}, _avg: { overallScore: true } }),
    ]);

    writeAuditLog({ action: 'coaching.summary.viewed', traceId: res.locals.traceId, actorId: req.user!.id, purpose: canViewOrganizationSummary(req.user!) ? 'organization-summary' : 'self-summary', result: 'success' });
    return res.json({
      data: {
        total_sessions: totalSessions,
        completed_sessions: completedSessions,
        average_score: Math.round(scoreAggregate._avg.overallScore || 0),
      },
      traceId: res.locals.traceId,
    });
  } catch {
    return sendApiError(res, 500, 'COACHING_SUMMARY_UNAVAILABLE', '获取陪练汇总失败');
  }
});

export default router;
