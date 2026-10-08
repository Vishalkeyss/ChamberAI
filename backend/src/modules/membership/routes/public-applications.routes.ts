import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { ApplicationsService } from '../services/applications.service';
import {
  submitApplicationSchema,
  resubmitApplicationSchema,
} from '../validation/applications.validation';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';

export const publicApplicationsRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

/**
 * POST /api/v1/public/applications
 * Submits a new membership application for the current tenant chamber
 */
publicApplicationsRoutes.post('/public/applications', async (c) => {
  const chamberId = c.get('chamberId');
  if (!chamberId) {
    throw new AppError(
      ErrorCodes.BAD_REQUEST,
      'Chamber identification required to submit an application',
      400
    );
  }

  const body = await c.req.json().catch(() => ({}));
  const parseResult = submitApplicationSchema.safeParse(body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0];
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      firstIssue ? firstIssue.message : 'Invalid application data',
      400
    );
  }

  const result = await ApplicationsService.submit(c.env.DB, chamberId, parseResult.data);
  const requestId = c.get('requestId');

  return c.json(successResponse(result, { requestId }), 201);
});

/**
 * GET /api/v1/public/applications/track/:code
 * Tracks application review status and details
 */
publicApplicationsRoutes.get('/public/applications/track/:code', async (c) => {
  const chamberId = c.get('chamberId');
  if (!chamberId) {
    throw new AppError(
      ErrorCodes.BAD_REQUEST,
      'Chamber identification required to track an application',
      400
    );
  }

  const code = c.req.param('code');
  if (!code) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Tracking code is required', 400);
  }

  const result = await ApplicationsService.track(c.env.DB, chamberId, code);
  const requestId = c.get('requestId');

  return c.json(successResponse(result, { requestId }));
});

/**
 * PUT /api/v1/public/applications/track/:code
 * Resubmits application when additional information was requested by committee
 */
publicApplicationsRoutes.put('/public/applications/track/:code', async (c) => {
  const chamberId = c.get('chamberId');
  if (!chamberId) {
    throw new AppError(
      ErrorCodes.BAD_REQUEST,
      'Chamber identification required to resubmit an application',
      400
    );
  }

  const code = c.req.param('code');
  if (!code) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Tracking code is required', 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parseResult = resubmitApplicationSchema.safeParse(body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0];
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      firstIssue ? firstIssue.message : 'Invalid update data',
      400
    );
  }

  const result = await ApplicationsService.resubmit(c.env.DB, chamberId, code, parseResult.data);
  const requestId = c.get('requestId');

  return c.json(successResponse(result, { requestId }));
});

/**
 * GET /api/v1/public/members/verify/:memberId
 * Public verification endpoint for QR code scans
 */
publicApplicationsRoutes.get('/public/members/verify/:memberId', async (c) => {
  const memberId = c.req.param('memberId');
  if (!memberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Member ID is required', 400);
  }
  // Verification is tenant-scoped: a QR code only verifies within its own chamber.
  const chamberId = c.get('chamberId');
  if (!chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Chamber identification required', 400);
  }

  const row = await c.env.DB
    .prepare(
      `SELECT cm.id AS membership_id, cm.member_id_display, cm.status, cm.plan_start_date, cm.plan_end_date, cm.created_at,
              u.name AS member_name, u.avatar_url,
              bp.business_name,
              pc.name AS chamber_name, pc.subdomain AS chamber_slug,
              mp.name AS tier_name
       FROM chamber_memberships cm
       JOIN business_profiles bp ON bp.id = cm.business_id
       JOIN business_members bm ON bm.business_id = cm.business_id AND bm.is_primary_contact = 1
       JOIN users u ON u.id = bm.user_id
       JOIN platform_chambers pc ON pc.id = cm.chamber_id
       LEFT JOIN membership_plans mp ON mp.id = cm.plan_id
       WHERE cm.chamber_id = ?
         AND (LOWER(cm.member_id_display) = LOWER(?) OR cm.id = ?)
       LIMIT 1`
    )
    .bind(chamberId, memberId, memberId)
    .first<any>();

  if (!row) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Member not found or invalid membership ID', 404);
  }

  const memberSinceYear = row.created_at || row.plan_start_date
    ? new Date(row.created_at || row.plan_start_date).getFullYear().toString()
    : null;

  const data = {
    verified: row.status === 'active',
    memberId: row.member_id_display || row.membership_id,
    membershipId: row.membership_id,
    memberName: row.member_name,
    avatarUrl: row.avatar_url || null,
    businessName: row.business_name,
    chamberName: row.chamber_name,
    chamberSlug: row.chamber_slug,
    tierName: row.tier_name || 'Standard',
    status: row.status,
    memberSince: memberSinceYear,
    validUntil: row.plan_end_date || null,
  };

  const requestId = c.get('requestId');
  return c.json(successResponse(data, { requestId }));
});
