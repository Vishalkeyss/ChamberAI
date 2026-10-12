import { drizzle } from 'drizzle-orm/d1';
import { and, eq, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { referrals, referralPeople, users, pointsHistory, activityLogs, notifications } from '../../../db/schema';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { newId } from '../../../core/shared/ids';
import { ReferralsRepository } from '../repositories/referrals.repository';
import { NetworkMembersRepository } from '../repositories/network-members.repository';
import type { CreateReferralInput, UpdateReferralStatusInput } from '../validation/networking.validation';

/** Prompt 05.3 §7.1 — fixed by the spec; no per-chamber setting exists yet (OD-066, like OD-030/OD-038). */
export const REFERRAL_REWARD_POINTS = 200;

/** §2 lifecycle: pending → contacted → converted | declined (forward only; converted/declined are final). */
const NEXT_STATUSES: Record<string, string[]> = {
  pending: ['contacted', 'converted', 'declined'],
  contacted: ['converted', 'declined'],
  converted: [],
  declined: [],
};

const NO_BUSINESS = 'Your account is not linked to an active business profile, so you cannot give referrals yet';

/** Prompt 05.3 — B2B Business Referrals. */
export class ReferralsService {
  private static async requireMember(d1: D1Database, chamberId: string, userId: string) {
    const me = await NetworkMembersRepository.findActiveUser(d1, chamberId, userId);
    if (!me) throw new AppError(ErrorCodes.FORBIDDEN, 'Only active chamber members can use referrals', 403);
    return me;
  }

  /** §9.1 GET /referrals — received + given for the member's businesses, with KPI totals. */
  static async list(d1: D1Database, chamberId: string, userId: string) {
    await this.requireMember(d1, chamberId, userId);
    const myBusinessIds = await NetworkMembersRepository.businessIdsOf(d1, chamberId, userId);
    const rows = await ReferralsRepository.listForBusinesses(d1, chamberId, myBusinessIds);

    const [people, businesses, creators] = await Promise.all([
      ReferralsRepository.peopleFor(d1, chamberId, rows.map((r) => r.id)),
      NetworkMembersRepository.findBusinesses(d1, chamberId, rows.flatMap((r) => [r.fromBusinessId, r.toBusinessId])),
      NetworkMembersRepository.memberCards(d1, chamberId, rows.map((r) => r.createdByUserId)),
    ]);
    const businessById = new Map(businesses.map((b) => [b.id, b]));
    const mine = new Set(myBusinessIds);

    const toDto = (r: (typeof rows)[number]) => {
      const creator = creators.get(r.createdByUserId);
      const status = r.status || 'pending';
      const isRecipient = mine.has(r.toBusinessId);
      return {
        id: r.id,
        fromBusiness: businessById.get(r.fromBusinessId) || { id: r.fromBusinessId, name: '', logoUrl: null },
        toBusiness: businessById.get(r.toBusinessId) || { id: r.toBusinessId, name: '', logoUrl: null },
        createdBy: creator ? { id: creator.id, name: creator.name, avatarUrl: creator.avatarUrl } : null,
        message: r.message,
        status,
        convertedValue: r.convertedValue,
        contacts: people
          .filter((p) => p.referralId === r.id)
          .map((p) => ({
            id: p.id,
            fullName: p.fullName,
            email: p.email,
            phone: p.mobileNumber,
            profession: p.profession,
            referredBusinessId: p.referredBusinessId,
          })),
        // §7.3: only representatives of the receiving business may advance the status.
        canUpdateStatus: isRecipient && (NEXT_STATUSES[status] || []).length > 0,
        allowedNextStatuses: isRecipient ? NEXT_STATUSES[status] || [] : [],
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    };

    const received = rows.filter((r) => mine.has(r.toBusinessId)).map(toDto);
    // A referral between two businesses the member both represents shows once, under Received.
    const given = rows.filter((r) => mine.has(r.fromBusinessId) && !mine.has(r.toBusinessId)).map(toDto);
    // §8 formula, restricted to referrals this member's business took part in.
    const convertedValue = rows
      .filter((r) => r.status === 'converted')
      .reduce((sum, r) => sum + (Number(r.convertedValue) || 0), 0);

    return {
      received,
      given,
      stats: {
        givenCount: given.length,
        receivedCount: received.length,
        convertedCount: rows.filter((r) => r.status === 'converted').length,
        convertedValue,
      },
      myBusinessIds,
      rewardPoints: REFERRAL_REWARD_POINTS,
    };
  }

  /** Recipient business picker (§5.2): active chamber businesses except the member's own. */
  static async searchBusinesses(d1: D1Database, chamberId: string, userId: string, query: string) {
    await this.requireMember(d1, chamberId, userId);
    const myBusinessIds = await NetworkMembersRepository.businessIdsOf(d1, chamberId, userId);
    return NetworkMembersRepository.searchBusinesses(d1, chamberId, myBusinessIds, query);
  }

  /** "Search Members" mode of the wizard (OD-064): pick people straight from the chamber directory. */
  static async searchMembers(d1: D1Database, chamberId: string, userId: string, query: string) {
    await this.requireMember(d1, chamberId, userId);
    return NetworkMembersRepository.searchMembers(d1, chamberId, userId, query);
  }

  /** §9.2 POST /referrals — referral + contacts + 200 points + ledger + audit + notifications, atomically. */
  static async create(d1: D1Database, chamberId: string, userId: string, input: CreateReferralInput) {
    await this.requireMember(d1, chamberId, userId);
    const fromBusiness = await NetworkMembersRepository.primaryBusinessOf(d1, chamberId, userId);
    if (!fromBusiness) throw new AppError(ErrorCodes.BAD_REQUEST, NO_BUSINESS, 400);

    // §7.2 self-referral prevention, extended to every business the member represents.
    const myBusinessIds = await NetworkMembersRepository.businessIdsOf(d1, chamberId, userId);
    if (myBusinessIds.includes(input.toBusinessId)) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'You cannot refer your own business', 400);
    }
    const [toBusiness] = await NetworkMembersRepository.findBusinesses(d1, chamberId, [input.toBusinessId]);
    if (!toBusiness) throw new AppError(ErrorCodes.NOT_FOUND, 'Business not found in this chamber', 404);
    const recipients = await NetworkMembersRepository.activeRepresentatives(d1, chamberId, toBusiness.id);
    if (recipients.length === 0) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'This business has no active representative to receive referrals', 404);
    }

    const referredIds = input.contacts.map((c) => c.referredBusinessId).filter(Boolean) as string[];
    if (referredIds.length > 0) {
      const found = await NetworkMembersRepository.findBusinesses(d1, chamberId, referredIds);
      if (found.length !== new Set(referredIds).size) {
        throw new AppError(ErrorCodes.NOT_FOUND, 'A referred business was not found in this chamber', 404);
      }
    }

    const db = drizzle(d1);
    const referralId = await newId(d1, 'referrals', 'REF', { chamberId });
    const now = new Date().toISOString();
    const fromName = fromBusiness.businessName;

    const statements: BatchItem<'sqlite'>[] = [
      db.insert(referrals).values({
        id: referralId,
        chamberId,
        fromBusinessId: fromBusiness.businessId,
        toBusinessId: toBusiness.id,
        createdByUserId: userId,
        message: input.message,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      }),
    ];
    for (const c of input.contacts) {
      statements.push(
        db.insert(referralPeople).values({
          id: await newId(d1, 'referral_people', 'REFP', { chamberId, suffixLength: 6, skipUniqueCheck: true }),
          chamberId,
          referralId,
          fullName: c.fullName,
          mobileNumber: c.phone || null,
          email: c.email || null,
          profession: c.profession,
          referredBusinessId: c.referredBusinessId || null,
          createdAt: now,
        })
      );
    }
    // §7.1 / §14: +200 points and a ledger row in the same transaction.
    statements.push(
      db
        .update(users)
        .set({ pointsBalance: sql`${users.pointsBalance} + ${REFERRAL_REWARD_POINTS}` })
        .where(and(eq(users.chamberId, chamberId), eq(users.id, userId))),
      db.insert(pointsHistory).values({
        id: await newId(d1, 'points_history', 'PTS', { chamberId, suffixLength: 6, skipUniqueCheck: true }),
        chamberId,
        userId,
        points: REFERRAL_REWARD_POINTS,
        type: 'earned',
        reason: `Referral given - ${toBusiness.name}`,
        relatedReferralId: referralId,
        createdAt: now,
      }),
      db.insert(activityLogs).values({
        id: await newId(d1, 'activity_logs', 'ACT', { chamberId, suffixLength: 6, skipUniqueCheck: true }),
        chamberId,
        userId,
        action: 'referral.created',
        targetType: 'referral',
        targetId: referralId,
        detailsJson: JSON.stringify({
          fromBusinessId: fromBusiness.businessId,
          toBusinessId: toBusiness.id,
          contacts: input.contacts.length,
          pointsAwarded: REFERRAL_REWARD_POINTS,
        }),
      })
    );
    // §13 in-app alert to every active representative of the receiving business (email: OD-059).
    for (const r of recipients) {
      statements.push(
        db.insert(notifications).values({
          id: await newId(d1, 'notifications', 'NTF', { chamberId, suffixLength: 6, skipUniqueCheck: true }),
          chamberId,
          userId: r.userId,
          type: 'referral_received',
          title: 'New business referral',
          message: `You received a new qualified business referral from ${fromName}.`,
          actionUrl: '/portal/referrals',
          createdAt: now,
        })
      );
    }

    await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
    return { id: referralId, pointsAwarded: REFERRAL_REWARD_POINTS };
  }

  /** §9.3 PATCH /referrals/:id/status — receiving business representatives only (§7.3). */
  static async updateStatus(
    d1: D1Database,
    chamberId: string,
    userId: string,
    referralId: string,
    input: UpdateReferralStatusInput
  ) {
    await this.requireMember(d1, chamberId, userId);
    const referral = await ReferralsRepository.findById(d1, chamberId, referralId);
    if (!referral) throw new AppError(ErrorCodes.NOT_FOUND, 'Referral not found', 404);

    const myBusinessIds = await NetworkMembersRepository.businessIdsOf(d1, chamberId, userId);
    if (!myBusinessIds.includes(referral.toBusinessId)) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Only the receiving business can update this referral', 403);
    }
    if (input.convertedValue !== undefined && input.status !== 'converted') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'A deal value can only be recorded when the referral is converted', 422);
    }

    const current = referral.status || 'pending';
    if (!(NEXT_STATUSES[current] || []).includes(input.status)) {
      throw new AppError(ErrorCodes.CONFLICT, `A ${current} referral cannot be marked ${input.status}`, 409);
    }

    const now = new Date().toISOString();
    const convertedValue = input.status === 'converted' ? input.convertedValue ?? null : null;
    const applied = await ReferralsRepository.transition(d1, chamberId, referralId, current, input.status, convertedValue, now);
    if (!applied) {
      throw new AppError(ErrorCodes.CONFLICT, 'This referral was updated by someone else. Refresh and try again.', 409);
    }

    await drizzle(d1)
      .insert(activityLogs)
      .values({
        id: await newId(d1, 'activity_logs', 'ACT', { chamberId, suffixLength: 6, skipUniqueCheck: true }),
        chamberId,
        userId,
        action: 'referral.status_updated',
        targetType: 'referral',
        targetId: referralId,
        detailsJson: JSON.stringify({ from: current, to: input.status, convertedValue }),
      })
      .run()
      .catch((err) => console.error('[AUDIT_LOG_WRITE_FAILED]', err));

    return { id: referralId, status: input.status, convertedValue };
  }
}
