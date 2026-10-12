import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { optionalAuth, requireAuth, requireRole } from '../../../core/middleware/auth.middleware';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import {
  adminRecordSponsorSchema,
  adminUpdateSponsorSchema,
  bookSponsorshipSchema,
} from '../validation/events.validation';
import { SponsorshipsService, sponsorshipScopeOf } from '../services/sponsorships.service';

/**
 * Prompt 04.4 — Event Sponsorship Packages & Member Self-Service Booking.
 * Tenant isolation: chamberId always comes from the resolved request context.
 */
export const sponsorshipsRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const memberRoles = ['member', 'full_admin', 'billing_admin', 'chapter_admin', 'group_admin', 'super_admin'];
const adminRoles = ['full_admin', 'billing_admin', 'chapter_admin', 'group_admin', 'super_admin'];

function chamberOf(c: any): string {
  const chamberId = c.get('chamberId');
  if (!chamberId) throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'No chamber context bound to request', 404);
  return chamberId;
}

function parse<T>(schema: { safeParse: (v: unknown) => any }, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.errors[0];
    const path = issue?.path?.length ? `${issue.path.join('.')}: ` : '';
    throw new AppError(ErrorCodes.VALIDATION_ERROR, `${path}${issue?.message || 'Invalid request'}`, 422);
  }
  return parsed.data as T;
}

/** §9.1 GET /api/v1/events/:id/sponsorship-tiers — public. */
sponsorshipsRouter.get('/events/:id/sponsorship-tiers', optionalAuth, async (c) => {
  const result = await SponsorshipsService.publicTiers(
    c.env.DB,
    chamberOf(c),
    c.req.param('id') as string,
    // Only a session of THIS chamber counts as signed in (optionalAuth does not check the tenant).
    c.get('user')?.chamber_id === c.get('chamberId')
  );
  return c.json(successResponse(result, { requestId: c.get('requestId') }));
});

/** §9.2 POST /api/v1/events/:id/sponsor — member books a package for their business. */
sponsorshipsRouter.post('/events/:id/sponsor', requireAuth, requireRole(memberRoles), async (c) => {
  const user = c.get('user');
  if (!user) throw new AppError(ErrorCodes.UNAUTHORIZED, 'Authentication required', 401);
  const input = parse<any>(bookSponsorshipSchema, await c.req.json().catch(() => ({})));
  const result = await SponsorshipsService.book(c.env.DB, chamberOf(c), c.req.param('id') as string, user.id, input);
  return c.json(successResponse(result, { requestId: c.get('requestId') }), 201);
});

/** Tab 6: GET /api/v1/admin/events/:id/sponsors — tiers, sponsors, revenue summary. */
sponsorshipsRouter.get('/admin/events/:id/sponsors', requireAuth, requireRole(adminRoles), async (c) => {
  const result = await SponsorshipsService.adminOverview(
    c.env.DB,
    chamberOf(c),
    c.req.param('id') as string,
    sponsorshipScopeOf(c)
  );
  return c.json(successResponse(result, { requestId: c.get('requestId') }));
});

/** POST /api/v1/admin/events/:id/sponsors — offline booking. */
sponsorshipsRouter.post('/admin/events/:id/sponsors', requireAuth, requireRole(adminRoles), async (c) => {
  const input = parse<any>(adminRecordSponsorSchema, await c.req.json().catch(() => ({})));
  const result = await SponsorshipsService.adminRecord(
    c.env.DB,
    chamberOf(c),
    c.req.param('id') as string,
    sponsorshipScopeOf(c),
    input
  );
  return c.json(successResponse(result, { requestId: c.get('requestId') }), 201);
});

/** PATCH /api/v1/admin/events/:id/sponsors/:sponsorId — payment status + invoice reconciliation. */
sponsorshipsRouter.patch('/admin/events/:id/sponsors/:sponsorId', requireAuth, requireRole(adminRoles), async (c) => {
  const input = parse<any>(adminUpdateSponsorSchema, await c.req.json().catch(() => ({})));
  const result = await SponsorshipsService.adminUpdateStatus(
    c.env.DB,
    chamberOf(c),
    c.req.param('id') as string,
    c.req.param('sponsorId') as string,
    sponsorshipScopeOf(c),
    input
  );
  return c.json(successResponse(result, { requestId: c.get('requestId') }));
});

/** DELETE /api/v1/admin/events/:id/sponsors/:sponsorId */
sponsorshipsRouter.delete('/admin/events/:id/sponsors/:sponsorId', requireAuth, requireRole(adminRoles), async (c) => {
  const result = await SponsorshipsService.adminRemove(
    c.env.DB,
    chamberOf(c),
    c.req.param('id') as string,
    c.req.param('sponsorId') as string,
    sponsorshipScopeOf(c)
  );
  return c.json(successResponse(result, { requestId: c.get('requestId') }));
});
