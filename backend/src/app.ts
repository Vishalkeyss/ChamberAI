import { Hono } from 'hono';
import type { Env } from './core/env';
import type { AppVariables } from './core/context';
import { requestIdMiddleware } from './core/middleware/request-id';
import { corsMiddleware } from './core/middleware/cors';
import { requireAuth, requireRole } from './core/middleware/auth.middleware';
import { globalErrorHandler } from './core/middleware/error-handler';
import { resolveChamberMiddleware } from './core/middleware/tenant-resolver';
import { createRateLimiter } from './core/middleware/rate-limiter';
import { healthRouter } from './api/routes/health';
import { publicSettingsRouter } from './api/routes/public-settings';
import { authRoutes } from './modules/auth/routes/otp.routes';
import { sessionRoutes } from './modules/auth/routes/session.routes';
import { accountSettingsRoutes } from './modules/settings/routes/account-settings.routes';
import { publicPlansRoutes } from './modules/membership/routes/public-plans.routes';
import { publicApplicationsRoutes } from './modules/membership/routes/public-applications.routes';
import { adminPlansRoutes } from './modules/membership/routes/admin-plans.routes';
import { adminApplicationsRoutes } from './modules/membership/routes/admin-applications.routes';
import { superChambersRoutes } from './modules/super-admin/routes/super-chambers.routes';
import { adminOnboardingRoutes } from './modules/admin/onboarding/routes/admin-onboarding.routes';
import { memberOverviewRoutes } from './modules/member/routes/overview.routes';
import { memberBillingRoutes } from './modules/billing/routes/member-billing.routes';
import { runMigrations, getMigrationHistory } from './core/db/migrator';
import { successResponse } from './core/shared/response';

export function createApp() {
  const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

  // 1. Global Request ID
  app.use('*', requestIdMiddleware);

  // 2. Dynamic CORS
  app.use('*', corsMiddleware);

  // 3. Global Error Handler
  app.onError(globalErrorHandler);

  // 4. Rate Limiter (120 reqs/min for public access)
  app.use('/api/v1/*', createRateLimiter(120, 60));

  // 5. Tenant Resolution (Mounts on API routes)
  app.use('/api/v1/*', resolveChamberMiddleware);

  // 6. Mount Feature Sub-routers under /api/v1
  const apiV1 = new Hono<{ Bindings: Env; Variables: AppVariables }>();
  apiV1.route('/', healthRouter);
  apiV1.route('/', publicSettingsRouter);
  apiV1.route('/auth', authRoutes);
  apiV1.route('/auth', sessionRoutes);
  apiV1.route('/', accountSettingsRoutes);
  apiV1.route('/', publicPlansRoutes);
  apiV1.route('/', publicApplicationsRoutes);
  apiV1.route('/', adminPlansRoutes);
  apiV1.route('/', adminApplicationsRoutes);
  apiV1.route('/', superChambersRoutes);
  apiV1.route('/', adminOnboardingRoutes);
  apiV1.route('/', memberOverviewRoutes);
  apiV1.route('/', memberBillingRoutes);

  // 7. Migration operations route for Super Admin (Strictly protected by requireAuth + super_admin RBAC)
  apiV1.post('/super-admin/migrations/run', requireAuth, requireRole(['super_admin']), async (c) => {
    const requestId = c.get('requestId');
    const result = await runMigrations(c.env.DB);
    return c.json(successResponse(result, { requestId }));
  });

  apiV1.get('/super-admin/migrations/history', requireAuth, requireRole(['super_admin']), async (c) => {
    const requestId = c.get('requestId');
    const history = await getMigrationHistory(c.env.DB);
    return c.json(successResponse(history, { requestId }));
  });

  app.route('/api/v1', apiV1);

  // Fallback 404 handler
  app.notFound((c) => {
    const requestId = c.get('requestId');
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `The endpoint ${c.req.method} ${c.req.path} was not found on this server`,
        },
        meta: { requestId },
      },
      404
    );
  });

  return app;
}
