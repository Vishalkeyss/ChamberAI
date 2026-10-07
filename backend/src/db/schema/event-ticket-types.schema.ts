import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';
import { events } from './events.schema';

/**
 * 5.2 event_ticket_types
 * Authoritative schema: database/DB_tables_reference.md & 0005_events_and_ticketing.sql
 */
export const eventTicketTypes = sqliteTable('event_ticket_types', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  eventId: text('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  price: real('price').notNull().default(0.0),
  description: text('description'),
  allowPayLater: integer('allow_pay_later').notNull().default(0),
  qtyLimit: integer('qty_limit'),
  qtySold: integer('qty_sold').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export type EventTicketTypeRecord = typeof eventTicketTypes.$inferSelect;
export type NewEventTicketTypeRecord = typeof eventTicketTypes.$inferInsert;
