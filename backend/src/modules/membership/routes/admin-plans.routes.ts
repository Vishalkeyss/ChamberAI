import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { requireAuth, requireRole } from '../../../core/middleware/auth.middleware';
import { MembershipPlansRepository } from '../repositories/membership-plans.repository';
import {
  createPlanSchema,
  toggleStatusSchema,
  updatePlanSchema,
} from '../validation/plans.validation';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';

export const adminPlansRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// All admin plan routes require authenticated session
adminPlansRoutes.use('/admin/plans/*', requireAuth);
adminPlansRoutes.use('/admin/plans', requireAuth);

/**
 * GET /api/v1/admin/plans
 * Returns all plans (both active and inactive) with metrics.
 * Permitted roles: full_admin, billing_admin, chapter_admin.
 */
adminPlansRoutes.get(
  '/admin/plans',
  requireRole(['full_admin', 'billing_admin', 'chapter_admin']),
  async (c) => {
    const chamberId = c.get('chamberId');
    if (!chamberId) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'Chamber context required', 400);
    }

    const plans = await MembershipPlansRepository.findAllPlansByChamber(c.env.DB, chamberId);
    const requestId = c.get('requestId');
    return c.json(successResponse(plans, { requestId }));
  }
);

/**
 * POST /api/v1/admin/plans
 * Creates a new membership plan.
 * Permitted roles: full_admin, billing_admin.
 */
adminPlansRoutes.post(
  '/admin/plans',
  requireRole(['full_admin', 'billing_admin']),
  async (c) => {
    const chamberId = c.get('chamberId');
    const user = c.get('user');
    if (!chamberId || !user) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'Chamber and user context required', 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const parseResult = createPlanSchema.safeParse(body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        firstIssue ? firstIssue.message : 'Invalid plan configuration',
        400
      );
    }

    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';
    const newPlan = await MembershipPlansRepository.createPlan(
      c.env.DB,
      chamberId,
      user.id,
      parseResult.data,
      ipAddress
    );

    const requestId = c.get('requestId');
    return c.json(successResponse(newPlan, { requestId }), 201);
  }
);

/**
 * GET /api/v1/admin/plans/:id
 * Retrieves a single plan by ID.
 * Permitted roles: full_admin, billing_admin, chapter_admin.
 */
adminPlansRoutes.get(
  '/admin/plans/:id',
  requireRole(['full_admin', 'billing_admin', 'chapter_admin']),
  async (c) => {
    const chamberId = c.get('chamberId');
    const planId = c.req.param('id');
    if (!chamberId || !planId) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'Plan ID and chamber context required', 400);
    }

    const plan = await MembershipPlansRepository.findPlanById(c.env.DB, chamberId, planId);
    if (!plan) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Membership plan not found', 404);
    }

    const requestId = c.get('requestId');
    return c.json(successResponse(plan, { requestId }));
  }
);

/**
 * PUT /api/v1/admin/plans/:id
 * Updates plan configuration and pricing.
 * Permitted roles: full_admin, billing_admin.
 */
adminPlansRoutes.put(
  '/admin/plans/:id',
  requireRole(['full_admin', 'billing_admin']),
  async (c) => {
    const chamberId = c.get('chamberId');
    const user = c.get('user');
    const planId = c.req.param('id');
    if (!chamberId || !user || !planId) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'Plan ID, chamber, and user context required', 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const parseResult = updatePlanSchema.safeParse(body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        firstIssue ? firstIssue.message : 'Invalid plan update payload',
        400
      );
    }

    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';
    const updatedPlan = await MembershipPlansRepository.updatePlan(
      c.env.DB,
      chamberId,
      user.id,
      planId,
      parseResult.data,
      ipAddress
    );

    if (!updatedPlan) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Membership plan not found', 404);
    }

    const requestId = c.get('requestId');
    return c.json(successResponse(updatedPlan, { requestId }));
  }
);

/**
 * PATCH /api/v1/admin/plans/:id/toggle-status
 * Toggles active/disabled status.
 * Permitted roles: full_admin, billing_admin.
 */
adminPlansRoutes.patch(
  '/admin/plans/:id/toggle-status',
  requireRole(['full_admin', 'billing_admin']),
  async (c) => {
    const chamberId = c.get('chamberId');
    const user = c.get('user');
    const planId = c.req.param('id');
    if (!chamberId || !user || !planId) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'Plan ID, chamber, and user context required', 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const parseResult = toggleStatusSchema.safeParse(body);
    if (!parseResult.success) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'isActive must be a boolean or 0/1 integer',
        400
      );
    }

    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';
    const result = await MembershipPlansRepository.togglePlanStatus(
      c.env.DB,
      chamberId,
      user.id,
      planId,
      parseResult.data.isActive,
      ipAddress
    );

    if (!result) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Membership plan not found', 404);
    }

    const requestId = c.get('requestId');
    return c.json(successResponse(result, { requestId }));
  }
);

/**
 * DELETE /api/v1/admin/plans/:id
 * Deletes a plan.
 * Permitted roles: full_admin, billing_admin.
 */
adminPlansRoutes.delete(
  '/admin/plans/:id',
  requireRole(['full_admin', 'billing_admin']),
  async (c) => {
    const chamberId = c.get('chamberId');
    const user = c.get('user');
    const planId = c.req.param('id');
    if (!chamberId || !user || !planId) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'Plan ID, chamber, and user context required', 400);
    }

    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';
    const deleted = await MembershipPlansRepository.deletePlan(
      c.env.DB,
      chamberId,
      user.id,
      planId,
      ipAddress
    );

    if (!deleted) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Membership plan not found', 404);
    }

    const requestId = c.get('requestId');
    return c.json(successResponse({ id: planId, deleted: true }, { requestId }));
  }
);
