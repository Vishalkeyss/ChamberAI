import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { requireAuth, requireRole } from '../../../core/middleware/auth.middleware';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { sendMessageSchema } from '../validation/networking.validation';
import { MessagesService } from '../services/messages.service';

/**
 * Prompt 05.2 — Member Direct Messaging Inbox, Threaded Chat & Read Receipts.
 * Part 4 matrix "1:1 Meetings & Chat": member / group / chapter / full admin = CRUD (Self);
 * billing_admin and guests have no access (OD-061).
 */
export const messagesRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const chatRoles = ['member', 'group_admin', 'chapter_admin', 'full_admin'];

messagesRouter.use('/messages', requireAuth, requireRole(chatRoles));
messagesRouter.use('/messages/*', requireAuth, requireRole(chatRoles));

function context(c: any): { chamberId: string; userId: string } {
  const chamberId = c.get('chamberId');
  const user = c.get('user');
  if (!chamberId || !user) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }
  return { chamberId, userId: user.id };
}

/** §9.1 */
messagesRouter.get('/messages/conversations', async (c) => {
  const { chamberId, userId } = context(c);
  const data = await MessagesService.conversations(c.env.DB, chamberId, userId);
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});

/** §7.3 / §8 — unread badge (OD-057). */
messagesRouter.get('/messages/unread-count', async (c) => {
  const { chamberId, userId } = context(c);
  const data = await MessagesService.unreadCount(c.env.DB, chamberId, userId);
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});

/** Member picker for a new conversation. */
messagesRouter.get('/messages/contacts', async (c) => {
  const { chamberId, userId } = context(c);
  const data = await MessagesService.searchContacts(c.env.DB, chamberId, userId, (c.req.query('q') || '').slice(0, 100));
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});

/** §9.2 — data = messages (oldest first); meta.partner = the other member's card. */
messagesRouter.get('/messages/threads/:otherUserId', async (c) => {
  const { chamberId, userId } = context(c);
  const { messages, partner } = await MessagesService.thread(c.env.DB, chamberId, userId, c.req.param('otherUserId') as string);
  return c.json(successResponse(messages, { requestId: c.get('requestId'), partner }));
});

/** §9.3 */
messagesRouter.post('/messages', async (c) => {
  const { chamberId, userId } = context(c);
  const parsed = sendMessageSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, parsed.error.errors[0]?.message || 'Invalid message', 422);
  }
  const data = await MessagesService.send(c.env.DB, chamberId, userId, parsed.data);
  return c.json(successResponse(data, { requestId: c.get('requestId') }), 201);
});
