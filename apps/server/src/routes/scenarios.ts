import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth.js';

const router: Router = Router();

router.use(authMiddleware);

router.get('/', async (_req: AuthRequest, res) => {
  try {
    const scenarios: any[] = await prisma.scenario.findMany({ 
      orderBy: { createdAt: 'desc' },
    });
    // Fallback: add region mapping for scenarios
    const regionMap: Record<string, string> = {
      '成本效益分析': '印度', '认证审核': '欧洲', '长期合作谈判': '中国',
      '安全危机应对': '中东', '官僚流程应对': '俄罗斯', '战略合作谈判': '中东',
      '技术验证邀请': '澳洲', '文化适配沟通': '日本', '紧急交货谈判': '中东',
      '价格谈判 - 哈萨': '中亚', '技术澄清视频会议': '北美',
      '展会初次接触': '中东', '谈判签约': '南美', '异议处理 - 俄罗': '俄罗斯',
      '方案呈现': '北美', '需求挖掘': '中东', '初次接触 - 挪威': '欧洲',
      '技术方案评审': '北美', '初次接触 - 建立': '通用', '价格谈判 - 应对': '通用',
      '复杂谈判': '通用', '沟通协作': '东南亚',
    };
    for (const s of scenarios) {
      if (!s.region) {
        s.region = '通用';
        for (const [key, val] of Object.entries(regionMap)) {
          if ((s.title as string).startsWith(key)) { s.region = val; break; }
        }
      }
    }
    res.json(scenarios);
  } catch (error) {
    console.error('Get scenarios error:', error);
    res.status(500).json({ error: '获取场景列表失败' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const scenario = await prisma.scenario.findUnique({ where: { id: req.params.id } });
    if (!scenario) return res.status(404).json({ error: '场景不存在' });
    res.json(scenario);
  } catch (error) {
    console.error('Get scenario error:', error);
    res.status(500).json({ error: '获取场景失败' });
  }
});

router.post('/', adminOnly, async (req: AuthRequest, res) => {
  try {
    const data = {
      title: req.body.title || '未命名场景',
      description: req.body.description || '',
      category: req.body.category || '',
      difficulty: req.body.difficulty || 'MEDIUM',
      background: req.body.background || '',
      objectives: req.body.objectives || '',
      evaluationCriteria: req.body.evaluationCriteria || '',
      region: req.body.region || '',
      isPreset: false,
    };
    const scenario = await prisma.scenario.create({ data });
    res.status(201).json(scenario);
  } catch (error) {
    console.error('Create scenario error:', error);
    res.status(500).json({ error: '创建场景失败' });
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  try {
    const allowedFields = ['title', 'description', 'category', 'difficulty', 'background', 'objectives', 'evaluationCriteria', 'region'];
    const data: any = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        data[field] = req.body[field];
      }
    }
    const scenario = await prisma.scenario.update({ where: { id: req.params.id }, data });
    res.json(scenario);
  } catch (error) {
    console.error('Update scenario error:', error);
    res.status(500).json({ error: '更新场景失败' });
  }
});

router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const scenarioId = req.params.id;

    // Delete related training sessions and their data
    const sessions = await prisma.trainingSession.findMany({ where: { scenarioId } });
    for (const session of sessions) {
      await prisma.evaluation.deleteMany({ where: { sessionId: session.id } });
      await prisma.message.deleteMany({ where: { sessionId: session.id } });
      await prisma.report.deleteMany({ where: { sessionId: session.id } });
    }
    await prisma.trainingSession.deleteMany({ where: { scenarioId } });

    // Delete role-scenario mappings
    await prisma.roleScenario.deleteMany({ where: { scenarioId } });

    // Finally delete the scenario
    await prisma.scenario.delete({ where: { id: scenarioId } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete scenario error:', error);
    res.status(500).json({ error: '删除场景失败，请确保已删除关联的培训记录' });
  }
});

export default router;
