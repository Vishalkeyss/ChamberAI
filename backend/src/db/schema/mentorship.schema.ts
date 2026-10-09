import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';
import { users } from './users.schema';

/**
 * 10.1 mentorship_profiles — one row per member registered as a mentor (Prompt 05.6).
 * Authoritative schema: database/DB_tables_reference.md, 0007_networking_and_crm.sql, 0020_mentorship.sql
 */
export const mentorshipProfiles = sqliteTable('mentorship_profiles', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  bio: text('bio'),
  expertiseJson: text('expertise_json'),
  yearsExperience: integer('years_experience').notNull().default(0),
  maxMentees: integer('max_mentees').notNull().default(3),
  activeMentees: integer('active_mentees').notNull().default(0),
  rating: real('rating').notNull().default(5.0),
  ratingCount: integer('rating_count').notNull().default(0),
  sessionsCompleted: integer('sessions_completed').notNull().default(0),
  status: text('status').default('active'), // active | paused | inactive (OD-090)
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
});

/** 10.2 mentorship — request + relationship lifecycle. */
export const mentorship = sqliteTable('mentorship', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  mentorId: text('mentor_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  menteeId: text('mentee_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  requestMessage: text('request_message'),
  status: text('status').notNull(), // pending | confirmed | rejected | cancelled | completed
  requestedAt: text('requested_at').notNull().default(sql`(datetime('now'))`),
  acceptedAt: text('accepted_at'),
  completedAt: text('completed_at'),
  cancelledAt: text('cancelled_at'),
  notes: text('notes'),
  declineReason: text('decline_reason'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
});

export type MentorshipProfileRecord = typeof mentorshipProfiles.$inferSelect;
export type MentorshipRecord = typeof mentorship.$inferSelect;
