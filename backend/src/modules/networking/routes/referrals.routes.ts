import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { requireAuth, requireRole } from '../../../core/middleware/auth.middleware';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { createReferralSchema, updateReferralStatusSchema } from '../validation/networking.validation';
import { ReferralsService } from '../services/referrals.service';

/**
 * Prompt 05.3 — B2B Business Referrals.
 * Part 4 matrix "B2B Referrals": member / group_admin = CRUD (Self), full_admin = CRUD.
 * chapter_admin (R scoped metrics) and full_admin impact reports are not built yet (OD-068);
 * billing_admin and guests have no access.
 */
export const referralsRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const referralRoles = ['member', 'group_admin', 'full_admin'];

referralsRouter.use('/referrals', requireAuth, requireRole(referralRoles));
referralsRouter.use('/referrals/*', requireAuth, requireRole(referralRoles));

function context(c: any): { chamberId: string; userId: string } {
  const chamberId = c.get('chamberId');
  const user = c.get('user');
  if (!chamberId || !user) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }
  return { chamberId, userId: user.id };
}

/** §9.1 */
referralsRouter.get('/referrals', async (c) => {
  const { chamberId, userId } = context(c);
  const data = await ReferralsService.list(c.env.DB, chamberId, userId);
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});

/** §5.2 recipient business picker. */
referralsRouter.get('/referrals/businesses', async (c) => {
  const { chamberId, userId } = context(c);
  const data = await ReferralsService.searchBusinesses(c.env.DB, chamberId, userId, (c.req.query('q') || '').slice(0, 100));
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});

/** OD-064 "Search Members" mode. */
referralsRouter.get('/referrals/members', async (c) => {
  const { chamberId, userId } = context(c);
  const data = await ReferralsService.searchMembers(c.env.DB, chamberId, userId, (c.req.query('q') || '').slice(0, 100));
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});

/** §9.2 */
referralsRouter.post('/referrals', async (c) => {
  const { chamberId, userId } = context(c);
  const parsed = createReferralSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, parsed.error.errors[0]?.message || 'Invalid referral', 422);
  }
  const data = await ReferralsService.create(c.env.DB, chamberId, userId, parsed.data);
  return c.json(successResponse(data, { requestId: c.get('requestId') }), 201);
});

/** §9.3 */
referralsRouter.patch('/referrals/:id/status', async (c) => {
  const { chamberId, userId } = context(c);
  const parsed = updateReferralStatusSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, parsed.error.errors[0]?.message || 'Invalid status', 422);
  }
  const data = await ReferralsService.updateStatus(c.env.DB, chamberId, userId, c.req.param('id') as string, parsed.data);
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});
