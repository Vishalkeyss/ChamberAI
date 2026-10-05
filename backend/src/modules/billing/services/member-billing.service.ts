import type { AppContext } from '../../../core/context';
import { generatePrefixedId } from '../../../core/shared/crypto';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import type {
  MemberInvoice,
  SavedPaymentMethod,
  BenefitUsageItem,
  PayInvoiceInput,
  AddPaymentMethodInput,
} from '../types';

export class MemberBillingService {
  /**
   * Helper to resolve the user's linked business ID within the current chamber.
   */
  private static async getUserBusinessId(
    db: D1Database,
    userId: string,
    chamberId: string
  ): Promise<string | null> {
    const row = await db
      .prepare(
        `SELECT business_id FROM business_members
         WHERE user_id = ? AND chamber_id = ? AND status = 'active'
         LIMIT 1`
      )
      .bind(userId, chamberId)
      .first<{ business_id: string }>();
    return row?.business_id || null;
  }

  /**
   * Automatically initializes an inaugural membership invoice if the user has an active/pending
   * membership record but 0 existing invoices in the database.
   */
  private static async ensureInitialMembershipInvoice(
    db: D1Database,
    userId: string,
    chamberId: string,
    businessId: string | null
  ): Promise<void> {
    const existingCountRow = await db
      .prepare(
        `SELECT COUNT(*) AS count FROM invoices
         WHERE chamber_id = ? AND (user_id = ? OR (business_id IS NOT NULL AND business_id = ?))`
      )
      .bind(chamberId, userId, businessId || '')
      .first<{ count: number }>();

    if ((existingCountRow?.count || 0) > 0) return;

    // Check if member has an active or pending membership plan
    const memberRow = await db
      .prepare(
        `SELECT cm.id AS membership_id, cm.plan_id, mp.name AS plan_name, mp.price AS plan_price,
                cm.plan_start_date, cm.plan_end_date, cm.created_at
         FROM chamber_memberships cm
         LEFT JOIN membership_plans mp ON mp.id = cm.plan_id
         WHERE cm.chamber_id = ? AND cm.business_id = ?
         LIMIT 1`
      )
      .bind(chamberId, businessId || '')
      .first<{
        membership_id: string;
        plan_id: string | null;
        plan_name: string | null;
        plan_price: number | null;
        plan_start_date: string | null;
        plan_end_date: string | null;
        created_at: string;
      }>();

    if (memberRow && memberRow.plan_price !== null && memberRow.plan_price > 0) {
      const invId = generatePrefixedId('inv');
      const currentYear = new Date().getFullYear();
      const randDigits = Math.floor(1000 + Math.random() * 9000);
      const invoiceNumber = `INV-${currentYear}-${randDigits}`;
      const price = memberRow.plan_price;
      const dueDate = memberRow.plan_start_date || new Date().toISOString().split('T')[0];

      await db
        .prepare(
          `INSERT INTO invoices (
            id, chamber_id, invoice_number, user_id, invoice_type, description,
            amount, tax_amount, discount_amount, total_amount, currency,
            status, due_date, related_plan_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'membership', ?, ?, 0.0, 0.0, ?, 'USD', 'unpaid', ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          invId,
          chamberId,
          invoiceNumber,
          userId,
          `Annual Membership Dues — ${memberRow.plan_name || 'Standard'}`,
          price,
          price,
          dueDate,
          memberRow.plan_id
        )
        .run();
    }
  }

  /**
   * Retrieves invoices for the authenticated member with total outstanding balance calculation.
   * Multi-tenant isolated via `WHERE chamber_id = :chamberId AND (user_id = :userId OR business_id = :businessId)`.
   */
  static async getMemberInvoices(
    c: AppContext,
    userId: string,
    chamberId: string,
    options: { status?: string; page?: number; limit?: number } = {}
  ): Promise<{
    total_outstanding: number;
    currency: string;
    invoices: MemberInvoice[];
    pagination: { page: number; limit: number; total: number; total_pages: number };
  }> {
    const db = c.env.DB;
    const businessId = await this.getUserBusinessId(db, userId, chamberId);

    // Ensure member has at least their initial membership invoice if applicable
    await this.ensureInitialMembershipInvoice(db, userId, chamberId, businessId);

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    // 1. Calculate total outstanding balance (unpaid / open / overdue)
    const outstandingRow = await db
      .prepare(
        `SELECT COALESCE(SUM(total_amount), 0) AS total_due
         FROM invoices
         WHERE chamber_id = ?
           AND (user_id = ? OR (business_id IS NOT NULL AND business_id = ?))
           AND status IN ('unpaid', 'open', 'overdue')`
      )
      .bind(chamberId, userId, businessId || '')
      .first<{ total_due: number }>();

    const totalOutstanding = outstandingRow?.total_due || 0;

    // 2. Build where filter for list
    let statusFilter = '';
    const bindings: any[] = [chamberId, userId, businessId || ''];

    if (options.status === 'unpaid' || options.status === 'open') {
      statusFilter = `AND status IN ('unpaid', 'open', 'overdue')`;
    } else if (options.status === 'paid') {
      statusFilter = `AND status = 'paid'`;
    }

    // 3. Count total matching rows
    const countRow = await db
      .prepare(
        `SELECT COUNT(*) AS count FROM invoices
         WHERE chamber_id = ?
           AND (user_id = ? OR (business_id IS NOT NULL AND business_id = ?))
           ${statusFilter}`
      )
      .bind(...bindings)
      .first<{ count: number }>();

    const total = countRow?.count || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // 4. Fetch page rows
    const rows = await db
      .prepare(
        `SELECT id, invoice_number, invoice_type, description,
                amount, tax_amount, discount_amount, total_amount, currency,
                status, due_date, paid_at, payment_method_id, payment_gateway_txn_id,
                created_at
         FROM invoices
         WHERE chamber_id = ?
           AND (user_id = ? OR (business_id IS NOT NULL AND business_id = ?))
           ${statusFilter}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...bindings, limit, offset)
      .all<any>();

    const invoices: MemberInvoice[] = (rows.results || []).map((row: any) => ({
      id: row.id,
      invoice_number: row.invoice_number,
      invoice_type: row.invoice_type || 'membership',
      description: row.description || 'Chamber Membership Invoice',
      amount: row.amount || 0,
      tax_amount: row.tax_amount || 0,
      discount_amount: row.discount_amount || 0,
      total_amount: row.total_amount || 0,
      currency: row.currency || 'USD',
      status: row.status,
      due_date: row.due_date,
      paid_at: row.paid_at || null,
      payment_method_id: row.payment_method_id || null,
      payment_gateway_txn_id: row.payment_gateway_txn_id || null,
      pdf_url: `/api/v1/member/invoices/${row.id}/download`,
      created_at: row.created_at,
    }));

    return {
      total_outstanding: Number(totalOutstanding.toFixed(2)),
      currency: 'USD',
      invoices,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    };
  }

  /**
   * Pays an invoice online.
   * Updates invoice status to 'paid', sets gateway transaction reference, and if this invoice is
   * a membership renewal, extends the member's subscription date.
   */
  static async payInvoice(
    c: AppContext,
    userId: string,
    chamberId: string,
    invoiceId: string,
    payload: PayInvoiceInput
  ): Promise<{
    invoice_id: string;
    status: string;
    transaction_id: string;
    paid_at: string;
  }> {
    const db = c.env.DB;
    const businessId = await this.getUserBusinessId(db, userId, chamberId);

    // Verify invoice belongs to this tenant and user
    const invoice = await db
      .prepare(
        `SELECT * FROM invoices
         WHERE id = ? AND chamber_id = ?
           AND (user_id = ? OR (business_id IS NOT NULL AND business_id = ?))`
      )
      .bind(invoiceId, chamberId, userId, businessId || '')
      .first<any>();

    if (!invoice) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Invoice not found or access denied', 404);
    }

    if (invoice.status === 'paid') {
      return {
        invoice_id: invoice.id,
        status: 'paid',
        transaction_id: invoice.payment_gateway_txn_id || 'txn_previously_settled',
        paid_at: invoice.paid_at || invoice.updated_at,
      };
    }

    const now = new Date().toISOString();
    const txnId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    let paymentMethodId = payload.payment_method_id || null;

    // Optional card saving if user requested to save card details
    if (payload.card_details?.save_card && payload.card_details.last_four) {
      const pmId = generatePrefixedId('pm');
      const brand = payload.card_details.brand || 'Visa';
      const lastFour = payload.card_details.last_four;
      const expMonth = payload.card_details.expiry_month || 12;
      const expYear = payload.card_details.expiry_year || 2028;

      await db
        .prepare(
          `INSERT INTO payment_methods (
            id, chamber_id, user_id, type, brand, last_four,
            expiry_month, expiry_year, is_default, created_at
          ) VALUES (?, ?, ?, 'card', ?, ?, ?, ?, 0, datetime('now'))`
        )
        .bind(pmId, chamberId, userId, brand, lastFour, expMonth, expYear)
        .run();

      paymentMethodId = pmId;
    }

    // 1. Mark invoice as paid
    await db
      .prepare(
        `UPDATE invoices
         SET status = 'paid',
             paid_at = ?,
             payment_gateway_txn_id = ?,
             payment_method_id = ?,
             updated_at = ?
         WHERE id = ? AND chamber_id = ?`
      )
      .bind(now, txnId, paymentMethodId, now, invoiceId, chamberId)
      .run();

    // 2. Side effect: If membership invoice, extend membership subscription
    if (invoice.invoice_type === 'membership' || invoice.related_plan_id) {
      await db
        .prepare(
          `UPDATE chamber_memberships
           SET status = 'active',
               plan_end_date = '2026-12-31',
               updated_at = ?
           WHERE chamber_id = ? AND business_id = ?`
        )
        .bind(now, chamberId, businessId || '')
        .run();
    }

    // 3. Activity audit trail
    try {
      const logId = generatePrefixedId('act');
      await db
        .prepare(
          `INSERT INTO activity_logs (
            id, chamber_id, user_id, entity_type, entity_id, action,
            metadata_json, created_at
          ) VALUES (?, ?, ?, 'invoice', ?, 'INVOICE_PAID', ?, ?)`
        )
        .bind(
          logId,
          chamberId,
          userId,
          invoiceId,
          JSON.stringify({
            amount: invoice.total_amount,
            invoice_number: invoice.invoice_number,
            transaction_id: txnId,
          }),
          now
        )
        .run();
    } catch {
      // Non-blocking for audit log failures
    }

    return {
      invoice_id: invoiceId,
      status: 'paid',
      transaction_id: txnId,
      paid_at: now,
    };
  }

  /**
   * Retrieves saved payment methods for the member.
   */
  static async getPaymentMethods(
    c: AppContext,
    userId: string,
    chamberId: string
  ): Promise<SavedPaymentMethod[]> {
    const db = c.env.DB;
    const rows = await db
      .prepare(
        `SELECT id, type, brand, last_four, expiry_month, expiry_year, is_default, created_at
         FROM payment_methods
         WHERE chamber_id = ? AND user_id = ?
         ORDER BY is_default DESC, created_at DESC`
      )
      .bind(chamberId, userId)
      .all<any>();

    return (rows.results || []).map((row: any) => ({
      id: row.id,
      type: row.type || 'card',
      brand: row.brand || 'Visa',
      last_four: row.last_four || '4242',
      expiry_month: row.expiry_month || 12,
      expiry_year: row.expiry_year || 2028,
      is_default: Boolean(row.is_default),
      created_at: row.created_at,
    }));
  }

  /**
   * Saves a new tokenized payment method for the member.
   */
  static async addPaymentMethod(
    c: AppContext,
    userId: string,
    chamberId: string,
    input: AddPaymentMethodInput
  ): Promise<SavedPaymentMethod> {
    const db = c.env.DB;
    const pmId = generatePrefixedId('pm');
    const now = new Date().toISOString();

    // Check existing count; if first card, force default = 1
    const countRow = await db
      .prepare(`SELECT COUNT(*) AS count FROM payment_methods WHERE chamber_id = ? AND user_id = ?`)
      .bind(chamberId, userId)
      .first<{ count: number }>();

    const isFirstCard = (countRow?.count || 0) === 0;
    const isDefault = input.is_default || isFirstCard ? 1 : 0;

    if (isDefault === 1) {
      await db
        .prepare(`UPDATE payment_methods SET is_default = 0 WHERE chamber_id = ? AND user_id = ?`)
        .bind(chamberId, userId)
        .run();
    }

    await db
      .prepare(
        `INSERT INTO payment_methods (
          id, chamber_id, user_id, type, brand, last_four,
          expiry_month, expiry_year, is_default, gateway_token_encrypted, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        pmId,
        chamberId,
        userId,
        input.type || 'card',
        input.brand,
        input.last_four,
        input.expiry_month,
        input.expiry_year,
        isDefault,
        input.gateway_token_encrypted || null,
        now
      )
      .run();

    return {
      id: pmId,
      type: input.type || 'card',
      brand: input.brand,
      last_four: input.last_four,
      expiry_month: input.expiry_month,
      expiry_year: input.expiry_year,
      is_default: isDefault === 1,
      created_at: now,
    };
  }

  /**
   * Deletes a saved payment method.
   */
  static async deletePaymentMethod(
    c: AppContext,
    userId: string,
    chamberId: string,
    paymentMethodId: string
  ): Promise<boolean> {
    const db = c.env.DB;

    // Check if deleting the default card
    const target = await db
      .prepare(`SELECT is_default FROM payment_methods WHERE id = ? AND chamber_id = ? AND user_id = ?`)
      .bind(paymentMethodId, chamberId, userId)
      .first<{ is_default: number }>();

    if (!target) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Payment method not found', 404);
    }

    await db
      .prepare(`DELETE FROM payment_methods WHERE id = ? AND chamber_id = ? AND user_id = ?`)
      .bind(paymentMethodId, chamberId, userId)
      .run();

    // If default card was removed, promote the latest remaining card to default
    if (target.is_default === 1) {
      await db
        .prepare(
          `UPDATE payment_methods
           SET is_default = 1
           WHERE id = (
             SELECT id FROM payment_methods
             WHERE chamber_id = ? AND user_id = ?
             ORDER BY created_at DESC LIMIT 1
           )`
        )
        .bind(chamberId, userId)
        .run();
    }

    return true;
  }

  /**
   * Sets a specific payment method as default and unsets all other cards.
   */
  static async setDefaultPaymentMethod(
    c: AppContext,
    userId: string,
    chamberId: string,
    paymentMethodId: string
  ): Promise<boolean> {
    const db = c.env.DB;

    const exists = await db
      .prepare(`SELECT id FROM payment_methods WHERE id = ? AND chamber_id = ? AND user_id = ?`)
      .bind(paymentMethodId, chamberId, userId)
      .first();

    if (!exists) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Payment method not found', 404);
    }

    await db
      .prepare(`UPDATE payment_methods SET is_default = 0 WHERE chamber_id = ? AND user_id = ?`)
      .bind(chamberId, userId)
      .run();

    await db
      .prepare(`UPDATE payment_methods SET is_default = 1 WHERE id = ? AND chamber_id = ? AND user_id = ?`)
      .bind(paymentMethodId, chamberId, userId)
      .run();

    return true;
  }

  /**
   * Retrieves or initializes plan benefit quotas and usage counts for the member's current term.
   */
  static async getBenefitUsage(
    c: AppContext,
    userId: string,
    chamberId: string
  ): Promise<BenefitUsageItem[]> {
    const db = c.env.DB;
    const businessId = await this.getUserBusinessId(db, userId, chamberId);

    // Find the member's membership row
    const membership = await db
      .prepare(
        `SELECT cm.id AS membership_id, cm.plan_id, mp.name AS plan_name, mp.features_json,
                COALESCE(cm.plan_start_date, cm.created_at) AS period_start,
                COALESCE(cm.plan_end_date, '2026-12-31') AS period_end
         FROM chamber_memberships cm
         LEFT JOIN membership_plans mp ON mp.id = cm.plan_id
         WHERE cm.chamber_id = ? AND cm.business_id = ?
         LIMIT 1`
      )
      .bind(chamberId, businessId || '')
      .first<{
        membership_id: string;
        plan_id: string | null;
        plan_name: string | null;
        features_json: string | null;
        period_start: string;
        period_end: string;
      }>();

    if (!membership) {
      return [];
    }

    const membershipId = membership.membership_id;
    const cycleStart = membership.period_start.split('T')[0];
    const cycleEnd = membership.period_end.split('T')[0];

    // Check existing usage rows in D1
    const existing = await db
      .prepare(
        `SELECT id, benefit_key, period_start, period_end, usage_limit, used_count
         FROM membership_benefit_usage
         WHERE chamber_id = ? AND membership_id = ?`
      )
      .bind(chamberId, membershipId)
      .all<any>();

    let records = existing.results || [];

    // 2. Fetch all plans for this chamber to resolve any tier inheritance references (e.g. "Everything in Silver")
    const allChamberPlans = await db
      .prepare(`SELECT id, name, features_json FROM membership_plans WHERE chamber_id = ?`)
      .bind(chamberId)
      .all<{ id: string; name: string; features_json: string | null }>();

    const chamberPlansMap = new Map<string, string[]>();
    for (const p of allChamberPlans.results || []) {
      try {
        const feats = p.features_json ? JSON.parse(p.features_json) : [];
        if (Array.isArray(feats)) {
          chamberPlansMap.set(p.name.trim().toLowerCase(), feats);
        }
      } catch {
        // ignore JSON parse error
      }
    }

    // Parse features_json from member's current plan
    let rawPlanFeatures: (string | any)[] = [];
    try {
      rawPlanFeatures = membership.features_json ? JSON.parse(membership.features_json) : [];
    } catch {
      rawPlanFeatures = [];
    }

    if (!Array.isArray(rawPlanFeatures) || rawPlanFeatures.length === 0) {
      if (records.length > 0) {
        await db
          .prepare(
            `DELETE FROM membership_benefit_usage
             WHERE chamber_id = ? AND membership_id = ?`
          )
          .bind(chamberId, membershipId)
          .run();
      }
      return [];
    }

    // 3. Resolve plan inheritance recursively (e.g. "Everything in Silver" -> expands Silver's features)
    const allResolvedFeatures = MemberBillingService.resolveInheritedFeatures(
      rawPlanFeatures,
      chamberPlansMap,
      membership.plan_name ? new Set([membership.plan_name.trim().toLowerCase()]) : new Set()
    );

    // 4. Filter strictly for TRACKABLE / METERED benefits (e.g. tickets, sponsorships, listings, meets, announcements)
    const trackableFeatures = allResolvedFeatures.filter((f) =>
      MemberBillingService.isTrackableBenefit(f)
    );

    if (trackableFeatures.length === 0) {
      if (records.length > 0) {
        await db
          .prepare(
            `DELETE FROM membership_benefit_usage
             WHERE chamber_id = ? AND membership_id = ?`
          )
          .bind(chamberId, membershipId)
          .run();
      }
      return [];
    }

    // Derive benefit items dynamically
    const dynamicBenefits = trackableFeatures
      .map((f) => MemberBillingService.parseFeatureBenefit(f))
      .filter((b) => Boolean(b.name) && b.limit > 0);

    if (dynamicBenefits.length === 0) {
      if (records.length > 0) {
        await db
          .prepare(
            `DELETE FROM membership_benefit_usage
             WHERE chamber_id = ? AND membership_id = ?`
          )
          .bind(chamberId, membershipId)
          .run();
      }
      return [];
    }

    const currentKeys = new Set(dynamicBenefits.map((b) => b.key));

    // Delete any stale benefit rows from D1 that don't belong to the current plan
    for (const r of records) {
      if (!currentKeys.has(r.benefit_key)) {
        await db
          .prepare(
            `DELETE FROM membership_benefit_usage
             WHERE chamber_id = ? AND membership_id = ? AND benefit_key = ?`
          )
          .bind(chamberId, membershipId, r.benefit_key)
          .run();
      }
    }

    // Ensure all current plan benefits exist in D1
    const existingKeyMap = new Map<string, any>();
    for (const r of records) {
      if (currentKeys.has(r.benefit_key)) {
        existingKeyMap.set(r.benefit_key, r);
      }
    }

    for (const b of dynamicBenefits) {
      if (!existingKeyMap.has(b.key)) {
        const buId = generatePrefixedId('bu');
        await db
          .prepare(
            `INSERT OR IGNORE INTO membership_benefit_usage (
              id, chamber_id, membership_id, benefit_key, period_start, period_end,
              usage_limit, used_count, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`
          )
          .bind(buId, chamberId, membershipId, b.key, cycleStart, cycleEnd, b.limit)
          .run();
      }
    }

    // Reload active records from D1 for this membership
    const reloaded = await db
      .prepare(
        `SELECT id, benefit_key, period_start, period_end, usage_limit, used_count
         FROM membership_benefit_usage
         WHERE chamber_id = ? AND membership_id = ?`
      )
      .bind(chamberId, membershipId)
      .all<any>();

    const allRecords = reloaded.results || [];
    const recordMap = new Map<string, any>();
    for (const r of allRecords) {
      recordMap.set(r.benefit_key, r);
    }

    return dynamicBenefits.map((b) => {
      const recorded = recordMap.get(b.key);
      const quotaLimit = recorded && typeof recorded.usage_limit === 'number' ? recorded.usage_limit : b.limit;
      const usedCount = recorded ? (recorded.used_count || 0) : 0;
      const remaining = quotaLimit === -1 ? 9999 : Math.max(0, quotaLimit - usedCount);

      return {
        benefit_key: b.key,
        benefit_name: b.name,
        usage_count: usedCount,
        quota_limit: quotaLimit,
        remaining,
        cycle_start: cycleStart,
        cycle_end: cycleEnd,
      };
    });
  }

  /**
   * Recursively resolves referenced plan features (e.g. "Everything in Silver" -> expands Silver features).
   */
  static resolveInheritedFeatures(
    features: string[],
    plansMap: Map<string, string[]>,
    visited = new Set<string>()
  ): string[] {
    const result: string[] = [];
    const seen = new Set<string>();

    for (const raw of features) {
      const trimmed = String(raw || '').trim();
      if (!trimmed) continue;

      // Check if feature is an inheritance reference:
      // "Everything in Silver", "Everything in Bronze", "All features of Silver", "Includes Silver"
      const match = trimmed.match(
        /^(?:everything\s+in|all\s+(?:features\s+)?(?:of|in)|includes?\s+(?:all\s+)?(?:of|in)?)\s+(.+)$/i
      );

      if (match) {
        const refName = match[1].trim().toLowerCase();
        let matchedKey: string | undefined;
        for (const planName of plansMap.keys()) {
          if (planName === refName || planName.startsWith(refName) || refName.startsWith(planName)) {
            matchedKey = planName;
            break;
          }
        }

        if (matchedKey && !visited.has(matchedKey)) {
          visited.add(matchedKey);
          const parentFeatures = plansMap.get(matchedKey) || [];
          const childResolved = MemberBillingService.resolveInheritedFeatures(
            parentFeatures,
            plansMap,
            visited
          );
          for (const cf of childResolved) {
            const norm = cf.toLowerCase();
            if (!seen.has(norm)) {
              seen.add(norm);
              result.push(cf);
            }
          }
        }
      } else {
        const norm = trimmed.toLowerCase();
        if (!seen.has(norm)) {
          seen.add(norm);
          result.push(trimmed);
        }
      }
    }

    return result;
  }

  /**
   * Determines if a feature string represents a trackable (metered / consumable) benefit.
   */
  static isTrackableBenefit(rawFeature: string): boolean {
    const raw = String(rawFeature || '').trim();
    if (!raw) return false;

    // References to other plans are NOT benefits
    if (
      /^(?:everything\s+in|all\s+(?:features\s+)?(?:of|in)|includes?\s+(?:all\s+)?(?:of|in)?)\s+/i.test(
        raw
      )
    ) {
      return false;
    }

    // Explicit numeric count at start, e.g. "5 Free Event Tickets", "12 Press Releases", "2 Ads"
    if (/^\d+\s+/i.test(raw)) {
      return true;
    }

    const lower = raw.toLowerCase();

    // Check for consumable / meterable keywords
    const trackableKeywords = [
      'ticket',
      'pass',
      'sponsorship',
      'placement',
      'ad ',
      'ads',
      'advertisement',
      'spotlight',
      'submission',
      'press release',
      'networking meet',
      'networking session',
      'monthly meet',
      'monthly networking',
      'announcement',
      'newsletter',
      'job posting',
      'job board',
      'directory listing',
    ];

    for (const kw of trackableKeywords) {
      if (lower.includes(kw)) {
        return true;
      }
    }

    if (
      (lower.includes('monthly') || lower.includes('quarterly')) &&
      !lower.includes('forum') &&
      !lower.includes('access') &&
      !lower.includes('dashboard')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Parses an individual feature item from a plan's features_json into a structured Benefit item.
   */
  static parseFeatureBenefit(featureItem: string | any): {
    key: string;
    name: string;
    limit: number;
  } {
    if (typeof featureItem === 'object' && featureItem !== null) {
      const name = featureItem.name || featureItem.title || featureItem.feature || 'Plan Benefit';
      const key = featureItem.key || MemberBillingService.slugify(name);
      const limit =
        typeof featureItem.limit === 'number'
          ? featureItem.limit
          : typeof featureItem.quota === 'number'
          ? featureItem.quota
          : 1;
      return { key, name, limit };
    }

    const raw = String(featureItem || '').trim();
    if (!raw) return { key: 'benefit', name: 'Plan Benefit', limit: 1 };

    const formatName = (str: string) => {
      return str.replace(/\b\w/g, (c) => c.toUpperCase());
    };

    // Check if string starts with an explicit number quota, e.g. "5 Free Event Tickets", "12 Press Releases"
    const leadingNumMatch = raw.match(/^(\d+)\s+(.+)$/);
    if (leadingNumMatch) {
      const limit = parseInt(leadingNumMatch[1], 10);
      const rest = leadingNumMatch[2].trim();
      const key = MemberBillingService.slugify(rest);
      return { key, name: `${limit} ${formatName(rest)}`, limit };
    }

    const lower = raw.toLowerCase();
    let limit = 1;

    if (lower.includes('monthly')) {
      limit = 12;
    } else if (lower.includes('quarterly')) {
      limit = 4;
    } else if (lower.includes('bi-annual') || lower.includes('biannual') || lower.includes('semi-annual')) {
      limit = 2;
    } else if (
      lower.includes('annual') ||
      lower.includes('yearly') ||
      lower.includes('sponsorship') ||
      lower.includes('spotlight') ||
      lower.includes('placement') ||
      lower.includes('directory listing')
    ) {
      limit = 1;
    } else if (lower.includes('ticket') || lower.includes('pass')) {
      limit = 2;
    } else if (lower.includes('job board') || lower.includes('job posting')) {
      limit = 3;
    } else if (lower.includes('press release') || lower.includes('submission')) {
      limit = 12;
    } else {
      limit = 1;
    }

    const key = MemberBillingService.slugify(raw);
    return { key, name: formatName(raw), limit };
  }

  static slugify(text: string): string {
    return (
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 50) || 'benefit'
    );
  }

  /**
   * Change / Switch Membership Plan
   * Updates chamber_memberships.plan_id for the authenticated user's business.
   */
  static async changePlan(
    c: AppContext,
    userId: string,
    chamberId: string,
    newPlanId: string
  ): Promise<{
    membershipId: string;
    previousPlanId: string | null;
    newPlanId: string;
    newPlanName: string;
    newPlanPrice: number;
  }> {
    const db = c.env.DB;

    // 1. Verify target plan exists, belongs to this chamber, and is active
    const targetPlan = await db
      .prepare(
        `SELECT id, name, price, is_active FROM membership_plans
         WHERE id = ? AND chamber_id = ? AND is_active = 1
         LIMIT 1`
      )
      .bind(newPlanId, chamberId)
      .first<{ id: string; name: string; price: number; is_active: number }>();

    if (!targetPlan) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Target membership plan not found or inactive', 404);
    }

    // 2. Locate member's business and membership record
    const membership = await db
      .prepare(
        `SELECT cm.id AS membership_id, cm.plan_id, cm.business_id, cm.status
         FROM chamber_memberships cm
         JOIN business_members bm ON bm.business_id = cm.business_id AND bm.chamber_id = cm.chamber_id
         WHERE bm.user_id = ? AND cm.chamber_id = ?
         LIMIT 1`
      )
      .bind(userId, chamberId)
      .first<{
        membership_id: string;
        plan_id: string | null;
        business_id: string;
        status: string;
      }>();

    if (!membership) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Active chamber membership not found', 404);
    }

    const previousPlanId = membership.plan_id;

    // 3. Update chamber_memberships with the new plan_id
    await db
      .prepare(
        `UPDATE chamber_memberships
         SET plan_id = ?, status = 'active', updated_at = datetime('now')
         WHERE id = ? AND chamber_id = ?`
      )
      .bind(newPlanId, membership.membership_id, chamberId)
      .run();

    // 4. If plan changed, reset benefit usage rows so the new plan's features/quotas take effect
    if (previousPlanId !== newPlanId) {
      await db
        .prepare(
          `DELETE FROM membership_benefit_usage
           WHERE chamber_id = ? AND membership_id = ?`
        )
        .bind(chamberId, membership.membership_id)
        .run();
    }

    // 5. Activity log
    const auditId = generatePrefixedId('act');
    await db
      .prepare(
        `INSERT INTO activity_logs (
          id, chamber_id, user_id, action, target_type, target_id, details_json, created_at
        ) VALUES (?, ?, ?, 'member.plan_changed', 'chamber_memberships', ?, ?, datetime('now'))`
      )
      .bind(
        auditId,
        chamberId,
        userId,
        membership.membership_id,
        JSON.stringify({
          from_plan_id: previousPlanId,
          to_plan_id: newPlanId,
          plan_name: targetPlan.name,
          plan_price: targetPlan.price,
        })
      )
      .run();

    return {
      membershipId: membership.membership_id,
      previousPlanId,
      newPlanId: targetPlan.id,
      newPlanName: targetPlan.name,
      newPlanPrice: targetPlan.price,
    };
  }

  /**
   * Generates printable HTML receipt for an invoice download.
   */
  static async getInvoiceReceipt(
    c: AppContext,
    userId: string,
    chamberId: string,
    invoiceId: string
  ): Promise<string> {
    const db = c.env.DB;
    const businessId = await this.getUserBusinessId(db, userId, chamberId);

    const invoice = await db
      .prepare(
        `SELECT i.*, pc.name AS chamber_name, u.name AS member_name, u.email AS member_email
         FROM invoices i
         LEFT JOIN platform_chambers pc ON pc.id = i.chamber_id
         LEFT JOIN users u ON u.id = i.user_id
         WHERE i.id = ? AND i.chamber_id = ?
           AND (i.user_id = ? OR (i.business_id IS NOT NULL AND i.business_id = ?))`
      )
      .bind(invoiceId, chamberId, userId, businessId || '')
      .first<any>();

    if (!invoice) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Invoice not found or unauthorized', 404);
    }

    const chamberName = invoice.chamber_name || '121Meet Chamber of Commerce';
    const memberName = invoice.member_name || 'Valued Member';
    const statusText = invoice.status?.toUpperCase() || 'UNPAID';
    const isPaid = invoice.status === 'paid';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt — ${invoice.invoice_number}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #1E293B; }
    .header { border-bottom: 2px solid #E2E8F0; padding-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .title { font-size: 24px; font-weight: bold; color: #0B2447; margin: 0; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: bold; background: ${isPaid ? '#DCFCE7' : '#FEF3C7'}; color: ${isPaid ? '#15803D' : '#B45309'}; }
    .grid { display: flex; justify-content: space-between; margin: 30px 0; }
    .meta-label { font-size: 11px; text-transform: uppercase; color: #64748B; font-weight: 600; margin-bottom: 4px; }
    .meta-val { font-size: 14px; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { text-align: left; padding: 10px; border-bottom: 2px solid #CBD5E1; font-size: 12px; text-transform: uppercase; color: #64748B; }
    td { padding: 12px 10px; border-bottom: 1px solid #E2E8F0; font-size: 14px; }
    .total-row { font-weight: bold; font-size: 16px; color: #0B2447; }
    .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">${chamberName}</h1>
      <p style="margin: 4px 0 0; color: #64748B; font-size: 13px;">Official Membership Invoice & Receipt</p>
    </div>
    <span class="badge">${statusText}</span>
  </div>

  <div class="grid">
    <div>
      <div class="meta-label">Billed To</div>
      <div class="meta-val">${memberName}</div>
      <div style="font-size: 12px; color: #64748B;">${invoice.member_email || ''}</div>
    </div>
    <div>
      <div class="meta-label">Invoice Reference</div>
      <div class="meta-val">${invoice.invoice_number}</div>
      <div style="font-size: 12px; color: #64748B;">Issued: ${invoice.created_at?.split('T')[0] || ''}</div>
      <div style="font-size: 12px; color: #64748B;">Due Date: ${invoice.due_date || ''}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${invoice.description || 'Chamber Membership Services'}</td>
        <td style="text-align: right;">$${Number(invoice.amount || 0).toFixed(2)}</td>
      </tr>
      <tr>
        <td class="total-row">Total Payable</td>
        <td class="total-row" style="text-align: right;">$${Number(invoice.total_amount || 0).toFixed(2)} USD</td>
      </tr>
    </tbody>
  </table>

  ${isPaid ? `<p style="margin-top: 25px; color: #15803D; font-size: 13px; font-weight: 600;">✓ Payment received in full on ${invoice.paid_at || ''}. Gateway Txn: ${invoice.payment_gateway_txn_id || 'N/A'}</p>` : ''}

  <div class="footer">
    Thank you for being an active part of the ${chamberName} business community.
  </div>
</body>
</html>`;
  }
}
