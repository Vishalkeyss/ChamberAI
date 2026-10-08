import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';

/**
 * 2.3 business_profiles
 * Authoritative schema: database/DB_tables_reference.md & 0002_identity_and_roles.sql
 */
export const businessProfiles = sqliteTable('business_profiles', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  businessName: text('business_name').notNull(),
  businessLogoUrl: text('business_logo_url'),
  tagline: text('tagline'),
  description: text('description'),
  industry: text('industry'),
  businessPhone: text('business_phone'),
  businessEmail: text('business_email'),
  website: text('website'),
  streetAddress: text('street_address'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  socialLinksJson: text('social_links_json'),
  skillsJson: text('skills_json'),
  interestsJson: text('interests_json'),
  locationsJson: text('locations_json'),
  relatedOrganizationsJson: text('related_organizations_json'),
  isVerified: integer('is_verified').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
});

export type BusinessProfileRecord = typeof businessProfiles.$inferSelect;
export type NewBusinessProfileRecord = typeof businessProfiles.$inferInsert;
