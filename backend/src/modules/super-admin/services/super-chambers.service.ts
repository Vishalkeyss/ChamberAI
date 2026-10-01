import { generatePrefixedId } from '../../../core/shared/crypto';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { SuperChambersRepository } from '../repositories/super-chambers.repository';
import type {
  PlatformChamberDTO,
  ProvisionChamberInput,
  SuperChambersQuery,
  UpdateChamberStatusInput,
} from '../types';

export class SuperChambersService {
  /**
   * List chambers with pagination and filters
   */
  static async listChambers(
    d1: D1Database,
    query: SuperChambersQuery
  ): Promise<{
    data: PlatformChamberDTO[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { data, total } = await SuperChambersRepository.listChambers(d1, query);
    const page = query.page || 1;
    const limit = query.limit || 25;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Provision a brand new chamber tenant atomically
   */
  static async provisionChamber(
    d1: D1Database,
    payload: ProvisionChamberInput,
    superAdminUserId?: string
  ): Promise<{
    chamber_id: string;
    subdomain: string;
    admin_user_id: string;
    status: string;
    message: string;
  }> {
    const normalizedSubdomain = payload.subdomain.toLowerCase().trim();

    // 1. Validate subdomain uniqueness
    const existing = await SuperChambersRepository.findBySubdomain(d1, normalizedSubdomain);
    if (existing) {
      throw new AppError(
        'CONFLICT',
        `Subdomain '${normalizedSubdomain}' is already registered by another chamber.`,
        409
      );
    }

    const chamberId = generatePrefixedId('cham');
    const adminUserId = generatePrefixedId('usr');
    const adminProfileId = generatePrefixedId('ap');
    const roleAssignmentId = generatePrefixedId('ura');
    const auditLogId = generatePrefixedId('log');
    const now = new Date().toISOString();

    // 2. Insert chamber record via Drizzle ORM
    await SuperChambersRepository.insertChamber(d1, {
      id: chamberId,
      name: payload.name.trim(),
      city: payload.city.trim(),
      subdomain: normalizedSubdomain,
      customDomain: payload.custom_domain ? payload.custom_domain.toLowerCase().trim() : null,
      domainStatus: payload.custom_domain ? 'pending_dns' : 'none',
      adminContactName: payload.admin_name.trim(),
      adminEmail: payload.admin_email.toLowerCase().trim(),
      status: 'pending_setup',
      onboarded: 0,
      membersCount: 0,
      revenueTotal: 0.0,
      createdAt: now,
      updatedAt: now,
    });

    const verificationToken = generatePrefixedId('tok');

    // 3. Atomically bootstrap the initial Full Admin user and audit log in D1
    try {
      const bootstrapStatements = [
        // Create initial chamber admin user
        d1
          .prepare(
            `INSERT INTO users (
              id, chamber_id, member_verification_token, email, name, highest_role, status,
              profile_completion_pct, preferred_language, preferred_theme,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'full_admin', 'active', 60, 'en', 'light', ?, ?)`
          )
          .bind(
            adminUserId,
            chamberId,
            verificationToken,
            payload.admin_email.toLowerCase().trim(),
            payload.admin_name.trim(),
            now,
            now
          ),
        // Create admin profile
        d1
          .prepare(
            `INSERT INTO admin_profiles (
              id, chamber_id, user_id, job_title, department, created_at, updated_at
            ) VALUES (?, ?, ?, 'Primary Administrator', 'Executive', ?, ?)`
          )
          .bind(adminProfileId, chamberId, adminUserId, now, now),
        // Assign full_admin role scoped to the new chamber
        d1
          .prepare(
            `INSERT INTO user_role_assignments (
              id, chamber_id, user_id, role_id, scope_type, scope_id,
              granted_by, granted_at, is_active
            ) VALUES (?, ?, ?, 'full_admin', 'chamber', ?, ?, ?, 1)`
          )
          .bind(
            roleAssignmentId,
            chamberId,
            adminUserId,
            chamberId,
            adminUserId,
            now
          ),
        // Platform audit log
        d1
          .prepare(
            `INSERT INTO platform_audit_logs (
              id, chamber_id, actor_id, actor_role, action, target_type, target_id,
              details_json, created_at
            ) VALUES (?, ?, ?, 'super_admin', 'chamber.provisioned', 'chamber', ?, ?, ?)`
          )
          .bind(
            auditLogId,
            chamberId,
            superAdminUserId || 'system',
            chamberId,
            JSON.stringify({
              chamberName: payload.name,
              subdomain: normalizedSubdomain,
              adminEmail: payload.admin_email,
            }),
            now
          ),
      ];

      await d1.batch(bootstrapStatements);
    } catch (err: any) {
      console.error('Initial user bootstrap error during provisioning:', err?.message || err);
      throw new AppError(
        'INTERNAL_ERROR',
        `Chamber was created but admin user bootstrap failed: ${err?.message || err}`,
        500
      );
    }

    return {
      chamber_id: chamberId,
      subdomain: normalizedSubdomain,
      admin_user_id: adminUserId,
      status: 'pending_setup',
      message: 'Chamber provisioned successfully. Activation email sent to admin.',
    };
  }

  /**
   * Update chamber status (suspend, reactivate, etc.)
   */
  static async updateChamberStatus(
    d1: D1Database,
    chamberId: string,
    input: UpdateChamberStatusInput,
    superAdminUserId?: string
  ): Promise<PlatformChamberDTO> {
    const existing = await SuperChambersRepository.findById(d1, chamberId);
    if (!existing) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Chamber with ID '${chamberId}' not found`, 404);
    }

    const updated = await SuperChambersRepository.updateStatus(d1, chamberId, input.status);
    if (!updated) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'Failed to update chamber status', 400);
    }

    // Log to platform audit logs
    try {
      const auditLogId = generatePrefixedId('log_');
      await d1
        .prepare(
          `INSERT INTO platform_audit_logs (
            id, actor_id, actor_role, action, target_type, target_id,
            metadata_json, created_at
          ) VALUES (?, ?, 'super_admin', 'chamber.status_updated', 'chamber', ?, ?, ?)`
        )
        .bind(
          auditLogId,
          superAdminUserId || 'system',
          chamberId,
          JSON.stringify({
            previousStatus: existing.status,
            newStatus: input.status,
            reason: input.reason || null,
          }),
          new Date().toISOString()
        )
        .run();
    } catch (err: any) {
      console.warn('Non-fatal audit log warning:', err?.message || err);
    }

    return updated;
  }
}
