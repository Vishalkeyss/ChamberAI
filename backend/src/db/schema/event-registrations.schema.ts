import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';
import { events } from './events.schema';
import { users } from './users.schema';
import { eventTicketTypes } from './event-ticket-types.schema';

/**
 * 5.5 event_registrations
 * Authoritative schema: database/DB_tables_reference.md & 0005_events_and_ticketing.sql
 */
export const eventRegistrations = sqliteTable('event_registrations', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  eventId: text('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  ticketTypeId: text('ticket_type_id').references(() => eventTicketTypes.id, { onDelete: 'set null' }),
  guestName: text('guest_name'),
  guestEmail: text('guest_email'),
  registrationType: text('registration_type').notNull().default('member'),
  promoCodeId: text('promo_code_id'),
  amountPaid: real('amount_paid').notNull().default(0.0),
  discountAmount: real('discount_amount').notNull().default(0.0),
  paymentStatus: text('payment_status').default('paid'),
  paymentMethodId: text('payment_method_id'),
  checkInStatus: text('check_in_status').default('not_checked_in'),
  checkedInAt: text('checked_in_at'),
  isWaitlisted: integer('is_waitlisted').notNull().default(0),
  waitlistPosition: integer('waitlist_position'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export type EventRegistrationRecord = typeof eventRegistrations.$inferSelect;
export type NewEventRegistrationRecord = typeof eventRegistrations.$inferInsert;
