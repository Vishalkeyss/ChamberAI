import type { AppContext } from '../../../core/context';

export interface MemberOverviewData {
  membership: {
    tierName: string;
    planId: string | null;
    planPrice: number;
    status: string;
    memberIdDisplay: string;
    memberSince: string;
    renewalDate: string | null;
  };
  kpis: {
    referralsGiven: number;
    referralsReceived: number;
    eventsAttended: number;
    pointsBalance: number;
  };
}

export class MemberOverviewService {
  /**
   * Aggregate all overview KPIs for the authenticated member.
   * Every query enforces WHERE user_id = :userId AND chamber_id = :chamberId.
   */
  static async getOverview(
    c: AppContext,
    userId: string,
    chamberId: string
  ): Promise<MemberOverviewData> {
    const db = c.env.DB;

    // 1. Points balance
    const userRow = await db
      .prepare(
        `SELECT points_balance, profile_completion_pct
         FROM users WHERE id = ? AND chamber_id = ?`
      )
      .bind(userId, chamberId)
      .first();

    const pointsBalance = (userRow?.points_balance as number) || 0;

    // 2. Membership info: join via business_members → chamber_memberships → membership_plans
    const membershipRow = await db
      .prepare(
        `SELECT cm.member_id_display, cm.status, cm.plan_start_date, cm.plan_end_date, cm.created_at AS member_since,
                mp.id AS plan_id, mp.name AS tier_name, mp.price AS plan_price
         FROM chamber_memberships cm
         JOIN business_members bm ON bm.business_id = cm.business_id AND bm.chamber_id = cm.chamber_id
         LEFT JOIN membership_plans mp ON mp.id = cm.plan_id AND mp.chamber_id = cm.chamber_id
         WHERE bm.user_id = ? AND cm.chamber_id = ? AND cm.status = 'active'
         LIMIT 1`
      )
      .bind(userId, chamberId)
      .first();

    const memberSinceYear = (() => {
      const rawDate = (membershipRow?.member_since || membershipRow?.plan_start_date) as string;
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getFullYear())) return d.getFullYear().toString();
      }
      return new Date().getFullYear().toString();
    })();

    const membership = {
      tierName: (membershipRow?.tier_name as string) || 'Standard',
      planId: (membershipRow?.plan_id as string) || null,
      planPrice: typeof membershipRow?.plan_price === 'number' ? (membershipRow.plan_price as number) : 0,
      status: (membershipRow?.status as string) || 'active',
      memberIdDisplay: (membershipRow?.member_id_display as string) || '',
      memberSince: memberSinceYear,
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
    };
  }

  /**
   * Deprecated stub: Onboarding is strictly tenant-scoped (platform_chambers.onboarded).
   */
  static async completeStep(
    _c: AppContext,
    _userId: string,
    _chamberId: string,
    _stepKey: string
  ): Promise<{ success: boolean }> {
    return { success: true };
  }
}
