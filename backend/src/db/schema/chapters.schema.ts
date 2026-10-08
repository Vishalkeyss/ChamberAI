import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';

/**
 * 3.1 chapters
 * Authoritative schema: database/DB_tables_reference.md & 0003_chapters_and_groups.sql
 */
export const chapters = sqliteTable('chapters', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  cityRegion: text('city_region'),
  status: text('status').default('active'),
  membersCount: integer('members_count').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
});

export type ChapterRecord = typeof chapters.$inferSelect;
export type NewChapterRecord = typeof chapters.$inferInsert;
