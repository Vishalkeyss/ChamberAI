import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { activityLogs, mentorship, mentorshipProfiles, notifications } from '../../../db/schema';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { newId } from '../../../core/shared/ids';
import { NetworkMembersRepository, type NetworkMemberCard } from '../../networking/repositories/network-members.repository';
import { MentorshipProfilesRepository } from '../repositories/mentorship-profiles.repository';
import { MentorshipRepository } from '../repositories/mentorship.repository';
import {
  statusFromDb,
  type CreateMentorshipRequestInput,
  type ReviewMentorshipRequestInput,
  type UpdateMentorProfileInput,
} from '../validation/mentorship.validation';

type Db = ReturnType<typeof drizzle>;
type ProfileRow = NonNullable<Awaited<ReturnType<typeof MentorshipProfilesRepository.findByUser>>>;
type MentorshipRow = NonNullable<Awaited<ReturnType<typeof MentorshipRepository.find>>>;

export const CAPACITY_MESSAGE = 'This mentor has reached maximum capacity.';

function parseTags(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

/** Case-insensitive de-duplication, first spelling wins. */
function uniqueTags(tags: string[]): string[] {
  const seen = new Map<string, string>();
  for (const t of tags) {
    const k = t.trim().toLowerCase();
    if (k && !seen.has(k)) seen.set(k, t.trim());
  }
  return [...seen.values()];
}

/** §8 Available = is_mentor ∧ is_available ∧ active < max. */
const isAvailable = (p: ProfileRow) => p.status === 'active' && p.activeMentees < p.maxMentees;

const batch = (db: Db, statements: BatchItem<'sqlite'>[]) => db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);

/** Prompt 05.6 — Chamber Mentorship Program. */
export class MentorshipService {
  /** Caller must be an active user of the request chamber (blocks cross-tenant / platform sessions). */
  private static async requireUser(d1: D1Database, chamberId: string, userId: string) {
    const me = await NetworkMembersRepository.findActiveUser(d1, chamberId, userId);
    if (!me) throw new AppError(ErrorCodes.FORBIDDEN, 'Only active chamber members can use mentorship', 403);
    return me;
  }

  private static displayName(u: { name: string | null; email: string }) {
    return u.name?.trim() || u.email;
  }

  private static profileDto(p: ProfileRow | undefined) {
    if (!p || p.status === 'inactive') {
      return {
        id: p?.id ?? null,
        is_mentor: false,
        is_mentee: true,
        expertise_areas: p ? parseTags(p.expertiseJson) : [],
        years_of_experience: p?.yearsExperience ?? 0,
        bio: p?.bio ?? null,
        max_mentees: p?.maxMentees ?? 3,
        active_mentees_count: p?.activeMentees ?? 0,
        is_available: false,
        rating: null,
        rating_count: 0,
      };
    }
    return {
      id: p.id,
      is_mentor: true,
      is_mentee: true,
      expertise_areas: parseTags(p.expertiseJson),
      years_of_experience: p.yearsExperience,
      bio: p.bio,
      max_mentees: p.maxMentees,
      active_mentees_count: p.activeMentees,
      is_available: p.status === 'active',
      // OD-096: no rating shown until someone has rated.
      rating: p.ratingCount > 0 ? p.rating : null,
      rating_count: p.ratingCount,
    };
  }

  /** Random log / notification ids (no uniqueness round-trip). */
  private static logId(d1: D1Database, table: 'activity_logs' | 'notifications', chamberId: string) {
    return newId(d1, table, table === 'notifications' ? 'NTF' : 'ACT', { chamberId, suffixLength: 6, skipUniqueCheck: true });
  }

  /** Sync on purpose: an async function returning a Drizzle builder would execute it (thenable). */
  private static audit(db: Db, id: string, chamberId: string, userId: string, action: string, targetId: string, details?: object) {
    return db.insert(activityLogs).values({
      id,
      chamberId,
      userId,
      action,
      targetType: 'mentorship',
      targetId,
      detailsJson: details ? JSON.stringify(details) : null,
    });
  }

  /** OD-100 in-app notification. */
  private static notify(db: Db, id: string, chamberId: string, userId: string, type: string, title: string, message: string, tab: string) {
    return db.insert(notifications).values({
      id,
      chamberId,
      userId,
      type,
      title,
      message,
      actionUrl: `/portal/mentorship?tab=${tab}`,
    });
  }

  private static connectionDto(row: MentorshipRow, userId: string, cards: Map<string, NetworkMemberCard>) {
    const role = row.mentorId === userId ? 'mentor' : 'mentee';
    const status = statusFromDb(row.status);
    return {
      id: row.id,
      chamber_id: row.chamberId,
      role,
      mentor_id: row.mentorId,
      mentor_name: cards.get(row.mentorId)?.name,
      mentee_id: row.menteeId,
      mentee_name: cards.get(row.menteeId)?.name,
      partner: cards.get(role === 'mentor' ? row.menteeId : row.mentorId) || null,
      status,
      request_message: row.requestMessage,
      decline_reason: row.declineReason,
      notes: row.notes,
      start_date: row.acceptedAt,
      end_date: row.completedAt || row.cancelledAt,
      created_at: row.createdAt,
    };
  }

  /** §9.1 GET /mentorship/mentors (+ meta filters, caller's own open requests). */
  static async mentors(d1: D1Database, chamberId: string, userId: string, opts: { search?: string; expertise?: string; industry?: string; available?: boolean }) {
    await this.requireUser(d1, chamberId, userId);
    const [rows, open, sources] = await Promise.all([
      MentorshipProfilesRepository.listMentors(d1, chamberId, userId, {
        search: opts.search?.slice(0, 100),
        expertise: opts.expertise?.slice(0, 50),
        industry: opts.industry?.slice(0, 100),
      }),
      MentorshipRepository.openRequestsOf(d1, chamberId, userId),
      MentorshipProfilesRepository.filterSources(d1, chamberId),
    ]);
    const cards = await NetworkMembersRepository.memberCards(d1, chamberId, rows.map((r) => r.profile.userId));
    const openBy = new Map(open.map((o) => [o.mentorId, { id: o.id, status: statusFromDb(o.status) }]));

    const data = rows
      .map(({ profile, name, email, avatarUrl }) => {
        const card = cards.get(profile.userId);
        return {
          user_id: profile.userId,
          name: name?.trim() || email,
          // No member job title column yet (BUG-034 / OD-071).
          title: null,
          business_name: card?.companyName ?? null,
          industry: card?.industry ?? null,
          avatar_url: avatarUrl,
          expertise_areas: parseTags(profile.expertiseJson),
          years_of_experience: profile.yearsExperience,
          bio: profile.bio,
          active_mentees_count: profile.activeMentees,
          max_mentees: profile.maxMentees,
          is_available: isAvailable(profile),
          rating: profile.ratingCount > 0 ? profile.rating : null,
          rating_count: profile.ratingCount,
          my_request: openBy.get(profile.userId) || null,
        };
      })
      .filter((m) => !opts.available || m.is_available);

    const expertise = uniqueTags(sources.tagJson.flatMap(parseTags)).sort((a, b) => a.localeCompare(b));
    const industries = [...new Set(sources.industries)].sort((a, b) => a.localeCompare(b));
    return { data, filters: { expertise, industries } };
  }

  /** GET /mentorship/profile — the caller's own mentor profile (defaults when never registered). */
  static async getProfile(d1: D1Database, chamberId: string, userId: string) {
    await this.requireUser(d1, chamberId, userId);
    return this.profileDto(await MentorshipProfilesRepository.findByUser(d1, chamberId, userId));
  }

  /** PUT /mentorship/profile — §10 UpdateMentorProfileSchema; instant, no review (OD-102). */
  static async updateProfile(d1: D1Database, chamberId: string, userId: string, input: UpdateMentorProfileInput) {
    await this.requireUser(d1, chamberId, userId);
    const existing = await MentorshipProfilesRepository.findByUser(d1, chamberId, userId);
    const status = !input.is_mentor ? 'inactive' : input.is_available ? 'active' : 'paused';
    const tags = uniqueTags(input.expertise_areas);
    if (input.is_mentor && tags.length === 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Add at least one expertise area', 422);
    }
    if (!existing && !input.is_mentor) return this.profileDto(undefined);

    const now = new Date().toISOString();
    const values = {
      bio: input.bio?.trim() || null,
      expertiseJson: JSON.stringify(tags),
      yearsExperience: input.years_of_experience,
      maxMentees: input.max_mentees,
      status,
      updatedAt: now,
    };
    const db = drizzle(d1);
    if (existing) {
      await db
        .update(mentorshipProfiles)
        .set(values)
        .where(and(eq(mentorshipProfiles.chamberId, chamberId), eq(mentorshipProfiles.userId, userId)))
        .run();
    } else {
      const id = await newId(d1, 'mentorship_profiles', 'MENP', { chamberId });
      await db.insert(mentorshipProfiles).values({ id, chamberId, userId, ...values, createdAt: now }).run();
    }
    return this.profileDto(await MentorshipProfilesRepository.findByUser(d1, chamberId, userId));
  }

  /** GET /mentorship/connections — every request / relationship the caller is part of + stats. */
  static async connections(d1: D1Database, chamberId: string, userId: string) {
    await this.requireUser(d1, chamberId, userId);
    const rows = await MentorshipRepository.listForUser(d1, chamberId, userId);
    const cards = await NetworkMembersRepository.memberCards(d1, chamberId, rows.flatMap((r) => [r.mentorId, r.menteeId]));
    const items = rows.map((r) => this.connectionDto(r, userId, cards));
    return {
      connections: items,
      stats: {
        pending_incoming: items.filter((i) => i.status === 'pending' && i.role === 'mentor').length,
        pending_outgoing: items.filter((i) => i.status === 'pending' && i.role === 'mentee').length,
        active: items.filter((i) => i.status === 'accepted').length,
        completed: items.filter((i) => i.status === 'completed').length,
      },
    };
  }

  /** §9.2 POST /mentorship/requests */
  static async request(d1: D1Database, chamberId: string, userId: string, input: CreateMentorshipRequestInput) {
    const me = await this.requireUser(d1, chamberId, userId);
    if (input.mentor_id === userId) throw new AppError(ErrorCodes.BAD_REQUEST, 'You cannot request mentorship from yourself', 400);

    // §12 / test 4: a mentor outside this chamber is never reachable (403, without revealing whether they exist).
    const mentor = await NetworkMembersRepository.findActiveUser(d1, chamberId, input.mentor_id);
    if (!mentor) throw new AppError(ErrorCodes.FORBIDDEN, 'This mentor is not available in your chamber', 403);
    const profile = await MentorshipProfilesRepository.findByUser(d1, chamberId, input.mentor_id);
    if (!profile || profile.status === 'inactive') throw new AppError(ErrorCodes.NOT_FOUND, 'Mentor not found', 404);

    if (await MentorshipRepository.findOpenPair(d1, chamberId, input.mentor_id, userId)) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'You already have a pending or active mentorship with this mentor', 400);
    }
    // §7 rule 1 (OD-103).
    if (profile.status !== 'active') throw new AppError(ErrorCodes.CONFLICT, 'This mentor is not accepting new requests right now.', 409);
    if (profile.activeMentees >= profile.maxMentees) throw new AppError(ErrorCodes.CONFLICT, CAPACITY_MESSAGE, 409);

    const db = drizzle(d1);
    const id = await newId(d1, 'mentorship', 'MENT', { chamberId });
    const now = new Date().toISOString();
    try {
      await batch(db, [
        db.insert(mentorship).values({
          id,
          chamberId,
          mentorId: input.mentor_id,
          menteeId: userId,
          requestMessage: input.request_message,
          status: 'pending',
          requestedAt: now,
          createdAt: now,
          updatedAt: now,
        }),
        this.notify(db, await this.logId(d1, 'notifications', chamberId), chamberId, input.mentor_id, 'mentorship_request', `New mentorship request from ${this.displayName(me)}`, input.request_message.slice(0, 140), 'requests'),
        this.audit(db, await this.logId(d1, 'activity_logs', chamberId), chamberId, userId, 'MENTORSHIP_REQUESTED', id, { mentor_id: input.mentor_id }),
      ]);
    } catch (err: any) {
      // Unique open-pair index (0020) — a concurrent duplicate lost the race.
      if (/UNIQUE/i.test(String(err?.message || err?.cause?.message || ''))) {
        throw new AppError(ErrorCodes.BAD_REQUEST, 'You already have a pending or active mentorship with this mentor', 400);
      }
      throw err;
    }
    return { id, mentor_id: input.mentor_id, status: 'pending' as const, created_at: now };
  }

  /** §9.3 PATCH /mentorship/requests/:id — accept / decline (mentor), cancel (mentee), complete (either, OD-091). */
  static async review(d1: D1Database, chamberId: string, userId: string, id: string, input: ReviewMentorshipRequestInput) {
    const me = await this.requireUser(d1, chamberId, userId);
    const row = await MentorshipRepository.find(d1, chamberId, id);
    // Other members' relationships are indistinguishable from missing ones.
    if (!row || (row.mentorId !== userId && row.menteeId !== userId)) throw new AppError(ErrorCodes.NOT_FOUND, 'Mentorship request not found', 404);
    const isMentor = row.mentorId === userId;
    const other = isMentor ? row.menteeId : row.mentorId;
    const myName = this.displayName(me);
    const db = drizzle(d1);
    const now = new Date().toISOString();

    const requirePending = () => {
      if (row.status !== 'pending') throw new AppError(ErrorCodes.CONFLICT, 'This request has already been handled', 409);
    };

    switch (input.action) {
      case 'accept': {
        if (!isMentor) throw new AppError(ErrorCodes.FORBIDDEN, 'Only the mentor can accept this request', 403);
        requirePending();
        await batch(db, [...MentorshipRepository.acceptStatements(db, chamberId, id, row.mentorId, now)]);
        const after = await MentorshipRepository.find(d1, chamberId, id);
        if (after?.status !== 'confirmed' || after.acceptedAt !== now) {
          if (after?.status === 'pending') {
            const profile = await MentorshipProfilesRepository.findByUser(d1, chamberId, row.mentorId);
            throw new AppError(
              ErrorCodes.CONFLICT,
              profile?.status === 'active' ? CAPACITY_MESSAGE : 'Set your mentor profile to available before accepting requests.',
              409
            );
          }
          throw new AppError(ErrorCodes.CONFLICT, 'This request has already been handled', 409);
        }
        await batch(db, [
          this.notify(db, await this.logId(d1, 'notifications', chamberId), chamberId, other, 'mentorship_accepted', `${myName} accepted your mentorship request`, 'Your mentorship is now active.', 'requests'),
          this.audit(db, await this.logId(d1, 'activity_logs', chamberId), chamberId, userId, 'MENTORSHIP_ACCEPTED', id, { mentee_id: row.menteeId }),
        ]);
        return { id, status: 'accepted' as const, start_date: now };
      }
      case 'decline': {
        if (!isMentor) throw new AppError(ErrorCodes.FORBIDDEN, 'Only the mentor can decline this request', 403);
        requirePending();
        if (!(await MentorshipRepository.closePending(d1, chamberId, id, 'rejected', now, input.decline_reason))) throw new AppError(ErrorCodes.CONFLICT, 'This request has already been handled', 409);
        await batch(db, [
          this.notify(
            db, await this.logId(d1, 'notifications', chamberId), chamberId, other, 'mentorship_declined', `${myName} declined your mentorship request`,
            input.decline_reason?.trim() || 'The mentor is not able to take this request.', 'requests'
          ),
        ]);
        return { id, status: 'declined' as const, decline_reason: input.decline_reason?.trim() || null };
      }
      case 'cancel': {
        if (isMentor) throw new AppError(ErrorCodes.FORBIDDEN, 'Only the requesting member can withdraw this request', 403);
        requirePending();
        if (!(await MentorshipRepository.closePending(d1, chamberId, id, 'cancelled', now))) throw new AppError(ErrorCodes.CONFLICT, 'This request has already been handled', 409);
        await batch(db, [
          this.notify(db, await this.logId(d1, 'notifications', chamberId), chamberId, other, 'mentorship_cancelled', `${myName} withdrew their mentorship request`, 'The request was cancelled.', 'requests'),
        ]);
        return { id, status: 'cancelled' as const, end_date: now };
      }
      case 'complete': {
        if (row.status !== 'confirmed') throw new AppError(ErrorCodes.CONFLICT, 'Only an active mentorship can be completed', 409);
        if (input.rating && isMentor) throw new AppError(ErrorCodes.BAD_REQUEST, 'Only the mentee can rate the mentorship', 400);
        await batch(db, [...MentorshipRepository.completeStatements(db, chamberId, id, row.mentorId, now, input.rating ?? null)]);
        const after = await MentorshipRepository.find(d1, chamberId, id);
        if (after?.status !== 'completed' || after.completedAt !== now) {
          throw new AppError(ErrorCodes.CONFLICT, 'Only an active mentorship can be completed', 409);
        }
        await batch(db, [
          this.notify(db, await this.logId(d1, 'notifications', chamberId), chamberId, other, 'mentorship_completed', `${myName} ended your mentorship`, 'The mentorship has been marked as completed.', 'requests'),
          this.audit(db, await this.logId(d1, 'activity_logs', chamberId), chamberId, userId, 'MENTORSHIP_COMPLETED', id, { rating: input.rating ?? null }),
        ]);
        return { id, status: 'completed' as const, end_date: now };
      }
    }
  }

  /** OD-095: shared session notes on an active mentorship (either party). */
  static async updateNotes(d1: D1Database, chamberId: string, userId: string, id: string, notes: string | null) {
    await this.requireUser(d1, chamberId, userId);
    const row = await MentorshipRepository.find(d1, chamberId, id);
    if (!row || (row.mentorId !== userId && row.menteeId !== userId)) throw new AppError(ErrorCodes.NOT_FOUND, 'Mentorship not found', 404);
    if (row.status !== 'confirmed') throw new AppError(ErrorCodes.CONFLICT, 'Notes can only be edited on an active mentorship', 409);
    const now = new Date().toISOString();
    const value = notes?.trim() ? notes : null;
    await drizzle(d1)
      .update(mentorship)
      .set({ notes: value, updatedAt: now })
      .where(and(eq(mentorship.chamberId, chamberId), eq(mentorship.id, id)))
      .run();
    return { id, notes: value, updated_at: now };
  }

  /** OD-098 admin program overview: full_admin chamber-wide, chapter_admin limited to own chapter's members. */
  static async adminOverview(d1: D1Database, chamberId: string, chapterId: string | null) {
    const [rows, mentors] = await Promise.all([
      MentorshipRepository.adminList(d1, chamberId, chapterId),
      MentorshipRepository.adminMentors(d1, chamberId, chapterId),
    ]);
    const cards = await NetworkMembersRepository.memberCards(d1, chamberId, rows.flatMap((r) => [r.mentorId, r.menteeId]));
    const count = (s: string) => rows.filter((r) => r.status === s).length;
    return {
      kpis: {
        mentors: mentors.length,
        available_mentors: mentors.filter((m) => isAvailable(m.profile)).length,
        pending_requests: count('pending'),
        active_pairs: count('confirmed'),
        completed: count('completed'),
        declined: count('rejected'),
      },
      mentors: mentors
        .map((m) => ({
          user_id: m.profile.userId,
          name: m.name?.trim() || m.email,
          status: m.profile.status,
          expertise_areas: parseTags(m.profile.expertiseJson),
          active_mentees_count: m.profile.activeMentees,
          max_mentees: m.profile.maxMentees,
          rating: m.profile.ratingCount > 0 ? m.profile.rating : null,
          rating_count: m.profile.ratingCount,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      pairs: rows.map((r) => ({
        id: r.id,
        mentor: cards.get(r.mentorId) || null,
        mentee: cards.get(r.menteeId) || null,
        status: statusFromDb(r.status),
        requested_at: r.requestedAt,
        start_date: r.acceptedAt,
        end_date: r.completedAt || r.cancelledAt,
      })),
    };
  }

  /** OD-098 profile moderation (full_admin): pause / re-activate a mentor. */
  static async adminSetMentorStatus(d1: D1Database, chamberId: string, adminId: string, mentorUserId: string, status: 'active' | 'paused') {
    const profile = await MentorshipProfilesRepository.findByUser(d1, chamberId, mentorUserId);
    if (!profile || profile.status === 'inactive') throw new AppError(ErrorCodes.NOT_FOUND, 'Mentor not found', 404);
    const db = drizzle(d1);
    const now = new Date().toISOString();
    await batch(db, [
      db
        .update(mentorshipProfiles)
        .set({ status, updatedAt: now })
        .where(and(eq(mentorshipProfiles.chamberId, chamberId), eq(mentorshipProfiles.userId, mentorUserId))),
      db.insert(activityLogs).values({
        id: await this.logId(d1, 'activity_logs', chamberId),
        chamberId,
        userId: adminId,
        action: status === 'paused' ? 'MENTOR_PROFILE_PAUSED' : 'MENTOR_PROFILE_ACTIVATED',
        targetType: 'mentorship_profile',
        targetId: profile.id,
      }),
    ]);
    return { user_id: mentorUserId, status };
  }
}
