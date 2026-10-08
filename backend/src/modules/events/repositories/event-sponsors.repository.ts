import { drizzle } from 'drizzle-orm/d1';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  events,
  eventSponsors,
  eventSponsorshipTiers,
  businessProfiles,
  businessMembers,
  invoices,
} from '../../../db/schema';
import type { EventSponsorshipTierRecord } from '../../../db/schema/event-sponsors.schema';

/**
 * Prompt 04.4 — data access for sponsorship tiers & sponsors. Every query is chamber-scoped.
 */
export class EventSponsorsRepository {
  static async findEvent(d1: D1Database, chamberId: string, eventId: string) {
    return drizzle(d1)
      .select()
      .from(events)
      .where(and(eq(events.chamberId, chamberId), eq(events.id, eventId)))
      .get();
  }

  static async listTiers(d1: D1Database, chamberId: string, eventId: string): Promise<EventSponsorshipTierRecord[]> {
    return drizzle(d1)
      .select()
      .from(eventSponsorshipTiers)
      .where(and(eq(eventSponsorshipTiers.chamberId, chamberId), eq(eventSponsorshipTiers.eventId, eventId)))
      .orderBy(asc(eventSponsorshipTiers.sortOrder), desc(eventSponsorshipTiers.amount))
      .all();
  }

  static async findTier(d1: D1Database, chamberId: string, eventId: string, tierId: string) {
    return drizzle(d1)
      .select()
      .from(eventSponsorshipTiers)
      .where(
        and(
          eq(eventSponsorshipTiers.chamberId, chamberId),
          eq(eventSponsorshipTiers.eventId, eventId),
          eq(eventSponsorshipTiers.id, tierId)
        )
      )
      .get();
  }

  /** §7.1 Tier capacity guard — atomic claim. Returns false when the tier is sold out. */
  static async claimSpot(d1: D1Database, chamberId: string, tierId: string, enforceCapacity: boolean): Promise<boolean> {
    const result = await drizzle(d1)
      .update(eventSponsorshipTiers)
      .set({ sponsorsCount: sql`${eventSponsorshipTiers.sponsorsCount} + 1` })
      .where(
        and(
          eq(eventSponsorshipTiers.chamberId, chamberId),
          eq(eventSponsorshipTiers.id, tierId),
          enforceCapacity
            ? sql`(${eventSponsorshipTiers.maxSponsors} IS NULL OR ${eventSponsorshipTiers.sponsorsCount} < ${eventSponsorshipTiers.maxSponsors})`
            : sql`1 = 1`
        )
      )
      .run();
    return !!result.meta.changes;
  }

  static releaseSpotStmt(d1: D1Database, chamberId: string, tierId: string) {
    return drizzle(d1)
      .update(eventSponsorshipTiers)
      .set({ sponsorsCount: sql`MAX(0, ${eventSponsorshipTiers.sponsorsCount} - 1)` })
      .where(and(eq(eventSponsorshipTiers.chamberId, chamberId), eq(eventSponsorshipTiers.id, tierId)));
  }

  /** Active representative link between the user and the business (§11). */
  static async findRepresentedBusiness(d1: D1Database, chamberId: string, userId: string, businessId: string) {
    return drizzle(d1)
      .select({
        id: businessProfiles.id,
        businessName: businessProfiles.businessName,
        logoUrl: businessProfiles.businessLogoUrl,
        website: businessProfiles.website,
      })
      .from(businessMembers)
      .innerJoin(businessProfiles, eq(businessMembers.businessId, businessProfiles.id))
      .where(
        and(
          eq(businessMembers.chamberId, chamberId),
          eq(businessMembers.userId, userId),
          eq(businessMembers.businessId, businessId),
          eq(businessMembers.status, 'active'),
          eq(businessProfiles.chamberId, chamberId)
        )
      )
      .get();
  }

  static async findBusiness(d1: D1Database, chamberId: string, businessId: string) {
    return drizzle(d1)
      .select({ id: businessProfiles.id, businessName: businessProfiles.businessName })
      .from(businessProfiles)
      .where(and(eq(businessProfiles.chamberId, chamberId), eq(businessProfiles.id, businessId)))
      .get();
  }

  static async businessAlreadySponsors(d1: D1Database, chamberId: string, eventId: string, businessId: string) {
    const row = await drizzle(d1)
      .select({ id: eventSponsors.id })
      .from(eventSponsors)
      .where(
        and(
          eq(eventSponsors.chamberId, chamberId),
          eq(eventSponsors.eventId, eventId),
          eq(eventSponsors.businessId, businessId)
        )
      )
      .get();
    return !!row;
  }

  /** Sponsors with their tier and business details, highest tier first. */
  static async listSponsors(d1: D1Database, chamberId: string, eventId: string, statuses?: string[]) {
    return drizzle(d1)
      .select({
        id: eventSponsors.id,
        sponsorName: eventSponsors.sponsorName,
        businessId: eventSponsors.businessId,
        sponsorUserId: eventSponsors.sponsorUserId,
        tierId: eventSponsors.tierId,
        tierName: eventSponsorshipTiers.tierName,
        tierSortOrder: eventSponsorshipTiers.sortOrder,
        amount: eventSponsors.amount,
        status: eventSponsors.status,
        paymentDate: eventSponsors.paymentDate,
        createdAt: eventSponsors.createdAt,
        logoUrl: businessProfiles.businessLogoUrl,
        website: businessProfiles.website,
        businessName: businessProfiles.businessName,
      })
      .from(eventSponsors)
      .leftJoin(eventSponsorshipTiers, eq(eventSponsors.tierId, eventSponsorshipTiers.id))
      .leftJoin(
        businessProfiles,
        and(eq(eventSponsors.businessId, businessProfiles.id), eq(businessProfiles.chamberId, chamberId))
      )
      .where(
        and(
          eq(eventSponsors.chamberId, chamberId),
          eq(eventSponsors.eventId, eventId),
          statuses?.length ? inArray(eventSponsors.status, statuses) : sql`1 = 1`
        )
      )
      .orderBy(asc(eventSponsorshipTiers.sortOrder), desc(eventSponsors.amount), asc(eventSponsors.createdAt))
      .all();
  }

  static async findSponsor(d1: D1Database, chamberId: string, eventId: string, sponsorId: string) {
    return drizzle(d1)
      .select()
      .from(eventSponsors)
      .where(
        and(eq(eventSponsors.chamberId, chamberId), eq(eventSponsors.eventId, eventId), eq(eventSponsors.id, sponsorId))
      )
      .get();
  }

  /**
   * OD-034: event_sponsors has no invoice_id column. The sponsorship invoice is the open
   * 'sponsorship' invoice for the same event, representative and amount.
   */
  static async findOpenInvoice(
    d1: D1Database,
    chamberId: string,
    eventId: string,
    userId: string | null,
    amount: number
  ) {
    if (!userId) return null;
    return drizzle(d1)
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.chamberId, chamberId),
          eq(invoices.relatedEventId, eventId),
          eq(invoices.invoiceType, 'sponsorship'),
          eq(invoices.userId, userId),
          eq(invoices.totalAmount, amount),
          inArray(invoices.status, ['unpaid', 'overdue'])
        )
      )
      .orderBy(asc(invoices.createdAt))
      .get();
  }
}
