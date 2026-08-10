import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Reads process.env at call time so dotenv.config() in index.ts runs first.
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error('JWT_SECRET is required. Refusing to use an insecure fallback secret.');
  }
  return secret;
}

export function assertAuthConfiguration(): void {
  const secret = getJwtSecret();
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export function generateToken(payload: { id: string; email: string; role: string }): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { id: string; email: string; role: string; name: string };
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

export function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: '只有主账号有此权限' });
  }
  next();
}
