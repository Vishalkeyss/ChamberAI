import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { MembershipPlansRepository } from '../repositories/membership-plans.repository';
import { PricingCalculatorService } from '../services/pricing-calculator.service';
import { calculateDuesSchema } from '../validation/plans.validation';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';

export const publicPlansRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

/**
 * GET /api/v1/public/plans
 * Returns all active plans for the resolved tenant chamber.
 */
publicPlansRoutes.get('/public/plans', async (c) => {
  const chamberId = c.get('chamberId');
  if (!chamberId) {
    throw new AppError(
      ErrorCodes.BAD_REQUEST,
      'Chamber identification required to list membership plans',
      400
    );
  }

  const plans = await MembershipPlansRepository.findActivePlansByChamber(c.env.DB, chamberId);

  // Return public projection (strip internal counts/dates if needed, matching Playbook Section 9.1)
  const publicData = plans.map((p) => ({
    id: p.id,
    name: p.name,
    accentColor: p.accentColor,
    price: p.price,
    pricingBasis: p.pricingBasis,
    pricingTiers: p.pricingTiers,
    billingFrequency: p.billingFrequency,
    isPopular: p.isPopular,
    features: p.features,
    sortOrder: p.sortOrder,
  }));

  const requestId = c.get('requestId');
  return c.json(successResponse(publicData, { requestId }));
});

/**
 * POST /api/v1/public/plans/calculate
 * Calculates dues dynamically for a prospective or upgrading member.
 */
publicPlansRoutes.post('/public/plans/calculate', async (c) => {
  const chamberId = c.get('chamberId');
  if (!chamberId) {
    throw new AppError(
      ErrorCodes.BAD_REQUEST,
      'Chamber identification required to calculate plan dues',
      400
    );
  }

  const body = await c.req.json().catch(() => ({}));
  const parseResult = calculateDuesSchema.safeParse(body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0];
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      firstIssue ? firstIssue.message : 'Invalid calculation parameters',
      400
    );
  }

  const { planId, employeeCount, annualRevenue, chapterId } = parseResult.data;

  // Retrieve plan enforcing tenant isolation and active status
  const plan = await MembershipPlansRepository.findActivePlanById(c.env.DB, chamberId, planId);
  if (!plan) {
    throw new AppError(
      ErrorCodes.NOT_FOUND,
      'Active plan not found',
      404
    );
  }

  const calculation = PricingCalculatorService.calculate(plan, {
    planId,
    employeeCount: employeeCount ?? undefined,
    annualRevenue: annualRevenue ?? undefined,
    chapterId: chapterId ?? undefined,
  });

  const requestId = c.get('requestId');
  return c.json(successResponse(calculation, { requestId }));
});

/**
 * GET /api/v1/public/chapters
 * Returns all active chapters for the resolved chamber.
 */
publicPlansRoutes.get('/public/chapters', async (c) => {
  const chamberId = c.get('chamberId');
  if (!chamberId) {
    throw new AppError(
      ErrorCodes.BAD_REQUEST,
      'Chamber identification required to list chapters',
      400
    );
  }

  const results = await c.env.DB
    .prepare(
      `SELECT id, name, city_region FROM chapters
       WHERE chamber_id = ? AND status = 'active'
       ORDER BY name ASC`
    )
    .bind(chamberId)
    .all<{ id: string; name: string; city_region: string | null }>();

  const requestId = c.get('requestId');
  return c.json(successResponse(results.results || [], { requestId }));
});

