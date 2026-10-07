import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';
import { events } from './events.schema';
import { users } from './users.schema';

/**
 * 5.6 event_feedback
 * Authoritative schema: database/DB_tables_reference.md & 0005_events_and_ticketing.sql
 */
export const eventFeedback = sqliteTable('event_feedback', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  eventId: text('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  starRating: integer('star_rating').notNull(),
  likedMost: text('liked_most'),
  wouldAttendAgain: integer('would_attend_again').notNull().default(1),
  suggestions: text('suggestions'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export type EventFeedbackRecord = typeof eventFeedback.$inferSelect;
export type NewEventFeedbackRecord = typeof eventFeedback.$inferInsert;
