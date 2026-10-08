import { drizzle } from 'drizzle-orm/d1';
import { and, count, desc, eq, or, sql } from 'drizzle-orm';
import { messages } from '../../../db/schema';

/** Upper bound of messages returned for one thread (latest N, oldest first). */
export const THREAD_PAGE_SIZE = 500;

export class MessagesRepository {
  /**
   * §9.1 — one row per conversation partner: latest message + unread count.
   * SQLite returns the bare columns (message, sender) from the row that holds MAX(created_at).
   */
  static async conversations(d1: D1Database, chamberId: string, userId: string) {
    const partner = sql<string>`CASE WHEN ${messages.senderId} = ${userId} THEN ${messages.recipientId} ELSE ${messages.senderId} END`;
    const lastAt = sql<string>`MAX(${messages.createdAt})`;
    return drizzle(d1)
      .select({
        partnerId: partner,
        lastAt,
        lastMessage: messages.message,
        lastSenderId: messages.senderId,
        unreadCount: sql<number>`SUM(CASE WHEN ${messages.recipientId} = ${userId} AND ${messages.isRead} = 0 THEN 1 ELSE 0 END)`,
      })
      .from(messages)
      .where(and(eq(messages.chamberId, chamberId), or(eq(messages.senderId, userId), eq(messages.recipientId, userId))))
      .groupBy(partner)
      .orderBy(desc(lastAt));
  }

  /** §7.2 — automatic read receipts for everything the partner sent to this user. */
  static async markThreadRead(d1: D1Database, chamberId: string, userId: string, otherUserId: string, readAt: string) {
    return drizzle(d1)
      .update(messages)
      .set({ isRead: 1, readAt })
      .where(
        and(
          eq(messages.chamberId, chamberId),
          eq(messages.senderId, otherUserId),
          eq(messages.recipientId, userId),
          eq(messages.isRead, 0)
        )
      )
      .run();
  }

  /** §9.2 — chronological history between the two users (latest THREAD_PAGE_SIZE). */
  static async thread(d1: D1Database, chamberId: string, userId: string, otherUserId: string) {
    const rows = await drizzle(d1)
      .select({
        id: messages.id,
        senderId: messages.senderId,
        message: messages.message,
        isRead: messages.isRead,
        readAt: messages.readAt,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(
        and(
          eq(messages.chamberId, chamberId),
          or(
            and(eq(messages.senderId, userId), eq(messages.recipientId, otherUserId)),
            and(eq(messages.senderId, otherUserId), eq(messages.recipientId, userId))
          )
        )
      )
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(THREAD_PAGE_SIZE);
    return rows.reverse();
  }

  /** §8 — topbar / sidebar unread badge. */
  static async unreadCount(d1: D1Database, chamberId: string, userId: string): Promise<number> {
    const row = await drizzle(d1)
      .select({ n: count() })
      .from(messages)
      .where(and(eq(messages.chamberId, chamberId), eq(messages.recipientId, userId), eq(messages.isRead, 0)))
      .get();
    return Number(row?.n || 0);
  }
}
