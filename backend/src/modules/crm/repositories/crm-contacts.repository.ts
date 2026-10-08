import { drizzle } from 'drizzle-orm/d1';
import { and, desc, eq, inArray, max, or, sql, type SQL } from 'drizzle-orm';
import { crmContacts, crmContactActivities, users } from '../../../db/schema';
import { sanitizeSearchQuery } from '../../directory/repositories/directory.repository';

/** Every CRM query is scoped to the owner AND the chamber (§11 / §12, OD-088). */
const owned = (chamberId: string, userId: string) => and(eq(crmContacts.chamberId, chamberId), eq(crmContacts.userId, userId));

export class CrmContactsRepository {
  static async list(d1: D1Database, chamberId: string, userId: string, opts: { stage?: string; search?: string }) {
    const conditions: SQL[] = [owned(chamberId, userId)!];
    if (opts.stage) conditions.push(eq(crmContacts.stage, opts.stage));
    const q = (opts.search || '').trim();
    if (q) {
      const like = `%${sanitizeSearchQuery(q)}%`;
      conditions.push(
        or(
          sql`${crmContacts.contactName} LIKE ${like} ESCAPE '\\'`,
          sql`${crmContacts.business} LIKE ${like} ESCAPE '\\'`,
          sql`${crmContacts.email} LIKE ${like} ESCAPE '\\'`
        )!
      );
    }
    return drizzle(d1)
      .select()
      .from(crmContacts)
      .where(and(...conditions))
      .orderBy(desc(crmContacts.createdAt), desc(crmContacts.id));
  }

  /** §8 per-stage count + value over ALL of the owner's contacts (not the filtered list). */
  static async stageTotals(d1: D1Database, chamberId: string, userId: string) {
    return drizzle(d1)
      .select({
        stage: crmContacts.stage,
        count: sql<number>`COUNT(*)`,
        value: sql<number>`COALESCE(SUM(${crmContacts.dealValue}), 0)`,
      })
      .from(crmContacts)
      .where(owned(chamberId, userId))
      .groupBy(crmContacts.stage);
  }

  static async find(d1: D1Database, chamberId: string, userId: string, id: string) {
    return drizzle(d1)
      .select()
      .from(crmContacts)
      .where(and(owned(chamberId, userId), eq(crmContacts.id, id)))
      .get();
  }

  static async lastInteractions(d1: D1Database, chamberId: string, userId: string, contactIds: string[]) {
    if (contactIds.length === 0) return [];
    return drizzle(d1)
      .select({ contactId: crmContactActivities.contactId, lastAt: max(crmContactActivities.createdAt) })
      .from(crmContactActivities)
      .where(
        and(
          eq(crmContactActivities.chamberId, chamberId),
          eq(crmContactActivities.userId, userId),
          inArray(crmContactActivities.contactId, contactIds)
        )
      )
      .groupBy(crmContactActivities.contactId);
  }

  static async activities(d1: D1Database, chamberId: string, userId: string, contactId: string) {
    return drizzle(d1)
      .select({
        id: crmContactActivities.id,
        type: crmContactActivities.type,
        body: crmContactActivities.body,
        createdAt: crmContactActivities.createdAt,
      })
      .from(crmContactActivities)
      .where(
        and(
          eq(crmContactActivities.chamberId, chamberId),
          eq(crmContactActivities.userId, userId),
          eq(crmContactActivities.contactId, contactId)
        )
      )
      .orderBy(desc(crmContactActivities.createdAt), desc(sql`rowid`));
  }

  /** Same-chamber active user (OD-083 linked member). */
  static async findChamberUser(d1: D1Database, chamberId: string, userId: string) {
    return drizzle(d1)
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.chamberId, chamberId), eq(users.id, userId), eq(users.status, 'active')))
      .get();
  }

  static async userNames(d1: D1Database, chamberId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    return drizzle(d1)
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.chamberId, chamberId), inArray(users.id, unique)));
  }
}
