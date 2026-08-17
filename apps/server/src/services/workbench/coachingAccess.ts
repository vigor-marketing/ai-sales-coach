import type { AuthUser } from '../../middleware/auth.js';

const ORGANIZATION_ROLES = new Set(['SALES_LEAD', 'SALES_MANAGER', 'SALES_VP', 'GENERAL_MANAGER', 'ADMIN']);

export function canViewOrganizationSummary(user: AuthUser): boolean {
  return ORGANIZATION_ROLES.has(user.role);
}

export function canViewSessionOwner(user: AuthUser, owner: { userId: string; teamId?: string | null }): boolean {
  if (user.role === 'ADMIN' || ['SALES_MANAGER', 'SALES_VP', 'GENERAL_MANAGER'].includes(user.role)) return true;
  if (user.role === 'SALES_LEAD') return Boolean(user.teamId && owner.teamId && user.teamId === owner.teamId);
  return user.id === owner.userId;
}

export function getSessionScope(user: AuthUser): { userId?: string; user?: { teamId: string } } {
  if (user.role === 'ADMIN' || ['SALES_MANAGER', 'SALES_VP', 'GENERAL_MANAGER'].includes(user.role)) return {};
  if (user.role === 'SALES_LEAD' && user.teamId) return { user: { teamId: user.teamId } };
  return { userId: user.id };
}
