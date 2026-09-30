import type { MiddlewareHandler } from 'hono';
import type { Env } from '../env';
import type { AppVariables } from '../context';
import { AppError, ErrorCodes } from '../shared/errors';

export function createRateLimiter(maxRequests = 100, windowSeconds = 60): MiddlewareHandler<{
  Bindings: Env;
  Variables: AppVariables;
}> {
  return async (c, next) => {
    // If KV is not bound (e.g. in minimal unit test), bypass
    if (!c.env.KV) {
      return await next();
    }

    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const minute = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `rl:${ip}:${minute}`;

    try {
      const current = await c.env.KV.get(key);
      const count = current ? parseInt(current, 10) : 0;

      if (count >= maxRequests) {
        throw new AppError(
          ErrorCodes.RATE_LIMIT_EXCEEDED,
          'Too many requests. Please slow down and try again.',
          429,
          { limit: maxRequests, windowSeconds }
        );
      }

      await c.env.KV.put(key, (count + 1).toString(), { expirationTtl: windowSeconds * 2 });
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      // Fail-open on KV temporary errors
      console.warn('[RATE_LIMIT_KV_ERROR]', e);
    }

    await next();
  };
}
