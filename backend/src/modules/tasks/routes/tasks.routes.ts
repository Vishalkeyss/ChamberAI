import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { requireAuth, requireRole } from '../../../core/middleware/auth.middleware';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { createTaskSchema, updateTaskSchema } from '../validation/tasks.validation';
import { TasksService } from '../services/tasks.service';
import { ownWorkspaceRoles } from '../../crm/routes/crm.routes';

/** Prompt 05.5 — personal Kanban tasks; private to the owner (OD-088). */
export const tasksRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

tasksRouter.use('/tasks', requireAuth, requireRole(ownWorkspaceRoles));
tasksRouter.use('/tasks/*', requireAuth, requireRole(ownWorkspaceRoles));

function context(c: any): { chamberId: string; userId: string } {
  const chamberId = c.get('chamberId');
  const user = c.get('user');
  if (!chamberId || !user) throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  return { chamberId, userId: user.id };
}

async function body<T>(c: any, schema: { safeParse: (v: unknown) => any }): Promise<T> {
  const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, parsed.error.errors[0]?.message || 'Invalid request', 422);
  }
  return parsed.data as T;
}

/** §9.4 */
tasksRouter.get('/tasks', async (c) => {
  const { chamberId, userId } = context(c);
  const data = await TasksService.list(c.env.DB, chamberId, userId, {
    status: c.req.query('status') || undefined,
    priority: c.req.query('priority') || undefined,
  });
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});

/** §9.5 */
tasksRouter.post('/tasks', async (c) => {
  const { chamberId, userId } = context(c);
  const data = await TasksService.create(c.env.DB, chamberId, userId, await body(c, createTaskSchema));
  return c.json(successResponse(data, { requestId: c.get('requestId') }), 201);
});

tasksRouter.patch('/tasks/:id', async (c) => {
  const { chamberId, userId } = context(c);
  const data = await TasksService.update(c.env.DB, chamberId, userId, c.req.param('id') as string, await body(c, updateTaskSchema));
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});

tasksRouter.delete('/tasks/:id', async (c) => {
  const { chamberId, userId } = context(c);
  const data = await TasksService.remove(c.env.DB, chamberId, userId, c.req.param('id') as string);
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});
