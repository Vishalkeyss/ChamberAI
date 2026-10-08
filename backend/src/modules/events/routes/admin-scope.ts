import { AppError, ErrorCodes } from '../../../core/shared/errors';

export type AdminEventRole = 'full_admin' | 'chapter_admin' | 'group_admin' | 'other';

export interface AdminScope {
  /** Effective role for event management (highest admin role held). */
  userRole: AdminEventRole;
  /** chapter id for chapter_admin, group id for group_admin, otherwise null. */
  userScopeId: string | null;
  userId: string;
}

/**
 * Resolves the caller's event-management scope from the authenticated session.
 * Never assumes a role that the session does not actually hold (BUG-054).
 */
export function getAdminScope(c: any): AdminScope {
  const user = c.get('user');
  const session = c.get('session');
  if (!user) throw new AppError(ErrorCodes.UNAUTHORIZED, 'Authentication required', 401);

  const roles: Array<{ roleId: string; scopeType: string; scopeId: string }> = session?.roles || [];
  const roleIds = new Set<string>([user.highest_role, ...roles.map((r) => r.roleId)].filter(Boolean));

  if (roleIds.has('super_admin') || roleIds.has('full_admin')) {
    return { userRole: 'full_admin', userScopeId: null, userId: user.id };
  }
  const chapterRole = roles.find((r) => r.roleId === 'chapter_admin' && r.scopeType === 'chapter' && r.scopeId);
  if (chapterRole) return { userRole: 'chapter_admin', userScopeId: chapterRole.scopeId, userId: user.id };
  const groupRole = roles.find((r) => r.roleId === 'group_admin' && r.scopeType === 'group' && r.scopeId);
  if (groupRole) return { userRole: 'group_admin', userScopeId: groupRole.scopeId, userId: user.id };

  return { userRole: 'other', userScopeId: null, userId: user.id };
}
