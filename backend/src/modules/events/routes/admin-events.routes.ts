import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { requireAuth, requireRole } from '../../../core/middleware/auth.middleware';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { MAX_IMAGE_UPLOAD_BYTES } from '../../../core/shared/image-upload';
import { createEventSchema, updateEventSchema } from '../validation/events.validation';
import { EventCreationService } from '../services/event-creation.service';
import { EventsAdminRepository } from '../repositories/events-admin.repository';
import { getAdminScope } from './admin-scope';

/**
 * Prompt 04.6 — Admin Event Creation Wizard API.
 * Write access: full_admin / super_admin (any chapter), chapter_admin (own chapter only).
 * The service re-checks scope on every call; route roles are only the outer gate.
 */
export const adminEventsRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const writerRoles = ['full_admin', 'chapter_admin', 'super_admin'];

function chamberOf(c: any): string {
  const chamberId = c.get('chamberId');
  if (!chamberId) throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'No chamber context bound to request', 404);
  return chamberId;
}

function parse<T>(schema: { safeParse: (v: unknown) => any }, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.errors[0];
    const path = issue?.path?.length ? `${issue.path.join('.')}: ` : '';
    throw new AppError(ErrorCodes.VALIDATION_ERROR, `${path}${issue?.message || 'Invalid request'}`, 422);
  }
  return parsed.data as T;
}

/** GET /api/v1/admin/events/form-options — chapters, groups, categories, cities for the wizard. */
adminEventsRouter.get('/admin/events/form-options', requireAuth, requireRole(writerRoles), async (c) => {
  const chamberId = chamberOf(c);
  const scope = getAdminScope(c);
  if (scope.userRole !== 'full_admin' && scope.userRole !== 'chapter_admin') {
    throw new AppError(ErrorCodes.FORBIDDEN, 'You are not allowed to create events', 403);
  }
  const options = await EventsAdminRepository.formOptions(
    c.env.DB,
    chamberId,
    scope.userRole === 'chapter_admin' ? scope.userScopeId : null
  );
  return c.json(
    successResponse(
      { ...options, lockedChapterId: scope.userRole === 'chapter_admin' ? scope.userScopeId : null },
      { requestId: c.get('requestId') }
    )
  );
});

/** POST /api/v1/admin/events/photos — upload one event photo to R2. */
adminEventsRouter.post('/admin/events/photos', requireAuth, requireRole(writerRoles), async (c) => {
  const chamberId = chamberOf(c);
  const contentType = c.req.header('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Upload the photo as multipart/form-data', 400);
  }
  const form = await c.req.formData();
  const file = form.get('file');
  if (!file || !(file instanceof File)) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'A valid image file is required', 400);
  }
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new AppError(
      ErrorCodes.BAD_REQUEST,
      `File too large. Maximum size is ${Math.round(MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024))}MB`,
      400
    );
  }
  const result = await EventCreationService.uploadPhoto(c.env, chamberId, getAdminScope(c), await file.arrayBuffer());
  return c.json(successResponse(result, { requestId: c.get('requestId') }), 201);
});

/** POST /api/v1/admin/events (§9.1) */
adminEventsRouter.post('/admin/events', requireAuth, requireRole(writerRoles), async (c) => {
  const chamberId = chamberOf(c);
  const input = parse<any>(createEventSchema, await c.req.json().catch(() => ({})));
  const result = await EventCreationService.create(c.env.DB, chamberId, getAdminScope(c), input);
  return c.json(successResponse(result, { requestId: c.get('requestId') }), 201);
});

/** GET /api/v1/admin/events/:id — full data for the edit form. */
adminEventsRouter.get('/admin/events/:id', requireAuth, requireRole(writerRoles), async (c) => {
  const chamberId = chamberOf(c);
  const result = await EventCreationService.getForEdit(c.env.DB, chamberId, getAdminScope(c), c.req.param('id') as string);
  return c.json(successResponse(result, { requestId: c.get('requestId') }));
});

/** PUT /api/v1/admin/events/:id (§9.2) */
adminEventsRouter.put('/admin/events/:id', requireAuth, requireRole(writerRoles), async (c) => {
  const chamberId = chamberOf(c);
  const input = parse<any>(updateEventSchema, await c.req.json().catch(() => ({})));
  const result = await EventCreationService.update(
    c.env.DB,
    chamberId,
    getAdminScope(c),
    c.req.param('id') as string,
    input
  );
  return c.json(successResponse(result, { requestId: c.get('requestId') }));
});

/** DELETE /api/v1/admin/events/:id — deletes, or cancels when people are registered. */
adminEventsRouter.delete('/admin/events/:id', requireAuth, requireRole(writerRoles), async (c) => {
  const chamberId = chamberOf(c);
  const result = await EventCreationService.remove(c.env.DB, chamberId, getAdminScope(c), c.req.param('id') as string);
  return c.json(successResponse(result, { requestId: c.get('requestId') }));
});
