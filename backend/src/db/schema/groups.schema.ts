import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';

/**
 * groups
 * Authoritative schema: database/DB_tables_reference.md & 0003_chapters_and_groups.sql
 */
export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category'),
  description: text('description'),
  inviteOnly: integer('invite_only').notNull().default(0),
  autoAddOnJoin: integer('auto_add_on_join').notNull().default(0),
  approvalMode: text('approval_mode').default('auto'),
  membersCount: integer('members_count').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
});

export type GroupRecord = typeof groups.$inferSelect;
