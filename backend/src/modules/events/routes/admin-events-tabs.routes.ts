import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { requireAuth, requireRole } from '../../../core/middleware/auth.middleware';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { getAdminScope } from './admin-scope';
import { EventRegistrationsRepository } from '../repositories/event-registrations.repository';
import {
  toggleCheckInSchema,
  attendeeQuerySchema,
} from '../validation/events.validation';

export const adminEventsTabsRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// All admin events endpoints strictly require authentication and admin roles.
// billing_admin passes this gate for sponsorships (04.4); every handler re-checks scope (deny by default).
const adminRoles = ['full_admin', 'billing_admin', 'chapter_admin', 'group_admin', 'super_admin'];
adminEventsTabsRouter.use('/admin/events/*', requireAuth, requireRole(adminRoles));
adminEventsTabsRouter.use('/admin/events', requireAuth, requireRole(adminRoles));


/**
 * Prompt 04.2 Section 9.1: GET /api/v1/admin/events/:id/overview
 * Returns complete 9-tab summary metrics for event.
 */
adminEventsTabsRouter.get('/admin/events/:id/overview', async (c) => {
  const chamberId = c.get('chamberId');
  const eventId = c.req.param('id');
  const requestId = c.get('requestId');

  if (!chamberId) {
    throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'Chamber context required', 400);
  }

  const { userRole, userScopeId } = getAdminScope(c);
  const data = await EventRegistrationsRepository.getOverview(
    c.env.DB,
    chamberId,
    eventId,
    userRole,
    userScopeId
  );

  return c.json(successResponse(data, { requestId }));
});

/**
 * Prompt 04.2 Section 5.2: GET /api/v1/admin/events/:id/attendees
 * Searchable attendee roster with check-in toggle and QR scan action.
 */
adminEventsTabsRouter.get('/admin/events/:id/attendees', async (c) => {
  const chamberId = c.get('chamberId');
  const eventId = c.req.param('id');
  const requestId = c.get('requestId');

  if (!chamberId) {
    throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'Chamber context required', 400);
  }

  const rawQuery = c.req.query();
  const parsed = attendeeQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      parsed.error.errors[0]?.message || 'Invalid attendee query params',
      422
    );
  }

  const { userRole, userScopeId } = getAdminScope(c);
  const result = await EventRegistrationsRepository.getAttendees(
    c.env.DB,
    chamberId,
    eventId,
    userRole,
    userScopeId,
    parsed.data
  );

  return c.json(
    successResponse(result.attendees, {
      requestId,
      meta: {
        total: result.total,
        page: parsed.data.page,
        limit: parsed.data.limit,
      },
    })
  );
});

/**
 * Prompt 04.2 Section 5.3: GET /api/v1/admin/events/:id/waitlist
 * Priority queue table ordered by registration timestamp.
 */
adminEventsTabsRouter.get('/admin/events/:id/waitlist', async (c) => {
  const chamberId = c.get('chamberId');
  const eventId = c.req.param('id');
  const requestId = c.get('requestId');

  if (!chamberId) {
    throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'Chamber context required', 400);
  }

  const { userRole, userScopeId } = getAdminScope(c);
  const waitlist = await EventRegistrationsRepository.getWaitlist(
    c.env.DB,
    chamberId,
    eventId,
    userRole,
    userScopeId
  );

  return c.json(successResponse(waitlist, { requestId }));
});

/**
 * Prompt 04.2 Section 9.3: PATCH /api/v1/admin/events/:id/attendees/:regId/check-in
 * Toggles check-in status for an attendee.
 */
adminEventsTabsRouter.patch('/admin/events/:id/attendees/:regId/check-in', async (c) => {
  const chamberId = c.get('chamberId');
  const eventId = c.req.param('id');
  const regId = c.req.param('regId');
  const requestId = c.get('requestId');

  if (!chamberId) {
    throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'Chamber context required', 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = toggleCheckInSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      parsed.error.errors[0]?.message || 'Invalid check-in payload',
      422
    );
  }

  const { userRole, userScopeId } = getAdminScope(c);
  const result = await EventRegistrationsRepository.toggleCheckIn(
    c.env.DB,
    chamberId,
    eventId,
    regId,
    parsed.data.isCheckedIn,
    userRole,
    userScopeId
  );

  return c.json(successResponse(result, { requestId }));
});

/**
 * Prompt 04.2 Section 9.2: POST /api/v1/admin/events/:id/waitlist/:regId/promote
 * Promotes waitlisted attendee to confirmed status.
 */
adminEventsTabsRouter.post('/admin/events/:id/waitlist/:regId/promote', async (c) => {
  const chamberId = c.get('chamberId');
  const eventId = c.req.param('id');
  const regId = c.req.param('regId');
  const requestId = c.get('requestId');

  if (!chamberId) {
    throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'Chamber context required', 400);
  }

  const { userRole, userScopeId } = getAdminScope(c);
  const result = await EventRegistrationsRepository.promoteWaitlist(
    c.env.DB,
    chamberId,
    eventId,
    regId,
    userRole,
    userScopeId
  );

  return c.json(successResponse(result, { requestId }));
});

/**
  * DELETE /api/v1/admin/events/:id/attendees/:regId
  * Removes attendee or waitlist registrant dynamically from database.
  */
adminEventsTabsRouter.delete('/admin/events/:id/attendees/:regId', async (c) => {
  const chamberId = c.get('chamberId');
  const eventId = c.req.param('id');
  const regId = c.req.param('regId');
  const requestId = c.get('requestId');

  if (!chamberId) {
    throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'Chamber context required', 400);
  }

  const { userRole, userScopeId } = getAdminScope(c);
  const result = await EventRegistrationsRepository.removeRegistration(
    c.env.DB,
    chamberId,
    eventId,
    regId,
    userRole,
    userScopeId
  );

  return c.json(successResponse(result, { requestId }));
});

/**
 * Tab 4: GET /api/v1/admin/events/:id/feedback
 */
adminEventsTabsRouter.get('/admin/events/:id/feedback', async (c) => {
  const chamberId = c.get('chamberId');
  const eventId = c.req.param('id');
  const requestId = c.get('requestId');

  if (!chamberId) {
    throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'Chamber context required', 400);
  }

  const { userRole, userScopeId } = getAdminScope(c);
  const feedback = await EventRegistrationsRepository.getFeedback(
    c.env.DB,
    chamberId,
    eventId,
    userRole,
    userScopeId
  );

  return c.json(successResponse(feedback, { requestId }));
});

// Tab 6 (sponsors) moved to sponsorships.routes.ts (Prompt 04.4).
