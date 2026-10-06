import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';

/**
 * 3.1 membership_plans
 * Authoritative schema: database/DB_tables_reference.md & 0003_membership_core.sql
 */
export const membershipPlans = sqliteTable('membership_plans', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  accentColor: text('accent_color'),
  price: real('price').notNull().default(0.0),
  pricingBasis: text('pricing_basis').default('flat'),
  pricingTiersJson: text('pricing_tiers_json'),
  billingFrequency: text('billing_frequency').default('annual'),
  isPopular: integer('is_popular').notNull().default(0),
  featuresJson: text('features_json'),
  isActive: integer('is_active').notNull().default(1),
  activeMembersCount: integer('active_members_count').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
});

export type MembershipPlanRecord = typeof membershipPlans.$inferSelect;
export type NewMembershipPlanRecord = typeof membershipPlans.$inferInsert;
