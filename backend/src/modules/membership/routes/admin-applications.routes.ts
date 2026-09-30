import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { requireAuth, requireRole } from '../../../core/middleware/auth.middleware';
import { ApplicationsRepository } from '../repositories/applications.repository';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';

export const adminApplicationsRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// All admin application routes require authenticated session
adminApplicationsRoutes.use('/admin/applications/*', requireAuth);
adminApplicationsRoutes.use('/admin/applications', requireAuth);

/**
 * GET /api/v1/admin/applications
 * Returns all applications for the current chamber with optional status/search filters.
 * Permitted roles: full_admin, chapter_admin, billing_admin.
 */
adminApplicationsRoutes.get(
  '/admin/applications',
  requireRole(['full_admin', 'chapter_admin', 'billing_admin']),
  async (c) => {
    const chamberId = c.get('chamberId');
    if (!chamberId) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'Chamber context required', 400);
    }

    const status = c.req.query('status');
    const search = c.req.query('search');
    const chapterId = c.req.query('chapter_id');

    const rawApps = await ApplicationsRepository.findAll(c.env.DB, chamberId, {
      status,
      search,
      chapterId,
    });

    const data = rawApps.map((a) => {
      let details: any = {};
      try {
        details = a.business_details_json ? JSON.parse(a.business_details_json) : {};
      } catch {}

      return {
        id: a.id,
        trackingCode: a.tracking_code,
        applicantName: a.applicant_name,
        businessName: a.business_name,
        businessEmail: a.business_email,
        businessPhone: a.business_phone,
        planId: a.plan_id,
        planName: a.plan_name || 'Standard Plan',
        planPrice: a.plan_price ?? 0,
        planPricingBasis: a.plan_pricing_basis || 'flat',
        chapterId: a.chapter_id,
        chapterName: a.chapter_name || null,
        status: a.status,
        adminNotes: a.admin_notes,
        submittedAt: a.created_at,
        updatedAt: a.updated_at,
        businessDetails: details,
      };
    });

    const requestId = c.get('requestId');
    return c.json(successResponse(data, { requestId }));
  }
);

/**
 * PATCH /api/v1/admin/applications/:id/approve
 * Approves application.
 */
adminApplicationsRoutes.patch(
  '/admin/applications/:id/approve',
  requireRole(['full_admin', 'chapter_admin', 'billing_admin']),
  async (c) => {
    const chamberId = c.get('chamberId');
    const user = c.get('user');
    const id = c.req.param('id');

    if (!chamberId || !id) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'Chamber context and application ID required', 400);
    }

    const app = await ApplicationsRepository.findById(c.env.DB, chamberId, id);
    if (!app) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Application not found', 404);
    }

    const success = await ApplicationsRepository.updateStatus(
      c.env.DB,
      chamberId,
      id,
      'approved',
      null,
      user?.id
    );

    if (!success) {
      throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Failed to approve application', 500);
    }

    const requestId = c.get('requestId');
    return c.json(
      successResponse(
        { id, status: 'approved', message: 'Application approved successfully' },
        { requestId }
      )
    );
  }
);

/**
 * PATCH /api/v1/admin/applications/:id/request-changes
 * Requests changes on application with admin notes.
 */
adminApplicationsRoutes.patch(
  '/admin/applications/:id/request-changes',
  requireRole(['full_admin', 'chapter_admin', 'billing_admin']),
  async (c) => {
    const chamberId = c.get('chamberId');
    const user = c.get('user');
    const id = c.req.param('id');

    if (!chamberId || !id) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'Chamber context and application ID required', 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const notes = String(body.notes || '').trim();
    if (!notes) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Reviewer notes are required', 400);
    }

    const app = await ApplicationsRepository.findById(c.env.DB, chamberId, id);
    if (!app) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Application not found', 404);
    }

    const success = await ApplicationsRepository.updateStatus(
      c.env.DB,
      chamberId,
      id,
      'changes_requested',
      notes,
      user?.id
    );

    if (!success) {
      throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Failed to update application status', 500);
    }

    const requestId = c.get('requestId');
    return c.json(
      successResponse(
        { id, status: 'changes_requested', message: 'Requested changes sent to applicant' },
        { requestId }
      )
    );
  }
);

/**
 * PATCH /api/v1/admin/applications/:id/reject
 * Rejects application.
 */
adminApplicationsRoutes.patch(
  '/admin/applications/:id/reject',
  requireRole(['full_admin', 'chapter_admin', 'billing_admin']),
  async (c) => {
    const chamberId = c.get('chamberId');
    const user = c.get('user');
    const id = c.req.param('id');

    if (!chamberId || !id) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'Chamber context and application ID required', 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const reason = String(body.reason || 'Application does not meet current criteria').trim();

    const app = await ApplicationsRepository.findById(c.env.DB, chamberId, id);
    if (!app) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Application not found', 404);
    }

    const success = await ApplicationsRepository.updateStatus(
      c.env.DB,
      chamberId,
      id,
      'rejected',
      reason,
      user?.id
    );

    if (!success) {
      throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Failed to update application status', 500);
    }

    const requestId = c.get('requestId');
    return c.json(
      successResponse(
        { id, status: 'rejected', message: 'Application rejected' },
        { requestId }
      )
    );
  }
);
