import { drizzle } from 'drizzle-orm/d1';
import { and, asc, desc, eq, type SQL } from 'drizzle-orm';
import { tasks, crmContacts } from '../../../db/schema';

const owned = (chamberId: string, userId: string) => and(eq(tasks.chamberId, chamberId), eq(tasks.userId, userId));

export class TasksRepository {
  /** §9.4 — owner's tasks with the linked contact's name (only when that contact is also theirs). */
  static async list(d1: D1Database, chamberId: string, userId: string, opts: { status?: string; priority?: string }) {
    const conditions: SQL[] = [owned(chamberId, userId)!];
    if (opts.status) conditions.push(eq(tasks.status, opts.status));
    if (opts.priority) conditions.push(eq(tasks.priority, opts.priority));
    return drizzle(d1)
      .select({ task: tasks, contactName: crmContacts.contactName })
      .from(tasks)
      .leftJoin(
        crmContacts,
        and(eq(crmContacts.id, tasks.crmContactId), eq(crmContacts.chamberId, chamberId), eq(crmContacts.userId, userId))
      )
      .where(and(...conditions))
      .orderBy(asc(tasks.sortOrder), desc(tasks.createdAt), desc(tasks.id));
  }

  static async find(d1: D1Database, chamberId: string, userId: string, id: string) {
    return drizzle(d1)
      .select()
      .from(tasks)
      .where(and(owned(chamberId, userId), eq(tasks.id, id)))
      .get();
  }

  /** A task may only link to one of the owner's own CRM contacts. */
  static async findOwnContact(d1: D1Database, chamberId: string, userId: string, contactId: string) {
    return drizzle(d1)
      .select({ id: crmContacts.id, name: crmContacts.contactName })
      .from(crmContacts)
      .where(and(eq(crmContacts.chamberId, chamberId), eq(crmContacts.userId, userId), eq(crmContacts.id, contactId)))
      .get();
  }
}
