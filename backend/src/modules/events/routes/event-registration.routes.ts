import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { requireAuth, requireRole } from '../../../core/middleware/auth.middleware';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { eventRegisterSchema, validatePromoSchema } from '../validation/events.validation';
import { EventRegistrationService } from '../services/event-registration.service';

/**
 * Prompt 04.3: Member & Guest Event Registration, Promo Codes & Checkout.
 * Tenant isolation: chamberId always comes from the resolved request context.
 */
export const eventRegistrationRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const memberRoles = ['member', 'full_admin', 'billing_admin', 'chapter_admin', 'group_admin', 'super_admin'];

function parseBody<T>(schema: { safeParse: (v: unknown) => any }, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, parsed.error.errors[0]?.message || 'Invalid request', 422);
  }
  return parsed.data as T;
}

/**
 * POST /api/v1/events/:id/validate-promo  (§9.1)
 */
eventRegistrationRouter.post('/events/:id/validate-promo', requireAuth, requireRole(memberRoles), async (c) => {
  const chamberId = c.get('chamberId');
  const user = c.get('user');
  if (!chamberId || !user) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }
  const input = parseBody<any>(validatePromoSchema, await c.req.json().catch(() => ({})));
  const result = await EventRegistrationService.validatePromo(
    c.env.DB,
    chamberId,
    c.req.param('id') as string,
    { userId: user.id, roles: c.get('roles') || [] },
    input
  );
  return c.json(successResponse(result, { requestId: c.get('requestId') }));
});

/**
 * POST /api/v1/events/:id/register  (§9.2, members)
 */
eventRegistrationRouter.post('/events/:id/register', requireAuth, requireRole(memberRoles), async (c) => {
  const chamberId = c.get('chamberId');
  const user = c.get('user');
  if (!chamberId || !user) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }
  const input = parseBody<any>(eventRegisterSchema, await c.req.json().catch(() => ({})));
  // Members register as themselves; guest details are ignored on this route.
  delete input.guestDetails;
  const result = await EventRegistrationService.register(
    c.env.DB,
    chamberId,
    c.req.param('id') as string,
    { userId: user.id, roles: c.get('roles') || [] },
    input
  );
  return c.json(successResponse(result, { requestId: c.get('requestId') }), 201);
});

/**
 * POST /api/v1/public/events/:id/register  (guests, public events only)
 */
eventRegistrationRouter.post('/public/events/:id/register', async (c) => {
  const chamberId = c.get('chamberId');
  if (!chamberId) {
    throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'No chamber context bound to request', 404);
  }
  const input = parseBody<any>(eventRegisterSchema, await c.req.json().catch(() => ({})));
  delete input.paymentMethodId;
  delete input.redeemPoints;
  const result = await EventRegistrationService.register(
    c.env.DB,
    chamberId,
    c.req.param('id') as string,
    { userId: null, roles: [] },
    input
  );
  return c.json(successResponse(result, { requestId: c.get('requestId') }), 201);
});
