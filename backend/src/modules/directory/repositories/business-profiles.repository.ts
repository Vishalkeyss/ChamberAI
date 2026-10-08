import { drizzle } from 'drizzle-orm/d1';
import { eq, and, sql, desc, ne, like, or } from 'drizzle-orm';
import { businessProfiles, businessMembers, users } from '../../../db/schema';
import type {
  BusinessProfileRecord,
  NewBusinessProfileRecord,
  BusinessMemberRecord,
  NewBusinessMemberRecord,
  UserRecord,
} from '../../../db/schema';
import type {
  BusinessProfileData,
  TeamRepresentative,
  UpdateBusinessProfileInput,
  InviteRepresentativeInput,
} from '../types';
import { generatePrefixedId } from '../../../core/shared/crypto';

export class BusinessProfilesRepository {
  /**
   * Finds the business profile linked to an authenticated user within a chamber context.
   */
  static async getBusinessByUserId(
    d1: D1Database,
    chamberId: string,
    userId: string
  ): Promise<{
    business: BusinessProfileRecord;
    membership: BusinessMemberRecord;
  } | null> {
    const db = drizzle(d1);

    // Join business_members and business_profiles via Drizzle ORM
    const rows = await db
      .select({
        business: businessProfiles,
        membership: businessMembers,
      })
      .from(businessMembers)
      .innerJoin(
        businessProfiles,
        and(
          eq(businessProfiles.id, businessMembers.businessId),
          eq(businessProfiles.chamberId, chamberId)
        )
      )
      .where(
        and(
          eq(businessMembers.chamberId, chamberId),
          eq(businessMembers.userId, userId),
          eq(businessMembers.status, 'active')
        )
      )
      .limit(1);

    if (rows.length > 0) {
      return rows[0];
    }

    // No implicit auto-linking: a user is linked to a business only through an explicit
    // business_members row (created on application approval or by team invite).
    return null;
  }

  /**
   * Retrieves a business profile by its primary key and chamber context.
   */
  static async getBusinessById(
    d1: D1Database,
    chamberId: string,
    businessId: string
  ): Promise<BusinessProfileRecord | null> {
    const db = drizzle(d1);
    const rows = await db
      .select()
      .from(businessProfiles)
      .where(
        and(
          eq(businessProfiles.chamberId, chamberId),
          eq(businessProfiles.id, businessId)
        )
      )
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Updates business profile fields using Drizzle ORM.
   */
  static async updateBusinessProfile(
    d1: D1Database,
    chamberId: string,
    businessId: string,
    data: UpdateBusinessProfileInput
  ): Promise<BusinessProfileRecord> {
    const db = drizzle(d1);
    const now = new Date().toISOString();

    // social_links_json also stores bannerUrl (set only by the banner upload). Preserve it
    // in the same statement so a concurrent banner upload is never overwritten.
    const socialLinksPayload = JSON.stringify({
      ...(data.socialLinks || {}),
      ...(data.dbaName ? { dbaName: data.dbaName } : {}),
    });

    await db
      .update(businessProfiles)
      .set({
        businessName: data.name,
        tagline: data.tagline ?? null,
        description: data.description ?? null,
        industry: data.industry,
        businessPhone: data.businessPhone ?? null,
        businessEmail: data.businessEmail ?? null,
        website: data.website ?? null,
        streetAddress: data.streetAddress ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        zip: data.zip ?? null,
        socialLinksJson: sql`CASE
          WHEN json_extract(${businessProfiles.socialLinksJson}, '$.bannerUrl') IS NOT NULL
          THEN json_set(${socialLinksPayload}, '$.bannerUrl', json_extract(${businessProfiles.socialLinksJson}, '$.bannerUrl'))
          ELSE ${socialLinksPayload}
        END`,
        skillsJson: JSON.stringify(data.skills || []),
        interestsJson: JSON.stringify(data.interests || []),
        locationsJson: JSON.stringify(data.locations || []),
        relatedOrganizationsJson: JSON.stringify(data.relatedOrganizations || []),
        updatedAt: now,
      })
      .where(
        and(
          eq(businessProfiles.chamberId, chamberId),
          eq(businessProfiles.id, businessId)
        )
      );

    const [updated] = await db
      .select()
      .from(businessProfiles)
      .where(
        and(
          eq(businessProfiles.chamberId, chamberId),
          eq(businessProfiles.id, businessId)
        )
      )
      .limit(1);

    return updated;
  }

  /**
   * Updates the logo URL for a business profile using Drizzle ORM.
   */
  static async updateLogoUrl(
    d1: D1Database,
    chamberId: string,
    businessId: string,
    logoUrl: string | null
  ): Promise<void> {
    const db = drizzle(d1);
    const now = new Date().toISOString();

    await db
      .update(businessProfiles)
      .set({
        businessLogoUrl: logoUrl,
        updatedAt: now,
      })
      .where(
        and(
          eq(businessProfiles.chamberId, chamberId),
          eq(businessProfiles.id, businessId)
        )
      );
  }

  /**
   * Updates the banner URL for a business profile.
   */
  static async updateBannerUrl(
    d1: D1Database,
    chamberId: string,
    businessId: string,
    bannerUrl: string
  ): Promise<void> {
    const db = drizzle(d1);
    const now = new Date().toISOString();

    // Atomic JSON update: no read-modify-write race with concurrent profile saves.
    await db
      .update(businessProfiles)
      .set({
        socialLinksJson: sql`json_set(COALESCE(NULLIF(${businessProfiles.socialLinksJson}, ''), '{}'), '$.bannerUrl', ${bannerUrl})`,
        updatedAt: now,
      })
      .where(
        and(
          eq(businessProfiles.chamberId, chamberId),
          eq(businessProfiles.id, businessId)
        )
      );
  }

  /**
   * Retrieves all team representatives linked to a business profile.
   */
  static async getTeamRepresentatives(
    d1: D1Database,
    chamberId: string,
    businessId: string
  ): Promise<TeamRepresentative[]> {
    const db = drizzle(d1);

    const rows = await db
      .select({
        memberId: businessMembers.id,
        userId: businessMembers.userId,
        accessLevel: businessMembers.accessLevel,
        isPrimaryContact: businessMembers.isPrimaryContact,
        status: businessMembers.status,
        createdAt: businessMembers.createdAt,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(businessMembers)
      .innerJoin(
        users,
        and(
          eq(users.id, businessMembers.userId),
          eq(users.chamberId, chamberId)
        )
      )
      .where(
        and(
          eq(businessMembers.chamberId, chamberId),
          eq(businessMembers.businessId, businessId),
          ne(businessMembers.status, 'removed')
        )
      )
      .orderBy(desc(businessMembers.isPrimaryContact), desc(businessMembers.createdAt));

    return rows.map((r) => ({
      id: r.memberId,
      userId: r.userId,
      name: r.name || r.email.split('@')[0],
      email: r.email,
      avatarUrl: r.avatarUrl,
      isPrimaryContact: Boolean(r.isPrimaryContact),
      accessLevel: r.accessLevel as any,
      status: r.status as any,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Retrieves a specific representative connection by businessId and userId.
   */
  static async getRepresentative(
    d1: D1Database,
    chamberId: string,
    businessId: string,
    userId: string
  ): Promise<BusinessMemberRecord | null> {
    const db = drizzle(d1);
    const rows = await db
      .select()
      .from(businessMembers)
      .where(
        and(
          eq(businessMembers.chamberId, chamberId),
          eq(businessMembers.businessId, businessId),
          eq(businessMembers.userId, userId)
        )
      )
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Invites and links a new team representative to the business.
   */
  static async addTeamRepresentative(
    d1: D1Database,
    chamberId: string,
    businessId: string,
    input: InviteRepresentativeInput
  ): Promise<TeamRepresentative> {
    const db = drizzle(d1);
    const now = new Date().toISOString();

    const normalizedEmail = input.email.trim().toLowerCase();

    // Check if user already exists in users table for this chamber
    let [existingUser] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.chamberId, chamberId),
          eq(users.email, normalizedEmail)
        )
      )
      .limit(1);

    let userId = existingUser?.id;

    if (!existingUser) {
      userId = generatePrefixedId('usr');
      const verificationToken = `mvt_${generatePrefixedId('tok')}`;
      const fullName = `${input.firstName} ${input.lastName}`.trim();

      await db.insert(users).values({
        id: userId,
        chamberId,
        memberVerificationToken: verificationToken,
        email: normalizedEmail,
        name: fullName,
        status: 'active',
        highestRole: 'member',
        createdAt: now,
        updatedAt: now,
      });
    }

    // Check if already linked to this business
    const [existingMember] = await db
      .select()
      .from(businessMembers)
      .where(
        and(
          eq(businessMembers.chamberId, chamberId),
          eq(businessMembers.businessId, businessId),
          eq(businessMembers.userId, userId!)
        )
      )
      .limit(1);

    const memberId = existingMember?.id || generatePrefixedId('bm');

    if (existingMember) {
      await db
        .update(businessMembers)
        .set({
          accessLevel: input.accessLevel,
          status: 'active',
          updatedAt: now,
        })
        .where(eq(businessMembers.id, existingMember.id));
    } else {
      await db.insert(businessMembers).values({
        id: memberId,
        chamberId,
        businessId,
        userId: userId!,
        accessLevel: input.accessLevel,
        isPrimaryContact: 0,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      id: memberId,
      userId: userId!,
      name: `${input.firstName} ${input.lastName}`.trim(),
      email: input.email,
      jobTitle: input.jobTitle ?? null,
      isPrimaryContact: false,
      accessLevel: input.accessLevel,
      status: 'active',
      createdAt: now,
    };
  }

  /**
   * Updates a team representative connection and associated user profile.
   */
  static async updateTeamRepresentative(
    d1: D1Database,
    chamberId: string,
    businessId: string,
    memberRecordId: string,
    payload: {
      name?: string;
      email?: string;
      jobTitle?: string;
      phone?: string;
      phones?: string[];
      accessLevel?: string;
    }
  ): Promise<boolean> {
    const db = drizzle(d1);
    const now = new Date().toISOString();

    const [target] = await db
      .select()
      .from(businessMembers)
      .where(
        and(
          eq(businessMembers.id, memberRecordId),
          eq(businessMembers.chamberId, chamberId),
          eq(businessMembers.businessId, businessId)
        )
      )
      .limit(1);

    if (!target) return false;

    // The primary contact must always keep full access (transfer primary first).
    if (payload.accessLevel && target.isPrimaryContact === 1 && payload.accessLevel !== 'full_access') {
      throw new Error('The primary contact must keep full access. Transfer primary contact first.');
    }

    if (payload.accessLevel) {
      await db
        .update(businessMembers)
        .set({
          accessLevel: payload.accessLevel,
          updatedAt: now,
        })
        .where(eq(businessMembers.id, memberRecordId));
    }

    // Email is a login identity: it is never changed through team management.
    if (payload.name || payload.phone || (payload.phones && payload.phones.length > 0)) {
      const primaryPhone = payload.phone || (payload.phones ? payload.phones.filter(Boolean)[0] : undefined);
      await db
        .update(users)
        .set({
          ...(payload.name ? { name: payload.name.trim() } : {}),
          ...(primaryPhone !== undefined ? { phone: primaryPhone.trim() || null } : {}),
          updatedAt: now,
        })
        .where(and(eq(users.id, target.userId), eq(users.chamberId, chamberId)));
    }

    return true;
  }

  /**
   * Removes a representative connection from a business.
   */
  static async removeTeamRepresentative(
    d1: D1Database,
    chamberId: string,
    businessId: string,
    memberRecordId: string
  ): Promise<boolean> {
    const db = drizzle(d1);

    // Verify member exists and is not the primary contact
    const [target] = await db
      .select()
      .from(businessMembers)
      .where(
        and(
          eq(businessMembers.id, memberRecordId),
          eq(businessMembers.chamberId, chamberId),
          eq(businessMembers.businessId, businessId)
        )
      )
      .limit(1);

    if (!target) return false;
    if (target.isPrimaryContact === 1) {
      throw new Error('Cannot remove primary contact. Assign another primary contact first.');
    }

    // Soft delete: keep the row for audit history (schema status 'removed').
    await db
      .update(businessMembers)
      .set({ status: 'removed', updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(businessMembers.id, memberRecordId),
          eq(businessMembers.chamberId, chamberId),
          eq(businessMembers.businessId, businessId)
        )
      );

    return true;
  }

  /**
   * Atomically transfers primary contact status to a target representative.
   * Strictly enforces the Single Primary Contact invariant (Prompt 03.1 §7.1).
   */
  static async setPrimaryContact(
    d1: D1Database,
    chamberId: string,
    businessId: string,
    targetMemberRecordId: string
  ): Promise<void> {
    const db = drizzle(d1);
    const now = new Date().toISOString();

    // Verify the target is an active representative of this business before changing anything.
    const [target] = await db
      .select()
      .from(businessMembers)
      .where(
        and(
          eq(businessMembers.id, targetMemberRecordId),
          eq(businessMembers.chamberId, chamberId),
          eq(businessMembers.businessId, businessId),
          eq(businessMembers.status, 'active')
        )
      )
      .limit(1);
    if (!target) {
      throw new Error('Target representative not found for this business');
    }

    // Demote + promote in one atomic batch: the business can never end up with zero
    // (or two) primary contacts.
    await db.batch([
      db
        .update(businessMembers)
        .set({ isPrimaryContact: 0, updatedAt: now })
        .where(
          and(
            eq(businessMembers.chamberId, chamberId),
            eq(businessMembers.businessId, businessId),
            ne(businessMembers.id, targetMemberRecordId)
          )
        ),
      db
        .update(businessMembers)
        .set({
          isPrimaryContact: 1,
          accessLevel: 'full_access', // Primary contact must have full access
          updatedAt: now,
        })
        .where(
          and(
            eq(businessMembers.id, targetMemberRecordId),
            eq(businessMembers.chamberId, chamberId),
            eq(businessMembers.businessId, businessId)
          )
        ),
    ]);
  }

  /**
   * Searches verified chamber member businesses for the Related Organizations network editor.
   */
  static async searchChamberBusinesses(
    d1: D1Database,
    chamberId: string,
    excludeBusinessId: string,
    searchQuery: string
  ): Promise<Array<{ id: string; name: string; industry: string }>> {
    const db = drizzle(d1);

    const term = `%${searchQuery.trim().toLowerCase()}%`;

    const rows = await db
      .select({
        id: businessProfiles.id,
        name: businessProfiles.businessName,
        industry: businessProfiles.industry,
      })
      .from(businessProfiles)
      .where(
        and(
          eq(businessProfiles.chamberId, chamberId),
          ne(businessProfiles.id, excludeBusinessId),
          like(sql`LOWER(${businessProfiles.businessName})`, term)
        )
      )
      .limit(10);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      industry: r.industry || 'General Business',
    }));
  }
}
