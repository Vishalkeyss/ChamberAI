import { drizzle } from 'drizzle-orm/d1';
import { and, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import { mentorship, mentorshipProfiles, users } from '../../../db/schema';

type Db = ReturnType<typeof drizzle>;

/** Mentorship relationships — always chamber-scoped (§12). */
export class MentorshipRepository {
  static async find(d1: D1Database, chamberId: string, id: string) {
    return drizzle(d1)
      .select()
      .from(mentorship)
      .where(and(eq(mentorship.chamberId, chamberId), eq(mentorship.id, id)))
      .get();
  }

  /** §7 rule 2: an open (pending / active) request for this pair. */
  static async findOpenPair(d1: D1Database, chamberId: string, mentorId: string, menteeId: string) {
    return drizzle(d1)
      .select({ id: mentorship.id, status: mentorship.status })
      .from(mentorship)
      .where(
        and(
          eq(mentorship.chamberId, chamberId),
          eq(mentorship.mentorId, mentorId),
          eq(mentorship.menteeId, menteeId),
          inArray(mentorship.status, ['pending', 'confirmed'])
        )
      )
      .get();
  }

  /** Everything the user takes part in, as mentor or mentee (newest first). */
  static async listForUser(d1: D1Database, chamberId: string, userId: string) {
    return drizzle(d1)
      .select()
      .from(mentorship)
      .where(and(eq(mentorship.chamberId, chamberId), or(eq(mentorship.mentorId, userId), eq(mentorship.menteeId, userId))))
      .orderBy(desc(mentorship.createdAt), desc(mentorship.id));
  }

  /** The caller's open requests per mentor (mentor cards show "pending" / "active"). */
  static async openRequestsOf(d1: D1Database, chamberId: string, menteeId: string) {
    return drizzle(d1)
      .select({ id: mentorship.id, mentorId: mentorship.mentorId, status: mentorship.status })
      .from(mentorship)
      .where(and(eq(mentorship.chamberId, chamberId), eq(mentorship.menteeId, menteeId), inArray(mentorship.status, ['pending', 'confirmed'])));
  }

  /**
   * §7 rules 1 + 3, atomic in one batch: the request is confirmed only while the mentor is
   * active and below capacity, and the counter moves only if that exact update happened
   * (`accepted_at` = this call's timestamp).
   */
  static acceptStatements(db: Db, chamberId: string, id: string, mentorId: string, now: string) {
    return [
      db
        .update(mentorship)
        .set({ status: 'confirmed', acceptedAt: now, updatedAt: now })
        .where(
          and(
            eq(mentorship.chamberId, chamberId),
            eq(mentorship.id, id),
            eq(mentorship.status, 'pending'),
            sql`EXISTS (SELECT 1 FROM mentorship_profiles p WHERE p.chamber_id = ${chamberId} AND p.user_id = ${mentorId}
                AND p.status = 'active' AND p.active_mentees < p.max_mentees)`
          )
        ),
      db
        .update(mentorshipProfiles)
        .set({ activeMentees: sql`${mentorshipProfiles.activeMentees} + 1`, updatedAt: now })
        .where(
          and(
            eq(mentorshipProfiles.chamberId, chamberId),
            eq(mentorshipProfiles.userId, mentorId),
            sql`EXISTS (SELECT 1 FROM mentorship m WHERE m.id = ${id} AND m.status = 'confirmed' AND m.accepted_at = ${now})`
          )
        ),
    ] as const;
  }

  /** §7 rule 3: completion frees a slot (floor 0) — counter only moves if this call completed it. Optional mentee rating (OD-096). */
  static completeStatements(db: Db, chamberId: string, id: string, mentorId: string, now: string, rating: number | null) {
    const completedNow = sql`EXISTS (SELECT 1 FROM mentorship m WHERE m.id = ${id} AND m.status = 'completed' AND m.completed_at = ${now})`;
    const profilePatch: Record<string, unknown> = {
      activeMentees: sql`MAX(${mentorshipProfiles.activeMentees} - 1, 0)`,
      updatedAt: now,
    };
    if (rating) {
      profilePatch.rating = sql`CASE WHEN ${mentorshipProfiles.ratingCount} = 0 THEN ${rating}
        ELSE ROUND((${mentorshipProfiles.rating} * ${mentorshipProfiles.ratingCount} + ${rating}) * 1.0 / (${mentorshipProfiles.ratingCount} + 1), 2) END`;
      profilePatch.ratingCount = sql`${mentorshipProfiles.ratingCount} + 1`;
    }
    return [
      db
        .update(mentorship)
        .set({ status: 'completed', completedAt: now, updatedAt: now })
        .where(and(eq(mentorship.chamberId, chamberId), eq(mentorship.id, id), eq(mentorship.status, 'confirmed'))),
      db
        .update(mentorshipProfiles)
        .set(profilePatch)
        .where(and(eq(mentorshipProfiles.chamberId, chamberId), eq(mentorshipProfiles.userId, mentorId), completedNow)),
    ] as const;
  }

  /** pending → rejected / cancelled (conditional: no lost updates). */
  static async closePending(d1: D1Database, chamberId: string, id: string, status: 'rejected' | 'cancelled', now: string, declineReason?: string | null) {
    const patch: Partial<typeof mentorship.$inferInsert> = { status, updatedAt: now };
    if (status === 'rejected') patch.declineReason = declineReason || null;
    if (status === 'cancelled') patch.cancelledAt = now;
    const res = await drizzle(d1)
      .update(mentorship)
      .set(patch)
      .where(and(eq(mentorship.chamberId, chamberId), eq(mentorship.id, id), eq(mentorship.status, 'pending')))
      .run();
    return Number((res as any)?.meta?.changes ?? 0) > 0;
  }

  /** OD-098 admin overview: relationships in the chamber, optionally limited to a chapter's members. */
  static async adminList(d1: D1Database, chamberId: string, chapterId: string | null) {
    const conditions: SQL[] = [eq(mentorship.chamberId, chamberId)];
    if (chapterId) {
      const chapterUsers = drizzle(d1)
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.chamberId, chamberId), eq(users.primaryChapterId, chapterId)));
      conditions.push(or(inArray(mentorship.mentorId, chapterUsers), inArray(mentorship.menteeId, chapterUsers))!);
    }
    return drizzle(d1)
      .select()
      .from(mentorship)
      .where(and(...conditions))
      .orderBy(desc(mentorship.createdAt), desc(mentorship.id));
  }

  static async adminMentors(d1: D1Database, chamberId: string, chapterId: string | null) {
    const conditions: SQL[] = [eq(mentorshipProfiles.chamberId, chamberId), eq(users.chamberId, chamberId), inArray(mentorshipProfiles.status, ['active', 'paused'])];
    if (chapterId) conditions.push(eq(users.primaryChapterId, chapterId));
    return drizzle(d1)
      .select({ profile: mentorshipProfiles, name: users.name, email: users.email })
      .from(mentorshipProfiles)
      .innerJoin(users, eq(mentorshipProfiles.userId, users.id))
      .where(and(...conditions));
  }
}
