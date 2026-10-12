import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';
import { events } from './events.schema';

/**
 * 5.3 event_promo_codes
 * Authoritative schema: database/DB_tables_reference.md & 0005_events_and_ticketing.sql
 */
export const eventPromoCodes = sqliteTable('event_promo_codes', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  eventId: text('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  discountType: text('discount_type').notNull(), // 'percentage' | 'flat'
  discountValue: real('discount_value').notNull(),
  pointsDiscountPoints: integer('points_discount_points'),
  pointsDiscountPct: real('points_discount_pct'),
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').notNull().default(0),
  isActive: integer('is_active').notNull().default(1),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export type EventPromoCodeRecord = typeof eventPromoCodes.$inferSelect;
