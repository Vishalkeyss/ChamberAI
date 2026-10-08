import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';
import { users } from './users.schema';

/**
 * 7.4 messages
 * Authoritative schema: database/DB_tables_reference.md & 0007_networking_and_crm.sql
 */
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  senderId: text('sender_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  recipientId: text('recipient_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  isRead: integer('is_read').notNull().default(0),
  readAt: text('read_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export type MessageRecord = typeof messages.$inferSelect;
