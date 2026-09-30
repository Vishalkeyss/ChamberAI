import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { requireAuth, requireRole } from '../../../core/middleware/auth.middleware';
import { MemberOverviewService } from '../services/overview.service';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { z } from 'zod';

export const memberOverviewRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// All member overview routes require authenticated session
memberOverviewRoutes.use('/member/*', requireAuth);
memberOverviewRoutes.use('/member', requireAuth);

const completeStepSchema = z.object({
  stepKey: z.enum(['profile', 'card', 'network', 'team']),
});

/**
 * GET /api/v1/member/overview
 * Returns personal dashboard metrics and onboarding state.
 * Auth: Bearer Token (member, all admin roles for impersonation).
 */
memberOverviewRoutes.get(
  '/member/overview',
  requireRole(['member', 'full_admin', 'billing_admin', 'chapter_admin', 'group_admin']),
  async (c) => {
    const user = c.get('user');
    const chamberId = c.get('chamberId');
    if (!user || !chamberId) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
    }

    const data = await MemberOverviewService.getOverview(c, user.id, chamberId);
    const requestId = c.get('requestId');
    return c.json(successResponse(data, { requestId }));
  }
);

/**
 * POST /api/v1/member/onboarding/complete-step
 * Manually flags an onboarding step as complete.
 * Auth: Bearer Token (member).
 */
memberOverviewRoutes.post(
  '/member/onboarding/complete-step',
  requireRole(['member', 'full_admin']),
  async (c) => {
    const user = c.get('user');
    const chamberId = c.get('chamberId');
    if (!user || !chamberId) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = completeStepSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        `Invalid step key. Must be one of: profile, card, network, team`,
        422
      );
    }

    const result = await MemberOverviewService.completeStep(
      c,
      user.id,
      chamberId,
      parsed.data.stepKey
    );

    const requestId = c.get('requestId');
    return c.json(successResponse(result, { requestId }));
  }
);
