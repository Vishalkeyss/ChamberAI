import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';
import { users } from './users.schema';
import { events } from './events.schema';

/**
 * points_history
 * Authoritative schema: database/DB_tables_reference.md & 0008_content_and_learning.sql
 */
export const pointsHistory = sqliteTable('points_history', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  points: integer('points').notNull(),
  type: text('type').notNull(), // 'earned' | 'redeemed'
  reason: text('reason').notNull(),
  relatedEventId: text('related_event_id').references(() => events.id, { onDelete: 'set null' }),
  relatedReferralId: text('related_referral_id'),
  claimCode: text('claim_code'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export type PointsHistoryRecord = typeof pointsHistory.$inferSelect;
