import { drizzle } from 'drizzle-orm/d1';
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import {
  events,
  eventTicketTypes,
  eventSponsorshipTiers,
  eventSponsors,
  eventPromoCodes,
  eventRegistrations,
  chapters,
  groups,
  platformChambers,
} from '../../../db/schema';
import type { EventRecord } from '../../../db/schema/events.schema';

/**
 * Prompt 04.6 — read-side queries for the admin event wizard. Every query is
 * bound to chamber_id (tenant isolation).
 */
export class EventsAdminRepository {
  static async findEvent(d1: D1Database, chamberId: string, eventId: string): Promise<EventRecord | null> {
    const db = drizzle(d1);
    return (
      (await db
        .select()
        .from(events)
        .where(and(eq(events.chamberId, chamberId), eq(events.id, eventId)))
        .get()) || null
    );
  }

  /** Root id of the recurring series an event belongs to, or null for standalone events. */
  static seriesRootId(event: EventRecord): string | null {
    if (event.parentEventId) return event.parentEventId;
    return event.isRecurring ? event.id : null;
  }

  static async findSeries(d1: D1Database, chamberId: string, rootId: string): Promise<EventRecord[]> {
    const db = drizzle(d1);
    return db
      .select()
      .from(events)
      .where(and(eq(events.chamberId, chamberId), or(eq(events.id, rootId), eq(events.parentEventId, rootId))))
      .orderBy(asc(events.eventDate));
  }

  static async children(d1: D1Database, chamberId: string, eventIds: string[]) {
    const db = drizzle(d1);
    if (!eventIds.length) return { tickets: [], tiers: [], promos: [], sponsorCounts: new Map<string, number>() };
    const [tickets, tiers, promos, sponsorRows] = await Promise.all([
      db
        .select()
        .from(eventTicketTypes)
        .where(and(eq(eventTicketTypes.chamberId, chamberId), inArray(eventTicketTypes.eventId, eventIds)))
        .orderBy(asc(eventTicketTypes.createdAt)),
      db
        .select()
        .from(eventSponsorshipTiers)
        .where(and(eq(eventSponsorshipTiers.chamberId, chamberId), inArray(eventSponsorshipTiers.eventId, eventIds)))
        .orderBy(asc(eventSponsorshipTiers.sortOrder)),
      db
        .select()
        .from(eventPromoCodes)
        .where(and(eq(eventPromoCodes.chamberId, chamberId), inArray(eventPromoCodes.eventId, eventIds)))
        .orderBy(asc(eventPromoCodes.createdAt)),
      db
        .select({ tierId: eventSponsors.tierId, count: sql<number>`count(*)` })
        .from(eventSponsors)
        .where(and(eq(eventSponsors.chamberId, chamberId), inArray(eventSponsors.eventId, eventIds)))
        .groupBy(eventSponsors.tierId),
    ]);
    const sponsorCounts = new Map<string, number>();
    for (const r of sponsorRows) if (r.tierId) sponsorCounts.set(r.tierId, Number(r.count));
    return { tickets, tiers, promos, sponsorCounts };
  }

  static async registrationCount(d1: D1Database, chamberId: string, eventId: string): Promise<number> {
    const db = drizzle(d1);
    const row = await db
      .select({ count: sql<number>`count(*)` })
      .from(eventRegistrations)
      .where(and(eq(eventRegistrations.chamberId, chamberId), eq(eventRegistrations.eventId, eventId)))
      .get();
    return Number(row?.count || 0);
  }

  static async chapterExists(d1: D1Database, chamberId: string, chapterId: string): Promise<boolean> {
    const db = drizzle(d1);
    return !!(await db
      .select({ id: chapters.id })
      .from(chapters)
      .where(and(eq(chapters.chamberId, chamberId), eq(chapters.id, chapterId)))
      .get());
  }

  static async groupExists(d1: D1Database, chamberId: string, groupId: string): Promise<boolean> {
    const db = drizzle(d1);
    return !!(await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.chamberId, chamberId), eq(groups.id, groupId)))
      .get());
  }

  /** Dropdown data for the wizard, all from the chamber's own records. */
  static async formOptions(d1: D1Database, chamberId: string, onlyChapterId: string | null) {
    const db = drizzle(d1);
    const [chapterRows, groupRows, categoryRows, cityRows, chamber] = await Promise.all([
      db
        .select({ id: chapters.id, name: chapters.name })
        .from(chapters)
        .where(
          and(
            eq(chapters.chamberId, chamberId),
            onlyChapterId ? eq(chapters.id, onlyChapterId) : eq(chapters.status, 'active')
          )
        )
        .orderBy(asc(chapters.name)),
      db
        .select({ id: groups.id, name: groups.name })
        .from(groups)
        .where(eq(groups.chamberId, chamberId))
        .orderBy(asc(groups.name)),
      db
        .selectDistinct({ value: events.category })
        .from(events)
        .where(and(eq(events.chamberId, chamberId), sql`${events.category} IS NOT NULL AND trim(${events.category}) != ''`))
        .orderBy(asc(events.category)),
      db
        .selectDistinct({ value: events.city })
        .from(events)
        .where(and(eq(events.chamberId, chamberId), sql`${events.city} IS NOT NULL AND trim(${events.city}) != ''`))
        .orderBy(asc(events.city)),
      db.select({ city: platformChambers.city }).from(platformChambers).where(eq(platformChambers.id, chamberId)).get(),
    ]);
    const cities = new Set<string>();
    if (chamber?.city) cities.add(chamber.city);
    for (const r of cityRows) if (r.value) cities.add(r.value);
    return {
      chapters: chapterRows,
      groups: groupRows,
      categories: categoryRows.map((r) => r.value as string),
      cities: [...cities],
      defaultCity: chamber?.city || null,
    };
  }
}
