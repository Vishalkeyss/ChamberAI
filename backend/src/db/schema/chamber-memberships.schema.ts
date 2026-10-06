import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';
import { businessProfiles } from './business-profiles.schema';
import { users } from './users.schema';

/**
 * 2.5 chamber_memberships
 * Authoritative schema: database/DB_tables_reference.md & 0002_identity_and_roles.sql
 */
export const chamberMemberships = sqliteTable('chamber_memberships', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  businessId: text('business_id')
    .notNull()
    .references(() => businessProfiles.id, { onDelete: 'cascade' }),
  memberIdDisplay: text('member_id_display').notNull(),
  planId: text('plan_id'),
  status: text('status').notNull().default('pending'),
  planStartDate: text('plan_start_date'),
  planEndDate: text('plan_end_date'),
  approvedBy: text('approved_by').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: text('approved_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
});

export type ChamberMembershipRecord = typeof chamberMemberships.$inferSelect;
export type NewChamberMembershipRecord = typeof chamberMemberships.$inferInsert;
