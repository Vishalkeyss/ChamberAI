import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { requireAuth, requireRole } from '../../../core/middleware/auth.middleware';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { getAdminScope } from '../../events/routes/admin-scope';
import {
  adminMentorStatusSchema,
  createMentorshipRequestSchema,
  reviewMentorshipRequestSchema,
  updateMentorProfileSchema,
  updateMentorshipNotesSchema,
} from '../validation/mentorship.validation';
import { MentorshipService } from '../services/mentorship.service';

/**
 * Prompt 05.6 — Chamber Mentorship Program.
 * Member features: member, chapter_admin, full_admin (self). group_admin only manages events,
 * billing_admin and guests have no access (OD-099).
 */
export const mentorshipRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const mentorshipRoles = ['member', 'chapter_admin', 'full_admin'];

mentorshipRouter.use('/mentorship/*', requireAuth, requireRole(mentorshipRoles));
mentorshipRouter.use('/admin/mentorship/*', requireAuth, requireRole(['full_admin', 'chapter_admin']));

function context(c: any): { chamberId: string; userId: string } {
  const chamberId = c.get('chamberId');
  const user = c.get('user');
  if (!chamberId || !user) throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  return { chamberId, userId: user.id };
}

async function body<T>(c: any, schema: { safeParse: (v: unknown) => any }): Promise<T> {
  const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, parsed.error.errors[0]?.message || 'Invalid request', 422);
  }
  return parsed.data as T;
}

/** §9.1 — data = mentors; meta.filters = expertise tags + industries (OD-101). */
mentorshipRouter.get('/mentorship/mentors', async (c) => {
  const { chamberId, userId } = context(c);
  const { data, filters } = await MentorshipService.mentors(c.env.DB, chamberId, userId, {
    search: c.req.query('search') || undefined,
    expertise: c.req.query('expertise') || undefined,
    industry: c.req.query('industry') || undefined,
    available: c.req.query('available') === 'true' || c.req.query('available') === '1',
  });
  return c.json(successResponse(data, { requestId: c.get('requestId'), filters }));
});

mentorshipRouter.get('/mentorship/profile', async (c) => {
  const { chamberId, userId } = context(c);
  return c.json(successResponse(await MentorshipService.getProfile(c.env.DB, chamberId, userId), { requestId: c.get('requestId') }));
});

mentorshipRouter.put('/mentorship/profile', async (c) => {
  const { chamberId, userId } = context(c);
  const data = await MentorshipService.updateProfile(c.env.DB, chamberId, userId, await body(c, updateMentorProfileSchema));
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});

mentorshipRouter.get('/mentorship/connections', async (c) => {
  const { chamberId, userId } = context(c);
  return c.json(successResponse(await MentorshipService.connections(c.env.DB, chamberId, userId), { requestId: c.get('requestId') }));
});

/** §9.2 */
mentorshipRouter.post('/mentorship/requests', async (c) => {
  const { chamberId, userId } = context(c);
  const data = await MentorshipService.request(c.env.DB, chamberId, userId, await body(c, createMentorshipRequestSchema));
  return c.json(successResponse(data, { requestId: c.get('requestId') }), 201);
});

/** §9.3 */
mentorshipRouter.patch('/mentorship/requests/:id', async (c) => {
  const { chamberId, userId } = context(c);
  const data = await MentorshipService.review(c.env.DB, chamberId, userId, c.req.param('id') as string, await body(c, reviewMentorshipRequestSchema));
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});

/** OD-095 */
mentorshipRouter.patch('/mentorship/connections/:id/notes', async (c) => {
  const { chamberId, userId } = context(c);
  const { notes } = await body<{ notes: string | null }>(c, updateMentorshipNotesSchema);
  const data = await MentorshipService.updateNotes(c.env.DB, chamberId, userId, c.req.param('id') as string, notes);
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});

/** OD-098 program overview — chapter_admin is limited to members of their chapter. */
mentorshipRouter.get('/admin/mentorship/overview', async (c) => {
  const chamberId = c.get('chamberId');
  if (!chamberId) throw new AppError(ErrorCodes.BAD_REQUEST, 'Chamber context required', 400);
  const scope = getAdminScope(c);
  if (scope.userRole !== 'full_admin' && scope.userRole !== 'chapter_admin') {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Insufficient permissions to access this resource', 403);
  }
  const data = await MentorshipService.adminOverview(c.env.DB, chamberId, scope.userRole === 'chapter_admin' ? scope.userScopeId : null);
  return c.json(successResponse({ ...data, scope: scope.userRole === 'chapter_admin' ? 'chapter' : 'chamber' }, { requestId: c.get('requestId') }));
});

/** OD-098 profile moderation — full_admin only. */
mentorshipRouter.patch('/admin/mentorship/mentors/:userId', async (c) => {
  const chamberId = c.get('chamberId');
  if (!chamberId) throw new AppError(ErrorCodes.BAD_REQUEST, 'Chamber context required', 400);
  const scope = getAdminScope(c);
  // super_admin is read-only (spec §3).
  if (scope.userRole !== 'full_admin' || c.get('user')?.highest_role === 'super_admin') throw new AppError(ErrorCodes.FORBIDDEN, 'Only chamber admins can moderate mentor profiles', 403);
  const { status } = await body<{ status: 'active' | 'paused' }>(c, adminMentorStatusSchema);
  const data = await MentorshipService.adminSetMentorStatus(c.env.DB, chamberId, scope.userId, c.req.param('userId') as string, status);
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});
