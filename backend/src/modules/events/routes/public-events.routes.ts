import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { eventsQuerySchema, eventRegisterSchema } from '../validation/events.validation';
import { EventsRepository } from '../repositories/events.repository';
import { EventRegistrationsRepository } from '../repositories/event-registrations.repository';

export const publicEventsRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

/**
 * GET /api/v1/public/events
 * Returns public events for guest view.
 * Visibility: WHERE visibility = 'public' AND status = 'published'
 * Mandatory Tenant Isolation: WHERE chamber_id = :chamberId
 */
publicEventsRouter.get('/public/events', async (c) => {
  const chamberId = c.get('chamberId');
  const requestId = c.get('requestId');

  if (!chamberId) {
    throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'No chamber context bound to request', 404);
  }

  const rawQuery = c.req.query();
  const parsed = eventsQuerySchema.safeParse(rawQuery);

  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      parsed.error.errors[0]?.message || 'Invalid events query parameters',
      422
    );
  }

  const result = await EventsRepository.listEvents(
    c.env.DB,
    chamberId,
    parsed.data,
    'guest'
  );

  return c.json(
    successResponse(result.data, {
      requestId,
      meta: result.meta,
    })
  );
});

/**
 * GET /api/v1/public/events/filters
 * Dynamic categories, cities, and chapters for filter dropdowns.
 */
publicEventsRouter.get('/public/events/filters', async (c) => {
  const chamberId = c.get('chamberId');
  const requestId = c.get('requestId');

  if (!chamberId) {
    throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'No chamber context bound to request', 404);
  }

  const filters = await EventsRepository.getFilterOptions(c.env.DB, chamberId);

  return c.json(successResponse(filters, { requestId }));
});

/**
 * POST /api/v1/public/events/:id/register
 * Allows public guests to dynamically register or waitlist for events in the database.
 */
publicEventsRouter.post('/public/events/:id/register', async (c) => {
  const chamberId = c.get('chamberId');
  const eventId = c.req.param('id');
  const requestId = c.get('requestId');

  if (!chamberId) {
    throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'No chamber context bound to request', 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = eventRegisterSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      parsed.error.errors[0]?.message || 'Invalid registration details',
      422
    );
  }

  const result = await EventRegistrationsRepository.registerEvent(
    c.env.DB,
    chamberId,
    eventId,
    null,
    parsed.data
  );

  return c.json(successResponse(result, { requestId }), 201);
});

