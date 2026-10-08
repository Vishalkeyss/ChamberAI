import { drizzle } from 'drizzle-orm/d1';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { users, businessProfiles, chamberSettings, platformChambers } from '../../../db/schema';

const cardOwnerColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  phone: users.phone,
  avatarUrl: users.avatarUrl,
  cardToken: users.cardToken,
  cardThemeColor: users.cardThemeColor,
  cardViewsCount: users.cardViewsCount,
};

export class BusinessCardRepository {
  /** Active user of this chamber (card owner). */
  static async findOwner(d1: D1Database, chamberId: string, userId: string) {
    return drizzle(d1)
      .select(cardOwnerColumns)
      .from(users)
      .where(and(eq(users.chamberId, chamberId), eq(users.id, userId), eq(users.status, 'active')))
      .get();
  }

  /** §12: token resolves only inside the request chamber, and only for active users (OD-072). */
  static async findByToken(d1: D1Database, chamberId: string, token: string) {
    return drizzle(d1)
      .select(cardOwnerColumns)
      .from(users)
      .where(and(eq(users.chamberId, chamberId), eq(users.cardToken, token), eq(users.status, 'active')))
      .get();
  }

  /** OD-070: set once — the `IS NULL` guard means an existing token is never replaced. */
  static async assignToken(d1: D1Database, chamberId: string, userId: string, token: string) {
    const result = await drizzle(d1)
      .update(users)
      .set({ cardToken: token })
      .where(and(eq(users.chamberId, chamberId), eq(users.id, userId), isNull(users.cardToken)))
      .run();
    return !!result.meta?.changes;
  }

  static async setThemeColor(d1: D1Database, chamberId: string, userId: string, color: string) {
    await drizzle(d1)
      .update(users)
      .set({ cardThemeColor: color, updatedAt: new Date().toISOString() })
      .where(and(eq(users.chamberId, chamberId), eq(users.id, userId)))
      .run();
  }

  /** §7.3 analytics. */
  static async incrementViews(d1: D1Database, chamberId: string, userId: string) {
    await drizzle(d1)
      .update(users)
      .set({ cardViewsCount: sql`${users.cardViewsCount} + 1` })
      .where(and(eq(users.chamberId, chamberId), eq(users.id, userId)))
      .run();
  }

  static async businessDetails(d1: D1Database, chamberId: string, businessId: string) {
    return drizzle(d1)
      .select({
        id: businessProfiles.id,
        name: businessProfiles.businessName,
        logoUrl: businessProfiles.businessLogoUrl,
        tagline: businessProfiles.tagline,
        industry: businessProfiles.industry,
        phone: businessProfiles.businessPhone,
        email: businessProfiles.businessEmail,
        website: businessProfiles.website,
        streetAddress: businessProfiles.streetAddress,
        city: businessProfiles.city,
        state: businessProfiles.state,
        zip: businessProfiles.zip,
        socialLinksJson: businessProfiles.socialLinksJson,
        isVerified: businessProfiles.isVerified,
      })
      .from(businessProfiles)
      .where(and(eq(businessProfiles.chamberId, chamberId), eq(businessProfiles.id, businessId)))
      .get();
  }

  static async chamberBranding(d1: D1Database, chamberId: string) {
    return drizzle(d1)
      .select({
        chamberName: platformChambers.name,
        orgName: chamberSettings.orgName,
        primaryColor: chamberSettings.primaryColor,
        logoUrl: chamberSettings.logoUrl,
      })
      .from(platformChambers)
      .leftJoin(chamberSettings, eq(chamberSettings.chamberId, platformChambers.id))
      .where(eq(platformChambers.id, chamberId))
      .get();
  }
}
