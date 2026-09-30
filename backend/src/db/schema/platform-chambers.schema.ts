import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * 1.1 platform_chambers
 * Authoritative schema: database/DB_tables_reference.md & 0001_platform_tables.sql
 */
export const platformChambers = sqliteTable('platform_chambers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  city: text('city'),
  subdomain: text('subdomain').unique(),
  customDomain: text('custom_domain').unique(),
  domainStatus: text('domain_status').default('none'),
  adminContactName: text('admin_contact_name'),
  adminEmail: text('admin_email'),
  status: text('status').default('pending_setup'),
  onboarded: integer('onboarded').notNull().default(0),
  r2BucketName: text('r2_bucket_name'),
  membersCount: integer('members_count').notNull().default(0),
  revenueTotal: real('revenue_total').notNull().default(0.0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
});

export type PlatformChamberRecord = typeof platformChambers.$inferSelect;
export type NewPlatformChamberRecord = typeof platformChambers.$inferInsert;
