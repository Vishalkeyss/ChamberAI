import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { requireAuth, requireRole } from '../../../core/middleware/auth.middleware';
import {
  ProvisionChamberSchema,
  SuperChambersQuerySchema,
  UpdateChamberStatusSchema,
} from '../types';
import { SuperChambersService } from '../services/super-chambers.service';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';

export const superChambersRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// All Super Admin chamber routes strictly require super_admin authentication
superChambersRoutes.use('/super/chambers/*', requireAuth, requireRole(['super_admin']));
superChambersRoutes.use('/super/chambers', requireAuth, requireRole(['super_admin']));

/**
 * GET /api/v1/super/chambers
 * List all chambers with pagination, search, and status filters.
 */
superChambersRoutes.get('/super/chambers', async (c) => {
  const queryParams = c.req.query();
  const parsed = SuperChambersQuerySchema.safeParse(queryParams);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      `Query validation error: ${firstIssue.path.join('.')} - ${firstIssue.message}`,
      400,
      parsed.error.flatten()
    );
  }

  const result = await SuperChambersService.listChambers(c.env.DB, parsed.data);
  const requestId = c.get('requestId');

  return c.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
    meta: { requestId },
  });
});

/**
 * POST /api/v1/super/chambers
 * Atomically provision a new chamber tenant.
 */
superChambersRoutes.post('/super/chambers', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = ProvisionChamberSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      `Validation error: ${firstIssue.path.join('.')} - ${firstIssue.message}`,
      400,
      parsed.error.flatten()
    );
  }

  const user = c.get('user');
  const result = await SuperChambersService.provisionChamber(
    c.env.DB,
    parsed.data,
    user?.id
  );
  const requestId = c.get('requestId');

  return c.json(successResponse(result, { requestId }), 201);
});

/**
 * PATCH /api/v1/super/chambers/:id/status
 * Update chamber lifecycle status (active, suspended, pending_setup).
 */
superChambersRoutes.patch('/super/chambers/:id/status', async (c) => {
  const chamberId = c.req.param('id');
  if (!chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Chamber ID is required', 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateChamberStatusSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      `Validation error: ${firstIssue.path.join('.')} - ${firstIssue.message}`,
      400,
      parsed.error.flatten()
    );
  }

  const user = c.get('user');
  const updated = await SuperChambersService.updateChamberStatus(
    c.env.DB,
    chamberId,
    parsed.data,
    user?.id
  );
  const requestId = c.get('requestId');

  return c.json(successResponse(updated, { requestId }));
});
