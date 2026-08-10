import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth.js';

const router: Router = Router();

router.use(authMiddleware);

// Get all roles (all users)
router.get('/', async (_req: AuthRequest, res) => {
  try {
    const roles = await prisma.aiRole.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(roles);
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: '获取角色列表失败' });
  }
});

// Get role by id (all users)
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const role = await prisma.aiRole.findUnique({ where: { id: req.params.id } });
    if (!role) return res.status(404).json({ error: '角色不存在' });
    res.json(role);
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({ error: '获取角色失败' });
  }
});

// Create role (admin only)
router.post('/', adminOnly, async (req: AuthRequest, res) => {
  try {
    const data = {
      name: req.body.name || '未命名角色',
      customerType: req.body.customerType || '',
      region: req.body.region || '',
      position: req.body.position || '',
      annualRevenue: req.body.annualRevenue || '',
      coreTags: req.body.coreTags || '',
      languagePreference: req.body.languagePreference || '',
      communicationStyle: req.body.communicationStyle || '',
      decisionStyle: req.body.decisionStyle || '',
      painPoints: req.body.painPoints || '',
      productFocus: req.body.productFocus || '',
      personalityTraits: req.body.personalityTraits || '',
      promptTemplate: req.body.promptTemplate || '',
      isPreset: false,
      // 陪练角色只能是模拟资料，绝不建立真实客户关联。
      trainingDataKind: 'SIMULATED',
    };
    const role = await prisma.aiRole.create({ data });
    res.status(201).json(role);
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ error: '创建角色失败' });
  }
});

// Update role (admin only)
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const allowedFields = ['name', 'customerType', 'region', 'position', 'annualRevenue', 'coreTags', 'languagePreference', 'communicationStyle', 'decisionStyle', 'painPoints', 'productFocus', 'personalityTraits', 'promptTemplate'];
    const data: any = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        data[field] = req.body[field];
      }
    }
    const role = await prisma.aiRole.update({ where: { id: req.params.id }, data });
    res.json(role);
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: '更新角色失败' });
  }
});

// Delete role (admin only)
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const roleId = req.params.id;

    // Delete related training sessions and their data
    const sessions = await prisma.trainingSession.findMany({ where: { roleId } });
    for (const session of sessions) {
      await prisma.evaluation.deleteMany({ where: { sessionId: session.id } });
      await prisma.message.deleteMany({ where: { sessionId: session.id } });
      await prisma.report.deleteMany({ where: { sessionId: session.id } });
    }
    await prisma.trainingSession.deleteMany({ where: { roleId } });

    // Delete role-scenario mappings
    await prisma.roleScenario.deleteMany({ where: { roleId } });

    // Finally delete the role
    await prisma.aiRole.delete({ where: { id: roleId } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ error: '删除角色失败，请确保已删除关联的培训记录' });
  }
});

export default router;
