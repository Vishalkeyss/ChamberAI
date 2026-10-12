import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { eventSponsors, invoices, activityLogs } from '../../../db/schema';
import type { EventRecord } from '../../../db/schema/events.schema';
import type { EventSponsorshipTierRecord } from '../../../db/schema/event-sponsors.schema';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { newId } from '../../../core/shared/ids';
import { PaymentGatewayService } from '../../billing/services/payment-gateway.service';
import { EventSponsorsRepository } from '../repositories/event-sponsors.repository';
import type {
  AdminRecordSponsorInput,
  AdminUpdateSponsorInput,
  BookSponsorshipInput,
} from '../validation/events.validation';

/** Net 30 (§5.1 Option B). */
const INVOICE_TERMS_DAYS = 30;

/**
 * Who may manage sponsorships (§3):
 *  - full   : full_admin / super_admin / billing_admin — every event, every action
 *  - chapter: chapter_admin — view + record on own chapter's events
 *  - group  : group_admin — view only on own group's events (pre-existing 04.2 tab access)
 */
export interface SponsorshipScope {
  level: 'full' | 'chapter' | 'group' | 'none';
  scopeId: string | null;
  userId: string;
}

type Batch = BatchItem<'sqlite'>[];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** §8 */
export function isSponsorshipAvailable(tier: { maxSponsors: number | null; sponsorsCount: number }): boolean {
  if (tier.maxSponsors === null || tier.maxSponsors === undefined) return true;
  return tier.sponsorsCount < tier.maxSponsors;
}

function parseBenefits(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
  } catch {
    return raw.split('\n').map((s) => s.trim()).filter(Boolean);
  }
}

function tierView(t: EventSponsorshipTierRecord) {
  return {
    id: t.id,
    tierName: t.tierName,
    amount: t.amount,
    benefits: parseBenefits(t.benefits),
    maxSponsors: t.maxSponsors,
    sponsorsCount: t.sponsorsCount,
    spotsRemaining: t.maxSponsors == null ? null : Math.max(0, t.maxSponsors - t.sponsorsCount),
    isSoldOut: !isSponsorshipAvailable(t),
    sortOrder: t.sortOrder,
  };
}

export function sponsorshipScopeOf(c: any): SponsorshipScope {
  const user = c.get('user');
  const session = c.get('session');
  if (!user) throw new AppError(ErrorCodes.UNAUTHORIZED, 'Authentication required', 401);
  const roles: Array<{ roleId: string; scopeType: string; scopeId: string }> = session?.roles || [];
  const ids = new Set<string>([user.highest_role, ...roles.map((r) => r.roleId)].filter(Boolean));
  if (ids.has('super_admin') || ids.has('full_admin') || ids.has('billing_admin')) {
    return { level: 'full', scopeId: null, userId: user.id };
  }
  const chapter = roles.find((r) => r.roleId === 'chapter_admin' && r.scopeType === 'chapter' && r.scopeId);
  if (chapter) return { level: 'chapter', scopeId: chapter.scopeId, userId: user.id };
  const group = roles.find((r) => r.roleId === 'group_admin' && r.scopeType === 'group' && r.scopeId);
  if (group) return { level: 'group', scopeId: group.scopeId, userId: user.id };
  return { level: 'none', scopeId: null, userId: user.id };
}

export class SponsorshipsService {
  private static async currency(d1: D1Database, chamberId: string): Promise<string | null> {
    const row = await d1
      .prepare('SELECT default_currency FROM chamber_settings WHERE chamber_id = ? LIMIT 1')
      .bind(chamberId)
      .first<{ default_currency: string | null }>();
    return row?.default_currency || null;
  }

  private static async uniqueInvoiceNumber(d1: D1Database): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const n = (crypto.getRandomValues(new Uint32Array(1))[0] % 90000) + 10000;
      const candidate = `INV-${new Date().getFullYear()}-${n}`;
      const exists = await d1.prepare('SELECT 1 FROM invoices WHERE invoice_number = ?').bind(candidate).first();
      if (!exists) return candidate;
    }
    throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Could not allocate an invoice number', 500);
  }

  private static async logStmt(
    d1: D1Database,
    chamberId: string,
    userId: string,
    action: string,
    sponsorId: string,
    details: Record<string, unknown>
  ) {
    const stmt = drizzle(d1).insert(activityLogs).values({
      id: await newId(d1, 'activity_logs', 'ACT', { chamberId, suffixLength: 6, skipUniqueCheck: true }),
      chamberId,
      userId,
      action,
      targetType: 'event_sponsor',
      targetId: sponsorId,
      detailsJson: JSON.stringify(details),
    });
    return { stmt };
  }

  /** Admin event access with chapter / group scoping (deny by default). */
  private static async scopedEvent(
    d1: D1Database,
    chamberId: string,
    eventId: string,
    scope: SponsorshipScope,
    write: boolean
  ): Promise<EventRecord> {
    const event = await EventSponsorsRepository.findEvent(d1, chamberId, eventId);
    if (!event) throw new AppError(ErrorCodes.NOT_FOUND, 'Event not found in this chamber', 404);
    if (scope.level === 'full') return event;
    if (scope.level === 'chapter' && event.chapterId === scope.scopeId) return event;
    if (scope.level === 'group' && !write && event.groupId === scope.scopeId) return event;
    throw new AppError(ErrorCodes.FORBIDDEN, 'You are not authorized to manage sponsorships for this event', 403);
  }

  // ---------------------------------------------------------------------------
  // §9.1 Public tiers + sponsor wall
  // ---------------------------------------------------------------------------

  static async publicTiers(d1: D1Database, chamberId: string, eventId: string, isAuthenticated: boolean) {
    const event = await EventSponsorsRepository.findEvent(d1, chamberId, eventId);
    // Same visibility rule as the public event page: published, and not staff-only.
    if (!event || event.status !== 'published' || event.visibility === 'staff_only') {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Event not found', 404);
    }
    if (!isAuthenticated && event.visibility !== 'public') {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Event not found', 404);
    }
    const [tiers, sponsors, currency] = await Promise.all([
      EventSponsorsRepository.listTiers(d1, chamberId, eventId),
      // §7.2 / OD-037: only confirmed (paid) sponsors appear publicly.
      EventSponsorsRepository.listSponsors(d1, chamberId, eventId, ['paid']),
      this.currency(d1, chamberId),
    ]);
    return {
      currency,
      isPast: new Date(event.eventDate).getTime() < Date.now(),
      tiers: tiers.map(tierView),
      confirmedSponsors: sponsors.map((s) => ({
        businessName: s.businessName || s.sponsorName,
        logoUrl: s.logoUrl || null,
        tierId: s.tierId,
        tierName: s.tierName || null,
        tierSortOrder: s.tierSortOrder ?? null,
        website: s.website || null,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // §9.2 Member self-service booking
  // ---------------------------------------------------------------------------

  static async book(d1: D1Database, chamberId: string, eventId: string, userId: string, input: BookSponsorshipInput) {
    const db = drizzle(d1);
    const event = await EventSponsorsRepository.findEvent(d1, chamberId, eventId);
    if (!event || event.status !== 'published' || event.visibility === 'staff_only') {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Event not found', 404);
    }
    if (new Date(event.eventDate).getTime() < Date.now()) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'This event has already taken place', 400);
    }

    // §11: the member must be an active representative of the business.
    const business = await EventSponsorsRepository.findRepresentedBusiness(d1, chamberId, userId, input.businessId);
    if (!business) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'You are not a representative of this business', 403);
    }

    const tier = await EventSponsorsRepository.findTier(d1, chamberId, eventId, input.tierId);
    if (!tier) throw new AppError(ErrorCodes.NOT_FOUND, 'Sponsorship package not found for this event', 404);
    if (!isSponsorshipAvailable(tier)) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'This sponsorship package is sold out', 400);
    }
    if (await EventSponsorsRepository.businessAlreadySponsors(d1, chamberId, eventId, business.id)) {
      throw new AppError(ErrorCodes.CONFLICT, 'Your business already sponsors this event', 409);
    }

    let paymentMethodId: string | null = null;
    if (input.paymentMethod === 'card' && input.paymentMethodId) {
      const pm = await d1
        .prepare('SELECT id FROM payment_methods WHERE id = ? AND chamber_id = ? AND user_id = ? LIMIT 1')
        .bind(input.paymentMethodId, chamberId, userId)
        .first<{ id: string }>();
      if (!pm) throw new AppError(ErrorCodes.NOT_FOUND, 'Payment method not found or access denied', 404);
      paymentMethodId = pm.id;
    }

    const amount = round2(Number(tier.amount || 0));
    const currency = await this.currency(d1, chamberId);

    // §7.1: claim the spot atomically before any money moves.
    if (!(await EventSponsorsRepository.claimSpot(d1, chamberId, tier.id, true))) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'This sponsorship package is sold out', 400);
    }
    const release = () =>
      EventSponsorsRepository.releaseSpotStmt(d1, chamberId, tier.id)
        .run()
        .catch((err) => console.error('[SPONSORSHIP_ROLLBACK_FAILED]', err));

    try {
      // Only a verified gateway result counts as paid (BUG-002). Gateway pending OD-001 → 503.
      let txnId: string | null = null;
      const paid = input.paymentMethod === 'card' && amount > 0;
      if (paid) {
        const charge = await PaymentGatewayService.charge({
          chamberId,
          userId,
          amount,
          currency: currency || '',
          description: `Event sponsorship - ${event.title} (${tier.tierName})`,
          paymentMethodId,
        });
        txnId = charge.transactionId;
      }
      const status: 'paid' | 'pending' = paid || amount === 0 ? 'paid' : 'pending';

      const now = new Date();
      const nowIso = now.toISOString();
      const sponsorId = await newId(d1, 'event_sponsors', 'SPN', { chamberId });
      const statements: Batch = [
        db.insert(eventSponsors).values({
          id: sponsorId,
          chamberId,
          eventId,
          businessId: business.id,
          sponsorName: business.businessName,
          sponsorUserId: userId,
          tierId: tier.id,
          amount,
          status,
          paymentDate: status === 'paid' ? nowIso.slice(0, 10) : null,
          createdAt: nowIso,
        }),
      ];

      // §7.3: invoice with invoice_type = 'sponsorship' and related_event_id.
      let invoiceId: string | null = null;
      if (amount > 0) {
        invoiceId = await newId(d1, 'invoices', 'INV', { chamberId });
        const due = new Date(now.getTime() + INVOICE_TERMS_DAYS * 86400000).toISOString().slice(0, 10);
        statements.push(
          db.insert(invoices).values({
            id: invoiceId,
            chamberId,
            invoiceNumber: await this.uniqueInvoiceNumber(d1),
            userId,
            invoiceType: 'sponsorship',
            description: `Event sponsorship - ${event.title} (${tier.tierName}) - ${business.businessName}`,
            amount,
            taxAmount: 0,
            discountAmount: 0,
            totalAmount: amount,
            ...(currency ? { currency } : {}),
            status: status === 'paid' ? 'paid' : 'unpaid',
            dueDate: status === 'paid' ? nowIso.slice(0, 10) : due,
            paidAt: status === 'paid' ? nowIso : null,
            paymentMethodId,
            paymentGatewayTxnId: txnId,
            relatedEventId: eventId,
            createdBy: userId,
            createdAt: nowIso,
            updatedAt: nowIso,
          })
        );
      }
      // §14: activity log.
      statements.push(
        (
          await this.logStmt(d1, chamberId, userId, 'event.sponsorship_booked', sponsorId, {
            eventId,
            tierId: tier.id,
            businessId: business.id,
            amount,
            paymentMethod: input.paymentMethod,
            status,
            invoiceId,
          })
        ).stmt
      );
      await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);

      return { sponsorId, status, invoiceId, amount, currency };
    } catch (err) {
      await release();
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Admin Sponsorship Manager (Tab 6)
  // ---------------------------------------------------------------------------

  static async adminOverview(d1: D1Database, chamberId: string, eventId: string, scope: SponsorshipScope) {
    await this.scopedEvent(d1, chamberId, eventId, scope, false);
    const [tiers, sponsors, currency] = await Promise.all([
      EventSponsorsRepository.listTiers(d1, chamberId, eventId),
      EventSponsorsRepository.listSponsors(d1, chamberId, eventId),
      this.currency(d1, chamberId),
    ]);
    const sum = (list: typeof sponsors) => round2(list.reduce((s, x) => s + Number(x.amount || 0), 0));
    return {
      currency,
      permissions: {
        canRecord: scope.level === 'full' || scope.level === 'chapter',
        canUpdateStatus: scope.level === 'full',
        canRemove: scope.level === 'full',
      },
      summary: {
        totalCommitted: sum(sponsors),
        totalPaid: sum(sponsors.filter((s) => s.status === 'paid')),
        totalOutstanding: sum(sponsors.filter((s) => s.status !== 'paid')),
        sponsorCount: sponsors.length,
      },
      tiers: tiers.map(tierView),
      sponsors: sponsors.map((s) => ({
        id: s.id,
        sponsorName: s.sponsorName,
        businessId: s.businessId,
        logoUrl: s.logoUrl || null,
        website: s.website || null,
        tierId: s.tierId,
        tierName: s.tierName || null,
        amount: s.amount,
        status: s.status || 'pending',
        paymentDate: s.paymentDate,
        createdAt: s.createdAt,
      })),
    };
  }

  /** Offline booking — admins may exceed the self-service capacity guard (§7.1 applies to self-service). */
  static async adminRecord(
    d1: D1Database,
    chamberId: string,
    eventId: string,
    scope: SponsorshipScope,
    input: AdminRecordSponsorInput
  ) {
    const db = drizzle(d1);
    await this.scopedEvent(d1, chamberId, eventId, scope, true);
    if (scope.level === 'chapter' && input.status === 'paid') {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Only billing or full admins can record payments', 403);
    }
    const tier = await EventSponsorsRepository.findTier(d1, chamberId, eventId, input.tierId);
    if (!tier) throw new AppError(ErrorCodes.NOT_FOUND, 'Sponsorship package not found for this event', 404);

    let businessId: string | null = null;
    let sponsorName = input.sponsorName || '';
    if (input.businessId) {
      const business = await EventSponsorsRepository.findBusiness(d1, chamberId, input.businessId);
      if (!business) throw new AppError(ErrorCodes.NOT_FOUND, 'Business not found in this chamber', 404);
      if (await EventSponsorsRepository.businessAlreadySponsors(d1, chamberId, eventId, business.id)) {
        throw new AppError(ErrorCodes.CONFLICT, 'This business already sponsors this event', 409);
      }
      businessId = business.id;
      sponsorName = business.businessName;
    }
    const amount = round2(input.amount ?? Number(tier.amount || 0));

    await EventSponsorsRepository.claimSpot(d1, chamberId, tier.id, false);
    try {
      const sponsorId = await newId(d1, 'event_sponsors', 'SPN', { chamberId });
      await db.batch([
        db.insert(eventSponsors).values({
          id: sponsorId,
          chamberId,
          eventId,
          businessId,
          sponsorName,
          sponsorUserId: null,
          tierId: tier.id,
          amount,
          status: input.status,
          paymentDate: input.status === 'paid' ? input.paymentDate || new Date().toISOString().slice(0, 10) : null,
        }),
        (
          await this.logStmt(d1, chamberId, scope.userId, 'event.sponsorship_recorded', sponsorId, {
            eventId,
            tierId: tier.id,
            businessId,
            amount,
            status: input.status,
          })
        ).stmt,
      ]);
      return { sponsorId, status: input.status, amount };
    } catch (err) {
      await EventSponsorsRepository.releaseSpotStmt(d1, chamberId, tier.id).run().catch(() => undefined);
      throw err;
    }
  }

  /** Payment status update + invoice reconciliation (billing_admin / full_admin). */
  static async adminUpdateStatus(
    d1: D1Database,
    chamberId: string,
    eventId: string,
    sponsorId: string,
    scope: SponsorshipScope,
    input: AdminUpdateSponsorInput
  ) {
    if (scope.level !== 'full') {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Only billing or full admins can update payment status', 403);
    }
    const db = drizzle(d1);
    await this.scopedEvent(d1, chamberId, eventId, scope, true);
    const sponsor = await EventSponsorsRepository.findSponsor(d1, chamberId, eventId, sponsorId);
    if (!sponsor) throw new AppError(ErrorCodes.NOT_FOUND, 'Sponsor not found', 404);

    const now = new Date().toISOString();
    const paymentDate = input.status === 'paid' ? input.paymentDate || now.slice(0, 10) : null;
    const statements: Batch = [
      db
        .update(eventSponsors)
        .set({ status: input.status, paymentDate })
        .where(and(eq(eventSponsors.chamberId, chamberId), eq(eventSponsors.id, sponsor.id))),
    ];
    const invoice = await EventSponsorsRepository.findOpenInvoice(
      d1,
      chamberId,
      eventId,
      sponsor.sponsorUserId,
      Number(sponsor.amount)
    );
    if (invoice && (input.status === 'paid' || input.status === 'overdue')) {
      statements.push(
        db
          .update(invoices)
          .set(
            input.status === 'paid'
              ? { status: 'paid', paidAt: now, updatedAt: now }
              : { status: 'overdue', updatedAt: now }
          )
          .where(and(eq(invoices.chamberId, chamberId), eq(invoices.id, invoice.id)))
      );
    }
    statements.push(
      (
        await this.logStmt(d1, chamberId, scope.userId, 'event.sponsorship_status_updated', sponsor.id, {
          eventId,
          from: sponsor.status,
          to: input.status,
          invoiceId: invoice?.id || null,
        })
      ).stmt
    );
    await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
    return { sponsorId: sponsor.id, status: input.status, paymentDate, invoiceId: invoice?.id || null };
  }

  /** Remove a sponsorship: frees the tier spot and cancels its open invoice. */
  static async adminRemove(d1: D1Database, chamberId: string, eventId: string, sponsorId: string, scope: SponsorshipScope) {
    if (scope.level !== 'full') {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Only billing or full admins can remove sponsorships', 403);
    }
    const db = drizzle(d1);
    await this.scopedEvent(d1, chamberId, eventId, scope, true);
    const sponsor = await EventSponsorsRepository.findSponsor(d1, chamberId, eventId, sponsorId);
    if (!sponsor) throw new AppError(ErrorCodes.NOT_FOUND, 'Sponsor not found', 404);

    const now = new Date().toISOString();
    const statements: Batch = [
      db.delete(eventSponsors).where(and(eq(eventSponsors.chamberId, chamberId), eq(eventSponsors.id, sponsor.id))),
    ];
    if (sponsor.tierId) statements.push(EventSponsorsRepository.releaseSpotStmt(d1, chamberId, sponsor.tierId));
    const invoice = await EventSponsorsRepository.findOpenInvoice(
      d1,
      chamberId,
      eventId,
      sponsor.sponsorUserId,
      Number(sponsor.amount)
    );
    if (invoice) {
      statements.push(
        db
          .update(invoices)
          .set({ status: 'cancelled', updatedAt: now })
          .where(and(eq(invoices.chamberId, chamberId), eq(invoices.id, invoice.id)))
      );
    }
    statements.push(
      (
        await this.logStmt(d1, chamberId, scope.userId, 'event.sponsorship_removed', sponsor.id, {
          eventId,
          sponsorName: sponsor.sponsorName,
          amount: sponsor.amount,
          status: sponsor.status,
          cancelledInvoiceId: invoice?.id || null,
        })
      ).stmt
    );
    await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
    return { sponsorId: sponsor.id, removed: true };
  }
}
