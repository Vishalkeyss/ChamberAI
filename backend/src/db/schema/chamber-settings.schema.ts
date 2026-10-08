import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { platformChambers } from './platform-chambers.schema';

/**
 * chamber_settings — branding subset used by read-only features (e.g. 05.4 business card).
 * Authoritative schema: database/DB_tables_reference.md & 0011_automations_and_ai.sql
 * (only the columns read through Drizzle are declared here).
 */
export const chamberSettings = sqliteTable('chamber_settings', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .unique()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  orgName: text('org_name').notNull(),
  primaryColor: text('primary_color').notNull(),
  logoUrl: text('logo_url'),
});
