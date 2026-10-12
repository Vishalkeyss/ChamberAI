import { drizzle } from 'drizzle-orm/d1';
import { and, eq, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import {
  events,
  eventTicketTypes,
  eventPromoCodes,
  eventRegistrations,
  users,
  invoices,
  pointsHistory,
} from '../../../db/schema';
import type { EventRecord } from '../../../db/schema/events.schema';
import type { EventTicketTypeRecord } from '../../../db/schema/event-ticket-types.schema';
import type { EventPromoCodeRecord } from '../../../db/schema/event-promo-codes.schema';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { newId } from '../../../core/shared/ids';
import { PaymentGatewayService } from '../../billing/services/payment-gateway.service';
import type { EventRegisterInput, ValidatePromoInput } from '../validation/events.validation';

/**
 * Prompt 04.3 §8 — "Points Discount = redeemed_points × $0.05".
 * Fixed by the spec formula; there is no per-chamber setting for it yet (OD-030).
 */
export const POINT_REDEMPTION_VALUE = 0.05;

const ADMIN_ROLES = new Set(['full_admin', 'billing_admin', 'chapter_admin', 'group_admin', 'super_admin']);

export interface RegistrationActor {
  /** null for public guests */
  userId: string | null;
  /** role ids from the session */
  roles: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export class EventRegistrationService {
  // ---------------------------------------------------------------------------
  // Pricing (§8)
  // ---------------------------------------------------------------------------

  /** OD-021: ticket.price when a tier is chosen; otherwise member/non-member event fee. */
  static basePrice(event: EventRecord, ticket: EventTicketTypeRecord | null, isMember: boolean): number {
    if (ticket) return Number(ticket.price || 0);
    if (!event.isPaid) return 0;
    const fee = isMember ? event.registrationFee : (event.nonMemberFee ?? event.registrationFee);
    return Number(fee || 0);
  }

  /** OD-023: DB discount types are 'percentage' | 'flat'. */
  static promoDiscount(base: number, promo: EventPromoCodeRecord | null): number {
    if (!promo || base <= 0) return 0;
    const value = Number(promo.discountValue || 0);
    const discount = promo.discountType === 'percentage' ? base * (value / 100) : Math.min(base, value);
    return round2(Math.min(base, Math.max(0, discount)));
  }

  // ---------------------------------------------------------------------------
  // Lookups (all tenant-scoped)
  // ---------------------------------------------------------------------------

  private static async loadEvent(d1: D1Database, chamberId: string, eventId: string): Promise<EventRecord> {
    const db = drizzle(d1);
    const event = await db
      .select()
      .from(events)
      .where(and(eq(events.chamberId, chamberId), eq(events.id, eventId)))
      .get();
    if (!event) throw new AppError(ErrorCodes.NOT_FOUND, 'Event not found', 404);
    return event;
  }

  /** OD-026 / OD-028: who may register for which event. */
  private static assertRegistrable(event: EventRecord, actor: RegistrationActor): void {
    if (event.status !== 'published') {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'Registration is not open for this event', 400);
    }
    if (new Date(event.eventDate).getTime() < Date.now()) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'This event has already taken place', 400);
    }
    const isAdmin = actor.roles.some((r) => ADMIN_ROLES.has(r));
    if (event.visibility === 'staff_only' && !isAdmin) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'This event is restricted to chamber staff', 403);
    }
    if (!actor.userId) {
      if (event.visibility !== 'public') {
        throw new AppError(ErrorCodes.FORBIDDEN, 'This event is not open to public registration', 403);
      }
      if (!event.allowNonMemberRegistration) {
        throw new AppError(ErrorCodes.FORBIDDEN, 'This event is open to chamber members only', 403);
      }
    }
  }

  private static async loadTicket(
    d1: D1Database,
    chamberId: string,
    eventId: string,
    ticketTypeId: string | undefined
  ): Promise<EventTicketTypeRecord | null> {
    const db = drizzle(d1);
    const tiers = await db
      .select()
      .from(eventTicketTypes)
      .where(and(eq(eventTicketTypes.chamberId, chamberId), eq(eventTicketTypes.eventId, eventId)));

    if (!ticketTypeId) {
      if (tiers.length > 0) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Please select a ticket type', 422);
      }
      return null;
    }
    const ticket = tiers.find((t) => t.id === ticketTypeId);
    if (!ticket) throw new AppError(ErrorCodes.NOT_FOUND, 'Ticket type not found for this event', 404);
    return ticket;
  }

  private static async loadPromo(
    d1: D1Database,
    chamberId: string,
    eventId: string,
    code: string | undefined
  ): Promise<EventPromoCodeRecord | null> {
    if (!code) return null;
    const db = drizzle(d1);
    const promo = await db
      .select()
      .from(eventPromoCodes)
      .where(
        and(
          eq(eventPromoCodes.chamberId, chamberId),
          eq(eventPromoCodes.eventId, eventId),
          sql`upper(${eventPromoCodes.code}) = ${code.trim().toUpperCase()}`
        )
      )
      .get();
    if (
      !promo ||
      !promo.isActive ||
      (promo.maxUses != null && promo.usedCount >= promo.maxUses)
    ) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Invalid or expired code', 422);
    }
    return promo;
  }

  private static async loadCurrency(d1: D1Database, chamberId: string): Promise<string | null> {
    const row = await d1
      .prepare('SELECT default_currency FROM chamber_settings WHERE chamber_id = ? LIMIT 1')
      .bind(chamberId)
      .first<{ default_currency: string | null }>();
    return row?.default_currency || null;
  }

  // ---------------------------------------------------------------------------
  // §9.1 validate-promo
  // ---------------------------------------------------------------------------

  static async validatePromo(
    d1: D1Database,
    chamberId: string,
    eventId: string,
    actor: RegistrationActor,
    input: ValidatePromoInput
  ) {
    const event = await this.loadEvent(d1, chamberId, eventId);
    this.assertRegistrable(event, actor);
    const ticket = await this.loadTicket(d1, chamberId, eventId, input.ticketTypeId);
    const promo = await this.loadPromo(d1, chamberId, eventId, input.code);
    const isMember = actor.roles.includes('member');
    const base = this.basePrice(event, ticket, isMember);
    return {
      valid: true,
      discountType: promo!.discountType,
      discountValue: promo!.discountValue,
      discountAmount: this.promoDiscount(base, promo),
    };
  }

  // ---------------------------------------------------------------------------
  // §9.2 register (member + guest)
  // ---------------------------------------------------------------------------

  static async register(
    d1: D1Database,
    chamberId: string,
    eventId: string,
    actor: RegistrationActor,
    input: EventRegisterInput
  ) {
    const db = drizzle(d1);
    const isGuest = !actor.userId;
    const isMember = !isGuest && actor.roles.includes('member');

    // 1. Validate everything before touching any counter.
    const event = await this.loadEvent(d1, chamberId, eventId);
    this.assertRegistrable(event, actor);

    let attendeeName: string;
    let attendeeEmail: string;
    let pointsBalance = 0;
    if (isGuest) {
      if (!input.guestDetails) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Guest name and email are required', 422);
      }
      if (input.redeemPoints) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Points can only be redeemed by members', 422);
      }
      attendeeName = input.guestDetails.name;
      attendeeEmail = input.guestDetails.email.toLowerCase();
    } else {
      const user = await db
        .select({ name: users.name, email: users.email, pointsBalance: users.pointsBalance })
        .from(users)
        .where(and(eq(users.id, actor.userId!), eq(users.chamberId, chamberId)))
        .get();
      if (!user) throw new AppError(ErrorCodes.USER_NOT_FOUND, 'User not found', 404);
      attendeeName = user.name || user.email;
      attendeeEmail = user.email.toLowerCase();
      pointsBalance = user.pointsBalance;
    }

    await this.assertNotRegistered(d1, chamberId, eventId, actor.userId, attendeeEmail);

    const ticket = await this.loadTicket(d1, chamberId, eventId, input.ticketTypeId);
    if (ticket && ticket.qtyLimit != null && ticket.qtySold >= ticket.qtyLimit) {
      throw new AppError(ErrorCodes.CONFLICT, 'This ticket type is sold out', 409);
    }
    const promo = await this.loadPromo(d1, chamberId, eventId, input.promoCode);

    const base = round2(this.basePrice(event, ticket, isMember));
    const promoDiscount = this.promoDiscount(base, promo);
    const redeemPoints = input.redeemPoints || 0;
    if (redeemPoints > pointsBalance) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, `You only have ${pointsBalance} points`, 422);
    }
    const remainingAfterPromo = round2(base - promoDiscount);
    const maxUsefulPoints = Math.ceil(remainingAfterPromo / POINT_REDEMPTION_VALUE - 1e-9);
    if (redeemPoints > maxUsefulPoints) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        `You can redeem at most ${maxUsefulPoints} points for this ticket`,
        422
      );
    }
    const pointsDiscount = round2(Math.min(remainingAfterPromo, redeemPoints * POINT_REDEMPTION_VALUE));
    const totalPayable = round2(Math.max(0, base - promoDiscount - pointsDiscount));
    const currency = await this.loadCurrency(d1, chamberId);

    // Paid without a gateway: only tiers that allow pay-later can be confirmed (OD-022).
    const payLater = totalPayable > 0 && !!ticket?.allowPayLater;

    let paymentMethodId: string | null = null;
    if (input.paymentMethodId) {
      if (isGuest) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Saved cards are for members only', 422);
      const pm = await d1
        .prepare('SELECT id FROM payment_methods WHERE id = ? AND chamber_id = ? AND user_id = ? LIMIT 1')
        .bind(input.paymentMethodId, chamberId, actor.userId)
        .first<{ id: string }>();
      if (!pm) throw new AppError(ErrorCodes.NOT_FOUND, 'Payment method not found or access denied', 404);
      paymentMethodId = pm.id;
    }

    // 2. Claim a seat atomically (BUG-018). No seat → waitlist without any charge (§7.2).
    const seat = await db
      .update(events)
      .set({ registeredCount: sql`${events.registeredCount} + 1` })
      .where(
        and(
          eq(events.chamberId, chamberId),
          eq(events.id, eventId),
          sql`(${events.maxCapacity} IS NULL OR ${events.maxCapacity} <= 0 OR ${events.registeredCount} < ${events.maxCapacity})`
        )
      )
      .run();

    if (!seat.meta.changes) {
      return this.addToWaitlist(d1, chamberId, event, actor, ticket, attendeeName, attendeeEmail, currency);
    }

    // 3. Claim the remaining limited resources; undo everything claimed so far on any failure.
    const undo: Array<() => Promise<unknown>> = [
      () =>
        db
          .update(events)
          .set({ registeredCount: sql`MAX(0, ${events.registeredCount} - 1)` })
          .where(and(eq(events.chamberId, chamberId), eq(events.id, eventId)))
          .run(),
    ];
    const rollback = async () => {
      for (const fn of undo.reverse()) {
        await fn().catch((err) => console.error('[EVENT_REGISTRATION_ROLLBACK_FAILED]', err));
      }
    };

    let registrationId: string | null = null;
    try {
      if (ticket) {
        const claimed = await db
          .update(eventTicketTypes)
          .set({ qtySold: sql`${eventTicketTypes.qtySold} + 1` })
          .where(
            and(
              eq(eventTicketTypes.chamberId, chamberId),
              eq(eventTicketTypes.id, ticket.id),
              sql`(${eventTicketTypes.qtyLimit} IS NULL OR ${eventTicketTypes.qtySold} < ${eventTicketTypes.qtyLimit})`
            )
          )
          .run();
        if (!claimed.meta.changes) throw new AppError(ErrorCodes.CONFLICT, 'This ticket type is sold out', 409);
        undo.push(() =>
          db
            .update(eventTicketTypes)
            .set({ qtySold: sql`MAX(0, ${eventTicketTypes.qtySold} - 1)` })
            .where(and(eq(eventTicketTypes.chamberId, chamberId), eq(eventTicketTypes.id, ticket.id)))
            .run()
        );
      }

      if (promo) {
        const claimed = await db
          .update(eventPromoCodes)
          .set({ usedCount: sql`${eventPromoCodes.usedCount} + 1` })
          .where(
            and(
              eq(eventPromoCodes.chamberId, chamberId),
              eq(eventPromoCodes.id, promo.id),
              eq(eventPromoCodes.isActive, 1),
              sql`(${eventPromoCodes.maxUses} IS NULL OR ${eventPromoCodes.usedCount} < ${eventPromoCodes.maxUses})`
            )
          )
          .run();
        if (!claimed.meta.changes) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Invalid or expired code', 422);
        undo.push(() =>
          db
            .update(eventPromoCodes)
            .set({ usedCount: sql`MAX(0, ${eventPromoCodes.usedCount} - 1)` })
            .where(and(eq(eventPromoCodes.chamberId, chamberId), eq(eventPromoCodes.id, promo.id)))
            .run()
        );
      }

      if (redeemPoints > 0) {
        const claimed = await db
          .update(users)
          .set({ pointsBalance: sql`${users.pointsBalance} - ${redeemPoints}` })
          .where(
            and(
              eq(users.chamberId, chamberId),
              eq(users.id, actor.userId!),
              sql`${users.pointsBalance} >= ${redeemPoints}`
            )
          )
          .run();
        if (!claimed.meta.changes) throw new AppError(ErrorCodes.CONFLICT, 'Not enough points', 409);
        undo.push(() =>
          db
            .update(users)
            .set({ pointsBalance: sql`${users.pointsBalance} + ${redeemPoints}` })
            .where(and(eq(users.chamberId, chamberId), eq(users.id, actor.userId!)))
            .run()
        );
      }

      // 4. Payment. Only a verified gateway result counts as paid (§7.3, BUG-002).
      let paymentStatus: 'paid' | 'pay_later' = 'paid';
      let amountPaid = 0;
      let txnId: string | null = null;
      if (totalPayable > 0) {
        if (payLater) {
          paymentStatus = 'pay_later';
        } else {
          const charge = await PaymentGatewayService.charge({
            chamberId,
            userId: actor.userId,
            amount: totalPayable,
            currency: currency || '',
            description: `Event registration - ${event.title}`,
            paymentMethodId,
          });
          txnId = charge.transactionId;
          amountPaid = totalPayable;
        }
      }

      // 5. Registration row — guarded against concurrent duplicates.
      registrationId = await newId(d1, 'event_registrations', 'REG', { chamberId });
      const inserted = await this.insertRegistration(d1, {
        id: registrationId,
        chamberId,
        eventId,
        userId: actor.userId,
        ticketTypeId: ticket?.id || null,
        guestName: attendeeName,
        guestEmail: attendeeEmail,
        registrationType: isGuest ? 'guest' : isMember ? 'member' : 'non_member',
        promoCodeId: promo?.id || null,
        amountPaid,
        discountAmount: round2(promoDiscount + pointsDiscount),
        paymentStatus,
        paymentMethodId,
        isWaitlisted: 0,
        waitlistPosition: null,
      });
      if (!inserted) throw new AppError(ErrorCodes.CONFLICT, 'You are already registered for this event', 409);
      const regId = registrationId;
      undo.push(() =>
        db
          .delete(eventRegistrations)
          .where(and(eq(eventRegistrations.chamberId, chamberId), eq(eventRegistrations.id, regId)))
          .run()
      );

      // 6. Invoice + points ledger in one batch.
      const now = new Date().toISOString();
      const statements: BatchItem<'sqlite'>[] = [];
      let invoiceId: string | null = null;
      if (totalPayable > 0 && actor.userId) {
        invoiceId = await newId(d1, 'invoices', 'INV', { chamberId });
        const invoiceNumber = await this.uniqueInvoiceNumber(d1);
        const ticketLabel = ticket ? ` (${ticket.name})` : '';
        statements.push(
          db
            .insert(invoices)
            .values({
              id: invoiceId,
              chamberId,
              invoiceNumber,
              userId: actor.userId,
              invoiceType: 'event',
              description: `Event registration - ${event.title}${ticketLabel}`,
              amount: base,
              taxAmount: 0,
              discountAmount: round2(promoDiscount + pointsDiscount),
              totalAmount: totalPayable,
              // Chamber's configured currency; when unset the column's DB default applies.
              ...(currency ? { currency } : {}),
              status: paymentStatus === 'paid' ? 'paid' : 'unpaid',
              dueDate: event.eventDate.slice(0, 10),
              paidAt: paymentStatus === 'paid' ? now : null,
              paymentMethodId,
              paymentGatewayTxnId: txnId,
              relatedEventId: eventId,
              createdBy: actor.userId,
              createdAt: now,
              updatedAt: now,
            })
        );
      }
      if (redeemPoints > 0) {
        const pointsId = await newId(d1, 'points_history', 'PTS', { chamberId, suffixLength: 6, skipUniqueCheck: true });
        statements.push(
          db.insert(pointsHistory).values({
            id: pointsId,
            chamberId,
            userId: actor.userId!,
            points: redeemPoints,
            type: 'redeemed',
            reason: `Event registration - ${event.title}`,
            relatedEventId: eventId,
            createdAt: now,
          })
        );
      }
      if (statements.length) await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);

      return {
        registrationId,
        status: 'confirmed' as const,
        isWaitlisted: false,
        waitlistPosition: null,
        paymentStatus,
        qrCodeHash: this.qrCodeHash(eventId, registrationId),
        invoiceId,
        totalPaid: amountPaid,
        amountDue: paymentStatus === 'pay_later' ? totalPayable : 0,
        pricing: {
          basePrice: base,
          promoDiscount,
          pointsDiscount,
          redeemedPoints: redeemPoints,
          totalPayable,
          currency,
        },
        attendee: { name: attendeeName, email: attendeeEmail },
      };
    } catch (err) {
      await rollback();
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** OD-024: matches the 04.2 check-in validator format `EVT-<event last 6>-…`. */
  static qrCodeHash(eventId: string, registrationId: string): string {
    return `EVT-${eventId.slice(-6)}-${registrationId}`.toUpperCase();
  }

  private static async assertNotRegistered(
    d1: D1Database,
    chamberId: string,
    eventId: string,
    userId: string | null,
    email: string
  ) {
    const existing = await d1
      .prepare(
        `SELECT id FROM event_registrations
         WHERE chamber_id = ? AND event_id = ?
           AND ((? IS NOT NULL AND user_id = ?) OR lower(guest_email) = ?)
         LIMIT 1`
      )
      .bind(chamberId, eventId, userId, userId, email)
      .first();
    if (existing) {
      throw new AppError(ErrorCodes.CONFLICT, 'You are already registered for this event', 409);
    }
  }

  /**
   * Raw SQL: Drizzle's insert builder cannot express INSERT … SELECT … WHERE NOT EXISTS,
   * which is what makes the duplicate guard race-safe. Returns false if a duplicate exists.
   */
  private static async insertRegistration(
    d1: D1Database,
    r: {
      id: string;
      chamberId: string;
      eventId: string;
      userId: string | null;
      ticketTypeId: string | null;
      guestName: string;
      guestEmail: string;
      registrationType: 'member' | 'non_member' | 'guest';
      promoCodeId: string | null;
      amountPaid: number;
      discountAmount: number;
      paymentStatus: 'paid' | 'unpaid' | 'pay_later';
      paymentMethodId: string | null;
      isWaitlisted: 0 | 1;
      waitlistPosition: number | null;
    }
  ): Promise<boolean> {
    const result = await d1
      .prepare(
        `INSERT INTO event_registrations (
           id, chamber_id, event_id, user_id, ticket_type_id, guest_name, guest_email, registration_type,
           promo_code_id, amount_paid, discount_amount, payment_status, payment_method_id,
           check_in_status, is_waitlisted, waitlist_position, created_at
         )
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_checked_in', ?, ?, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM event_registrations
           WHERE chamber_id = ? AND event_id = ?
             AND ((? IS NOT NULL AND user_id = ?) OR lower(guest_email) = ?)
         )`
      )
      .bind(
        r.id,
        r.chamberId,
        r.eventId,
        r.userId,
        r.ticketTypeId,
        r.guestName,
        r.guestEmail,
        r.registrationType,
        r.promoCodeId,
        r.amountPaid,
        r.discountAmount,
        r.paymentStatus,
        r.paymentMethodId,
        r.isWaitlisted,
        r.waitlistPosition,
        new Date().toISOString(),
        r.chamberId,
        r.eventId,
        r.userId,
        r.userId,
        r.guestEmail
      )
      .run();
    return !!result.meta.changes;
  }

  /** §7.2: full event → waitlisted, nothing charged, no promo/points consumed. */
  private static async addToWaitlist(
    d1: D1Database,
    chamberId: string,
    event: EventRecord,
    actor: RegistrationActor,
    ticket: EventTicketTypeRecord | null,
    attendeeName: string,
    attendeeEmail: string,
    currency: string | null
  ) {
    const position = await d1
      .prepare(
        `SELECT COALESCE(MAX(waitlist_position), 0) + 1 AS pos
         FROM event_registrations WHERE chamber_id = ? AND event_id = ? AND is_waitlisted = 1`
      )
      .bind(chamberId, event.id)
      .first<{ pos: number }>();
    const isGuest = !actor.userId;
    const registrationId = await newId(d1, 'event_registrations', 'REG', { chamberId });
    const inserted = await this.insertRegistration(d1, {
      id: registrationId,
      chamberId,
      eventId: event.id,
      userId: actor.userId,
      ticketTypeId: ticket?.id || null,
      guestName: attendeeName,
      guestEmail: attendeeEmail,
      registrationType: isGuest ? 'guest' : actor.roles.includes('member') ? 'member' : 'non_member',
      promoCodeId: null,
      amountPaid: 0,
      discountAmount: 0,
      paymentStatus: 'unpaid',
      paymentMethodId: null,
      isWaitlisted: 1,
      waitlistPosition: position?.pos ?? 1,
    });
    if (!inserted) throw new AppError(ErrorCodes.CONFLICT, 'You are already registered for this event', 409);

    return {
      registrationId,
      status: 'waitlisted' as const,
      isWaitlisted: true,
      waitlistPosition: position?.pos ?? 1,
      paymentStatus: 'unpaid' as const,
      qrCodeHash: null,
      invoiceId: null,
      totalPaid: 0,
      amountDue: 0,
      pricing: null,
      currency,
      attendee: { name: attendeeName, email: attendeeEmail },
    };
  }

  /** Same INV-YYYY-NNNNN format as membership invoices, CSPRNG + uniqueness check. */
  private static async uniqueInvoiceNumber(d1: D1Database): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const n = crypto.getRandomValues(new Uint32Array(1))[0] % 90000 + 10000;
      const candidate = `INV-${new Date().getFullYear()}-${n}`;
      const exists = await d1.prepare('SELECT 1 FROM invoices WHERE invoice_number = ?').bind(candidate).first();
      if (!exists) return candidate;
    }
    throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Could not allocate an invoice number', 500);
  }
}
