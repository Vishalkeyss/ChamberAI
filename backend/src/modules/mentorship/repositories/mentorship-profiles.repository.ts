import { drizzle } from 'drizzle-orm/d1';
import { and, asc, eq, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import { mentorshipProfiles, users, businessMembers, businessProfiles } from '../../../db/schema';
import { sanitizeSearchQuery } from '../../directory/repositories/directory.repository';

const like = (value: string) => `%${sanitizeSearchQuery(value)}%`;

/** Every query is chamber-scoped (§12). Mentor = profile row with status active / paused (OD-090). */
export class MentorshipProfilesRepository {
  static async findByUser(d1: D1Database, chamberId: string, userId: string) {
    return drizzle(d1)
      .select()
      .from(mentorshipProfiles)
      .where(and(eq(mentorshipProfiles.chamberId, chamberId), eq(mentorshipProfiles.userId, userId)))
      .get();
  }

  /**
   * §9.1 mentor directory: active profiles of active users in this chamber (caller excluded).
   * Filters: free-text search (name / business / expertise), exact expertise tag, business industry.
   */
  static async listMentors(
    d1: D1Database,
    chamberId: string,
    excludeUserId: string,
    opts: { search?: string; expertise?: string; industry?: string }
  ) {
    const db = drizzle(d1);
    const conditions: SQL[] = [
      eq(mentorshipProfiles.chamberId, chamberId),
      eq(mentorshipProfiles.status, 'active'),
      eq(users.chamberId, chamberId),
      eq(users.status, 'active'),
      ne(users.id, excludeUserId),
    ];
    const businessUsers = (condition: SQL) =>
      db
        .select({ userId: businessMembers.userId })
        .from(businessMembers)
        .innerJoin(businessProfiles, eq(businessMembers.businessId, businessProfiles.id))
        .where(and(eq(businessMembers.chamberId, chamberId), eq(businessProfiles.chamberId, chamberId), eq(businessMembers.status, 'active'), condition));

    const q = (opts.search || '').trim();
    if (q) {
      conditions.push(
        or(
          sql`${users.name} LIKE ${like(q)} ESCAPE '\\'`,
          sql`${mentorshipProfiles.expertiseJson} LIKE ${like(q)} ESCAPE '\\'`,
          inArray(users.id, businessUsers(sql`${businessProfiles.businessName} LIKE ${like(q)} ESCAPE '\\'`))
        )!
      );
    }
    if (opts.expertise) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM json_each(${mentorshipProfiles.expertiseJson}) WHERE lower(json_each.value) = lower(${opts.expertise}))`
      );
    }
    if (opts.industry) {
      conditions.push(inArray(users.id, businessUsers(eq(businessProfiles.industry, opts.industry))));
    }
    return db
      .select({ profile: mentorshipProfiles, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
      .from(mentorshipProfiles)
      .innerJoin(users, eq(mentorshipProfiles.userId, users.id))
      .where(and(...conditions))
      .orderBy(asc(users.name));
  }

  /** Filter options (OD-101): every tag / industry used by the chamber's active mentors. */
  static async filterSources(d1: D1Database, chamberId: string) {
    const db = drizzle(d1);
    const active = and(
      eq(mentorshipProfiles.chamberId, chamberId),
      eq(mentorshipProfiles.status, 'active'),
      eq(users.chamberId, chamberId),
      eq(users.status, 'active')
    );
    const [tags, industries] = await Promise.all([
      db
        .select({ json: mentorshipProfiles.expertiseJson })
        .from(mentorshipProfiles)
        .innerJoin(users, eq(mentorshipProfiles.userId, users.id))
        .where(active),
      db
        .selectDistinct({ industry: businessProfiles.industry })
        .from(mentorshipProfiles)
        .innerJoin(users, eq(mentorshipProfiles.userId, users.id))
        .innerJoin(businessMembers, and(eq(businessMembers.userId, users.id), eq(businessMembers.status, 'active')))
        .innerJoin(businessProfiles, eq(businessMembers.businessId, businessProfiles.id))
        .where(and(active, eq(businessProfiles.chamberId, chamberId))),
    ]);
    return { tagJson: tags.map((t) => t.json), industries: industries.map((i) => i.industry).filter(Boolean) as string[] };
  }
}
