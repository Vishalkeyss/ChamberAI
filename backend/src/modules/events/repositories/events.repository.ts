import { drizzle } from 'drizzle-orm/d1';
import { eq, and, sql, desc, asc, like, or, inArray } from 'drizzle-orm';
import { events, chapters } from '../../../db/schema';
import type { EventsQueryParams } from '../validation/events.validation';
import {
  type EventListItem,
  type EventsListResponse,
  getEventCapacityStatus,
} from '../types/events.types';

export function sanitizeSearchQuery(query: string): string {
  return query.trim().replace(/[%_]/g, '\\$&');
}

export class EventsRepository {
  /**
   * List events with tenant isolation, timeframe partition, RBAC visibility, and facet filtering
   */
  static async listEvents(
    d1: D1Database,
    chamberId: string,
    params: EventsQueryParams,
    viewerRole: 'guest' | 'member' | 'chapter_admin' | 'full_admin' = 'guest',
    userScopeChapterId?: string | null
  ): Promise<EventsListResponse> {
    const db = drizzle(d1);
    const {
      timeframe = 'upcoming',
      category,
      city,
      chapterId: filterChapterId,
      chapter_id,
      isVirtual,
      is_virtual,
      isPaid,
      is_paid,
      q,
      page = 1,
      limit = 12,
    } = params;

    const offset = (page - 1) * limit;
    const resolvedChapterId = filterChapterId || chapter_id;
    const resolvedIsVirtual = isVirtual !== undefined ? isVirtual : is_virtual;
    const resolvedIsPaid = isPaid !== undefined ? isPaid : is_paid;

    // Base conditions: mandatory tenant isolation
    const conditions = [eq(events.chamberId, chamberId)];

    // 1. Timeframe Partition per Section 7 Business Rules:
    // Upcoming: event_date >= datetime('now') AND status = 'published' (or admin view)
    // Past: event_date < datetime('now') OR status = 'completed'
    if (timeframe === 'upcoming') {
      conditions.push(sql`${events.eventDate} >= datetime('now')`);
      if (viewerRole !== 'full_admin') {
        conditions.push(eq(events.status, 'published'));
      }
    } else {
      conditions.push(
        or(
          sql`${events.eventDate} < datetime('now')`,
          eq(events.status, 'completed')
        )!
      );
      if (viewerRole !== 'full_admin') {
        conditions.push(
          or(
            eq(events.status, 'published'),
            eq(events.status, 'completed')
          )!
        );
      }
    }

    // 2. Role-based Visibility Filter
    if (viewerRole === 'guest') {
      // Guest: only public events
      conditions.push(eq(events.visibility, 'public'));
    } else if (viewerRole === 'member') {
      // Member: public + members_only + unlisted events
      conditions.push(
        or(
          eq(events.visibility, 'public'),
          eq(events.visibility, 'members_only'),
          eq(events.visibility, 'unlisted')
        )!
      );
    } else if (viewerRole === 'chapter_admin') {
      // Chapter Admin: events scoped to their chapter OR chamber-wide (chapter_id IS NULL)
      if (userScopeChapterId) {
        conditions.push(
          or(
            eq(events.chapterId, userScopeChapterId),
            sql`${events.chapterId} IS NULL`
          )!
        );
      }
    }
    // full_admin has unrestricted access (including draft and staff_only)

    // 3. Facet Filters
    if (category && category.trim() && category !== 'Any Category' && category !== 'all') {
      conditions.push(eq(events.category, category.trim()));
    }

    if (city && city.trim() && city !== 'All Cities') {
      conditions.push(like(events.city, `%${sanitizeSearchQuery(city)}%`));
    }

    if (resolvedChapterId && resolvedChapterId.trim() && resolvedChapterId !== 'all') {
      conditions.push(eq(events.chapterId, resolvedChapterId.trim()));
    }

    if (resolvedIsVirtual !== undefined) {
      if (resolvedIsVirtual === 1) {
        conditions.push(
          or(
            sql`${events.venue} LIKE '%virtual%'`,
            sql`${events.venue} LIKE '%zoom%'`
          )!
        );
      }
    }

    if (resolvedIsPaid !== undefined) {
      conditions.push(eq(events.isPaid, resolvedIsPaid));
    }

    // Keyword Search across title, description, venue, city
    if (q && q.trim()) {
      const sanitized = sanitizeSearchQuery(q);
      conditions.push(
        or(
          like(events.title, `%${sanitized}%`),
          like(events.description, `%${sanitized}%`),
          like(events.venue, `%${sanitized}%`),
          like(events.city, `%${sanitized}%`),
          like(events.category, `%${sanitized}%`)
        )!
      );
    }

    const whereClause = and(...conditions);

    // Count Total
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(whereClause);

    const total = Number(countResult?.count || 0);

    // Order by date: upcoming ASC (soonest first), past DESC (most recent past first)
    const orderClause =
      timeframe === 'upcoming' ? asc(events.eventDate) : desc(events.eventDate);

    // Query Data with Chapter Name Join
    const rows = await db
      .select({
        event: events,
        chapterName: chapters.name,
      })
      .from(events)
      .leftJoin(chapters, eq(events.chapterId, chapters.id))
      .where(whereClause)
      .orderBy(orderClause)
      .limit(limit)
      .offset(offset);

    const data: EventListItem[] = rows.map(({ event: e, chapterName }) => {
      const isVirtualResolved =
        (e.venue && e.venue.toLowerCase().includes('virtual')) ||
        (e.venue && e.venue.toLowerCase().includes('zoom'))
          ? 1
          : 0;

      // Extract cover image from photos_json if available
      let coverImg = null;
      if (e.photosJson) {
        try {
          const photos = JSON.parse(e.photosJson);
          if (Array.isArray(photos) && photos.length > 0) {
            coverImg = photos[0];
          }
        } catch {}
      }

      const capacity = getEventCapacityStatus(e.registeredCount, e.maxCapacity);

      return {
        id: e.id,
        title: e.title,
        description: e.description,
        category: e.category,
        visibility: e.visibility,
        eventDate: e.eventDate,
        eventEndDate: e.eventEndDate,
        isAllDay: e.isAllDay,
        city: e.city,
        venue: e.venue,
        isVirtual: isVirtualResolved,
        virtualMeetingUrl: null,
        chapterId: e.chapterId,
        chapterName: chapterName || null,
        coverImageUrl: coverImg,
        registrationFee: e.registrationFee,
        nonMemberFee: e.nonMemberFee,
        isPaid: e.isPaid,
        registeredCount: e.registeredCount,
        maxCapacity: e.maxCapacity,
        status: e.status,
        isSoldOut: capacity.isSoldOut,
        spotsRemaining: capacity.spotsRemaining,
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Get dynamic filter options (categories, cities, chapters) for a chamber
   */
  static async getFilterOptions(
    d1: D1Database,
    chamberId: string
  ): Promise<{ categories: string[]; cities: string[]; chapters: { id: string; name: string }[] }> {
    const db = drizzle(d1);

    const [categoryRows, cityRows, chapterRows] = await Promise.all([
      db
        .selectDistinct({ category: events.category })
        .from(events)
        .where(and(eq(events.chamberId, chamberId), sql`${events.category} IS NOT NULL`)),
      db
        .selectDistinct({ city: events.city })
        .from(events)
        .where(and(eq(events.chamberId, chamberId), sql`${events.city} IS NOT NULL`)),
      db
        .select({ id: chapters.id, name: chapters.name })
        .from(chapters)
        .where(eq(chapters.chamberId, chamberId)),
    ]);

    const categories = Array.from(
      new Set(
        categoryRows
          .map((r) => r.category)
          .filter(Boolean) as string[]
      )
    );

    const cities = Array.from(
      new Set(
        cityRows
          .map((r) => r.city)
          .filter(Boolean) as string[]
      )
    );

    return {
      categories,
      cities,
      chapters: chapterRows,
    };
  }
}
