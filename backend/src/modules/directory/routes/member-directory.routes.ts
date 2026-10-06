import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { requireAuth, requireRole } from '../../../core/middleware/auth.middleware';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { directoryQuerySchema } from '../validation/directory.validation';
import { DirectoryRepository } from '../repositories/directory.repository';

export const memberDirectoryRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// All routes require authentication
memberDirectoryRouter.use('/directory', requireAuth);

const allowedRoles = ['member', 'full_admin', 'billing_admin', 'chapter_admin', 'group_admin', 'super_admin'];

/**
 * GET /api/v1/directory
 * Enhanced directory listings for authenticated members with representative contact details.
 * RBAC: member, full_admin, billing_admin, chapter_admin, group_admin, super_admin.
 * Chapter Admin: Scoped read access filtered to businesses affiliated with their chapter.
 */
memberDirectoryRouter.get('/directory', requireRole(allowedRoles), async (c) => {
  const chamberId = c.get('chamberId');
  const session = c.get('session') as any;
  const user = c.get('user');
  const userRoles = (c.get('userRoles') as any) || session?.roles || [];
  const requestId = c.get('requestId');

  if (!chamberId || !user) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }

  // Parse and validate query params
  const rawQuery = c.req.query();
  const parsed = directoryQuerySchema.safeParse(rawQuery);

  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      parsed.error.errors[0]?.message || 'Invalid directory search query parameters',
      422
    );
  }

  // Scoped read access for chapter_admin (unless also full_admin or super_admin)
  let scopedChapterId: string | null = null;
  const highestRole = user.highest_role || user.highestRole;
  const isSuperAdmin = highestRole === 'super_admin';
  const isFullAdmin =
    highestRole === 'full_admin' ||
    userRoles.some((r: any) => r.roleId === 'full_admin');

  if (!isSuperAdmin && !isFullAdmin) {
    const chapterAssignment = userRoles.find(
      (r: any) => r.roleId === 'chapter_admin' && r.scopeType === 'chapter'
    );
    if (chapterAssignment?.scopeId) {
      scopedChapterId = chapterAssignment.scopeId;
    }
  }

  const result = await DirectoryRepository.searchDirectory(
    c.env.DB,
    chamberId,
    parsed.data,
    {
      isMemberView: true,
      scopedChapterId,
    }
  );

  return c.json(
    successResponse(result.businesses, {
      requestId,
      meta: result.meta,
    })
  );
});
