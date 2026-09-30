import type { AppContext } from '../../../core/context';
import { generatePrefixedId } from '../../../core/shared/crypto';

export interface OnboardingSteps {
  profile: boolean;
  card: boolean;
  network: boolean;
  team: boolean;
}

export interface MemberOverviewData {
  membership: {
    tierName: string;
    status: string;
    memberIdDisplay: string;
    renewalDate: string | null;
  };
  kpis: {
    referralsGiven: number;
    referralsReceived: number;
    eventsAttended: number;
    pointsBalance: number;
  };
  onboarding: {
    isComplete: boolean;
    completionPct: number;
    steps: OnboardingSteps;
  };
}

const STEP_WEIGHTS: Record<keyof OnboardingSteps, number> = {
  profile: 40,
  card: 20,
  network: 20,
  team: 20,
};

/**
 * Calculates profile completion percentage from weighted onboarding steps.
 */
export function calculateProfileCompleteness(steps: OnboardingSteps): number {
  let pct = 0;
  if (steps.profile) pct += STEP_WEIGHTS.profile;
  if (steps.card) pct += STEP_WEIGHTS.card;
  if (steps.network) pct += STEP_WEIGHTS.network;
  if (steps.team) pct += STEP_WEIGHTS.team;
  return pct;
}

export class MemberOverviewService {
  /**
   * Aggregate all overview KPIs and onboarding state for the authenticated member.
   * Every query enforces WHERE user_id = :userId AND chamber_id = :chamberId.
   */
  static async getOverview(
    c: AppContext,
    userId: string,
    chamberId: string
  ): Promise<MemberOverviewData> {
    const db = c.env.DB;

    // 1. User onboarding state & points balance
    const userRow = await db
      .prepare(
        `SELECT points_balance, onboarding_complete, onboarding_steps_json, profile_completion_pct
         FROM users WHERE id = ? AND chamber_id = ?`
      )
      .bind(userId, chamberId)
      .first();

    let steps: OnboardingSteps = { profile: false, card: false, network: false, team: false };
    let pointsBalance = 0;
    let isComplete = false;
    let completionPct = 0;

    if (userRow) {
      pointsBalance = (userRow.points_balance as number) || 0;
      isComplete = (userRow.onboarding_complete as number) === 1;

      try {
        const parsed = JSON.parse((userRow.onboarding_steps_json as string) || '{}');
        steps = {
          profile: !!parsed.profile,
          card: !!parsed.card,
          network: !!parsed.network,
          team: !!parsed.team,
        };
      } catch {
        // fallback to defaults
      }

      completionPct = calculateProfileCompleteness(steps);
    }

    // 2. Membership info: join via business_members → chamber_memberships → membership_plans
    const membershipRow = await db
      .prepare(
        `SELECT cm.member_id_display, cm.status, cm.plan_end_date,
                mp.name AS tier_name
         FROM chamber_memberships cm
         JOIN business_members bm ON bm.business_id = cm.business_id AND bm.chamber_id = cm.chamber_id
         LEFT JOIN membership_plans mp ON mp.id = cm.plan_id AND mp.chamber_id = cm.chamber_id
         WHERE bm.user_id = ? AND cm.chamber_id = ? AND cm.status = 'active'
         LIMIT 1`
      )
      .bind(userId, chamberId)
      .first();

    const membership = {
      tierName: (membershipRow?.tier_name as string) || 'Standard',
      status: (membershipRow?.status as string) || 'active',
      memberIdDisplay: (membershipRow?.member_id_display as string) || '',
      renewalDate: (membershipRow?.plan_end_date as string) || null,
    };

    // 3. Referrals given (where user's business is from_business_id)
    const refGivenRow = await db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM referrals r
         JOIN business_members bm ON bm.business_id = r.from_business_id AND bm.chamber_id = r.chamber_id
         WHERE bm.user_id = ? AND r.chamber_id = ?`
      )
      .bind(userId, chamberId)
      .first();
    const referralsGiven = (refGivenRow?.cnt as number) || 0;

    // 4. Referrals received
    const refRecvRow = await db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM referrals r
         JOIN business_members bm ON bm.business_id = r.to_business_id AND bm.chamber_id = r.chamber_id
         WHERE bm.user_id = ? AND r.chamber_id = ?`
      )
      .bind(userId, chamberId)
      .first();
    const referralsReceived = (refRecvRow?.cnt as number) || 0;

    // 5. Events attended (check_in_status = 'checked_in')
    const eventsRow = await db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM event_registrations
         WHERE user_id = ? AND chamber_id = ? AND check_in_status = 'checked_in'`
      )
      .bind(userId, chamberId)
      .first();
    const eventsAttended = (eventsRow?.cnt as number) || 0;

    return {
      membership,
      kpis: {
        referralsGiven,
        referralsReceived,
        eventsAttended,
        pointsBalance,
      },
      onboarding: {
        isComplete,
        completionPct,
        steps,
      },
    };
  }

  /**
   * Marks a single onboarding step as complete.
   * If all 4 steps are now true, awards +100 loyalty points (idempotent).
   */
  static async completeStep(
    c: AppContext,
    userId: string,
    chamberId: string,
    stepKey: keyof OnboardingSteps
  ): Promise<{ completionPct: number; isComplete: boolean }> {
    const db = c.env.DB;

    // 1. Read current onboarding state
    const userRow = await db
      .prepare(
        `SELECT onboarding_steps_json, onboarding_complete, points_balance
         FROM users WHERE id = ? AND chamber_id = ?`
      )
      .bind(userId, chamberId)
      .first();

    if (!userRow) {
      throw new Error('User not found');
    }

    let steps: OnboardingSteps = { profile: false, card: false, network: false, team: false };
    try {
      const parsed = JSON.parse((userRow.onboarding_steps_json as string) || '{}');
      steps = {
        profile: !!parsed.profile,
        card: !!parsed.card,
        network: !!parsed.network,
        team: !!parsed.team,
      };
    } catch {
      // fallback
    }

    // 2. Mark step as done
    steps[stepKey] = true;

    const completionPct = calculateProfileCompleteness(steps);
    const allDone = steps.profile && steps.card && steps.network && steps.team;
    const wasAlreadyComplete = (userRow.onboarding_complete as number) === 1;

    // 3. Update user record
    await db
      .prepare(
        `UPDATE users
         SET onboarding_steps_json = ?,
             profile_completion_pct = ?,
             onboarding_complete = ?,
             updated_at = datetime('now')
         WHERE id = ? AND chamber_id = ?`
      )
      .bind(
        JSON.stringify(steps),
        completionPct,
        allDone ? 1 : 0,
        userId,
        chamberId
      )
      .run();

    // 4. If newly completed (all 4 steps), award +100 loyalty points (idempotent)
    if (allDone && !wasAlreadyComplete) {
      await db
        .prepare(
          `UPDATE users SET points_balance = points_balance + 100 WHERE id = ? AND chamber_id = ?`
        )
        .bind(userId, chamberId)
        .run();

      // Record in points_history
      const pointsId = generatePrefixedId('pts');
      try {
        await db
          .prepare(
            `INSERT INTO points_history (id, chamber_id, user_id, points, type, reason, created_at)
             VALUES (?, ?, ?, 100, 'earned', 'Completed Member Onboarding', datetime('now'))`
          )
          .bind(pointsId, chamberId, userId)
          .run();
      } catch (err) {
        console.warn('[POINTS_HISTORY_INSERT_FAILED]', err);
      }

      // Record in notifications
      const notifId = generatePrefixedId('notif');
      try {
        await db
          .prepare(
            `INSERT INTO notifications (id, chamber_id, user_id, type, title, message, is_read, action_url, created_at)
             VALUES (?, ?, ?, 'onboarding_complete', '🎉 Onboarding Complete!', 'Congratulations! You completed your onboarding checklist and earned 100 points.', 0, '/member/overview', datetime('now'))`
          )
          .bind(notifId, chamberId, userId)
          .run();
      } catch (err) {
        console.warn('[NOTIFICATION_INSERT_FAILED]', err);
      }

      // Record in activity_logs
      const logId = generatePrefixedId('act');
      try {
        await db
          .prepare(
            `INSERT INTO activity_logs (id, chamber_id, user_id, action, target_type, target_id, details_json, created_at)
             VALUES (?, ?, ?, 'member.onboarding_completed', 'user', ?, ?, datetime('now'))`
          )
          .bind(logId, chamberId, userId, userId, JSON.stringify({ pointsEarned: 100 }))
          .run();
      } catch (err) {
        console.warn('[ACTIVITY_LOG_INSERT_FAILED]', err);
      }
    }

    return { completionPct, isComplete: allDone };
  }
}
