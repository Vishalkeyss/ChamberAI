import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import { events, eventFeedback, eventRegistrations, users } from '../../../db/schema';

/**
 * Prompt 04.5 — data access for post-event feedback & certificates. Every query is chamber-scoped.
 */
export class EventFeedbackRepository {
  static async findEvent(d1: D1Database, chamberId: string, eventId: string) {
    return drizzle(d1)
      .select()
      .from(events)
      .where(and(eq(events.chamberId, chamberId), eq(events.id, eventId)))
      .get();
  }

  /** §11: the member's checked-in registration for the event, or undefined. */
  static async findCheckedInRegistration(d1: D1Database, chamberId: string, eventId: string, userId: string) {
    return drizzle(d1)
      .select({ id: eventRegistrations.id, checkedInAt: eventRegistrations.checkedInAt })
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.chamberId, chamberId),
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.userId, userId),
          // OD-036: the spec's `is_checked_in = 1` is `check_in_status = 'checked_in'` in the canonical schema.
          eq(eventRegistrations.checkInStatus, 'checked_in')
        )
      )
      .get();
  }

  static async findFeedback(d1: D1Database, chamberId: string, eventId: string, userId: string) {
    return drizzle(d1)
      .select({ id: eventFeedback.id, starRating: eventFeedback.starRating, createdAt: eventFeedback.createdAt })
      .from(eventFeedback)
      .where(
        and(eq(eventFeedback.chamberId, chamberId), eq(eventFeedback.eventId, eventId), eq(eventFeedback.userId, userId))
      )
      .get();
  }

  static async findUser(d1: D1Database, chamberId: string, userId: string) {
    return drizzle(d1)
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.chamberId, chamberId), eq(users.id, userId)))
      .get();
  }

  static async chamberBranding(d1: D1Database, chamberId: string) {
    return d1
      .prepare(
        `SELECT s.org_name AS orgName, s.logo_url AS logoUrl, s.timezone AS timezone, c.name AS chamberName
         FROM platform_chambers c LEFT JOIN chamber_settings s ON s.chamber_id = c.id
         WHERE c.id = ? LIMIT 1`
      )
      .bind(chamberId)
      .first<{ orgName: string | null; logoUrl: string | null; timezone: string | null; chamberName: string }>();
  }
}
