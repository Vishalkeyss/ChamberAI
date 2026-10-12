import { sqliteTable, text, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';
import { businessProfiles } from './business-profiles.schema';
import { users } from './users.schema';

/**
 * 7.1 referrals
 * Authoritative schema: database/DB_tables_reference.md, 0007_networking_and_crm.sql, 0017 (converted_value)
 */
export const referrals = sqliteTable('referrals', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  fromBusinessId: text('from_business_id')
    .notNull()
    .references(() => businessProfiles.id, { onDelete: 'cascade' }),
  toBusinessId: text('to_business_id')
    .notNull()
    .references(() => businessProfiles.id, { onDelete: 'cascade' }),
  createdByUserId: text('created_by_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  message: text('message'),
  status: text('status').default('pending'), // pending | contacted | converted | declined
  convertedValue: real('converted_value'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
});

/**
 * 7.2 referral_people
 * Authoritative schema: database/DB_tables_reference.md & 0007_networking_and_crm.sql
 */
export const referralPeople = sqliteTable('referral_people', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  referralId: text('referral_id')
    .notNull()
    .references(() => referrals.id, { onDelete: 'cascade' }),
  fullName: text('full_name').notNull(),
  mobileNumber: text('mobile_number'),
  email: text('email'),
  profession: text('profession'),
  referredBusinessId: text('referred_business_id').references(() => businessProfiles.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export type ReferralRecord = typeof referrals.$inferSelect;
export type ReferralPersonRecord = typeof referralPeople.$inferSelect;
