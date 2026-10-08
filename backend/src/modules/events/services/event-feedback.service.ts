import { drizzle } from 'drizzle-orm/d1';
import { and, eq, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { eventFeedback, users, pointsHistory, activityLogs } from '../../../db/schema';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { newId } from '../../../core/shared/ids';
import { EventFeedbackRepository } from '../repositories/event-feedback.repository';
import { CertificateGeneratorService } from './certificate-generator.service';
import type { SubmitFeedbackInput } from '../validation/events.validation';

/** Prompt 04.5 §7.3 — fixed by the spec; no per-chamber setting exists yet (OD-038, like OD-030). */
export const FEEDBACK_REWARD_POINTS = 25;

/** §13: ratings at or below this trigger a follow-up alert (logged until notifications exist). */
const LOW_RATING_THRESHOLD = 2;

const ATTENDANCE_REQUIRED = 'You must have attended this event to submit feedback or download a certificate';

export class EventFeedbackService {
  private static async requireAttendance(d1: D1Database, chamberId: string, eventId: string, userId: string) {
    const event = await EventFeedbackRepository.findEvent(d1, chamberId, eventId);
    if (!event) throw new AppError(ErrorCodes.NOT_FOUND, 'Event not found', 404);
    const registration = await EventFeedbackRepository.findCheckedInRegistration(d1, chamberId, eventId, userId);
    if (!registration) throw new AppError(ErrorCodes.FORBIDDEN, ATTENDANCE_REQUIRED, 403);
    return { event, registration };
  }

  /** Engagement state for the member's past-event card. */
  static async attendance(d1: D1Database, chamberId: string, eventId: string, userId: string) {
    const event = await EventFeedbackRepository.findEvent(d1, chamberId, eventId);
    if (!event) throw new AppError(ErrorCodes.NOT_FOUND, 'Event not found', 404);
    const [registration, feedback] = await Promise.all([
      EventFeedbackRepository.findCheckedInRegistration(d1, chamberId, eventId, userId),
      EventFeedbackRepository.findFeedback(d1, chamberId, eventId, userId),
    ]);
    return {
      checkedIn: !!registration,
      feedbackSubmitted: !!feedback,
      feedbackRewardPoints: FEEDBACK_REWARD_POINTS,
    };
  }

  /** §9.1 */
  static async submit(d1: D1Database, chamberId: string, eventId: string, userId: string, input: SubmitFeedbackInput) {
    const db = drizzle(d1);
    const { event } = await this.requireAttendance(d1, chamberId, eventId, userId);
    if (await EventFeedbackRepository.findFeedback(d1, chamberId, eventId, userId)) {
      throw new AppError(ErrorCodes.CONFLICT, 'You have already submitted feedback for this event', 409);
    }

    const feedbackId = await newId(d1, 'event_feedback', 'EFB', { chamberId });
    const now = new Date().toISOString();
    const statements: BatchItem<'sqlite'>[] = [
      db.insert(eventFeedback).values({
        id: feedbackId,
        chamberId,
        eventId,
        userId,
        starRating: input.starRating,
        likedMost: input.likedMost || null,
        wouldAttendAgain: input.wouldAttendAgain ? 1 : 0,
        suggestions: input.suggestions || null,
        createdAt: now,
      }),
      // §7.3 / §14: +25 points and a ledger row, in the same transaction as the review.
      db
        .update(users)
        .set({ pointsBalance: sql`${users.pointsBalance} + ${FEEDBACK_REWARD_POINTS}` })
        .where(and(eq(users.chamberId, chamberId), eq(users.id, userId))),
      db.insert(pointsHistory).values({
        id: await newId(d1, 'points_history', 'PTS', { chamberId, suffixLength: 6, skipUniqueCheck: true }),
        chamberId,
        userId,
        points: FEEDBACK_REWARD_POINTS,
        type: 'earned',
        reason: `Event feedback - ${event.title}`,
        relatedEventId: eventId,
        createdAt: now,
      }),
      db.insert(activityLogs).values({
        id: await newId(d1, 'activity_logs', 'ACT', { chamberId, suffixLength: 6, skipUniqueCheck: true }),
        chamberId,
        userId,
        action: input.starRating <= LOW_RATING_THRESHOLD ? 'event.feedback_low_rating' : 'event.feedback_submitted',
        targetType: 'event',
        targetId: eventId,
        detailsJson: JSON.stringify({ feedbackId, starRating: input.starRating }),
      }),
    ];

    try {
      await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
    } catch (err: any) {
      // §7.2: UNIQUE(event_id, user_id) — a concurrent duplicate loses here; nothing was written.
      // Drizzle wraps the driver error; the SQLite message is on err.cause.
      const message = `${err?.message || err} ${err?.cause?.message || ''}`;
      if (/UNIQUE constraint failed/i.test(message)) {
        throw new AppError(ErrorCodes.CONFLICT, 'You have already submitted feedback for this event', 409);
      }
      throw err;
    }

    return {
      feedbackId,
      pointsAwarded: FEEDBACK_REWARD_POINTS,
      message: `Thank you for your feedback! ${FEEDBACK_REWARD_POINTS} points credited to your account.`,
    };
  }

  /** §9.2 — returns the printable certificate (OD-039 b). */
  static async certificate(d1: D1Database, chamberId: string, eventId: string, userId: string, assetOrigin: string) {
    const { event, registration } = await this.requireAttendance(d1, chamberId, eventId, userId);
    const [user, branding] = await Promise.all([
      EventFeedbackRepository.findUser(d1, chamberId, userId),
      EventFeedbackRepository.chamberBranding(d1, chamberId),
    ]);
    if (!user) throw new AppError(ErrorCodes.USER_NOT_FOUND, 'User not found', 404);
    const orgName = branding?.orgName || branding?.chamberName || '';
    // Stored asset URLs are app-relative; the certificate opens as a standalone document.
    const logoUrl = branding?.logoUrl
      ? /^https?:\/\//i.test(branding.logoUrl)
        ? branding.logoUrl
        : `${assetOrigin}${branding.logoUrl.startsWith('/') ? '' : '/'}${branding.logoUrl}`
      : null;

    const html = CertificateGeneratorService.render({
      certificateId: CertificateGeneratorService.certificateId(registration.id),
      attendeeName: user.name?.trim() || user.email,
      eventTitle: event.title,
      eventDate: event.eventDate,
      timezone: branding?.timezone || null,
      orgName,
      logoUrl,
    });
    return { html, fileName: CertificateGeneratorService.fileName(orgName) };
  }
}
