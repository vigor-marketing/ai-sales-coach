import { Request, Response, NextFunction } from 'express';
import jwt, { JwtHeader, JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../utils/prisma.js';
import { sendApiError } from '../utils/apiResponse.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string | null;
  teamId?: string | null;
  authSource: 'local' | 'oidc' | 'workbench';
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

type OidcClaims = JwtPayload & {
  sub: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  department?: string;
  team_id?: string;
  teamId?: string;
  roles?: string[];
  realm_access?: { roles?: string[] };
};

let oidcKeyCache: { expiresAt: number; keys: Map<string, crypto.KeyObject> } | null = null;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  const fallback = crypto.createHash('sha256').update('ai-sales-coach-fallback-key-2026').digest('hex');
  console.error('[auth] JWT_SECRET not set — using deterministic fallback (token will reset after restart!)');
  return fallback;
}

function authMode(): 'local' | 'hybrid' | 'oidc' | 'workbench' {
  const mode = process.env.AUTH_MODE?.trim().toLowerCase();
  if (mode === 'oidc' || mode === 'hybrid' || mode === 'workbench') return mode;
  return 'local';
}
type WorkbenchClaims = JwtPayload & { sub: string; name: string; isAdmin: boolean; app: string };
async function provisionWorkbenchUser(claims: WorkbenchClaims): Promise<AuthUser> {
  if (claims.app !== 'ai-sales-coach') throw new Error('Workbench token application mismatch');
  const email = 'workbench:' + claims.sub + '@vigor.local';
  const role = claims.isAdmin ? 'ADMIN' : 'TRAINEE';
  const user = await prisma.user.upsert({ where: { email }, update: { name: claims.name, role }, create: { email, name: claims.name, password: 'workbench:' + crypto.randomUUID(), role } });
  return { id: user.id, email: user.email, name: user.name, role: user.role, department: user.department, teamId: user.teamId, authSource: 'workbench' };
}
async function verifyWorkbenchToken(token: string): Promise<WorkbenchClaims> {
  const secret = process.env.WORKBENCH_BRIDGE_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error('WORKBENCH_BRIDGE_SECRET is not configured');
  return jwt.verify(token, secret, { algorithms: ['HS256'], issuer: 'vigor-workbench', audience: 'ai-sales-coach' }) as WorkbenchClaims;
}

function mapOidcRole(claims: OidcClaims): string {
  const roles = [...(claims.roles || []), ...(claims.realm_access?.roles || [])].map(value => value.toLowerCase());
  if (roles.some(value => /general[_-]?manager|总经理/.test(value))) return 'GENERAL_MANAGER';
  if (roles.some(value => /vice[_-]?president|分管销售副总/.test(value))) return 'SALES_VP';
  if (roles.some(value => /sales[_-]?manager|销售经理/.test(value))) return 'SALES_MANAGER';
  if (roles.some(value => /sales[_-]?lead|team[_-]?lead|销售组长/.test(value))) return 'SALES_LEAD';
  return 'TRAINEE';
}

async function getOidcKey(kid?: string): Promise<crypto.KeyObject> {
  const issuer = process.env.OIDC_ISSUER?.replace(/\/$/, '');
  if (!issuer) throw new Error('OIDC_ISSUER is not configured');

  if (!oidcKeyCache || oidcKeyCache.expiresAt < Date.now()) {
    const discoveryResponse = await fetch(`${issuer}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(5000) });
    if (!discoveryResponse.ok) throw new Error('OIDC discovery failed');
    const discovery = await discoveryResponse.json() as { jwks_uri?: string };
    if (!discovery.jwks_uri) throw new Error('OIDC JWKS URI is missing');

    const keysResponse = await fetch(discovery.jwks_uri, { signal: AbortSignal.timeout(5000) });
    if (!keysResponse.ok) throw new Error('OIDC JWKS request failed');
    const jwks = await keysResponse.json() as { keys?: Array<JsonWebKey & { kid?: string }> };
    const keys = new Map<string, crypto.KeyObject>();
    for (const key of jwks.keys || []) {
      if (key.kid) keys.set(key.kid, crypto.createPublicKey({ key: key as crypto.JsonWebKey, format: 'jwk' }));
    }
    oidcKeyCache = { keys, expiresAt: Date.now() + 10 * 60 * 1000 };
  }

  const key = kid ? oidcKeyCache.keys.get(kid) : oidcKeyCache.keys.values().next().value;
  if (!key) throw new Error('OIDC signing key was not found');
  return key;
}

async function verifyOidcToken(token: string): Promise<OidcClaims> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string') throw new Error('Invalid OIDC token');
  const key = await getOidcKey((decoded.header as JwtHeader).kid);
  const issuer = process.env.OIDC_ISSUER?.replace(/\/$/, '');
  const audience = process.env.OIDC_CLIENT_ID;
  return jwt.verify(token, key, {
    algorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'],
    issuer,
    audience: audience || undefined,
  }) as OidcClaims;
}

async function provisionOidcUser(claims: OidcClaims): Promise<AuthUser> {
  const email = claims.email || `${claims.sub}@oidc.local`;
  const name = claims.name || claims.preferred_username || email;
  const role = mapOidcRole(claims);
  const teamId = claims.team_id || claims.teamId || null;
  const department = claims.department || null;

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role, department, teamId },
    create: {
      email,
      name,
      password: `oidc:${crypto.randomUUID()}`,
      role,
      department,
      teamId,
    },
  });

  return { id: user.id, email: user.email, name: user.name, role: user.role, department: user.department, teamId: user.teamId, authSource: 'oidc' };
}

export function generateToken(payload: { id: string; email: string; role: string }): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return sendApiError(res, 401, 'UNAUTHENTICATED', '未登录，请先登录');
  }

  const token = authHeader.slice('Bearer '.length);
  try {
    const mode = authMode();
    if (mode === 'workbench') {
      req.user = await provisionWorkbenchUser(await verifyWorkbenchToken(token));
      return next();
    }
    if (mode !== 'local') {
      try {
        req.user = await provisionOidcUser(await verifyOidcToken(token));
        return next();
      } catch (oidcError) {
        if (mode === 'oidc') throw oidcError;
      }
    }

    const decoded = jwt.verify(token, getJwtSecret()) as { id: string; email: string; role: string; name?: string };
    req.user = { id: decoded.id, email: decoded.email, name: decoded.name || decoded.email, role: decoded.role, authSource: 'local' };
    return next();
  } catch {
    return sendApiError(res, 401, 'INVALID_TOKEN', '登录已过期或令牌无效');
  }
}

export function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') {
    return sendApiError(res, 403, 'FORBIDDEN', '只有主账号有此权限');
  }
  return next();
}
