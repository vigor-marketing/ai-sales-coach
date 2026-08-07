import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma.js';
import { generateToken, authMiddleware, AuthRequest } from '../middleware/auth.js';

const router: Router = Router();

// POST /api/auth/register - 注册子账号（需要主账号权限）
router.post('/register', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '只有主账号可以创建子账号' });
    }
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: '请填写完整信息' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少6位' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: '该账号已存在' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, name, password: hashedPassword, role: 'TRAINEE' },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// POST /api/auth/login - 登录（含简单限流）
const loginAttempts = new Map<string, { count: number; lockUntil: number }>();
router.post('/login', async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const attempt = loginAttempts.get(ip);
    if (attempt && attempt.lockUntil > now) {
      const remaining = Math.ceil((attempt.lockUntil - now) / 1000 / 60);
      return res.status(429).json({ error: `登录尝试过多，请${remaining}分钟后再试` });
    }
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: '请输入账号和密码' });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: '账号或密码错误' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      // Track failed attempts
      const existing = loginAttempts.get(ip) || { count: 0, lockUntil: 0 };
      existing.count += 1;
      if (existing.count >= 10) {
        existing.lockUntil = Date.now() + 15 * 60 * 1000; // 15 min lockout
      }
      loginAttempts.set(ip, existing);
      return res.status(401).json({ error: '账号或密码错误' });
    }
    // Reset on success
    loginAttempts.delete(ip);
    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// GET /api/auth/me - 获取当前登录用户信息
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// PUT /api/auth/password - 修改密码
router.put('/password', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) return res.status(400).json({ error: '原密码错误' });
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });
    res.json({ message: '密码修改成功' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: '修改密码失败' });
  }
});

// GET /api/auth/users - 获取所有用户（仅主账号）
router.get('/users', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '只有主账号可以查看用户列表' });
    }
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true,
        _count: { select: { sessions: true, reports: true } }
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// PUT /api/auth/profile - 修改当前用户信息（名称、邮箱）
router.put('/profile', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, email } = req.body;
    const data: any = {};
    if (name) data.name = name;
    if (email) {
      const existing = await prisma.user.findFirst({ where: { email, id: { not: req.user!.id } } });
      if (existing) return res.status(400).json({ error: '该邮箱已被使用' });
      data.email = email;
    }
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
      select: { id: true, email: true, name: true, role: true },
    });
    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: '修改信息失败' });
  }
});

// PUT /api/auth/users/:id - 主账号修改子账号信息
router.put('/users/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '只有主账号可以修改用户' });
    }
    const { name, email, password, role } = req.body;
    const data: any = {};
    if (name) data.name = name;
    if (email) {
      const existing = await prisma.user.findFirst({ where: { email, id: { not: req.params.id } } });
      if (existing) return res.status(400).json({ error: '该邮箱已被使用' });
      data.email = email;
    }
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: '密码长度至少6位' });
      }
      data.password = await bcrypt.hash(password, 10);
    }
    if (role) {
      const validRoles = ['TRAINEE', 'ADMIN'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: '无效的角色类型' });
      }
      data.role = role;
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, email: true, name: true, role: true, createdAt: true,
        _count: { select: { sessions: true, reports: true } }
      },
    });
    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: '修改用户失败' });
  }
});

// DELETE /api/auth/users/:id - 主账号删除子账号
router.delete('/users/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '只有主账号可以删除用户' });
    }
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: '用户不存在' });
    if (target.role === 'ADMIN') return res.status(400).json({ error: '不能删除主账号' });
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

// GET /api/auth/setup - 检查是否需要初始化（是否已有主账号）
router.get('/setup', async (_req, res) => {
  try {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    res.json({ needsSetup: !admin });
  } catch (error) {
    console.error('Setup check error:', error);
    res.status(500).json({ error: '检查初始化状态失败' });
  }
});

// POST /api/auth/setup - 初始化主账号
router.post('/setup', async (req, res) => {
  try {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (admin) {
      return res.status(400).json({ error: '主账号已存在' });
    }
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: '请填写完整信息' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少6位' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: '该邮箱已被使用' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, name, password: hashedPassword, role: 'ADMIN' },
      select: { id: true, email: true, name: true, role: true },
    });
    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    res.status(201).json({ token, user });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: '初始化失败' });
  }
});

export default router;
