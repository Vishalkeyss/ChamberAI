import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import {
  events,
  eventTicketTypes,
  eventSponsorshipTiers,
  eventPromoCodes,
  activityLogs,
  users,
} from '../../../db/schema';
import type { EventRecord } from '../../../db/schema/events.schema';
import type { EventTicketTypeRecord } from '../../../db/schema/event-ticket-types.schema';
import type { EventSponsorshipTierRecord } from '../../../db/schema/event-sponsors.schema';
import type { EventPromoCodeRecord } from '../../../db/schema/event-promo-codes.schema';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { newId } from '../../../core/shared/ids';
import { validateImageUpload, MAX_IMAGE_UPLOAD_BYTES } from '../../../core/shared/image-upload';
import type {
  CreateEventInput,
  UpdateEventInput,
  RecurrenceInput,
  AdminTicketTypeInput,
  AdminSponsorshipTierInput,
  AdminPromoCodeInput,
} from '../validation/events.validation';
import type { AdminScope } from '../routes/admin-scope';
import { EventsAdminRepository } from '../repositories/events-admin.repository';
import { generateRecurrenceDates, describeRecurrence } from './recurrence';

type Batch = BatchItem<'sqlite'>[];
type EventFields = Omit<CreateEventInput, 'recurrence'>;

const ASSET_PREFIX = '/api/v1/public/assets/';

export function eventPhotoStoragePrefix(chamberId: string): string {
  return `tenants/${chamberId}/events/`;
}

/**
 * Prompt 04.6 — Admin event creation, editing, recurrence & removal.
 */
export class EventCreationService {
  // ---------------------------------------------------------------------------
  // Authorization (§3, §7.1, §11) — backend-enforced, never UI-only
  // ---------------------------------------------------------------------------

  /** full_admin: any chapter. chapter_admin: locked to own chapter. Others: no create/edit. */
  private static resolveChapter(scope: AdminScope, requested: string | null | undefined): string | null {
    if (scope.userRole === 'full_admin') return requested || null;
    if (scope.userRole === 'chapter_admin') {
      if (requested && requested !== scope.userScopeId) {
        throw new AppError(ErrorCodes.FORBIDDEN, 'Chapter admins can only manage events in their own chapter', 403);
      }
      return scope.userScopeId;
    }
    throw new AppError(ErrorCodes.FORBIDDEN, 'You are not allowed to create or edit events', 403);
  }

  private static assertCanManage(scope: AdminScope, event: EventRecord): void {
    if (scope.userRole === 'full_admin') return;
    if (scope.userRole === 'chapter_admin' && event.chapterId === scope.userScopeId) return;
    throw new AppError(ErrorCodes.FORBIDDEN, 'You are not allowed to manage this event', 403);
  }

  // ---------------------------------------------------------------------------
  // Validation shared by create & update
  // ---------------------------------------------------------------------------

  private static async validate(
    d1: D1Database,
    chamberId: string,
    input: EventFields,
    chapterId: string | null
  ): Promise<void> {
    const fail = (msg: string) => {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, msg, 422);
    };
    const start = new Date(input.eventDate).getTime();
    if (input.eventEndDate && new Date(input.eventEndDate).getTime() <= start) {
      fail('End time must be after the start time');
    }
    if (chapterId && !(await EventsAdminRepository.chapterExists(d1, chamberId, chapterId))) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Chapter not found', 404);
    }
    if (input.groupId && !(await EventsAdminRepository.groupExists(d1, chamberId, input.groupId))) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Group not found', 404);
    }

    // OD-045: paid events need a price; free events cannot charge.
    if (input.isPaid) {
      const hasPrice = input.registrationFee > 0 || input.ticketTypes.some((t) => t.price > 0);
      if (!hasPrice) fail('A paid event needs a registration fee or at least one priced ticket type');
    } else {
      if (input.ticketTypes.some((t) => t.price > 0)) fail('Ticket prices must be 0 for a free event');
      if (input.promoCodes.length) fail('Promo codes are only available for paid events');
    }

    const dupe = (values: string[]) => values.find((v, i) => values.indexOf(v) !== i);
    const ticketDupe = dupe(input.ticketTypes.map((t) => t.name.toLowerCase()));
    if (ticketDupe) fail(`Duplicate ticket type "${ticketDupe}"`);
    const tierDupe = dupe(input.sponsorshipTiers.map((t) => t.tierName.toLowerCase()));
    if (tierDupe) fail(`Duplicate sponsorship tier "${tierDupe}"`);
    const codeDupe = dupe(input.promoCodes.map((p) => p.code));
    if (codeDupe) fail(`Duplicate promo code "${codeDupe}"`);
    if (input.promoCodes.some((p) => p.discountType === 'percentage' && p.discountValue > 100)) {
      fail('A percentage discount cannot exceed 100%');
    }

    // Only images uploaded for this chamber's events may be referenced (no arbitrary URLs).
    const photoPrefix = ASSET_PREFIX + eventPhotoStoragePrefix(chamberId);
    if (input.photos.some((p) => !p.startsWith(photoPrefix) || p.includes('..'))) {
      fail('Photos must be uploaded through the event photo uploader');
    }
  }

  /** Column values shared by every occurrence (dates are set per occurrence). */
  private static eventColumns(input: EventFields, chapterId: string | null) {
    return {
      title: input.title,
      description: input.description,
      category: input.category,
      visibility: input.visibility,
      city: input.city,
      venue: input.venue,
      chapterId,
      groupId: input.groupId || null,
      tableArrangement: input.tableArrangement,
      numTables: input.numTables,
      maxCapacity: input.maxCapacity,
      isPaid: input.isPaid ? 1 : 0,
      registrationFee: input.isPaid ? input.registrationFee : 0,
      allowNonMemberRegistration: input.allowNonMemberRegistration ? 1 : 0,
      nonMemberFee: input.isPaid && input.allowNonMemberRegistration ? input.nonMemberFee : null,
      promoteFacebook: input.promoteFacebook ? 1 : 0,
      promoteMeetup: input.promoteMeetup ? 1 : 0,
      promoteEventbrite: input.promoteEventbrite ? 1 : 0,
      photosJson: input.photos.length ? JSON.stringify(input.photos) : null,
      videoUrl: input.videoUrl,
    };
  }

  private static async logActivity(
    d1: D1Database,
    chamberId: string,
    scope: AdminScope,
    action: string,
    eventId: string,
    details: Record<string, unknown>
  ): Promise<{ stmt: BatchItem<'sqlite'> } | null> {
    const db = drizzle(d1);
    // activity_logs.user_id references users; platform super admins have no chamber user row.
    const actor = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, scope.userId), eq(users.chamberId, chamberId)))
      .get();
    if (!actor) return null;
    // Wrapped: a Drizzle builder is thenable and would execute if returned from an async fn.
    const stmt = db.insert(activityLogs).values({
      id: await newId(d1, 'activity_logs', 'ACT', { chamberId, suffixLength: 6, skipUniqueCheck: true }),
      chamberId,
      userId: actor.id,
      action,
      targetType: 'event',
      targetId: eventId,
      detailsJson: JSON.stringify(details),
    });
    return { stmt };
  }

  // ---------------------------------------------------------------------------
  // §9.1 Create (with recurrence expansion §7.3)
  // ---------------------------------------------------------------------------

  static async create(d1: D1Database, chamberId: string, scope: AdminScope, input: CreateEventInput) {
    const db = drizzle(d1);
    const chapterId = this.resolveChapter(scope, input.chapterId);
    await this.validate(d1, chamberId, input, chapterId);

    const start = new Date(input.eventDate);
    const durationMs = input.eventEndDate ? new Date(input.eventEndDate).getTime() - start.getTime() : null;
    const recurrence: RecurrenceInput | null = input.recurrence || null;
    const dates = recurrence ? generateRecurrenceDates(start, recurrence) : [start];
    const isSeries = !!recurrence && dates.length > 1;
    const now = new Date().toISOString();
    const columns = this.eventColumns(input, chapterId);

    const statements: Batch = [];
    const ids: string[] = [];
    for (let i = 0; i < dates.length; i++) {
      const id = await newId(d1, 'events', 'EVT', { chamberId });
      ids.push(id);
      statements.push(
        db.insert(events).values({
          id,
          chamberId,
          ...columns,
          eventDate: dates[i].toISOString(),
          eventEndDate: durationMs != null ? new Date(dates[i].getTime() + durationMs).toISOString() : null,
          isAllDay: 0,
          isRecurring: isSeries ? 1 : 0,
          recurrenceRuleJson: isSeries ? JSON.stringify(recurrence) : null,
          parentEventId: isSeries && i > 0 ? ids[0] : null,
          status: 'published',
          registeredCount: 0,
          createdBy: scope.userId,
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        })
      );
      statements.push(...(await this.childInserts(d1, chamberId, id, input)));
    }

    const log = await this.logActivity(d1, chamberId, scope, 'event.created', ids[0], {
      title: input.title,
      occurrences: ids.length,
      recurrence: isSeries ? describeRecurrence(recurrence!) : null,
    });
    if (log) statements.push(log.stmt);

    await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);

    return {
      id: ids[0],
      title: input.title,
      status: 'published',
      createdAt: now,
      occurrenceIds: ids,
      recurrenceLabel: isSeries ? describeRecurrence(recurrence!) : null,
    };
  }

  private static async childInserts(d1: D1Database, chamberId: string, eventId: string, input: EventFields): Promise<Batch> {
    const db = drizzle(d1);
    const out: Batch = [];
    const opts = { chamberId, suffixLength: 6, skipUniqueCheck: true };
    for (const t of input.ticketTypes) {
      out.push(db.insert(eventTicketTypes).values(await this.ticketValues(d1, chamberId, eventId, t, opts)));
    }
    for (let i = 0; i < input.sponsorshipTiers.length; i++) {
      out.push(
        db.insert(eventSponsorshipTiers).values(await this.tierValues(d1, chamberId, eventId, input.sponsorshipTiers[i], i, opts))
      );
    }
    for (const p of input.promoCodes) {
      out.push(db.insert(eventPromoCodes).values(await this.promoValues(d1, chamberId, eventId, p, opts)));
    }
    return out;
  }

  private static async ticketValues(d1: D1Database, chamberId: string, eventId: string, t: AdminTicketTypeInput, opts: any) {
    return {
      id: await newId(d1, 'event_ticket_types', 'TKT', opts),
      chamberId,
      eventId,
      name: t.name,
      price: t.price,
      description: t.description,
      allowPayLater: t.allowPayLater ? 1 : 0,
      qtyLimit: t.qtyLimit,
      qtySold: 0,
    };
  }

  private static async tierValues(
    d1: D1Database,
    chamberId: string,
    eventId: string,
    t: AdminSponsorshipTierInput,
    sortOrder: number,
    opts: any
  ) {
    return {
      id: await newId(d1, 'event_sponsorship_tiers', 'STIER', opts),
      chamberId,
      eventId,
      tierName: t.tierName,
      amount: t.amount,
      benefits: JSON.stringify(t.benefits),
      maxSponsors: t.maxSponsors ?? null,
      sponsorsCount: 0,
      sortOrder,
    };
  }

  private static async promoValues(d1: D1Database, chamberId: string, eventId: string, p: AdminPromoCodeInput, opts: any) {
    return {
      id: await newId(d1, 'event_promo_codes', 'PROMO', opts),
      chamberId,
      eventId,
      code: p.code,
      discountType: p.discountType,
      discountValue: p.discountValue,
      maxUses: p.maxUses,
      usedCount: 0,
      isActive: p.isActive ? 1 : 0,
    };
  }

  // ---------------------------------------------------------------------------
  // GET for the edit form
  // ---------------------------------------------------------------------------

  static async getForEdit(d1: D1Database, chamberId: string, scope: AdminScope, eventId: string) {
    const event = await EventsAdminRepository.findEvent(d1, chamberId, eventId);
    if (!event) throw new AppError(ErrorCodes.NOT_FOUND, 'Event not found', 404);
    this.assertCanManage(scope, event);

    const { tickets, tiers, promos, sponsorCounts } = await EventsAdminRepository.children(d1, chamberId, [eventId]);
    const rootId = EventsAdminRepository.seriesRootId(event);
    const series = rootId ? await EventsAdminRepository.findSeries(d1, chamberId, rootId) : [];
    let recurrenceLabel: string | null = null;
    if (series.length > 1 && event.recurrenceRuleJson) {
      try {
        recurrenceLabel = describeRecurrence(JSON.parse(event.recurrenceRuleJson));
      } catch {
        recurrenceLabel = null;
      }
    }
    let photos: string[] = [];
    try {
      photos = event.photosJson ? JSON.parse(event.photosJson) : [];
    } catch {
      photos = [];
    }

    return {
      id: event.id,
      title: event.title,
      category: event.category,
      visibility: event.visibility,
      status: event.status,
      eventDate: event.eventDate,
      eventEndDate: event.eventEndDate,
      city: event.city,
      venue: event.venue,
      chapterId: event.chapterId,
      groupId: event.groupId,
      tableArrangement: event.tableArrangement,
      numTables: event.numTables,
      maxCapacity: event.maxCapacity,
      registeredCount: event.registeredCount,
      isPaid: !!event.isPaid,
      registrationFee: event.registrationFee,
      allowNonMemberRegistration: !!event.allowNonMemberRegistration,
      nonMemberFee: event.nonMemberFee,
      description: event.description,
      videoUrl: event.videoUrl,
      photos: Array.isArray(photos) ? photos : [],
      promoteFacebook: !!event.promoteFacebook,
      promoteMeetup: !!event.promoteMeetup,
      promoteEventbrite: !!event.promoteEventbrite,
      ticketTypes: tickets.map((t) => ({
        id: t.id,
        name: t.name,
        price: t.price,
        description: t.description,
        allowPayLater: !!t.allowPayLater,
        qtyLimit: t.qtyLimit,
        qtySold: t.qtySold,
      })),
      sponsorshipTiers: tiers.map((t) => ({
        id: t.id,
        tierName: t.tierName,
        amount: t.amount,
        benefits: parseBenefits(t.benefits),
        maxSponsors: t.maxSponsors,
        sponsorCount: sponsorCounts.get(t.id) || 0,
      })),
      promoCodes: promos.map((p) => ({
        id: p.id,
        code: p.code,
        discountType: p.discountType,
        discountValue: p.discountValue,
        maxUses: p.maxUses,
        usedCount: p.usedCount,
        isActive: !!p.isActive,
      })),
      series: series.length > 1 ? { total: series.length, recurrenceLabel } : null,
    };
  }

  // ---------------------------------------------------------------------------
  // §9.2 Update (single occurrence or whole series)
  // ---------------------------------------------------------------------------

  static async update(d1: D1Database, chamberId: string, scope: AdminScope, eventId: string, input: UpdateEventInput) {
    const db = drizzle(d1);
    const event = await EventsAdminRepository.findEvent(d1, chamberId, eventId);
    if (!event) throw new AppError(ErrorCodes.NOT_FOUND, 'Event not found', 404);
    this.assertCanManage(scope, event);
    const chapterId = this.resolveChapter(scope, input.chapterId);
    await this.validate(d1, chamberId, input, chapterId);

    const rootId = EventsAdminRepository.seriesRootId(event);
    const targets =
      input.applyToSeries && rootId ? await EventsAdminRepository.findSeries(d1, chamberId, rootId) : [event];
    for (const t of targets) this.assertCanManage(scope, t);

    const durationMs = input.eventEndDate
      ? new Date(input.eventEndDate).getTime() - new Date(input.eventDate).getTime()
      : null;
    const now = new Date().toISOString();
    const columns = this.eventColumns(input, chapterId);
    const { tickets, tiers, promos, sponsorCounts } = await EventsAdminRepository.children(
      d1,
      chamberId,
      targets.map((t) => t.id)
    );

    // Original names/codes of the edited event's items, so renamed items can be
    // matched in sibling occurrences when changes are applied to the whole series.
    const originalTicketName = new Map(tickets.filter((t) => t.eventId === eventId).map((t) => [t.id, t.name.toLowerCase()]));
    const originalTierName = new Map(tiers.filter((t) => t.eventId === eventId).map((t) => [t.id, t.tierName.toLowerCase()]));
    const originalCode = new Map(promos.filter((p) => p.eventId === eventId).map((p) => [p.id, p.code]));

    const statements: Batch = [];
    for (const target of targets) {
      const isEdited = target.id === eventId;
      if (input.maxCapacity != null && input.maxCapacity < target.registeredCount) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          `Capacity cannot be lower than the ${target.registeredCount} people already registered`,
          422
        );
      }
      const startIso = isEdited ? new Date(input.eventDate).toISOString() : target.eventDate;
      statements.push(
        db
          .update(events)
          .set({
            ...columns,
            eventDate: startIso,
            eventEndDate: durationMs != null ? new Date(new Date(startIso).getTime() + durationMs).toISOString() : null,
            updatedAt: now,
          })
          .where(and(eq(events.chamberId, chamberId), eq(events.id, target.id)))
      );

      statements.push(
        ...(await this.syncTickets(d1, chamberId, target, isEdited, input.ticketTypes, tickets, originalTicketName)),
        ...(await this.syncTiers(d1, chamberId, target, isEdited, input.sponsorshipTiers, tiers, sponsorCounts, originalTierName)),
        ...(await this.syncPromos(d1, chamberId, target, isEdited, input.promoCodes, promos, originalCode))
      );
    }

    const log = await this.logActivity(d1, chamberId, scope, 'event.updated', eventId, {
      title: input.title,
      appliedToSeries: targets.length > 1,
      occurrences: targets.length,
    });
    if (log) statements.push(log.stmt);
    await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);

    return { id: eventId, updatedAt: now, updatedOccurrences: targets.length };
  }

  /** Match an incoming item to an existing row of `target` (by id on the edited event, by original name elsewhere). */
  private static matchExisting<T extends { id: string; eventId: string }>(
    target: EventRecord,
    isEdited: boolean,
    incomingId: string | undefined,
    existing: T[],
    originalKey: Map<string, string>,
    keyOf: (row: T) => string
  ): T | undefined {
    if (!incomingId) return undefined;
    if (isEdited) return existing.find((e) => e.id === incomingId && e.eventId === target.id);
    const key = originalKey.get(incomingId);
    return key ? existing.find((e) => e.eventId === target.id && keyOf(e) === key) : undefined;
  }

  private static async syncTickets(
    d1: D1Database,
    chamberId: string,
    target: EventRecord,
    isEdited: boolean,
    incoming: AdminTicketTypeInput[],
    all: EventTicketTypeRecord[],
    originalName: Map<string, string>
  ): Promise<Batch> {
    const db = drizzle(d1);
    const existing = all.filter((t) => t.eventId === target.id);
    const kept = new Set<string>();
    const out: Batch = [];
    for (const t of incoming) {
      const match = this.matchExisting(target, isEdited, t.id, existing, originalName, (r) => r.name.toLowerCase());
      if (match) {
        if (t.qtyLimit != null && t.qtyLimit < match.qtySold) {
          throw new AppError(
            ErrorCodes.VALIDATION_ERROR,
            `"${t.name}" already sold ${match.qtySold} tickets; its limit cannot be lower`,
            422
          );
        }
        kept.add(match.id);
        out.push(
          db
            .update(eventTicketTypes)
            .set({
              name: t.name,
              price: t.price,
              description: t.description,
              allowPayLater: t.allowPayLater ? 1 : 0,
              qtyLimit: t.qtyLimit,
            })
            .where(and(eq(eventTicketTypes.chamberId, chamberId), eq(eventTicketTypes.id, match.id)))
        );
      } else {
        out.push(
          db
            .insert(eventTicketTypes)
            .values(await this.ticketValues(d1, chamberId, target.id, t, { chamberId, suffixLength: 6, skipUniqueCheck: true }))
        );
      }
    }
    for (const row of existing) {
      if (kept.has(row.id)) continue;
      if (row.qtySold > 0) {
        throw new AppError(
          ErrorCodes.CONFLICT,
          `Ticket type "${row.name}" has sold tickets and cannot be removed`,
          409
        );
      }
      out.push(
        db
          .delete(eventTicketTypes)
          .where(and(eq(eventTicketTypes.chamberId, chamberId), eq(eventTicketTypes.id, row.id)))
      );
    }
    return out;
  }

  private static async syncTiers(
    d1: D1Database,
    chamberId: string,
    target: EventRecord,
    isEdited: boolean,
    incoming: AdminSponsorshipTierInput[],
    all: EventSponsorshipTierRecord[],
    sponsorCounts: Map<string, number>,
    originalName: Map<string, string>
  ): Promise<Batch> {
    const db = drizzle(d1);
    const existing = all.filter((t) => t.eventId === target.id);
    const kept = new Set<string>();
    const out: Batch = [];
    for (let i = 0; i < incoming.length; i++) {
      const t = incoming[i];
      const match = this.matchExisting(target, isEdited, t.id, existing, originalName, (r) => r.tierName.toLowerCase());
      if (match) {
        kept.add(match.id);
        const held = sponsorCounts.get(match.id) || 0;
        if (t.maxSponsors != null && t.maxSponsors < held) {
          throw new AppError(
            ErrorCodes.CONFLICT,
            `Sponsorship tier "${t.tierName}" already has ${held} sponsors; max sponsors cannot be lower`,
            409
          );
        }
        out.push(
          db
            .update(eventSponsorshipTiers)
            .set({
              tierName: t.tierName,
              amount: t.amount,
              benefits: JSON.stringify(t.benefits),
              maxSponsors: t.maxSponsors ?? null,
              sortOrder: i,
            })
            .where(and(eq(eventSponsorshipTiers.chamberId, chamberId), eq(eventSponsorshipTiers.id, match.id)))
        );
      } else {
        out.push(
          db
            .insert(eventSponsorshipTiers)
            .values(await this.tierValues(d1, chamberId, target.id, t, i, { chamberId, suffixLength: 6, skipUniqueCheck: true }))
        );
      }
    }
    for (const row of existing) {
      if (kept.has(row.id)) continue;
      if ((sponsorCounts.get(row.id) || 0) > 0) {
        throw new AppError(
          ErrorCodes.CONFLICT,
          `Sponsorship tier "${row.tierName}" already has sponsors and cannot be removed`,
          409
        );
      }
      out.push(
        db
          .delete(eventSponsorshipTiers)
          .where(and(eq(eventSponsorshipTiers.chamberId, chamberId), eq(eventSponsorshipTiers.id, row.id)))
      );
    }
    return out;
  }

  private static async syncPromos(
    d1: D1Database,
    chamberId: string,
    target: EventRecord,
    isEdited: boolean,
    incoming: AdminPromoCodeInput[],
    all: EventPromoCodeRecord[],
    originalCode: Map<string, string>
  ): Promise<Batch> {
    const db = drizzle(d1);
    const existing = all.filter((p) => p.eventId === target.id);
    const kept = new Set<string>();
    const out: Batch = [];
    for (const p of incoming) {
      const match =
        this.matchExisting(target, isEdited, p.id, existing, originalCode, (r) => r.code) ||
        // A code typed again that already exists on this event (UNIQUE(event_id, code))
        existing.find((e) => e.code === p.code && !kept.has(e.id));
      if (match) {
        kept.add(match.id);
        out.push(
          db
            .update(eventPromoCodes)
            .set({
              code: p.code,
              discountType: p.discountType,
              discountValue: p.discountValue,
              maxUses: p.maxUses,
              isActive: p.isActive ? 1 : 0,
            })
            .where(and(eq(eventPromoCodes.chamberId, chamberId), eq(eventPromoCodes.id, match.id)))
        );
      } else {
        out.push(
          db
            .insert(eventPromoCodes)
            .values(await this.promoValues(d1, chamberId, target.id, p, { chamberId, suffixLength: 6, skipUniqueCheck: true }))
        );
      }
    }
    for (const row of existing) {
      if (kept.has(row.id)) continue;
      // OD-040: a promo code that has been used is deactivated, never deleted.
      out.push(
        row.usedCount > 0
          ? db
              .update(eventPromoCodes)
              .set({ isActive: 0 })
              .where(and(eq(eventPromoCodes.chamberId, chamberId), eq(eventPromoCodes.id, row.id)))
          : db
              .delete(eventPromoCodes)
              .where(and(eq(eventPromoCodes.chamberId, chamberId), eq(eventPromoCodes.id, row.id)))
      );
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Delete / cancel (UI "Delete event?"; §14 cancellation log)
  // ---------------------------------------------------------------------------

  static async remove(d1: D1Database, chamberId: string, scope: AdminScope, eventId: string) {
    const db = drizzle(d1);
    const event = await EventsAdminRepository.findEvent(d1, chamberId, eventId);
    if (!event) throw new AppError(ErrorCodes.NOT_FOUND, 'Event not found', 404);
    this.assertCanManage(scope, event);

    const registrations = await EventsAdminRepository.registrationCount(d1, chamberId, eventId);
    const statements: Batch = [];
    let result: { id: string; deleted: boolean; status: string };

    if (registrations > 0) {
      // People are registered: keep their records, cancel instead of deleting (OD-006).
      statements.push(
        db
          .update(events)
          .set({ status: 'cancelled', updatedAt: new Date().toISOString() })
          .where(and(eq(events.chamberId, chamberId), eq(events.id, eventId)))
      );
      result = { id: eventId, deleted: false, status: 'cancelled' };
    } else {
      // Keep a deleted series master's siblings linked: promote the next occurrence to root.
      if (!event.parentEventId && event.isRecurring) {
        const siblings = (await EventsAdminRepository.findSeries(d1, chamberId, eventId)).filter((e) => e.id !== eventId);
        if (siblings.length) {
          const [newRoot, ...rest] = siblings;
          statements.push(
            db
              .update(events)
              .set({ parentEventId: null })
              .where(and(eq(events.chamberId, chamberId), eq(events.id, newRoot.id)))
          );
          for (const s of rest) {
            statements.push(
              db
                .update(events)
                .set({ parentEventId: newRoot.id })
                .where(and(eq(events.chamberId, chamberId), eq(events.id, s.id)))
            );
          }
        }
      }
      statements.push(db.delete(events).where(and(eq(events.chamberId, chamberId), eq(events.id, eventId))));
      result = { id: eventId, deleted: true, status: 'deleted' };
    }

    const log = await this.logActivity(
      d1,
      chamberId,
      scope,
      result.deleted ? 'event.deleted' : 'event.cancelled',
      eventId,
      { title: event.title, registrations }
    );
    if (log) statements.unshift(log.stmt); // log first: on delete the target row is gone afterwards
    await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Photo upload (OD-038) → R2, returned URL is stored in photos_json via create/update
  // ---------------------------------------------------------------------------

  static async uploadPhoto(
    env: { STORAGE?: R2Bucket },
    chamberId: string,
    scope: AdminScope,
    fileBuffer: ArrayBuffer
  ): Promise<{ url: string }> {
    if (scope.userRole !== 'full_admin' && scope.userRole !== 'chapter_admin') {
      throw new AppError(ErrorCodes.FORBIDDEN, 'You are not allowed to upload event photos', 403);
    }
    const image = validateImageUpload(fileBuffer, MAX_IMAGE_UPLOAD_BYTES);
    if (!env.STORAGE) {
      throw new AppError(ErrorCodes.INTERNAL_ERROR, 'File storage is not configured', 500);
    }
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    const name = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    const key = `${eventPhotoStoragePrefix(chamberId)}${name}.${image.ext}`;
    await env.STORAGE.put(key, fileBuffer, { httpMetadata: { contentType: image.mime } });
    return { url: `${ASSET_PREFIX}${key}` };
  }
}

function parseBenefits(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
  } catch {
    return raw.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
  }
}
