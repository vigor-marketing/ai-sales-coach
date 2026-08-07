import { Router, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { generateRoleResponse, generateEvaluation } from '../services/ai/chatService.js';
import { generateInsights } from '../services/strategy/strategyService.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { cleanupStaleSessions } from '../services/cleanupService.js';

const router: Router = Router();

// Track consecutive silent responses per session
const skipCounter = new Map<string, number>();

// Apply auth middleware to all training routes
router.use(authMiddleware);

// Check if a message is simple/basic to determine response speed
function isSimpleMessage(text: string): boolean {
  const t = text.trim().toLowerCase();
  
  // Very short messages (1-3 words)
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 3) return true;
  
  // Greeting/acknowledgment patterns
  const simplePatterns = [
    /^(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy)\b/,
    /^(ok|okay|sure|fine|great|nice|good|yes|no|yeah|yep|nope)\b/,
    /^(thanks|thank\s*you|thx|ty|ta)\b/,
    /^(got\s*it|understood|copy|roger|i\s*see|i\s*understand)\b/,
    /^(who\s*are\s*you|what'?s?\s*this|tell\s*me\s*more)\b/,
    /^(nice\s*to\s*(meet|talk)|pleasure|同样|你好|谢谢|好的|明白|知道了|可以|行|嗯|对)\b/,
    // Company introduction / self-introduction
    /^(i'?m\s+(a|an|from|with)\s|(let\s*me\s*)?(introduce|tell)\s+(you\s+)?(about|myself|our)\s|we\s+(are|'re|re)\s+(a|an|the)\s)/i,
    // Casual chat / small talk
    /^(how\s+(are|'re|is|'s)\s+(you|it|everything|things|your)\s|(what'?s?\s*up|how'?s?\s*it\s*(going|hangin))\s)/i,
    // Self-introduction patterns: My name is / I am / This is
    /^(my\s+name\s+is\s|i\s+am\s+|i'm\s+|this\s+is\s+)/i,
  ];
  for (const pattern of simplePatterns) {
    if (pattern.test(t)) return true;
  }
  
  return false;
}

// GET /sessions - 获取会话列表
router.get('/sessions', async (req: AuthRequest, res: Response) => {
  try {
    const where = req.user!.role === 'ADMIN' ? {} : { userId: req.user!.id };
    const sessions = await prisma.trainingSession.findMany({
      where,
      include: { role: true, scenario: true, user: { select: { name: true, email: true } } },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    res.json(sessions);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: '获取会话列表失败' });
  }
});

// GET /sessions/stats - 统计数据（给仪表盘用）
router.get('/sessions/stats', async (req: AuthRequest, res: Response) => {
  try {
    // Auto-cleanup stale sessions (older than 24h) — fire and forget
    cleanupStaleSessions().catch(e => console.error('[Cleanup]', e));

    const where = req.user!.role === 'ADMIN' ? {} : { userId: req.user!.id };

    const [totalSessions, totalRoles, totalReports, recentSessions] = await Promise.all([
      prisma.trainingSession.count({ where }),
      prisma.aiRole.count(),
      prisma.report.count({ where: { ...where } }),
      prisma.trainingSession.findMany({
        where,
        include: { role: true, scenario: true },
        orderBy: { startedAt: 'desc' },
        take: 10,
      }),
    ]);

    const avgResult = await prisma.report.aggregate({
      where: { ...where },
      _avg: { overallScore: true },
    });

    res.json({
      totalSessions,
      totalRoles,
      totalReports,
      averageScore: Math.round(avgResult._avg.overallScore || 0),
      recentSessions,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

// DELETE /sessions/:id - 删除会话（仅管理员）
router.delete('/sessions/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: '仅管理员可删除会话' });
    }
    const sessionId = req.params.id;
    const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
    if (!session) return res.status(404).json({ error: '会话未找到' });

    // Delete associated data
    await prisma.evaluation.deleteMany({ where: { sessionId } });
    await prisma.message.deleteMany({ where: { sessionId } });
    await prisma.report.deleteMany({ where: { sessionId } });
    await prisma.trainingSession.delete({ where: { id: sessionId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete session:', error);
    res.status(500).json({ error: '删除会话失败' });
  }
});

// PATCH /sessions/:id/status - 更新会话状态（PAUSED / COMPLETED / ACTIVE）
router.patch('/sessions/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.id;
    const { status } = req.body;
    if (!['ACTIVE', 'PAUSED', 'COMPLETED'].includes(status)) {
      return res.status(400).json({ error: '无效的状态值，允许: ACTIVE/PAUSED/COMPLETED' });
    }
    const session = await prisma.trainingSession.update({
      where: { id: sessionId },
      data: { status, endedAt: status === 'COMPLETED' ? new Date() : undefined },
    });
    res.json(session);
  } catch (error) {
    console.error('Failed to update session status:', error);
    res.status(500).json({ error: '更新会话状态失败' });
  }
});

// POST /sessions - 创建新会话
router.post('/sessions', async (req: AuthRequest, res: Response) => {
  try {
    // 如果未指定场景（随机场景），优先选与角色同地区或通用的场景
    let scenarioId = req.body.scenarioId || undefined;
    if (!scenarioId) {
      // Get role to determine region
      const role = await prisma.aiRole.findUnique({ where: { id: req.body.roleId } });
      const roleRegion = role?.region || '';
      // Extract broad region keyword
      let matchRegion = '通用';
      if (/中东|沙特|阿联酋|伊拉克/.test(roleRegion)) matchRegion = '中东';
      else if (/欧洲|挪威|英国|法国|巴黎/.test(roleRegion)) matchRegion = '欧洲';
      else if (/俄罗斯/.test(roleRegion)) matchRegion = '俄罗斯';
      else if (/北美|美国|德州|墨西哥/.test(roleRegion)) matchRegion = '北美';
      else if (/中国|北京/.test(roleRegion)) matchRegion = '中国';
      else if (/印度/.test(roleRegion)) matchRegion = '印度';
      else if (/南美|巴西|阿根廷|哥伦比亚|拉美/.test(roleRegion)) matchRegion = '南美';
      else if (/澳洲/.test(roleRegion)) matchRegion = '澳洲';
      else if (/东南亚|马来西亚|印尼/.test(roleRegion)) matchRegion = '东南亚';
      else if (/日本/.test(roleRegion)) matchRegion = '日本';
      else if (/中亚|哈萨克/.test(roleRegion)) matchRegion = '中亚';

      // Prefer matching region, fall back to 通用
      const filterRegion = matchRegion === '通用' ? '通用' : matchRegion;
      const candidateScenarios = await prisma.scenario.findMany({
        where: { OR: [{ region: filterRegion }, { region: '通用' }] },
        take: 30,
      });
      // Sort so exact match comes first
      candidateScenarios.sort((a, b) => {
        const aR = a.region || '通用';
        const bR = b.region || '通用';
        if (aR === matchRegion && bR !== matchRegion) return -1;
        if (aR !== matchRegion && bR === matchRegion) return 1;
        return 0;
      });
      // Weighted random: 70% chance pick first (matched), 30% random
      if (candidateScenarios.length > 0) {
        const idx = Math.random() < 0.7 ? 0 : Math.floor(Math.random() * Math.min(candidateScenarios.length, 5));
        scenarioId = candidateScenarios[idx].id;
      }
    }
    const session = await prisma.trainingSession.create({
      data: {
        roleId: req.body.roleId,
        scenarioId,
        userId: req.user!.id,
        status: 'ACTIVE',
      },
      include: { role: true, scenario: true },
    });

    // Create welcome system message in DB so it persists across refreshes
    const roleName = session.role?.name || '';
    const rolePos = session.role?.position || '';
    const scenarioTitle = session.scenario?.title || '';
    const systemContent = `陪练开始。你正在与 ${roleName}（${rolePos}）进行对话。${scenarioTitle ? `场景：${scenarioTitle}` : ''}`;
    await prisma.message.create({
      data: { sessionId: session.id, role: 'SYSTEM', content: systemContent },
    });

    res.status(201).json(session);
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: '创建会话失败' });
  }
});

// Helper to check session ownership
async function checkSessionAccess(sessionId: string, req: AuthRequest): Promise<boolean> {
  const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
  if (!session) return false;
  if (req.user!.role === 'ADMIN') return true;
  return session.userId === req.user!.id;
}

router.get('/sessions/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await checkSessionAccess(req.params.id, req))) {
      return res.status(403).json({ error: '无权访问此会话' });
    }
    const messages = await prisma.message.findMany({
      where: { sessionId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: '获取消息失败' });
  }
});

router.post('/sessions/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await checkSessionAccess(req.params.id, req))) {
      return res.status(403).json({ error: '无权访问此会话' });
    }
    const { role, content } = req.body;
    const message = await prisma.message.create({
      data: { sessionId: req.params.id, role, content },
    });
    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: '发送消息失败' });
  }
});

router.post('/sessions/:id/chat', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await checkSessionAccess(req.params.id, req))) {
      return res.status(403).json({ error: '无权访问此会话' });
    }
    const { message } = req.body;
    const sessionId = req.params.id;

    // Save user message
    await prisma.message.create({
      data: { sessionId, role: 'USER', content: message },
    });

    // Simulate customer thinking delay (reduced for faster response)
    const simpleKeywords = /^(hi|hello|hey|ok|okay|thanks|thank you|yes|no|sure|great|good|fine|bye|goodbye)$/i;
    const isSimple = simpleKeywords.test(message.trim()) || message.trim().length < 10;
    const delayMs = isSimple ? 0 : 500 + Math.floor(Math.random() * 1500); // simple: 0s, normal: 0.5-2s
    await new Promise(r => setTimeout(r, delayMs));

    // Generate AI response
    const response = await generateRoleResponse(sessionId, message);
    console.log(`[Chat ${sessionId.slice(0,8)}] AI response: "${response.slice(0,60)}" skips=${skipCounter.get(sessionId)||0}`);

    // Track silent responses — force a reply at least every 4 skips (1 reply per 3-5 messages)
    const currentSkips = skipCounter.get(sessionId) || 0;
    if (response.trim() === '[NO_RESPONSE]') {
      if (currentSkips >= 1) {
        console.log(`[Chat ${sessionId.slice(0,8)}] FORCING reply (was skip #${currentSkips+1})`);
        // Already skipped enough — force a reply now
        skipCounter.set(sessionId, 0);
        const forcedResponse = await generateRoleResponse(sessionId, message);
        console.log(`[Chat ${sessionId.slice(0,8)}] Forced response: "${(forcedResponse||'').slice(0,60)}"`);
        const finalResponse = forcedResponse.trim() === '[NO_RESPONSE]'
          ? "I've been thinking. What else do you have for me?"
          : forcedResponse;
        const cleanedForced = finalResponse.replace('[END_CONVERSATION]', '').trim();
        await prisma.message.create({
          data: { sessionId, role: 'ASSISTANT', content: cleanedForced },
        });
        return res.json({ response: cleanedForced });
      }
      skipCounter.set(sessionId, currentSkips + 1);
      return res.json({ skipped: true, response: null });
    }
    skipCounter.set(sessionId, 0);

    // Save AI response
    const cleanedResponse = response.replace('[END_CONVERSATION]', '').trim();
    await prisma.message.create({
      data: { sessionId, role: 'ASSISTANT', content: cleanedResponse },
    });

    // Check if AI wants to end the conversation
    if (response.includes('[END_CONVERSATION]')) {
      // Auto-trigger evaluation
      const evaluation = await generateEvaluation(sessionId);

      // Save evaluation data
      for (const dim of evaluation.dimensions) {
        await prisma.evaluation.create({
          data: { sessionId, dimension: dim.dimension, score: dim.score, feedback: dim.feedback },
        });
      }

      // Create report
      const session = await prisma.trainingSession.findUnique({
        where: { id: sessionId },
        include: { messages: true },
      });

      const formatRecs = (recs: unknown): string => {
        if (typeof recs === 'string') return recs;
        if (Array.isArray(recs)) {
          return recs.map((r: any, i: number) => {
            const content = r.advice || r.建议内容 || r.recommendation || r.content || String(r);
            return `${i + 1}. ${content}`;
          }).join('\n\n');
        }
        return String(recs || '');
      };

      const report = await prisma.report.upsert({
        where: { sessionId },
        update: {
          overallScore: evaluation.overallScore,
          radarData: JSON.stringify(evaluation.dimensions),
          strengths: evaluation.strengths,
          weaknesses: evaluation.weaknesses,
          recommendations: formatRecs(evaluation.recommendations),
          transcript: session?.messages.map((m) => `${m.role}: ${m.content}`).join('\n'),
          orderAwarded: evaluation.orderDecision.awarded,
          orderReason: evaluation.orderDecision.reason,
          orderType: evaluation.orderDecision.type,
        },
        create: {
          sessionId,
          userId: session?.userId || req.user!.id,
          overallScore: evaluation.overallScore,
          radarData: JSON.stringify(evaluation.dimensions),
          strengths: evaluation.strengths,
          weaknesses: evaluation.weaknesses,
          recommendations: formatRecs(evaluation.recommendations),
          transcript: session?.messages.map((m) => `${m.role}: ${m.content}`).join('\n'),
          orderAwarded: evaluation.orderDecision.awarded,
          orderReason: evaluation.orderDecision.reason,
          orderType: evaluation.orderDecision.type,
        },
      });

      await prisma.trainingSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED', endedAt: new Date() },
      });

      // Generate strategy insights in background
      generateInsights(sessionId).catch(e => console.error('Insights error:', e));

      return res.json({
        response: cleanedResponse,
        ended: true,
        evaluation: { ...evaluation, reportId: report.id },
      });
    }

    res.json({ response });
  } catch (error: any) {
    console.error('Chat error:', error);
    const errorMsg = error?.message || '';
    if (errorMsg.includes('timeout') || errorMsg.includes('ETIMEDOUT') || errorMsg.includes('ECONNRESET')) {
      res.status(503).json({ error: 'AI服务暂时繁忙，请稍后重试', retryable: true });
    } else if (errorMsg.includes('401') || errorMsg.includes('unauthorized') || errorMsg.includes('api_key')) {
      res.status(502).json({ error: 'AI服务配置异常，请联系管理员', retryable: false });
    } else {
      res.status(500).json({ error: '对话生成失败，请重试', retryable: true });
    }
  }
});

router.post('/sessions/:id/evaluate', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await checkSessionAccess(req.params.id, req))) {
      return res.status(403).json({ error: '无权访问此会话' });
    }
    const sessionId = req.params.id;
    const evaluation = await generateEvaluation(sessionId);

    // Save evaluation data
    for (const dim of evaluation.dimensions) {
      await prisma.evaluation.create({
        data: {
          sessionId,
          dimension: dim.dimension,
          score: dim.score,
          feedback: dim.feedback,
        },
      });
    }

    // Create or update report
    const session = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: { messages: true },
    });

    const formatRecs = (recs: unknown): string => {
      if (typeof recs === 'string') return recs;
      if (Array.isArray(recs)) {
        return recs.map((r: any, i: number) => {
          const content = r.advice || r.建议内容 || r.recommendation || r.content || String(r);
          return `${i + 1}. ${content}`;
        }).join('\n\n');
      }
      return String(recs || '');
    };

    const report = await prisma.report.upsert({
      where: { sessionId },
      update: {
        overallScore: evaluation.overallScore,
        radarData: JSON.stringify(evaluation.dimensions),
        strengths: evaluation.strengths,
        weaknesses: evaluation.weaknesses,
        recommendations: formatRecs(evaluation.recommendations),
        transcript: session?.messages.map((m) => `${m.role}: ${m.content}`).join('\n'),
        orderAwarded: evaluation.orderDecision.awarded,
        orderReason: evaluation.orderDecision.reason,
        orderType: evaluation.orderDecision.type,
      },
      create: {
        sessionId,
        userId: session?.userId || req.user!.id,
        overallScore: evaluation.overallScore,
        radarData: JSON.stringify(evaluation.dimensions),
        strengths: evaluation.strengths,
        weaknesses: evaluation.weaknesses,
        recommendations: formatRecs(evaluation.recommendations),
        transcript: session?.messages.map((m) => `${m.role}: ${m.content}`).join('\n'),
        orderAwarded: evaluation.orderDecision.awarded,
        orderReason: evaluation.orderDecision.reason,
        orderType: evaluation.orderDecision.type,
      },
    });

    await prisma.trainingSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED', endedAt: new Date() },
    });

    // Generate strategy insights in background
    generateInsights(sessionId).catch(e => console.error('Insights error:', e));

    res.json({ ...evaluation, reportId: report.id });
  } catch (error) {
    console.error('Evaluation error:', error);
    res.status(500).json({ error: 'Failed to generate evaluation' });
  }
});

export default router;
