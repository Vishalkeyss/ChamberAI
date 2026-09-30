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
