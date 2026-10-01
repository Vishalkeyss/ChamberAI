import type { SubmitApplicationInput, ResubmitApplicationInput } from '../validation/applications.validation';
import { generatePrefixedId, generateTrackingCode, generateSessionToken } from '../../../core/shared/crypto';

export interface ApplicationRecord {
  id: string;
  chamber_id: string;
  applicant_name: string;
  business_email: string;
  business_phone: string | null;
  business_name: string;
  business_details_json: string;
  plan_id: string;
  chapter_id: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  admin_notes: string | null;
  kanban_stage: string;
  tracking_code: string;
  created_at: string;
  updated_at: string;
}

export interface ApplicationDetails extends ApplicationRecord {
  plan_name?: string;
  plan_accent_color?: string;
  plan_price?: number;
  plan_pricing_basis?: string;
  chapter_name?: string;
}

export class ApplicationsRepository {
  /**
   * Creates a new membership application in D1
   */
  static async create(
    db: D1Database,
    chamberId: string,
    input: SubmitApplicationInput,
    autoApprove = false
  ): Promise<{ id: string; trackingCode: string; status: 'pending' | 'approved' }> {
    const id = generatePrefixedId('app');
    const trackingCode = input.customTrackingCode ? input.customTrackingCode.trim().toUpperCase() : generateTrackingCode();
    const status: 'pending' | 'approved' = autoApprove ? 'approved' : 'pending';
    const kanbanStage = autoApprove ? 'approved' : 'new';
    const now = new Date().toISOString();

    const statements: D1PreparedStatement[] = [
      db
        .prepare(
          `INSERT INTO applications (
            id, chamber_id, applicant_name, business_email, business_phone,
            business_name, business_details_json, plan_id, chapter_id,
            status, kanban_stage, tracking_code, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          chamberId,
          input.applicantName,
          input.businessEmail,
          input.businessPhone || null,
          input.businessName,
          JSON.stringify(input.businessDetails),
          input.planId,
          input.chapterId || null,
          status,
          kanbanStage,
          trackingCode,
          now,
          now
        ),
    ];

    // Find chamber user to attach activity log if available
    const adminUser = await db
      .prepare('SELECT id FROM users WHERE chamber_id = ? LIMIT 1')
      .bind(chamberId)
      .first<{ id: string }>();

    if (adminUser?.id) {
      const logId = generatePrefixedId('act');
      statements.push(
        db
          .prepare(
            `INSERT INTO activity_logs (
              id, chamber_id, user_id, action, target_type, target_id, details_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            logId,
            chamberId,
            adminUser.id,
            'application.submitted',
            'application',
            id,
            JSON.stringify({ tracking_code: trackingCode, applicant: input.applicantName }),
            now
          )
      );
    }

    await db.batch(statements);

    return {
      id,
      trackingCode,
      status,
    };
  }

  /**
   * Retrieves an application by tracking code strictly scoped to tenant chamber
   */
  static async findByTrackingCode(
    db: D1Database,
    chamberId: string,
    trackingCode: string
  ): Promise<ApplicationDetails | null> {
    const normalizedCode = (trackingCode || '')
      .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
      .trim()
      .toUpperCase();

    let row = await db
      .prepare(
        `SELECT a.*,
                p.name AS plan_name,
                p.accent_color AS plan_accent_color,
                p.price AS plan_price,
                p.pricing_basis AS plan_pricing_basis,
                c.name AS chapter_name
         FROM applications a
         LEFT JOIN membership_plans p ON a.plan_id = p.id
         LEFT JOIN chapters c ON a.chapter_id = c.id
         WHERE a.chamber_id = ? AND a.tracking_code = ?`
      )
      .bind(chamberId, normalizedCode)
      .first<any>();

    // Fallback: If not found under current chamber, look up by globally unique tracking code
    if (!row) {
      row = await db
        .prepare(
          `SELECT a.*,
                  p.name AS plan_name,
                  p.accent_color AS plan_accent_color,
                  p.price AS plan_price,
                  p.pricing_basis AS plan_pricing_basis,
                  c.name AS chapter_name
           FROM applications a
           LEFT JOIN membership_plans p ON a.plan_id = p.id
           LEFT JOIN chapters c ON a.chapter_id = c.id
           WHERE a.tracking_code = ?`
        )
        .bind(normalizedCode)
        .first<any>();
    }

    return row || null;
  }

  /**
   * Resubmits application details when status is 'changes_requested'
   * Resets status back to 'pending'
   */
  static async resubmit(
    db: D1Database,
    chamberId: string,
    trackingCode: string,
    input: ResubmitApplicationInput
  ): Promise<boolean> {
    const now = new Date().toISOString();

    // Fetch existing details to merge
    const existing = await this.findByTrackingCode(db, chamberId, trackingCode);
    if (!existing) return false;

    let mergedDetails = {};
    try {
      mergedDetails = existing.business_details_json ? JSON.parse(existing.business_details_json) : {};
    } catch {}

    if (input.businessDetails) {
      mergedDetails = {
        ...mergedDetails,
        ...input.businessDetails,
        address: {
          ...(mergedDetails as any).address,
          ...input.businessDetails.address,
        },
      };
    }

    const updatedApplicantName = input.applicantName || existing.applicant_name;
    const updatedBusinessName = input.businessName || existing.business_name;
    const updatedBusinessPhone = input.businessPhone !== undefined ? input.businessPhone : existing.business_phone;
    const updatedChapterId = input.chapterId !== undefined ? input.chapterId : existing.chapter_id;

    const statements: D1PreparedStatement[] = [
      db
        .prepare(
          `UPDATE applications
           SET applicant_name = ?,
               business_name = ?,
               business_phone = ?,
               chapter_id = ?,
               business_details_json = ?,
               status = 'pending',
               kanban_stage = 'under_review',
               updated_at = ?
           WHERE chamber_id = ? AND tracking_code = ? AND status = 'changes_requested'`
        )
        .bind(
          updatedApplicantName,
          updatedBusinessName,
          updatedBusinessPhone,
          updatedChapterId,
          JSON.stringify(mergedDetails),
          now,
          chamberId,
          trackingCode
        ),
    ];

    // Activity log entry
    const adminUser = await db
      .prepare('SELECT id FROM users WHERE chamber_id = ? LIMIT 1')
      .bind(chamberId)
      .first<{ id: string }>();

    if (adminUser?.id) {
      const logId = generatePrefixedId('act');
      statements.push(
        db
          .prepare(
            `INSERT INTO activity_logs (
              id, chamber_id, user_id, action, target_type, target_id, details_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            logId,
            chamberId,
            adminUser.id,
            'application.resubmitted',
            'application',
            existing.id,
            JSON.stringify({ tracking_code: trackingCode, applicant: updatedApplicantName }),
            now
          )
      );
    }

    const results = await db.batch(statements);
    const updateResult = results[0];
    return (updateResult.meta.changes ?? 0) > 0;
  }

  /**
   * Admin: List all applications for a chamber with optional filters
   */
  static async findAll(
    db: D1Database,
    chamberId: string,
    filters?: { status?: string; search?: string; chapterId?: string }
  ): Promise<ApplicationDetails[]> {
    let sql = `
      SELECT a.*,
             p.name AS plan_name,
             p.accent_color AS plan_accent_color,
             p.price AS plan_price,
             p.pricing_basis AS plan_pricing_basis,
             c.name AS chapter_name
      FROM applications a
      LEFT JOIN membership_plans p ON a.plan_id = p.id
      LEFT JOIN chapters c ON a.chapter_id = c.id
      WHERE a.chamber_id = ?
    `;
    const params: any[] = [chamberId];

    if (filters?.status && filters.status !== 'All') {
      const dbStatus = filters.status.toLowerCase().replace(/\s+/g, '_');
      sql += ` AND a.status = ?`;
      params.push(dbStatus);
    } else {
      // Exclude approved applications from the general review queue display
      sql += ` AND a.status != 'approved'`;
    }

    if (filters?.chapterId) {
      sql += ` AND a.chapter_id = ?`;
      params.push(filters.chapterId);
    }

    if (filters?.search && filters.search.trim()) {
      const q = `%${filters.search.trim()}%`;
      sql += ` AND (a.applicant_name LIKE ? OR a.business_name LIKE ? OR a.business_email LIKE ? OR p.name LIKE ?)`;
      params.push(q, q, q, q);
    }

    sql += ` ORDER BY a.created_at DESC`;

    const result = await db.prepare(sql).bind(...params).all<any>();
    return (result.results as ApplicationDetails[]) || [];
  }

  /**
   * Admin: Find application by ID
   */
  static async findById(
    db: D1Database,
    chamberId: string,
    id: string
  ): Promise<ApplicationDetails | null> {
    const row = await db
      .prepare(
        `SELECT a.*,
                p.name AS plan_name,
                p.accent_color AS plan_accent_color,
                p.price AS plan_price,
                p.pricing_basis AS plan_pricing_basis,
                c.name AS chapter_name
         FROM applications a
         LEFT JOIN membership_plans p ON a.plan_id = p.id
         LEFT JOIN chapters c ON a.chapter_id = c.id
         WHERE a.chamber_id = ? AND a.id = ?`
      )
      .bind(chamberId, id)
      .first<any>();

    return row || null;
  }

  /**
   * Admin: Update application status (approve, request changes, reject)
   */
  static async updateStatus(
    db: D1Database,
    chamberId: string,
    id: string,
    status: 'approved' | 'rejected' | 'changes_requested',
    adminNotes?: string | null,
    adminUserId?: string
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const kanbanStage =
      status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'changes_requested';

    const statements: D1PreparedStatement[] = [
      db
        .prepare(
          `UPDATE applications
           SET status = ?,
               admin_notes = ?,
               kanban_stage = ?,
               updated_at = ?
           WHERE chamber_id = ? AND id = ?`
        )
        .bind(status, adminNotes || null, kanbanStage, now, chamberId, id),
    ];

    if (adminUserId) {
      const logId = generatePrefixedId('act');
      statements.push(
        db
          .prepare(
            `INSERT INTO activity_logs (
              id, chamber_id, user_id, action, target_type, target_id, details_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            logId,
            chamberId,
            adminUserId,
            `application.${status}`,
            'application',
            id,
            JSON.stringify({ status, notes: adminNotes }),
            now
          )
      );
    }

    // When approved, automatically provision the member user account, role, and membership
    if (status === 'approved') {
      const app = await this.findById(db, chamberId, id);
      if (app) {
        const email = app.business_email.trim().toLowerCase();
        let existingUser = await db
          .prepare('SELECT id, status FROM users WHERE email = ? AND chamber_id = ? LIMIT 1')
          .bind(email, app.chamber_id)
          .first<{ id: string; status: string }>();

        if (!existingUser) {
          existingUser = await db
            .prepare('SELECT id, status FROM users WHERE email = ? LIMIT 1')
            .bind(email)
            .first<{ id: string; status: string }>();
        }

        let userId = existingUser?.id;
        if (!userId) {
          userId = generatePrefixedId('usr');
          const token = generateSessionToken();
          statements.push(
            db
              .prepare(
                `INSERT INTO users (
                  id, chamber_id, member_verification_token, email, phone, name,
                  highest_role, status, preferred_theme, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'member', 'active', 'light', ?, ?)`
              )
              .bind(
                userId,
                app.chamber_id,
                token,
                email,
                app.business_phone || null,
                app.applicant_name,
                now,
                now
              )
          );
        } else {
          statements.push(
            db
              .prepare('UPDATE users SET status = "active", highest_role = "member", updated_at = ? WHERE id = ?')
              .bind(now, userId)
          );
        }

        // Role assignment for member
        const uraId = generatePrefixedId('ura');
        statements.push(
          db
            .prepare(
              `INSERT OR IGNORE INTO user_role_assignments (
                id, chamber_id, user_id, role_id, scope_type, scope_id, granted_by, granted_at, is_active
              ) VALUES (?, ?, ?, 'member', 'chamber', ?, ?, ?, 1)`
            )
            .bind(
              uraId,
              app.chamber_id,
              userId,
              app.chamber_id,
              adminUserId || userId,
              now
            )
        );

        // Business profile
        const bizId = generatePrefixedId('biz');
        statements.push(
          db
            .prepare(
              `INSERT OR IGNORE INTO business_profiles (
                id, chamber_id, business_name, business_email, business_phone, is_verified, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
            )
            .bind(
              bizId,
              app.chamber_id,
              app.business_name,
              email,
              app.business_phone || null,
              now,
              now
            )
        );

        // Business member link
        const bmId = generatePrefixedId('bm');
        statements.push(
          db
            .prepare(
              `INSERT OR IGNORE INTO business_members (
                id, chamber_id, business_id, user_id, access_level, is_primary_contact, status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, 'full_access', 1, 'active', ?, ?)`
            )
            .bind(
              bmId,
              app.chamber_id,
              bizId,
              userId,
              now,
              now
            )
        );

        // Chamber membership
        const cmId = generatePrefixedId('mbr');
        const displayMemberId = `MEM-2026-${Math.floor(10000 + Math.random() * 90000)}`;
        statements.push(
          db
            .prepare(
              `INSERT OR IGNORE INTO chamber_memberships (
                id, chamber_id, business_id, member_id_display, plan_id, status, approved_by, approved_at, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`
            )
            .bind(
              cmId,
              app.chamber_id,
              bizId,
              displayMemberId,
              app.plan_id || null,
              adminUserId || null,
              now,
              now,
              now
            )
        );

        // Update applications converted_user_id
        statements.push(
          db
            .prepare('UPDATE applications SET converted_user_id = ?, updated_at = ? WHERE id = ?')
            .bind(userId, now, id)
        );
      }
    }

    const results = await db.batch(statements);
    return (results[0].meta.changes ?? 0) > 0;
  }

  /**
   * Admin: Approve and delete application from the database table
   */
  static async approveAndDelete(
    db: D1Database,
    chamberId: string,
    id: string,
    adminUserId?: string
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const existing = await this.findById(db, chamberId, id);
    if (!existing) return false;

    const statements: D1PreparedStatement[] = [
      db
        .prepare('DELETE FROM applications WHERE chamber_id = ? AND id = ?')
        .bind(chamberId, id),
    ];

    if (adminUserId) {
      const logId = generatePrefixedId('act');
      statements.push(
        db
          .prepare(
            `INSERT INTO activity_logs (
              id, chamber_id, user_id, action, target_type, target_id, details_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            logId,
            chamberId,
            adminUserId,
            'application.approved',
            'application',
            id,
            JSON.stringify({
              applicant: existing.applicant_name,
              business: existing.business_name,
              tracking_code: existing.tracking_code,
              status: 'approved_and_deleted',
            }),
            now
          )
      );
    }

    const results = await db.batch(statements);
    return (results[0].meta.changes ?? 0) > 0;
  }
}
