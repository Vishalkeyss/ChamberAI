import { Hono } from 'hono';
import type { Env } from '../../core/env';
import type { AppVariables } from '../../core/context';
import { successResponse } from '../../core/shared/response';

export const healthRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

healthRouter.get('/health', (c) => {
  const requestId = c.get('requestId');
  return c.json(
    successResponse(
      {
        status: 'healthy',
        version: '1.0.0',
        region: 'auto',
        timestamp: new Date().toISOString(),
      },
      { requestId }
    )
  );
});
