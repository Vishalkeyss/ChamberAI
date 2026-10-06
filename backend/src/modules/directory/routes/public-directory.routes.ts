import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { directoryQuerySchema } from '../validation/directory.validation';
import { DirectoryRepository } from '../repositories/directory.repository';

export const publicDirectoryRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

/**
 * GET /api/v1/public/directory
 * Public business directory with search, multi-facet filtering, and pagination.
 * Auth: Public / Anonymous (uses tenant resolver middleware).
 * Tenant Isolation: WHERE bp.chamber_id = :chamberId
 */
publicDirectoryRouter.get('/public/directory', async (c) => {
  const chamberId = c.get('chamberId');
  const requestId = c.get('requestId');

  if (!chamberId) {
    throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'No chamber context bound to request', 404);
  }

  // Parse and validate query params
  const rawQuery = c.req.query();
  const parsed = directoryQuerySchema.safeParse(rawQuery);

  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      parsed.error.errors[0]?.message || 'Invalid directory search query parameters',
      422
    );
  }

  const result = await DirectoryRepository.searchDirectory(
    c.env.DB,
    chamberId,
    parsed.data,
    { isMemberView: false }
  );

  return c.json(
    successResponse(result.businesses, {
      requestId,
      meta: result.meta,
    })
  );
});

/**
 * GET /api/v1/public/directory/filters
 * Returns available filter options (distinct industries, cities, active chapters) for the directory.
 */
publicDirectoryRouter.get('/public/directory/filters', async (c) => {
  const chamberId = c.get('chamberId');
  const requestId = c.get('requestId');

  if (!chamberId) {
    throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'No chamber context bound to request', 404);
  }

  const filters = await DirectoryRepository.getFilterOptions(c.env.DB, chamberId);

  return c.json(successResponse(filters, { requestId }));
});
