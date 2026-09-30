import type { MiddlewareHandler } from 'hono';
import type { AppVariables } from '../context';
import type { Env } from '../env';

export const requestIdMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: AppVariables }> = async (
  c,
  next
) => {
  const existingId = c.req.header('X-Request-ID');
  const requestId = existingId || `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);

  await next();
};
