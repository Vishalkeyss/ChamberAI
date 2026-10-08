import { sqliteTable, text, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';
import { users } from './users.schema';
import { events } from './events.schema';

/**
 * invoices
 * Authoritative schema: database/DB_tables_reference.md & 0006_billing_and_invoices.sql
 */
export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  invoiceNumber: text('invoice_number').notNull().unique(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  invoiceType: text('invoice_type').notNull(),
  description: text('description'),
  amount: real('amount').notNull().default(0.0),
  taxAmount: real('tax_amount').notNull().default(0.0),
  discountAmount: real('discount_amount').notNull().default(0.0),
  totalAmount: real('total_amount').notNull().default(0.0),
  // Callers pass the chamber's chamber_settings.default_currency; the DB default mirrors the migration.
  currency: text('currency').notNull().default(sql`'USD'`),
  status: text('status').default('unpaid'),
  dueDate: text('due_date').notNull(),
  paidAt: text('paid_at'),
  paymentMethodId: text('payment_method_id'),
  paymentGatewayTxnId: text('payment_gateway_txn_id'),
  relatedEventId: text('related_event_id').references(() => events.id, { onDelete: 'set null' }),
  relatedOrderId: text('related_order_id'),
  relatedPlanId: text('related_plan_id'),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
});

export type InvoiceRecord = typeof invoices.$inferSelect;
