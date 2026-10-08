import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';
import { events } from './events.schema';
import { businessProfiles } from './business-profiles.schema';
import { users } from './users.schema';

/**
 * 5.4 event_sponsorship_tiers
 */
export const eventSponsorshipTiers = sqliteTable('event_sponsorship_tiers', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  eventId: text('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  tierName: text('tier_name').notNull(),
  amount: real('amount').notNull().default(0.0),
  benefits: text('benefits'),
  /** NULL = unlimited (migration 0016, Prompt 04.4 §6.1). */
  maxSponsors: integer('max_sponsors'),
  sponsorsCount: integer('sponsors_count').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

/**
 * 5.7 event_sponsors
 */
export const eventSponsors = sqliteTable('event_sponsors', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  eventId: text('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  businessId: text('business_id').references(() => businessProfiles.id, { onDelete: 'set null' }),
  sponsorName: text('sponsor_name').notNull(),
  sponsorUserId: text('sponsor_user_id').references(() => users.id, { onDelete: 'set null' }),
  tierId: text('tier_id').references(() => eventSponsorshipTiers.id, { onDelete: 'set null' }),
  amount: real('amount').notNull().default(0.0),
  status: text('status').default('pending'),
  paymentDate: text('payment_date'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export type EventSponsorshipTierRecord = typeof eventSponsorshipTiers.$inferSelect;
export type EventSponsorRecord = typeof eventSponsors.$inferSelect;
