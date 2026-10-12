import { drizzle } from 'drizzle-orm/d1';
import { and, asc, desc, eq, inArray, ne, or, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { users, businessMembers, businessProfiles } from '../../../db/schema';
import { sanitizeSearchQuery } from '../../directory/repositories/directory.repository';

/** `column LIKE '%value%' ESCAPE '\'` (same escaping as the directory search). */
function containsLike(column: SQLWrapper, value: string): SQL {
  return sql`${column} LIKE ${`%${sanitizeSearchQuery(value)}%`} ESCAPE '\\'`;
}

export interface NetworkMemberCard {
  id: string;
  name: string;
  avatarUrl: string | null;
  businessId: string | null;
  companyName: string | null;
  industry: string | null;
}

export interface NetworkBusinessCard {
  id: string;
  name: string;
  logoUrl: string | null;
  industry: string | null;
  contactName: string | null;
}

/**
 * Shared people/business lookups for Phase 05 networking.
 * "Active member" = users.status = 'active' in the same chamber (05.2 §7.1, 05.3).
 */
export class NetworkMembersRepository {
  static async findActiveUser(d1: D1Database, chamberId: string, userId: string) {
    return drizzle(d1)
      .select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
      .from(users)
      .where(and(eq(users.chamberId, chamberId), eq(users.id, userId), eq(users.status, 'active')))
      .get();
  }

  /** Active businesses each user represents, primary-contact links first. */
  static async businessesForUsers(d1: D1Database, chamberId: string, userIds: string[]) {
    if (userIds.length === 0) return [];
    return drizzle(d1)
      .select({
        userId: businessMembers.userId,
        businessId: businessProfiles.id,
        businessName: businessProfiles.businessName,
        logoUrl: businessProfiles.businessLogoUrl,
        industry: businessProfiles.industry,
        isPrimaryContact: businessMembers.isPrimaryContact,
      })
      .from(businessMembers)
      .innerJoin(businessProfiles, eq(businessMembers.businessId, businessProfiles.id))
      .where(
        and(
          eq(businessMembers.chamberId, chamberId),
          eq(businessProfiles.chamberId, chamberId),
          eq(businessMembers.status, 'active'),
          inArray(businessMembers.userId, userIds)
        )
      )
      .orderBy(desc(businessMembers.isPrimaryContact), asc(businessMembers.createdAt));
  }

  /**
   * The member's own business for referrals (OD-067: one business per member,
   * primary-contact link preferred — same limitation as OD-044).
   */
  static async primaryBusinessOf(d1: D1Database, chamberId: string, userId: string) {
    const rows = await this.businessesForUsers(d1, chamberId, [userId]);
    return rows[0] || null;
  }

  /** Every business the user actively represents (received/given referral lists). */
  static async businessIdsOf(d1: D1Database, chamberId: string, userId: string): Promise<string[]> {
    const rows = await this.businessesForUsers(d1, chamberId, [userId]);
    return [...new Set(rows.map((r) => r.businessId))];
  }

  /** Active users representing a business (referral notification recipients). */
  static async activeRepresentatives(d1: D1Database, chamberId: string, businessId: string) {
    return drizzle(d1)
      .select({ userId: users.id })
      .from(businessMembers)
      .innerJoin(users, eq(businessMembers.userId, users.id))
      .where(
        and(
          eq(businessMembers.chamberId, chamberId),
          eq(businessMembers.businessId, businessId),
          eq(businessMembers.status, 'active'),
          eq(users.chamberId, chamberId),
          eq(users.status, 'active')
        )
      );
  }

  /** Member cards (name, avatar, company) for a set of user ids in this chamber. */
  static async memberCards(d1: D1Database, chamberId: string, userIds: string[]): Promise<Map<string, NetworkMemberCard>> {
    const ids = [...new Set(userIds)];
    const result = new Map<string, NetworkMemberCard>();
    if (ids.length === 0) return result;
    const [people, businesses] = await Promise.all([
      drizzle(d1)
        .select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
        .from(users)
        .where(and(eq(users.chamberId, chamberId), inArray(users.id, ids))),
      this.businessesForUsers(d1, chamberId, ids),
    ]);
    for (const p of people) {
      const biz = businesses.find((b) => b.userId === p.id);
      result.set(p.id, {
        id: p.id,
        name: p.name?.trim() || p.email,
        avatarUrl: p.avatarUrl,
        businessId: biz?.businessId ?? null,
        companyName: biz?.businessName ?? null,
        industry: biz?.industry ?? null,
      });
    }
    return result;
  }

  /** Searchable member picker: active users of this chamber by name, company or industry. */
  static async searchMembers(d1: D1Database, chamberId: string, excludeUserId: string, query: string, limit = 20) {
    const db = drizzle(d1);
    const q = query.trim();
    const conditions: SQL[] = [eq(users.chamberId, chamberId), eq(users.status, 'active'), ne(users.id, excludeUserId)];
    if (q) {
      const byCompany = db
        .select({ userId: businessMembers.userId })
        .from(businessMembers)
        .innerJoin(businessProfiles, eq(businessMembers.businessId, businessProfiles.id))
        .where(
          and(
            eq(businessMembers.chamberId, chamberId),
            eq(businessMembers.status, 'active'),
            or(containsLike(businessProfiles.businessName, q), containsLike(businessProfiles.industry, q))
          )
        );
      conditions.push(or(containsLike(users.name, q), inArray(users.id, byCompany)) as SQL);
    }
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(...conditions))
      .orderBy(asc(users.name))
      .limit(limit);
    const cards = await this.memberCards(d1, chamberId, rows.map((r) => r.id));
    return rows.map((r) => cards.get(r.id)).filter(Boolean) as NetworkMemberCard[];
  }

  /** Referral recipient picker: chamber businesses with at least one active representative. */
  static async searchBusinesses(
    d1: D1Database,
    chamberId: string,
    excludeBusinessIds: string[],
    query: string,
    limit = 20
  ): Promise<NetworkBusinessCard[]> {
    const q = query.trim();
    const conditions: SQL[] = [
      eq(businessProfiles.chamberId, chamberId),
      eq(businessMembers.chamberId, chamberId),
      eq(businessMembers.status, 'active'),
      eq(users.chamberId, chamberId),
      eq(users.status, 'active'),
    ];
    for (const id of excludeBusinessIds) conditions.push(ne(businessProfiles.id, id));
    if (q) {
      conditions.push(
        or(
          containsLike(businessProfiles.businessName, q),
          containsLike(businessProfiles.industry, q),
          containsLike(users.name, q)
        ) as SQL
      );
    }
    const rows = await drizzle(d1)
      .select({
        id: businessProfiles.id,
        name: businessProfiles.businessName,
        logoUrl: businessProfiles.businessLogoUrl,
        industry: businessProfiles.industry,
        contactName: users.name,
      })
      .from(businessProfiles)
      .innerJoin(businessMembers, eq(businessMembers.businessId, businessProfiles.id))
      .innerJoin(users, eq(businessMembers.userId, users.id))
      .where(and(...conditions))
      .orderBy(asc(businessProfiles.businessName), desc(businessMembers.isPrimaryContact))
      .limit(limit * 5);

    const seen = new Map<string, NetworkBusinessCard>();
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.set(r.id, { id: r.id, name: r.name, logoUrl: r.logoUrl, industry: r.industry, contactName: r.contactName });
      if (seen.size >= limit) break;
    }
    return [...seen.values()];
  }

  static async findBusinesses(d1: D1Database, chamberId: string, businessIds: string[]) {
    const ids = [...new Set(businessIds)];
    if (ids.length === 0) return [];
    return drizzle(d1)
      .select({ id: businessProfiles.id, name: businessProfiles.businessName, logoUrl: businessProfiles.businessLogoUrl })
      .from(businessProfiles)
      .where(and(eq(businessProfiles.chamberId, chamberId), inArray(businessProfiles.id, ids)));
  }
}
