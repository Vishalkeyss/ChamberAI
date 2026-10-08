import { drizzle } from 'drizzle-orm/d1';
import { eq, and, sql, desc, asc, like, or } from 'drizzle-orm';
import {
  events,
  eventTicketTypes,
  eventRegistrations,
  eventFeedback,
  eventSponsors,
  eventSponsorshipTiers,
  users,
} from '../../../db/schema';
import type {
  AdminEventOverviewData,
  AttendeeListItem,
  WaitlistListItem,
  EventFeedbackItem,
  EventSponsorItem,
} from '../types/events.types';
import type { AttendeeQueryParams } from '../validation/events.validation';
import { AppError, ErrorCodes } from '../../../core/shared/errors';

export class EventRegistrationsRepository {
  /**
   * Fetch event with strict tenant chamber isolation and chapter/group scoping checks
   */
  static async getScopedEvent(
    d1: D1Database,
    chamberId: string,
    eventId: string,
    userRole: string,
    userScopeId: string | null
  ) {
    const db = drizzle(d1);
    const event = await db
      .select()
      .from(events)
      .where(and(eq(events.chamberId, chamberId), eq(events.id, eventId)))
      .get();

    if (!event) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Event not found in this chamber', 404);
    }

    // RBAC & Scoping Invariant: Chapter / Group admin isolation.
    // Deny by default: only full admins are unscoped (BUG-054).
    if (userRole === 'full_admin' || userRole === 'super_admin') {
      return event;
    }
    if (!userScopeId || (userRole !== 'chapter_admin' && userRole !== 'group_admin')) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'You are not authorized to manage this event', 403);
    }
    if (userRole === 'chapter_admin') {
      if (event.chapterId !== userScopeId) {
        throw new AppError(
          ErrorCodes.FORBIDDEN,
          'You are only authorized to manage events hosted by your assigned chapter',
          403
        );
      }
    } else {
      if (event.groupId !== userScopeId) {
        throw new AppError(
          ErrorCodes.FORBIDDEN,
          'You are only authorized to manage events hosted by your assigned group',
          403
        );
      }
    }

    return event;
  }

  /**
   * Prompt 04.2 Section 9.1: GET /api/v1/admin/events/:id/overview
   */
  static async getOverview(
    d1: D1Database,
    chamberId: string,
    eventId: string,
    userRole: string,
    userScopeId: string | null
  ): Promise<AdminEventOverviewData> {
    const db = drizzle(d1);
    const event = await this.getScopedEvent(d1, chamberId, eventId, userRole, userScopeId);

    // 1. Ticket Types
    const tickets = await db
      .select()
      .from(eventTicketTypes)
      .where(and(eq(eventTicketTypes.chamberId, chamberId), eq(eventTicketTypes.eventId, eventId)))
      .all();

    // 2. Metrics calculation from event_registrations
    const regMetrics = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${eventRegistrations.isWaitlisted} = 0 AND ${eventRegistrations.paymentStatus} = 'paid' THEN ${eventRegistrations.amountPaid} ELSE 0 END), 0.0)`,
        confirmedCount: sql<number>`COUNT(CASE WHEN ${eventRegistrations.isWaitlisted} = 0 THEN 1 END)`,
        waitlistedCount: sql<number>`COUNT(CASE WHEN ${eventRegistrations.isWaitlisted} = 1 THEN 1 END)`,
        checkedInCount: sql<number>`COUNT(CASE WHEN ${eventRegistrations.checkInStatus} = 'checked_in' THEN 1 END)`,
      })
      .from(eventRegistrations)
      .where(and(eq(eventRegistrations.chamberId, chamberId), eq(eventRegistrations.eventId, eventId)))
      .get();

    // 3. Feedback Metrics
    const feedbackMetrics = await db
      .select({
        avgRating: sql<number>`COALESCE(AVG(${eventFeedback.starRating}), 0.0)`,
        count: sql<number>`COUNT(${eventFeedback.id})`,
      })
      .from(eventFeedback)
      .where(and(eq(eventFeedback.chamberId, chamberId), eq(eventFeedback.eventId, eventId)))
      .get();

    return {
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        category: event.category,
        visibility: event.visibility,
        status: event.status || 'draft',
        eventDate: event.eventDate,
        eventEndDate: event.eventEndDate,
        isAllDay: event.isAllDay,
        venue: event.venue,
        city: event.city,
        chapterId: event.chapterId,
        groupId: event.groupId,
        maxCapacity: event.maxCapacity,
        registeredCount: event.registeredCount,
        registrationFee: event.registrationFee,
        isPaid: event.isPaid,
      },
      metrics: {
        totalRevenue: Math.round((Number(regMetrics?.totalRevenue || 0)) * 100) / 100,
        confirmedAttendees: Number(regMetrics?.confirmedCount || 0),
        waitlistedCount: Number(regMetrics?.waitlistedCount || 0),
        checkedInCount: Number(regMetrics?.checkedInCount || 0),
        avgFeedbackRating: Math.round((Number(feedbackMetrics?.avgRating || 0)) * 10) / 10,
        totalFeedbackCount: Number(feedbackMetrics?.count || 0),
      },
      ticketTypes: tickets.map((t) => ({
        id: t.id,
        name: t.name,
        price: t.price,
        sold: t.qtySold,
        available: t.qtyLimit,
        allowPayLater: t.allowPayLater,
      })),
    };
  }

  /**
   * Prompt 04.2 Section 5.2: Searchable & filterable attendees roster
   */
  static async getAttendees(
    d1: D1Database,
    chamberId: string,
    eventId: string,
    userRole: string,
    userScopeId: string | null,
    params: AttendeeQueryParams
  ): Promise<{ attendees: AttendeeListItem[]; total: number }> {
    const db = drizzle(d1);
    await this.getScopedEvent(d1, chamberId, eventId, userRole, userScopeId);

    const conditions = [
      eq(eventRegistrations.chamberId, chamberId),
      eq(eventRegistrations.eventId, eventId),
      eq(eventRegistrations.isWaitlisted, 0), // Confirmed attendees only
    ];

    if (params.ticketTypeId || params.ticket_type_id) {
      conditions.push(eq(eventRegistrations.ticketTypeId, (params.ticketTypeId || params.ticket_type_id)!));
    }

    const checkInFilter = params.check_in_status || params.checkInStatus;
    if (checkInFilter && checkInFilter !== 'all') {
      conditions.push(eq(eventRegistrations.checkInStatus, checkInFilter));
    }

    if (params.q) {
      const queryPattern = `%${params.q.trim()}%`;
      conditions.push(
        or(
          like(eventRegistrations.guestName, queryPattern),
          like(eventRegistrations.guestEmail, queryPattern)
        )!
      );
    }

    const whereClause = and(...conditions);
    const offset = (params.page - 1) * params.limit;

    const rows = await db
      .select({
        id: eventRegistrations.id,
        guestName: eventRegistrations.guestName,
        guestEmail: eventRegistrations.guestEmail,
        registrationType: eventRegistrations.registrationType,
        ticketTypeId: eventRegistrations.ticketTypeId,
        ticketTypeName: eventTicketTypes.name,
        amountPaid: eventRegistrations.amountPaid,
        discountAmount: eventRegistrations.discountAmount,
        paymentStatus: eventRegistrations.paymentStatus,
        checkInStatus: eventRegistrations.checkInStatus,
        checkedInAt: eventRegistrations.checkedInAt,
        isWaitlisted: eventRegistrations.isWaitlisted,
        waitlistPosition: eventRegistrations.waitlistPosition,
        createdAt: eventRegistrations.createdAt,
      })
      .from(eventRegistrations)
      .leftJoin(eventTicketTypes, eq(eventRegistrations.ticketTypeId, eventTicketTypes.id))
      .where(whereClause)
      .orderBy(desc(eventRegistrations.createdAt))
      .limit(params.limit)
      .offset(offset)
      .all();

    const countRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(eventRegistrations)
      .where(whereClause)
      .get();

    return {
      attendees: rows.map((r) => ({
        id: r.id,
        guestName: r.guestName || 'Unnamed Guest',
        guestEmail: r.guestEmail || '',
        companyName: null,
        registrationType: r.registrationType,
        ticketTypeId: r.ticketTypeId,
        ticketTypeName: r.ticketTypeName || 'General Admission',
        amountPaid: r.amountPaid,
        discountAmount: r.discountAmount,
        paymentStatus: r.paymentStatus || 'paid',
        checkInStatus: r.checkInStatus || 'not_checked_in',
        isCheckedIn: r.checkInStatus === 'checked_in',
        checkedInAt: r.checkedInAt,
        isWaitlisted: r.isWaitlisted === 1,
        waitlistPosition: r.waitlistPosition,
        createdAt: r.createdAt,
      })),
      total: Number(countRow?.count || 0),
    };
  }

  /**
   * Prompt 04.2 Section 5.3: Priority Waitlist Queue
   */
  static async getWaitlist(
    d1: D1Database,
    chamberId: string,
    eventId: string,
    userRole: string,
    userScopeId: string | null
  ): Promise<WaitlistListItem[]> {
    const db = drizzle(d1);
    await this.getScopedEvent(d1, chamberId, eventId, userRole, userScopeId);

    const rows = await db
      .select({
        id: eventRegistrations.id,
        guestName: eventRegistrations.guestName,
        guestEmail: eventRegistrations.guestEmail,
        ticketTypeId: eventRegistrations.ticketTypeId,
        ticketTypeName: eventTicketTypes.name,
        waitlistPosition: eventRegistrations.waitlistPosition,
        createdAt: eventRegistrations.createdAt,
      })
      .from(eventRegistrations)
      .leftJoin(eventTicketTypes, eq(eventRegistrations.ticketTypeId, eventTicketTypes.id))
      .where(
        and(
          eq(eventRegistrations.chamberId, chamberId),
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.isWaitlisted, 1)
        )
      )
      .orderBy(asc(eventRegistrations.waitlistPosition), asc(eventRegistrations.createdAt))
      .all();

    return rows.map((r) => ({
      id: r.id,
      guestName: r.guestName || 'Waitlisted Attendee',
      guestEmail: r.guestEmail || '',
      companyName: null,
      ticketTypeId: r.ticketTypeId,
      ticketTypeName: r.ticketTypeName || 'Standard Ticket',
      waitlistPosition: r.waitlistPosition,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Prompt 04.2 Section 9.3: PATCH /api/v1/admin/events/:id/attendees/:regId/check-in
   */
  static async toggleCheckIn(
    d1: D1Database,
    chamberId: string,
    eventId: string,
    registrationId: string,
    isCheckedIn: number,
    userRole: string,
    userScopeId: string | null
  ) {
    const db = drizzle(d1);
    await this.getScopedEvent(d1, chamberId, eventId, userRole, userScopeId);

    const reg = await db
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.chamberId, chamberId),
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.id, registrationId)
        )
      )
      .get();

    if (!reg) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Attendee registration not found', 404);
    }

    const checkInStatus = isCheckedIn === 1 ? 'checked_in' : 'not_checked_in';
    const checkedInAt = isCheckedIn === 1 ? new Date().toISOString() : null;

    await db
      .update(eventRegistrations)
      .set({
        checkInStatus,
        checkedInAt,
      })
      .where(eq(eventRegistrations.id, registrationId))
      .run();

    return {
      registrationId,
      isCheckedIn: isCheckedIn === 1,
      checkedInAt,
    };
  }

  /**
   * Prompt 04.2 Section 9.2: POST /api/v1/admin/events/:id/waitlist/:regId/promote
   * Promotes waitlisted attendee to confirmed, increments quantity_sold on ticket type and event.
   */
  static async promoteWaitlist(
    d1: D1Database,
    chamberId: string,
    eventId: string,
    registrationId: string,
    userRole: string,
    userScopeId: string | null
  ) {
    const db = drizzle(d1);
    await this.getScopedEvent(d1, chamberId, eventId, userRole, userScopeId);

    const reg = await db
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.chamberId, chamberId),
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.id, registrationId)
        )
      )
      .get();

    if (!reg) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Waitlist registration not found', 404);
    }

    if (reg.isWaitlisted === 0) {
      return { registrationId, status: 'confirmed', alreadyConfirmed: true };
    }

    // 1. Claim the waitlist entry (conditional: two concurrent promotes cannot both win)
    const claimed = await d1
      .prepare(
        `UPDATE event_registrations SET is_waitlisted = 0, waitlist_position = NULL
         WHERE id = ? AND chamber_id = ? AND event_id = ? AND is_waitlisted = 1`
      )
      .bind(registrationId, chamberId, eventId)
      .run();
    if (!claimed.meta?.changes) {
      return { registrationId, status: 'confirmed', alreadyConfirmed: true };
    }

    // 2. Claim a seat only if capacity allows (atomic check-and-increment)
    const seat = await d1
      .prepare(
        `UPDATE events SET registered_count = registered_count + 1
         WHERE id = ? AND chamber_id = ?
           AND (max_capacity IS NULL OR max_capacity <= 0 OR registered_count < max_capacity)`
      )
      .bind(eventId, chamberId)
      .run();
    if (!seat.meta?.changes) {
      // Event is full: put the entry back on the waitlist at its original position.
      await d1
        .prepare('UPDATE event_registrations SET is_waitlisted = 1, waitlist_position = ? WHERE id = ? AND chamber_id = ?')
        .bind(reg.waitlistPosition ?? null, registrationId, chamberId)
        .run();
      throw new AppError(ErrorCodes.CONFLICT, 'Event is at full capacity; cannot promote from waitlist', 409);
    }

    // 3. Increment ticket type qtySold if bound to a ticket type
    if (reg.ticketTypeId) {
      await db
        .update(eventTicketTypes)
        .set({
          qtySold: sql`${eventTicketTypes.qtySold} + 1`,
        })
        .where(and(eq(eventTicketTypes.id, reg.ticketTypeId), eq(eventTicketTypes.chamberId, chamberId)))
        .run();
    }

    return {
      registrationId,
      status: 'confirmed',
    };
  }

  /**
   * DELETE /api/v1/admin/events/:id/attendees/:regId
   * Cancels/deletes attendee registration or waitlist entry, decrementing event and ticket counts if confirmed.
   */
  static async removeRegistration(
    d1: D1Database,
    chamberId: string,
    eventId: string,
    registrationId: string,
    userRole: string,
    userScopeId: string | null
  ) {
    const db = drizzle(d1);
    await this.getScopedEvent(d1, chamberId, eventId, userRole, userScopeId);

    const reg = await db
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.chamberId, chamberId),
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.id, registrationId)
        )
      )
      .get();

    if (!reg) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Registration not found', 404);
    }

    // 1. Delete registration record
    await db
      .delete(eventRegistrations)
      .where(eq(eventRegistrations.id, registrationId))
      .run();

    // 2. If it was a confirmed attendee, decrement registeredCount on events table
    if (reg.isWaitlisted === 0) {
      await db
        .update(events)
        .set({
          registeredCount: sql`MAX(0, ${events.registeredCount} - 1)`,
        })
        .where(eq(events.id, eventId))
        .run();

      // Decrement ticketType qtySold if bound
      if (reg.ticketTypeId) {
        await db
          .update(eventTicketTypes)
          .set({
            qtySold: sql`MAX(0, ${eventTicketTypes.qtySold} - 1)`,
          })
          .where(eq(eventTicketTypes.id, reg.ticketTypeId))
          .run();
      }
    }

    return {
      registrationId,
      deleted: true,
      wasWaitlisted: reg.isWaitlisted === 1,
    };
  }

  /**
   * Tabs 4, 6: Feedback & Sponsors retrieval
   */
  static async getFeedback(
    d1: D1Database,
    chamberId: string,
    eventId: string,
    userRole: string,
    userScopeId: string | null
  ): Promise<EventFeedbackItem[]> {
    const db = drizzle(d1);
    await this.getScopedEvent(d1, chamberId, eventId, userRole, userScopeId);

    const list = await db
      .select({
        id: eventFeedback.id,
        userId: eventFeedback.userId,
        userName: users.name,
        starRating: eventFeedback.starRating,
        likedMost: eventFeedback.likedMost,
        wouldAttendAgain: eventFeedback.wouldAttendAgain,
        suggestions: eventFeedback.suggestions,
        createdAt: eventFeedback.createdAt,
      })
      .from(eventFeedback)
      .leftJoin(users, eq(eventFeedback.userId, users.id))
      .where(and(eq(eventFeedback.chamberId, chamberId), eq(eventFeedback.eventId, eventId)))
      .orderBy(desc(eventFeedback.createdAt))
      .all();

    return list.map((f) => ({
      id: f.id,
      userId: f.userId,
      userName: f.userName?.trim() || 'Anonymous Member',
      starRating: f.starRating,
      likedMost: f.likedMost,
      wouldAttendAgain: f.wouldAttendAgain === 1,
      suggestions: f.suggestions,
      createdAt: f.createdAt,
    }));
  }

  static async getSponsors(
    d1: D1Database,
    chamberId: string,
    eventId: string,
    userRole: string,
    userScopeId: string | null
  ): Promise<EventSponsorItem[]> {
    const db = drizzle(d1);
    await this.getScopedEvent(d1, chamberId, eventId, userRole, userScopeId);

    const list = await db
      .select({
        id: eventSponsors.id,
        sponsorName: eventSponsors.sponsorName,
        tierId: eventSponsors.tierId,
        tierName: eventSponsorshipTiers.tierName,
        amount: eventSponsors.amount,
        status: eventSponsors.status,
        paymentDate: eventSponsors.paymentDate,
      })
      .from(eventSponsors)
      .leftJoin(eventSponsorshipTiers, eq(eventSponsors.tierId, eventSponsorshipTiers.id))
      .where(and(eq(eventSponsors.chamberId, chamberId), eq(eventSponsors.eventId, eventId)))
      .orderBy(desc(eventSponsors.amount))
      .all();

    return list.map((s) => ({
      id: s.id,
      sponsorName: s.sponsorName,
      tierId: s.tierId,
      tierName: s.tierName || 'Standard Sponsor',
      amount: s.amount,
      status: s.status || 'pending',
      paymentDate: s.paymentDate,
    }));
  }

}

