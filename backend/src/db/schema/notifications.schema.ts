import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';
import { users } from './users.schema';

/**
 * 20.1 notifications (in-app)
 * Authoritative schema: database/DB_tables_reference.md & 0011_automations_and_ai.sql
 */
export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: integer('is_read').notNull().default(0),
  actionUrl: text('action_url'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
