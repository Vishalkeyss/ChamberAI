import { drizzle } from 'drizzle-orm/d1';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { referrals, referralPeople } from '../../../db/schema';

export class ReferralsRepository {
  /** Referrals given or received by any of the member's businesses (§9.1). */
  static async listForBusinesses(d1: D1Database, chamberId: string, businessIds: string[]) {
    if (businessIds.length === 0) return [];
    return drizzle(d1)
      .select()
      .from(referrals)
      .where(
        and(
          eq(referrals.chamberId, chamberId),
          or(inArray(referrals.fromBusinessId, businessIds), inArray(referrals.toBusinessId, businessIds))
        )
      )
      .orderBy(desc(referrals.createdAt), desc(referrals.id));
  }

  static async peopleFor(d1: D1Database, chamberId: string, referralIds: string[]) {
    if (referralIds.length === 0) return [];
    return drizzle(d1)
      .select()
      .from(referralPeople)
      .where(and(eq(referralPeople.chamberId, chamberId), inArray(referralPeople.referralId, referralIds)))
      // rowid = insertion order (all contacts of one referral share created_at).
      .orderBy(sql`rowid`);
  }

  static async findById(d1: D1Database, chamberId: string, referralId: string) {
    return drizzle(d1)
      .select()
      .from(referrals)
      .where(and(eq(referrals.chamberId, chamberId), eq(referrals.id, referralId)))
      .get();
  }

  /** Conditional transition: only applies while the row still has `fromStatus` (no lost updates). */
  static async transition(
    d1: D1Database,
    chamberId: string,
    referralId: string,
    fromStatus: string,
    toStatus: string,
    convertedValue: number | null,
    updatedAt: string
  ) {
    const result = await drizzle(d1)
      .update(referrals)
      .set({ status: toStatus, convertedValue, updatedAt })
      .where(and(eq(referrals.chamberId, chamberId), eq(referrals.id, referralId), eq(referrals.status, fromStatus)))
      .run();
    return !!result.meta?.changes;
  }
}
