import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { platformChambers } from './platform-chambers.schema';
import { users } from './users.schema';

/**
 * 8.1 crm_contacts — private per-member CRM (Prompt 05.5).
 * Authoritative schema: database/DB_tables_reference.md, 0007_networking_and_crm.sql, 0019_crm_tasks.sql
 */
export const crmContacts = sqliteTable('crm_contacts', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  contactName: text('contact_name').notNull(),
  business: text('business'),
  email: text('email'),
  phone: text('phone'),
  stage: text('stage').default('lead'), // lead | contacted | qualified | proposal | won | lost
  dealValue: real('deal_value').notNull().default(0),
  notes: text('notes'),
  expectedCloseDate: text('expected_close_date'),
  followUpDate: text('follow_up_date'),
  linkedUserId: text('linked_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
});

/** 8.3 crm_contact_activities — interaction timeline (OD-081). */
export const crmContactActivities = sqliteTable('crm_contact_activities', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  contactId: text('contact_id')
    .notNull()
    .references(() => crmContacts.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('note'), // note | call | meeting | email | stage
  body: text('body').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

/** 8.2 tasks — personal Kanban (Prompt 05.5, rebuilt in 0019). */
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  chamberId: text('chamber_id')
    .notNull()
    .references(() => platformChambers.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  crmContactId: text('crm_contact_id').references(() => crmContacts.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('todo'), // todo | in_progress | done
  priority: text('priority').notNull().default('medium'), // low | medium | high | urgent
  dueDate: text('due_date'),
  completedAt: text('completed_at'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
});

export type CrmContactRecord = typeof crmContacts.$inferSelect;
export type TaskRecord = typeof tasks.$inferSelect;
