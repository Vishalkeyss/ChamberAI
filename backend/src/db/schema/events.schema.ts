import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';
import { chapters } from './chapters.schema';
import { users } from './users.schema';

/**
 * 5.1 events
 * Authoritative schema: database/DB_tables_reference.md & 0005_events_and_ticketing.sql
 */
export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category'),
  visibility: text('visibility').default('public'),
  eventDate: text('event_date').notNull(),
  eventEndDate: text('event_end_date'),
  isAllDay: integer('is_all_day').notNull().default(0),
  isRecurring: integer('is_recurring').notNull().default(0),
  recurrenceRuleJson: text('recurrence_rule_json'),
  parentEventId: text('parent_event_id'),
  city: text('city'),
  venue: text('venue'),
  chapterId: text('chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
  groupId: text('group_id'),
  tableArrangement: text('table_arrangement'),
  numTables: integer('num_tables'),
  maxCapacity: integer('max_capacity'),
  registrationFee: real('registration_fee').notNull().default(0.0),
  nonMemberFee: real('non_member_fee'),
  isPaid: integer('is_paid').notNull().default(0),
  allowNonMemberRegistration: integer('allow_non_member_registration').notNull().default(1),
  promoteFacebook: integer('promote_facebook').notNull().default(0),
  promoteMeetup: integer('promote_meetup').notNull().default(0),
  promoteEventbrite: integer('promote_eventbrite').notNull().default(0),
  googleCalendarLink: text('google_calendar_link'),
  photosJson: text('photos_json'),
  videoUrl: text('video_url'),
  status: text('status').default('draft'),
  registeredCount: integer('registered_count').notNull().default(0),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  publishedAt: text('published_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
});

export type EventRecord = typeof events.$inferSelect;
export type NewEventRecord = typeof events.$inferInsert;
