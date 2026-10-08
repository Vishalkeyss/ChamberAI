import { drizzle } from 'drizzle-orm/d1';
import type { BatchItem } from 'drizzle-orm/batch';
import { messages, notifications } from '../../../db/schema';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { newId } from '../../../core/shared/ids';
import { MessagesRepository } from '../repositories/messages.repository';
import { NetworkMembersRepository } from '../repositories/network-members.repository';
import type { SendMessageInput } from '../validation/networking.validation';

const SNIPPET_LENGTH = 140;

function snippet(text: string): string {
  return text.length > SNIPPET_LENGTH ? `${text.slice(0, SNIPPET_LENGTH - 1)}…` : text;
}

/** Prompt 05.2 — Member Direct Messaging. */
export class MessagesService {
  /** The caller must be an active user of this chamber (blocks other-tenant / platform sessions). */
  private static async requireSender(d1: D1Database, chamberId: string, userId: string) {
    const me = await NetworkMembersRepository.findActiveUser(d1, chamberId, userId);
    if (!me) throw new AppError(ErrorCodes.FORBIDDEN, 'Only active chamber members can use messaging', 403);
    return me;
  }

  /** §7.1: partner must be another active user of the same chamber, otherwise 404. */
  private static async requirePartner(d1: D1Database, chamberId: string, userId: string, otherUserId: string) {
    if (otherUserId === userId) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'You cannot message yourself', 400);
    }
    const partner = await NetworkMembersRepository.findActiveUser(d1, chamberId, otherUserId);
    if (!partner) throw new AppError(ErrorCodes.NOT_FOUND, 'Member not found', 404);
    return partner;
  }

  /** §9.1 GET /messages/conversations */
  static async conversations(d1: D1Database, chamberId: string, userId: string) {
    await this.requireSender(d1, chamberId, userId);
    const rows = await MessagesRepository.conversations(d1, chamberId, userId);
    const cards = await NetworkMembersRepository.memberCards(d1, chamberId, rows.map((r) => r.partnerId));
    return rows
      .filter((r) => cards.has(r.partnerId))
      .map((r) => ({
        partner: cards.get(r.partnerId)!,
        lastMessage: {
          text: snippet(r.lastMessage),
          createdAt: r.lastAt,
          isSender: r.lastSenderId === userId,
        },
        unreadCount: Number(r.unreadCount || 0),
      }));
  }

  /** §9.2 GET /messages/threads/:otherUserId — loading the thread marks incoming messages read (§7.2). */
  static async thread(d1: D1Database, chamberId: string, userId: string, otherUserId: string) {
    await this.requireSender(d1, chamberId, userId);
    await this.requirePartner(d1, chamberId, userId, otherUserId);
    await MessagesRepository.markThreadRead(d1, chamberId, userId, otherUserId, new Date().toISOString());
    const [items, cards] = await Promise.all([
      MessagesRepository.thread(d1, chamberId, userId, otherUserId),
      NetworkMembersRepository.memberCards(d1, chamberId, [otherUserId]),
    ]);
    return { messages: items, partner: cards.get(otherUserId) || null };
  }

  /** §9.3 POST /messages — message + in-app notification for the recipient (OD-059) in one batch. */
  static async send(d1: D1Database, chamberId: string, userId: string, input: SendMessageInput) {
    const me = await this.requireSender(d1, chamberId, userId);
    await this.requirePartner(d1, chamberId, userId, input.recipientId);

    const db = drizzle(d1);
    const id = await newId(d1, 'messages', 'MSG', { chamberId, suffixLength: 6 });
    const createdAt = new Date().toISOString();
    const senderName = me.name?.trim() || me.email;
    const statements: BatchItem<'sqlite'>[] = [
      db.insert(messages).values({
        id,
        chamberId,
        senderId: userId,
        recipientId: input.recipientId,
        message: input.message,
        isRead: 0,
        createdAt,
      }),
      db.insert(notifications).values({
        id: await newId(d1, 'notifications', 'NTF', { chamberId, suffixLength: 6, skipUniqueCheck: true }),
        chamberId,
        userId: input.recipientId,
        type: 'direct_message',
        title: `New message from ${senderName}`,
        message: snippet(input.message),
        actionUrl: `/portal/messages?with=${encodeURIComponent(userId)}`,
        createdAt,
      }),
    ];
    await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
    return { id, createdAt };
  }

  /** §7.3 / §8 */
  static async unreadCount(d1: D1Database, chamberId: string, userId: string) {
    await this.requireSender(d1, chamberId, userId);
    return { unreadCount: await MessagesRepository.unreadCount(d1, chamberId, userId) };
  }

  /** Member picker for starting a conversation (searchable, same chamber only). */
  static async searchContacts(d1: D1Database, chamberId: string, userId: string, query: string) {
    await this.requireSender(d1, chamberId, userId);
    return NetworkMembersRepository.searchMembers(d1, chamberId, userId, query);
  }
}
