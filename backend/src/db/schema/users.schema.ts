import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';

/**
 * 2.1 users
 * Authoritative schema: database/DB_tables_reference.md & 0002_identity_and_roles.sql
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  memberVerificationToken: text('member_verification_token').notNull().unique(),
  email: text('email').notNull(),
  phone: text('phone'),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  highestRole: text('highest_role').default('member'),
  status: text('status').default('pending'),
  primaryChapterId: text('primary_chapter_id'),
  pointsBalance: integer('points_balance').notNull().default(0),
  profileCompletionPct: integer('profile_completion_pct').notNull().default(0),
  twoFactorEnabled: integer('two_factor_enabled').notNull().default(0),
  preferredLanguage: text('preferred_language').notNull().default('en'),
  preferredTheme: text('preferred_theme').notNull().default('system'),
  aiCreditsUsed: integer('ai_credits_used').notNull().default(0),
  aiCreditsLimit: integer('ai_credits_limit').notNull().default(5),
  personalApiKeyEncrypted: text('personal_api_key_encrypted'),
  personalApiProvider: text('personal_api_provider'),
  // Prompt 05.4 digital business card (migration 0018)
  cardToken: text('card_token').unique(),
  cardThemeColor: text('card_theme_color'),
  cardViewsCount: integer('card_views_count').notNull().default(0),
  lastLoginAt: text('last_login_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
});

export type UserRecord = typeof users.$inferSelect;
export type NewUserRecord = typeof users.$inferInsert;
