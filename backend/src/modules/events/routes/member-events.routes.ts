import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { requireAuth, requireRole } from '../../../core/middleware/auth.middleware';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { eventsQuerySchema } from '../validation/events.validation';
import { EventsRepository } from '../repositories/events.repository';

export const memberEventsRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// All routes require authentication
memberEventsRouter.use('/events', requireAuth);
memberEventsRouter.use('/events/*', requireAuth);

const allowedRoles = ['member', 'full_admin', 'billing_admin', 'chapter_admin', 'group_admin', 'super_admin'];

/**
 * GET /api/v1/events
 * Enhanced event listings for authenticated members (public + members_only).
 * Chapter Admin: Scoped to their chapter or chamber-wide.
 * Full Admin / Super Admin: Unrestricted access.
 */
memberEventsRouter.get('/events', requireRole(allowedRoles), async (c) => {
  const chamberId = c.get('chamberId');
  const session = c.get('session');
  const user = c.get('user');
  const userRoles = session?.roles || [];
  const requestId = c.get('requestId');

  if (!chamberId || !user) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }

  const rawQuery = c.req.query();
  const parsed = eventsQuerySchema.safeParse(rawQuery);

  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      parsed.error.errors[0]?.message || 'Invalid events query parameters',
      422
    );
  }

  const highestRole = user.highest_role;
  const isSuperAdmin = highestRole === 'super_admin';
  const isFullAdmin =
    highestRole === 'full_admin' ||
    userRoles.some((r: any) => r.roleId === 'full_admin');

  let viewerRole: 'guest' | 'member' | 'chapter_admin' | 'full_admin' = 'member';
  let scopedChapterId: string | null = null;

  if (isSuperAdmin || isFullAdmin) {
    viewerRole = 'full_admin';
  } else {
    const chapterAssignment = userRoles.find(
      (r: any) => r.roleId === 'chapter_admin' && r.scopeType === 'chapter'
    );
    if (chapterAssignment?.scopeId) {
      viewerRole = 'chapter_admin';
      scopedChapterId = chapterAssignment.scopeId;
    }
  }

  const result = await EventsRepository.listEvents(
    c.env.DB,
    chamberId,
    parsed.data,
    viewerRole,
    scopedChapterId
  );

  return c.json(
    successResponse(result.data, {
      requestId,
      meta: result.meta,
    })
  );
});

/**
 * GET /api/v1/events/filters
 * Available filter options for members.
 */
memberEventsRouter.get('/events/filters', requireRole(allowedRoles), async (c) => {
  const chamberId = c.get('chamberId');
  const requestId = c.get('requestId');

  if (!chamberId) {
    throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'No chamber context bound to request', 404);
  }

  const filters = await EventsRepository.getFilterOptions(c.env.DB, chamberId);

  return c.json(successResponse(filters, { requestId }));
});


