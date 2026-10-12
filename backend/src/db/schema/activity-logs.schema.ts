import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';
import { users } from './users.schema';

/**
 * activity_logs
 * Authoritative schema: database/DB_tables_reference.md & migrations
 */
export const activityLogs = sqliteTable('activity_logs', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id'),
  detailsJson: text('details_json'),
  ipAddress: text('ip_address'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export type ActivityLogRecord = typeof activityLogs.$inferSelect;
