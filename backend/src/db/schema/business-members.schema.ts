import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';
import { businessProfiles } from './business-profiles.schema';

/**
 * 2.4 business_members
 * Authoritative schema: database/DB_tables_reference.md & 0002_identity_and_roles.sql
 */
export const businessMembers = sqliteTable('business_members', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  businessId: text('business_id')
    .notNull()
    .references(() => businessProfiles.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  accessLevel: text('access_level').notNull().default('events_networking'),
  isPrimaryContact: integer('is_primary_contact').notNull().default(0),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
});

export type BusinessMemberRecord = typeof businessMembers.$inferSelect;
export type NewBusinessMemberRecord = typeof businessMembers.$inferInsert;
