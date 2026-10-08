import { drizzle } from 'drizzle-orm/d1';
import { eq, and, sql, desc, asc, like, or } from 'drizzle-orm';
import {
  businessProfiles,
  chamberMemberships,
  businessMembers,
  users,
  chapters,
  membershipPlans,
  platformChambers,
} from '../../../db/schema';
import type { DirectoryQueryParams } from '../validation/directory.validation';

/**
 * Escapes SQL LIKE wildcard characters to prevent injection.
 * Per Prompt 03.2 Section 8 spec.
 */
export function sanitizeSearchQuery(query: string): string {
  return query.trim().replace(/[%_]/g, '\\$&');
}

export interface PublicDirectoryBusinessItem {
  id: string;
  name: string;
  dbaName?: string | null;
  logoUrl: string | null;
  tagline: string | null;
  description: string | null;
  industry: string | null;
  city: string | null;
  chamberCity?: string | null;
  state: string | null;
  website: string | null;
  phone: string | null;
  isVerified: number | boolean;
  chapterName: string | null;
  planName?: string | null;
  membershipStatus?: string | null;
}

export interface MemberDirectoryBusinessItem extends PublicDirectoryBusinessItem {
  primaryContact: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    email: string | null;
    phone?: string | null;
    jobTitle?: string | null;
  } | null;
}

export interface DirectorySearchResult<T = PublicDirectoryBusinessItem> {
  businesses: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DirectoryFilterOptions {
  industries: string[];
  cities: string[];
  chapters: { id: string; name: string }[];
  plans: string[];
}

export class DirectoryRepository {
  /**
   * Search Directory with multi-facet filtering, active membership verification,
   * verified business prioritization, and tenant isolation.
   */
  static async searchDirectory(
    d1: D1Database,
    chamberId: string,
    params: DirectoryQueryParams,
    options: {
      isMemberView?: boolean;
      scopedChapterId?: string | null;
    } = {}
  ): Promise<DirectorySearchResult<any>> {
    const db = drizzle(d1);
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 12));
    const offset = (page - 1) * limit;

    const effectiveChapterId = options.scopedChapterId || params.chapterId || params.chapter_id;
    const verifiedOnly = params.verified === 1;

    // Build conditions array
    const conditions = [
      eq(businessProfiles.chamberId, chamberId),
      eq(chamberMemberships.chamberId, chamberId),
      eq(chamberMemberships.status, 'active'),
    ];

    if (verifiedOnly) {
      conditions.push(eq(businessProfiles.isVerified, 1));
    }

    if (params.industry && params.industry.trim()) {
      const ind = params.industry.trim();
      conditions.push(
        or(
          eq(businessProfiles.industry, ind),
          like(businessProfiles.industry, `%${ind}%`)
        )!
      );
    }

    if (params.city && params.city.trim()) {
      const city = params.city.trim();
      conditions.push(
        or(
          eq(businessProfiles.city, city),
          like(businessProfiles.city, `%${city}%`),
          like(businessProfiles.locationsJson, `%${city}%`)
        )!
      );
    }

    if (effectiveChapterId && effectiveChapterId.trim()) {
      const chId = effectiveChapterId.trim();
      conditions.push(
        or(
          eq(users.primaryChapterId, chId),
          sql`EXISTS (
            SELECT 1 FROM user_chapters uc 
            WHERE uc.user_id = ${users.id} AND uc.chapter_id = ${chId}
          )`
        )!
      );
    }

    if (params.q && params.q.trim()) {
      const sanitized = sanitizeSearchQuery(params.q);
      const searchLike = `%${sanitized}%`;
      conditions.push(
        or(
          like(businessProfiles.businessName, searchLike),
          like(businessProfiles.tagline, searchLike),
          like(businessProfiles.description, searchLike),
          like(businessProfiles.skillsJson, searchLike)
        )!
      );
    }

    const whereClause = and(...conditions);

    // 1. Total Count Query
    const countResult = await db
      .select({
        count: sql<number>`count(distinct ${businessProfiles.id})`,
      })
      .from(businessProfiles)
      .innerJoin(
        chamberMemberships,
        and(
          eq(chamberMemberships.businessId, businessProfiles.id),
          eq(chamberMemberships.chamberId, chamberId)
        )
      )
      .leftJoin(
        businessMembers,
        and(
          eq(businessMembers.businessId, businessProfiles.id),
          eq(businessMembers.chamberId, chamberId),
          eq(businessMembers.isPrimaryContact, 1)
        )
      )
      .leftJoin(
        users,
        and(
          eq(users.id, businessMembers.userId),
          eq(users.chamberId, chamberId)
        )
      )
      .where(whereClause);

    const total = Number(countResult[0]?.count || 0);

    // 2. Data Rows Query
    const rows = await db
      .select({
        id: businessProfiles.id,
        name: businessProfiles.businessName,
        logoUrl: businessProfiles.businessLogoUrl,
        tagline: businessProfiles.tagline,
        description: businessProfiles.description,
        industry: businessProfiles.industry,
        city: businessProfiles.city,
        state: businessProfiles.state,
        website: businessProfiles.website,
        phone: businessProfiles.businessPhone,
        isVerified: businessProfiles.isVerified,
        primaryContactId: users.id,
        primaryContactName: users.name,
        primaryContactAvatar: users.avatarUrl,
        primaryContactEmail: users.email,
        primaryContactPhone: users.phone,
        primaryChapterId: users.primaryChapterId,
        chapterName: chapters.name,
        planName: membershipPlans.name,
        membershipStatus: chamberMemberships.status,
        chamberCity: platformChambers.city,
      })
      .from(businessProfiles)
      .innerJoin(
        chamberMemberships,
        and(
          eq(chamberMemberships.businessId, businessProfiles.id),
          eq(chamberMemberships.chamberId, chamberId)
        )
      )
      .leftJoin(
        businessMembers,
        and(
          eq(businessMembers.businessId, businessProfiles.id),
          eq(businessMembers.chamberId, chamberId),
          eq(businessMembers.isPrimaryContact, 1)
        )
      )
      .leftJoin(
        users,
        and(
          eq(users.id, businessMembers.userId),
          eq(users.chamberId, chamberId)
        )
      )
      .leftJoin(
        chapters,
        and(
          eq(chapters.id, users.primaryChapterId),
          eq(chapters.chamberId, chamberId)
        )
      )
      .leftJoin(
        membershipPlans,
        eq(membershipPlans.id, chamberMemberships.planId)
      )
      .leftJoin(
        platformChambers,
        eq(platformChambers.id, businessProfiles.chamberId)
      )
      .where(whereClause)
      .groupBy(businessProfiles.id)
      .orderBy(desc(businessProfiles.isVerified), asc(businessProfiles.businessName))
      .limit(limit)
      .offset(offset);

    const businesses = rows.map((row) => {
      const base: PublicDirectoryBusinessItem = {
        id: row.id,
        name: row.name,
        logoUrl: row.logoUrl || null,
        tagline: row.tagline || null,
        description: row.description || null,
        industry: row.industry || null,
        city: row.city || row.chamberCity || null,
        chamberCity: row.chamberCity || null,
        state: row.state || null,
        website: row.website || null,
        phone: row.phone || null,
        isVerified: row.isVerified === 1 ? 1 : 0,
        chapterName: row.chapterName || null,
        planName: row.planName || null,
        membershipStatus: row.membershipStatus || 'active',
      };

      if (!options.isMemberView) {
        return base;
      }

      return {
        ...base,
        primaryContact: row.primaryContactId
          ? {
              id: row.primaryContactId,
              name: row.primaryContactName || null,
              avatarUrl: row.primaryContactAvatar || null,
              email: row.primaryContactEmail || null,
              phone: row.primaryContactPhone || null,
            }
          : null,
      };
    });

    return {
      businesses,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves available distinct filter values for the chamber directory.
   */
  static async getFilterOptions(
    d1: D1Database,
    chamberId: string
  ): Promise<DirectoryFilterOptions> {
    const db = drizzle(d1);

    const [industryRows, cityRows, chapterRows, chamberRow, planRows] = await Promise.all([
      db
        .select({ industry: businessProfiles.industry })
        .from(businessProfiles)
        .innerJoin(
          chamberMemberships,
          and(
            eq(chamberMemberships.businessId, businessProfiles.id),
            eq(chamberMemberships.chamberId, chamberId),
            eq(chamberMemberships.status, 'active')
          )
        )
        .where(
          and(
            eq(businessProfiles.chamberId, chamberId),
            sql`${businessProfiles.industry} IS NOT NULL AND ${businessProfiles.industry} != ''`
          )
        )
        .groupBy(businessProfiles.industry)
        .orderBy(asc(businessProfiles.industry)),

      db
        .select({ city: businessProfiles.city })
        .from(businessProfiles)
        .innerJoin(
          chamberMemberships,
          and(
            eq(chamberMemberships.businessId, businessProfiles.id),
            eq(chamberMemberships.chamberId, chamberId),
            eq(chamberMemberships.status, 'active')
          )
        )
        .where(
          and(
            eq(businessProfiles.chamberId, chamberId),
            sql`${businessProfiles.city} IS NOT NULL AND ${businessProfiles.city} != ''`
          )
        )
        .groupBy(businessProfiles.city)
        .orderBy(asc(businessProfiles.city)),

      db
        .select({ id: chapters.id, name: chapters.name })
        .from(chapters)
        .where(
          and(
            eq(chapters.chamberId, chamberId),
            eq(chapters.status, 'active')
          )
        )
        .orderBy(asc(chapters.name)),

      db
        .select({ city: platformChambers.city })
        .from(platformChambers)
        .where(eq(platformChambers.id, chamberId)),

      db
        .select({ name: membershipPlans.name })
        .from(membershipPlans)
        .where(
          and(
            eq(membershipPlans.chamberId, chamberId),
            eq(membershipPlans.isActive, 1)
          )
        )
        .orderBy(asc(membershipPlans.name)),
    ]);

    // Flatten multi-category industries if comma-separated
    const industrySet = new Set<string>();
    for (const row of industryRows) {
      if (row.industry) {
        row.industry
          .split(/[,|]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((item) => industrySet.add(item));
      }
    }

    const citySet = new Set<string>();
    if (chamberRow[0]?.city && chamberRow[0].city.trim()) {
      citySet.add(chamberRow[0].city.trim());
    }
    for (const row of cityRows) {
      if (row.city && row.city.trim()) {
        citySet.add(row.city.trim());
      }
    }

    const plans = planRows.map((p) => p.name).filter(Boolean);

    return {
      industries: Array.from(industrySet).sort(),
      cities: Array.from(citySet).sort(),
      chapters: chapterRows,
      plans,
    };
  }
}
