import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { requireAuth, requireRole } from '../../../core/middleware/auth.middleware';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import {
  createActivitySchema,
  createCrmContactSchema,
  updateContactStageSchema,
  updateCrmContactSchema,
} from '../validation/crm.validation';
import { CrmService } from '../services/crm.service';

/**
 * Prompt 05.5 — Lightweight CRM pipeline. Data is private to its owner (§7.1):
 * every chamber role manages only its own contacts; no admin oversight (OD-088).
 */
export const crmRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

export const ownWorkspaceRoles = ['member', 'group_admin', 'chapter_admin', 'billing_admin', 'full_admin'];

crmRouter.use('/crm/*', requireAuth, requireRole(ownWorkspaceRoles));

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

/** §9.1 */
crmRouter.get('/crm/contacts', async (c) => {
  const { chamberId, userId } = context(c);
  const data = await CrmService.list(c.env.DB, chamberId, userId, { stage: c.req.query('stage') || undefined, search: c.req.query('search') || undefined });
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});

/** §9.2 */
crmRouter.post('/crm/contacts', async (c) => {
  const { chamberId, userId } = context(c);
  const data = await CrmService.create(c.env.DB, chamberId, userId, await body(c, createCrmContactSchema));
  return c.json(successResponse(data, { requestId: c.get('requestId') }), 201);
});

crmRouter.get('/crm/contacts/:id', async (c) => {
  const { chamberId, userId } = context(c);
  const data = await CrmService.detail(c.env.DB, chamberId, userId, c.req.param('id') as string);
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});

crmRouter.put('/crm/contacts/:id', async (c) => {
  const { chamberId, userId } = context(c);
  const data = await CrmService.update(c.env.DB, chamberId, userId, c.req.param('id') as string, await body(c, updateCrmContactSchema));
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});

/** §9.3 */
crmRouter.patch('/crm/contacts/:id/stage', async (c) => {
  const { chamberId, userId } = context(c);
  const { stage } = await body<{ stage: any }>(c, updateContactStageSchema);
  const data = await CrmService.updateStage(c.env.DB, chamberId, userId, c.req.param('id') as string, stage);
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});

crmRouter.delete('/crm/contacts/:id', async (c) => {
  const { chamberId, userId } = context(c);
  const data = await CrmService.remove(c.env.DB, chamberId, userId, c.req.param('id') as string);
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});

/** OD-081 interaction timeline. */
crmRouter.post('/crm/contacts/:id/activities', async (c) => {
  const { chamberId, userId } = context(c);
  const data = await CrmService.addActivity(c.env.DB, chamberId, userId, c.req.param('id') as string, await body(c, createActivitySchema));
  return c.json(successResponse(data, { requestId: c.get('requestId') }), 201);
});
