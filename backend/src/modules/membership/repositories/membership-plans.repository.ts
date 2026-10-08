import { newId } from '../../../core/shared/ids';
import type {
  CreatePlanDTO,
  MembershipPlanDTO,
  MembershipPlanRecord,
  TierBracket,
  UpdatePlanDTO,
} from '../types';

function mapRecordToDTO(record: MembershipPlanRecord): MembershipPlanDTO {
  let pricingTiers: TierBracket[] = [];
  if (record.pricing_tiers_json) {
    try {
      pricingTiers = JSON.parse(record.pricing_tiers_json);
    } catch {
      pricingTiers = [];
    }
  }

  let features: string[] = [];
  if (record.features_json) {
    try {
      features = JSON.parse(record.features_json);
    } catch {
      features = [];
    }
  }

  return {
    id: record.id,
    chamberId: record.chamber_id,
    name: record.name,
    accentColor: record.accent_color || '#2563EB',
    price: Number(record.price) || 0,
    pricingBasis: record.pricing_basis,
    pricingTiers,
    billingFrequency: record.billing_frequency,
    isPopular: record.is_popular ? 1 : 0,
    features,
    isActive: record.is_active ? 1 : 0,
    activeMembersCount: Number(record.active_members_count) || 0,
    sortOrder: Number(record.sort_order) || 0,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export class MembershipPlansRepository {
  /**
   * Retrieves all active membership plans for a given tenant chamber
   */
  static async findActivePlansByChamber(
    db: D1Database,
    chamberId: string
  ): Promise<MembershipPlanDTO[]> {
    const results = await db
      .prepare(
        `SELECT * FROM membership_plans
         WHERE chamber_id = ? AND is_active = 1
         ORDER BY sort_order ASC, created_at ASC`
      )
      .bind(chamberId)
      .all<MembershipPlanRecord>();

    return (results.results || []).map(mapRecordToDTO);
  }

  /**
   * Retrieves all membership plans (active and inactive) for admin management
   */
  static async findAllPlansByChamber(
    db: D1Database,
    chamberId: string
  ): Promise<MembershipPlanDTO[]> {
    const results = await db
      .prepare(
        `SELECT * FROM membership_plans
         WHERE chamber_id = ?
         ORDER BY sort_order ASC, created_at ASC`
      )
      .bind(chamberId)
      .all<MembershipPlanRecord>();

    return (results.results || []).map(mapRecordToDTO);
  }

  /**
   * Retrieves a single plan by ID enforcing tenant chamber isolation
   */
  static async findPlanById(
    db: D1Database,
    chamberId: string,
    planId: string
  ): Promise<MembershipPlanDTO | null> {
    const record = await db
      .prepare(
        `SELECT * FROM membership_plans
         WHERE chamber_id = ? AND id = ?
         LIMIT 1`
      )
      .bind(chamberId, planId)
      .first<MembershipPlanRecord>();

    return record ? mapRecordToDTO(record) : null;
  }

  /**
   * Retrieves a single active plan by ID enforcing tenant chamber isolation
   */
  static async findActivePlanById(
    db: D1Database,
    chamberId: string,
    planId: string
  ): Promise<MembershipPlanDTO | null> {
    const record = await db
      .prepare(
        `SELECT * FROM membership_plans
         WHERE chamber_id = ? AND id = ? AND is_active = 1
         LIMIT 1`
      )
      .bind(chamberId, planId)
      .first<MembershipPlanRecord>();

    return record ? mapRecordToDTO(record) : null;
  }

  /**
   * Creates a new membership plan within the tenant chamber and logs to activity_logs
   */
  static async createPlan(
    db: D1Database,
    chamberId: string,
    userId: string,
    data: CreatePlanDTO,
    ipAddress?: string
  ): Promise<MembershipPlanDTO> {
    const planId = await newId(db, 'membership_plans', 'PLAN', { chamberId });
    const accentColor = data.accentColor || '#2563EB';
    const price = data.price ?? 0;
    const pricingBasis = data.pricingBasis;
    const pricingTiersJson = JSON.stringify(data.pricingTiers || []);
    const billingFrequency = data.billingFrequency || 'annual';
    const isPopular = data.isPopular ? 1 : 0;
    const featuresJson = JSON.stringify(data.features || []);
    const sortOrder = data.sortOrder ?? 0;
    const isActive = 1;
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO membership_plans (
           id, chamber_id, name, accent_color, price, pricing_basis,
           pricing_tiers_json, billing_frequency, is_popular, features_json,
           is_active, active_members_count, sort_order, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
      )
      .bind(
        planId,
        chamberId,
        data.name.trim(),
        accentColor,
        price,
        pricingBasis,
        pricingTiersJson,
        billingFrequency,
        isPopular,
        featuresJson,
        isActive,
        sortOrder,
        now,
        now
      )
      .run();

    // Side effect: Log to activity_logs (Prompt 02.1 Section 14)
    const logId = await newId(db, 'activity_logs', 'ACT', { chamberId, suffixLength: 6, skipUniqueCheck: true });
    try {
      await db
        .prepare(
          `INSERT INTO activity_logs (
             id, chamber_id, user_id, action, target_type, target_id, details_json, ip_address, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          logId,
          chamberId,
          userId,
          'create_plan',
          'membership_plan',
          planId,
          JSON.stringify({ name: data.name, price, pricingBasis }),
          ipAddress || null,
          now
        )
        .run();
    } catch (err) {
      console.warn('Failed to insert activity_log for create_plan:', err);
    }

    return {
      id: planId,
      chamberId,
      name: data.name.trim(),
      accentColor,
      price,
      pricingBasis,
      pricingTiers: data.pricingTiers || [],
      billingFrequency,
      isPopular,
      features: data.features || [],
      isActive,
      activeMembersCount: 0,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Updates an existing membership plan and records audit log
   */
  static async updatePlan(
    db: D1Database,
    chamberId: string,
    userId: string,
    planId: string,
    data: UpdatePlanDTO,
    ipAddress?: string
  ): Promise<MembershipPlanDTO | null> {
    const existing = await this.findPlanById(db, chamberId, planId);
    if (!existing) return null;

    const name = data.name !== undefined ? data.name.trim() : existing.name;
    const accentColor = data.accentColor !== undefined ? data.accentColor : existing.accentColor;
    const price = data.price !== undefined ? data.price : existing.price;
    const pricingBasis = data.pricingBasis !== undefined ? data.pricingBasis : existing.pricingBasis;
    const pricingTiers = data.pricingTiers !== undefined ? data.pricingTiers : existing.pricingTiers;
    const billingFrequency =
      data.billingFrequency !== undefined ? data.billingFrequency : existing.billingFrequency;
    const isPopular = data.isPopular !== undefined ? (data.isPopular ? 1 : 0) : existing.isPopular;
    const features = data.features !== undefined ? data.features : existing.features;
    const sortOrder = data.sortOrder !== undefined ? data.sortOrder : existing.sortOrder;
    const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : existing.isActive;
    const now = new Date().toISOString();

    await db
      .prepare(
        `UPDATE membership_plans
         SET name = ?, accent_color = ?, price = ?, pricing_basis = ?,
             pricing_tiers_json = ?, billing_frequency = ?, is_popular = ?,
             features_json = ?, is_active = ?, sort_order = ?, updated_at = ?
         WHERE chamber_id = ? AND id = ?`
      )
      .bind(
        name,
        accentColor,
        price,
        pricingBasis,
        JSON.stringify(pricingTiers),
        billingFrequency,
        isPopular,
        JSON.stringify(features),
        isActive,
        sortOrder,
        now,
        chamberId,
        planId
      )
      .run();

    // Side effect: Log to activity_logs
    const logId = await newId(db, 'activity_logs', 'ACT', { chamberId, suffixLength: 6, skipUniqueCheck: true });
    try {
      await db
        .prepare(
          `INSERT INTO activity_logs (
             id, chamber_id, user_id, action, target_type, target_id, details_json, ip_address, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          logId,
          chamberId,
          userId,
          'update_plan',
          'membership_plan',
          planId,
          JSON.stringify({ name, price, pricingBasis, isActive }),
          ipAddress || null,
          now
        )
        .run();
    } catch (err) {
      console.warn('Failed to insert activity_log for update_plan:', err);
    }

    return {
      ...existing,
      name,
      accentColor,
      price,
      pricingBasis,
      pricingTiers,
      billingFrequency,
      isPopular,
      features,
      isActive,
      sortOrder,
      updatedAt: now,
    };
  }

  /**
   * Toggles active status for a plan
   */
  static async togglePlanStatus(
    db: D1Database,
    chamberId: string,
    userId: string,
    planId: string,
    isActive: number,
    ipAddress?: string
  ): Promise<{ id: string; isActive: number } | null> {
    const existing = await this.findPlanById(db, chamberId, planId);
    if (!existing) return null;

    const now = new Date().toISOString();
    await db
      .prepare(
        `UPDATE membership_plans
         SET is_active = ?, updated_at = ?
         WHERE chamber_id = ? AND id = ?`
      )
      .bind(isActive, now, chamberId, planId)
      .run();

    // Log status toggle to activity_logs
    const logId = await newId(db, 'activity_logs', 'ACT', { chamberId, suffixLength: 6, skipUniqueCheck: true });
    try {
      await db
        .prepare(
          `INSERT INTO activity_logs (
             id, chamber_id, user_id, action, target_type, target_id, details_json, ip_address, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          logId,
          chamberId,
          userId,
          'toggle_plan_status',
          'membership_plan',
          planId,
          JSON.stringify({ previousStatus: existing.isActive, newStatus: isActive }),
          ipAddress || null,
          now
        )
        .run();
    } catch (err) {
      console.warn('Failed to insert activity_log for toggle_plan_status:', err);
    }

    return { id: planId, isActive };
  }

  /**
   * Deletes a plan if no active subscriptions exist, and logs audit
   */
  static async deletePlan(
    db: D1Database,
    chamberId: string,
    userId: string,
    planId: string,
    ipAddress?: string
  ): Promise<boolean> {
    const existing = await this.findPlanById(db, chamberId, planId);
    if (!existing) return false;

    await db
      .prepare(
        `DELETE FROM membership_plans
         WHERE chamber_id = ? AND id = ?`
      )
      .bind(chamberId, planId)
      .run();

    const logId = await newId(db, 'activity_logs', 'ACT', { chamberId, suffixLength: 6, skipUniqueCheck: true });
    try {
      await db
        .prepare(
          `INSERT INTO activity_logs (
             id, chamber_id, user_id, action, target_type, target_id, details_json, ip_address, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          logId,
          chamberId,
          userId,
          'delete_plan',
          'membership_plan',
          planId,
          JSON.stringify({ name: existing.name }),
          ipAddress || null,
          new Date().toISOString()
        )
        .run();
    } catch (err) {
      console.warn('Failed to insert activity_log for delete_plan:', err);
    }

    return true;
  }
}
