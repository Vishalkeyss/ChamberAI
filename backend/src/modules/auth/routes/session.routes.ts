import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { requireAuth } from '../../../core/middleware/auth.middleware';
import { SessionService, type CachedSession } from '../services/session.service';
import { successResponse } from '../../../core/shared/response';

export const sessionRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

/**
 * GET /api/v1/auth/me
 * Session Introspection API — sub-15ms edge resolution from Cloudflare KV
 */
sessionRoutes.get('/me', requireAuth, async (c) => {
  const requestId = c.get('requestId');
  const session = c.get('session') as CachedSession;

  const data = SessionService.toResponseData(session);
  return c.json(successResponse(data, { requestId }));
});

/**
 * POST /api/v1/auth/refresh
 * Explicit session keep-alive & extension — resets sliding window and KV TTL
 */
sessionRoutes.post('/refresh', requireAuth, async (c) => {
  const requestId = c.get('requestId');
  const token = c.get('sessionToken') as string;
  const session = c.get('session') as CachedSession;

  // Force session touch/extension in KV
  await SessionService.touchSession(c, token, session, true);

  const data = SessionService.toResponseData(session);
  return c.json(
    successResponse(
      {
        ...data,
        refreshedAt: new Date().toISOString(),
      },
      { requestId }
    )
  );
});

/**
 * POST /api/v1/auth/logout
 * Session Termination — purges KV session and writes to platform_audit_logs
 */
sessionRoutes.post('/logout', requireAuth, async (c) => {
  const requestId = c.get('requestId');
  const token = c.get('sessionToken') as string;
  const session = c.get('session') as CachedSession;

  await SessionService.invalidateSession(c, token, session);

  return c.json(
    successResponse(
      {
        message: 'Logged out successfully',
      },
      { requestId }
    )
  );
});

/**
 * PATCH /api/v1/auth/me/preferences
 * User Preferences API — persists preferred theme & language in D1 users table
 */
sessionRoutes.patch('/me/preferences', requireAuth, async (c) => {
  const requestId = c.get('requestId');
  const session = c.get('session') as CachedSession;
  const body = await c.req.json().catch(() => ({}));
  const theme = body.preferredTheme || body.theme;
  const language = body.preferredLanguage || body.language;

  if (theme && ['light', 'dark', 'system'].includes(theme)) {
    await c.env.DB.prepare('UPDATE users SET preferred_theme = ? WHERE id = ?')
      .bind(theme, session.userId)
      .run();
  }
  if (language && ['en', 'es', 'fr', 'zh', 'vi', 'ko'].includes(language)) {
    await c.env.DB.prepare('UPDATE users SET preferred_language = ? WHERE id = ?')
      .bind(language, session.userId)
      .run();
  }

  return c.json(
    successResponse(
      {
        updated: true,
        preferredTheme: theme || undefined,
        preferredLanguage: language || undefined,
      },
      { requestId }
    )
  );
});
