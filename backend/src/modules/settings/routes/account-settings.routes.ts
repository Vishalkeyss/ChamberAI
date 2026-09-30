import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { requireAuth } from '../../../core/middleware/auth.middleware';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { successResponse } from '../../../core/shared/response';
import { AccountSettingsService } from '../services/account-settings.service';
import {
  updateProfileSchema,
  updateNotificationPrefsSchema,
  savePersonalApiKeySchema,
} from '../validation/account-settings.validation';

export const accountSettingsRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// All settings routes require valid authenticated session
accountSettingsRoutes.use('/member/settings*', requireAuth);
accountSettingsRoutes.use('/settings*', requireAuth);

/**
 * GET /api/v1/member/settings
 * Retrieves user profile, 15-item notification preferences matrix, active sessions, and AI credit status
 */
const getSettingsHandler = async (c: any) => {
  const requestId = c.get('requestId');
  const user = c.get('user')!;
  const chamberId = c.get('chamberId') || user.chamber_id;

  if (!chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Chamber context required', 400);
  }

  const data = await AccountSettingsService.getSettings(c, user.id, chamberId);
  return c.json(successResponse(data, { requestId }));
};

accountSettingsRoutes.get('/member/settings', getSettingsHandler);
accountSettingsRoutes.get('/member/settings/', getSettingsHandler);
accountSettingsRoutes.get('/settings', getSettingsHandler);

/**
 * PUT /api/v1/member/settings/profile
 * Updates name, title, and phone
 */
accountSettingsRoutes.put('/member/settings/profile', async (c) => {
  const requestId = c.get('requestId');
  const user = c.get('user')!;
  const chamberId = c.get('chamberId') || user.chamber_id;

  if (!chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Chamber context required', 400);
  }

  const rawBody = await c.req.json().catch(() => ({}));
  const parseResult = updateProfileSchema.safeParse(rawBody);

  if (!parseResult.success) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      parseResult.error.errors[0]?.message || 'Invalid profile data',
      400,
      parseResult.error.format()
    );
  }

  const result = await AccountSettingsService.updateProfile(
    c,
    user.id,
    chamberId,
    parseResult.data
  );
  return c.json(successResponse(result, { requestId }));
});

/**
 * PUT /api/v1/member/settings/notifications
 * Updates notification matrix
 */
accountSettingsRoutes.put('/member/settings/notifications', async (c) => {
  const requestId = c.get('requestId');
  const user = c.get('user')!;
  const chamberId = c.get('chamberId') || user.chamber_id;

  if (!chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Chamber context required', 400);
  }

  const rawBody = await c.req.json().catch(() => ({}));
  const parseResult = updateNotificationPrefsSchema.safeParse(rawBody);

  if (!parseResult.success) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      parseResult.error.errors[0]?.message || 'Invalid notification preferences data',
      400,
      parseResult.error.format()
    );
  }

  const result = await AccountSettingsService.updateNotifications(
    c,
    user.id,
    chamberId,
    parseResult.data.preferences
  );
  return c.json(successResponse(result, { requestId }));
});

/**
 * DELETE /api/v1/member/settings/sessions/:sessionId
 * Revokes a specific remote session
 */
accountSettingsRoutes.delete('/member/settings/sessions/:sessionId', async (c) => {
  const requestId = c.get('requestId');
  const user = c.get('user')!;
  const chamberId = c.get('chamberId') || user.chamber_id;
  const sessionId = c.req.param('sessionId');

  if (!chamberId || !sessionId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Chamber and Session ID required', 400);
  }

  const result = await AccountSettingsService.revokeSession(
    c,
    user.id,
    chamberId,
    sessionId
  );
  return c.json(successResponse(result, { requestId }));
});

/**
 * POST /api/v1/member/settings/api-key
 * Configures personal encrypted BYO AI key
 */
accountSettingsRoutes.post('/member/settings/api-key', async (c) => {
  const requestId = c.get('requestId');
  const user = c.get('user')!;
  const chamberId = c.get('chamberId') || user.chamber_id;

  if (!chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Chamber context required', 400);
  }

  const rawBody = await c.req.json().catch(() => ({}));
  const parseResult = savePersonalApiKeySchema.safeParse(rawBody);

  if (!parseResult.success) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      parseResult.error.errors[0]?.message || 'Invalid API key configuration',
      400,
      parseResult.error.format()
    );
  }

  const result = await AccountSettingsService.savePersonalApiKey(
    c,
    user.id,
    chamberId,
    parseResult.data
  );
  return c.json(successResponse(result, { requestId }));
});
