import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { requireAuth, requireRole } from '../../../core/middleware/auth.middleware';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { submitFeedbackSchema } from '../validation/events.validation';
import { EventFeedbackService } from '../services/event-feedback.service';

/**
 * Prompt 04.5 — Post-Event Member Feedback & Attendance Certificates.
 * Admin feedback view stays on Tab 4 (GET /admin/events/:id/feedback, Prompt 04.2).
 */
export const eventFeedbackRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const memberRoles = ['member', 'full_admin', 'billing_admin', 'chapter_admin', 'group_admin', 'super_admin'];

function context(c: any): { chamberId: string; userId: string } {
  const chamberId = c.get('chamberId');
  const user = c.get('user');
  if (!chamberId || !user) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }
  return { chamberId, userId: user.id };
}

/** GET /api/v1/events/:id/attendance — check-in + feedback state for the member's past-event card. */
eventFeedbackRouter.get('/events/:id/attendance', requireAuth, requireRole(memberRoles), async (c) => {
  const { chamberId, userId } = context(c);
  const result = await EventFeedbackService.attendance(c.env.DB, chamberId, c.req.param('id') as string, userId);
  return c.json(successResponse(result, { requestId: c.get('requestId') }));
});

/** §9.1 POST /api/v1/events/:id/feedback */
eventFeedbackRouter.post('/events/:id/feedback', requireAuth, requireRole(memberRoles), async (c) => {
  const { chamberId, userId } = context(c);
  const parsed = submitFeedbackSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, parsed.error.errors[0]?.message || 'Invalid feedback', 422);
  }
  const result = await EventFeedbackService.submit(c.env.DB, chamberId, c.req.param('id') as string, userId, parsed.data);
  return c.json(successResponse(result, { requestId: c.get('requestId') }), 201);
});

/** §9.2 GET /api/v1/events/:id/certificate — printable certificate document (OD-039 b). */
eventFeedbackRouter.get('/events/:id/certificate', requireAuth, requireRole(memberRoles), async (c) => {
  const { chamberId, userId } = context(c);
  const { html, fileName } = await EventFeedbackService.certificate(
    c.env.DB,
    chamberId,
    c.req.param('id') as string,
    userId,
    new URL(c.req.url).origin
  );
  return c.body(html, 200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Disposition': `inline; filename="${fileName}"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
    // Every interpolated value is HTML-escaped; only the print button script runs.
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src https: http: data:; script-src 'unsafe-inline'",
  });
});
