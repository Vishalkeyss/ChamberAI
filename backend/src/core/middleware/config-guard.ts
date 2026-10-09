import type { MiddlewareHandler } from 'hono';
import type { Env } from '../env';
import type { AppVariables } from '../context';
import { validateDeployedConfig } from '../config';
import { AppError, ErrorCodes } from '../shared/errors';

let reported = false;

/**
 * Staging / production fail closed when required configuration is missing (core/config).
 * `/api/v1/health` stays reachable so the problem is visible; details go to the Worker log only.
 */
export const configGuardMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: AppVariables }> = async (c, next) => {
  const issues = validateDeployedConfig(c.env);
  if (issues.length === 0 || c.req.path === '/api/v1/health') {
    return next();
  }
  if (!reported) {
    reported = true;
    console.error('[CONFIG_INVALID]', issues.join('; '));
  }
  throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Service is not configured. Please contact the platform administrator.', 503);
};
