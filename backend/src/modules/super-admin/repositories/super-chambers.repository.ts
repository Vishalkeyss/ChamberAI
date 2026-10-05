import { drizzle } from 'drizzle-orm/d1';
import { eq, like, or, and, sql, desc, count } from 'drizzle-orm';
import {
  platformChambers,
  type PlatformChamberRecord,
  type NewPlatformChamberRecord,
} from '../../../db/schema/platform-chambers.schema';
import type { PlatformChamberDTO, SuperChambersQuery } from '../types';

export function mapRecordToDTO(record: PlatformChamberRecord, metrics?: any): PlatformChamberDTO {
  const plansCount = metrics ? Number(metrics.plans_count) || 0 : (record.onboarded === 1 ? 1 : 0);
  const gatewayConnected = metrics ? Number(metrics.gateway_connected) || 0 : (record.onboarded === 1 ? 1 : 0);
  const brandingConfigured = metrics ? Number(metrics.branding_configured) || 0 : (record.onboarded === 1 ? 1 : 0);
  const actualMembersCount = metrics ? Number(metrics.actual_members_count) || 0 : 0;
  const rawMembersCount = Number(record.membersCount) || 0;
  const membersCount = metrics ? Math.max(actualMembersCount, rawMembersCount) : rawMembersCount;
  const eventsCount = metrics ? Number(metrics.events_count) || 0 : 0;
  const workflowsCount = metrics ? Number(metrics.workflows_count) || 0 : 0;
  const jobsCount = metrics ? Number(metrics.jobs_count) || 0 : 0;

  const steps = [
    { key: 'plan', label: 'Set up a membership plan', done: plansCount > 0 },
    { key: 'gateway', label: 'Connect a payment gateway', done: gatewayConnected > 0 },
    { key: 'branding', label: 'Add your logo & brand colors', done: brandingConfigured > 0 },
    { key: 'members', label: 'Add or invite your first members', done: membersCount > 0 },
    { key: 'event', label: 'Create your first event', done: eventsCount > 0 },
    { key: 'engagement', label: 'Set up a newsletter or alert workflow', done: workflowsCount > 0 },
    { key: 'jobs', label: 'Post to the Job Board', done: jobsCount > 0 },
  ];

  const completedSteps = steps.filter((s) => s.done).length;
  const percent = Math.round((completedSteps / steps.length) * 100);

  return {
    id: record.id,
    name: record.name,
    city: record.city,
    subdomain: record.subdomain || '',
    customDomain: record.customDomain,
    domainStatus: (record.domainStatus as any) || 'none',
    adminContactName: record.adminContactName,
    adminEmail: record.adminEmail,
    status: (record.status as any) || 'pending_setup',
    onboarded: record.onboarded === 1,
    r2BucketName: record.r2BucketName,
    membersCount,
    revenueTotal: Number(record.revenueTotal) || 0,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    setupProgress: {
      percent,
      completedSteps,
      totalSteps: steps.length,
      steps,
    },
  };
}

export class SuperChambersRepository {
  /**
   * Retrieves paginated chambers with optional search and status filtering using Drizzle ORM
   */
  static async listChambers(
    d1: D1Database,
    query: SuperChambersQuery
  ): Promise<{ data: PlatformChamberDTO[]; total: number }> {
    const db = drizzle(d1);
    const { search, status, page = 1, limit = 25 } = query;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (status && status !== 'all') {
      conditions.push(eq(platformChambers.status, status));
    }

    if (search && search.trim() !== '') {
      const searchPattern = `%${search.trim()}%`;
      conditions.push(
        or(
          like(platformChambers.name, searchPattern),
          like(platformChambers.city, searchPattern),
          like(platformChambers.subdomain, searchPattern),
          like(platformChambers.adminEmail, searchPattern),
          like(platformChambers.adminContactName, searchPattern)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total matches
    const totalResult = await db
      .select({ count: count() })
      .from(platformChambers)
      .where(whereClause);

    const total = totalResult[0]?.count ?? 0;

    // Fetch paginated results
    const records = await db
      .select()
      .from(platformChambers)
      .where(whereClause)
      .orderBy(desc(platformChambers.createdAt))
      .limit(limit)
      .offset(offset);

    if (!records || records.length === 0) {
      return { data: [], total };
    }

    const chamberIds = records.map((r) => r.id);
    const placeholders = chamberIds.map(() => '?').join(',');

    const metricsMap = new Map<string, any>();
    try {
      const metricsQuery = `
        SELECT 
          c.id,
          (SELECT COUNT(*) FROM membership_plans WHERE chamber_id = c.id) AS plans_count,
          (SELECT COUNT(*) FROM payment_gateway_config WHERE chamber_id = c.id AND status = 'connected') AS gateway_connected,
          (SELECT COUNT(*) FROM chamber_settings WHERE chamber_id = c.id AND ((logo_url IS NOT NULL AND logo_url != '') OR primary_color != '#2563EB')) AS branding_configured,
          MAX(
            (SELECT COUNT(*) FROM users WHERE chamber_id = c.id AND highest_role = 'member' AND status != 'suspended'),
            (SELECT COUNT(*) FROM chamber_memberships WHERE chamber_id = c.id AND status = 'active'),
            COALESCE(c.members_count, 0)
          ) AS actual_members_count,
          (SELECT COUNT(*) FROM events WHERE chamber_id = c.id) AS events_count,
          (SELECT (SELECT COUNT(*) FROM automation_workflows WHERE chamber_id = c.id) + (SELECT COUNT(*) FROM email_campaigns WHERE chamber_id = c.id)) AS workflows_count,
          (SELECT COUNT(*) FROM job_postings WHERE chamber_id = c.id) AS jobs_count
        FROM platform_chambers c
        WHERE c.id IN (${placeholders})
      `;
      const metricsResult = await d1.prepare(metricsQuery).bind(...chamberIds).all<any>();
      if (metricsResult && metricsResult.results) {
        for (const row of metricsResult.results) {
          metricsMap.set(row.id, row);
        }
      }
    } catch (err) {
      console.warn('[SUPER_CHAMBERS_METRICS_WARN]', err);
    }

    const data = records.map((record) => {
      const metrics = metricsMap.get(record.id);
      return mapRecordToDTO(record, metrics);
    });

    return {
      data,
      total,
    };
  }

  /**
   * Find a chamber by its subdomain slug
   */
  static async findBySubdomain(
    d1: D1Database,
    subdomain: string
  ): Promise<PlatformChamberDTO | null> {
    const db = drizzle(d1);
    const records = await db
      .select()
      .from(platformChambers)
      .where(eq(platformChambers.subdomain, subdomain.toLowerCase()))
      .limit(1);

    if (!records || records.length === 0) return null;

    let metrics: any = null;
    try {
      const metricsQuery = `
        SELECT 
          c.id,
          (SELECT COUNT(*) FROM membership_plans WHERE chamber_id = c.id) AS plans_count,
          (SELECT COUNT(*) FROM payment_gateway_config WHERE chamber_id = c.id AND status = 'connected') AS gateway_connected,
          (SELECT COUNT(*) FROM chamber_settings WHERE chamber_id = c.id AND ((logo_url IS NOT NULL AND logo_url != '') OR primary_color != '#2563EB')) AS branding_configured,
          MAX(
            (SELECT COUNT(*) FROM users WHERE chamber_id = c.id AND highest_role = 'member' AND status != 'suspended'),
            (SELECT COUNT(*) FROM chamber_memberships WHERE chamber_id = c.id AND status = 'active'),
            COALESCE(c.members_count, 0)
          ) AS actual_members_count,
          (SELECT COUNT(*) FROM events WHERE chamber_id = c.id) AS events_count,
          (SELECT (SELECT COUNT(*) FROM automation_workflows WHERE chamber_id = c.id) + (SELECT COUNT(*) FROM email_campaigns WHERE chamber_id = c.id)) AS workflows_count,
          (SELECT COUNT(*) FROM job_postings WHERE chamber_id = c.id) AS jobs_count
        FROM platform_chambers c
        WHERE c.id = ?
      `;
      const metricsResult = await d1.prepare(metricsQuery).bind(records[0].id).all<any>();
      if (metricsResult && metricsResult.results && metricsResult.results.length > 0) {
        metrics = metricsResult.results[0];
      }
    } catch {}

    return mapRecordToDTO(records[0], metrics);
  }

  /**
   * Find a chamber by its primary ID
   */
  static async findById(
    d1: D1Database,
    chamberId: string
  ): Promise<PlatformChamberDTO | null> {
    const db = drizzle(d1);
    const records = await db
      .select()
      .from(platformChambers)
      .where(eq(platformChambers.id, chamberId))
      .limit(1);

    if (!records || records.length === 0) return null;

    let metrics: any = null;
    try {
      const metricsQuery = `
        SELECT 
          c.id,
          (SELECT COUNT(*) FROM membership_plans WHERE chamber_id = c.id) AS plans_count,
          (SELECT COUNT(*) FROM payment_gateway_config WHERE chamber_id = c.id AND status = 'connected') AS gateway_connected,
          (SELECT COUNT(*) FROM chamber_settings WHERE chamber_id = c.id AND ((logo_url IS NOT NULL AND logo_url != '') OR primary_color != '#2563EB')) AS branding_configured,
          MAX(
            (SELECT COUNT(*) FROM users WHERE chamber_id = c.id AND highest_role = 'member' AND status != 'suspended'),
            (SELECT COUNT(*) FROM chamber_memberships WHERE chamber_id = c.id AND status = 'active'),
            COALESCE(c.members_count, 0)
          ) AS actual_members_count,
          (SELECT COUNT(*) FROM events WHERE chamber_id = c.id) AS events_count,
          (SELECT (SELECT COUNT(*) FROM automation_workflows WHERE chamber_id = c.id) + (SELECT COUNT(*) FROM email_campaigns WHERE chamber_id = c.id)) AS workflows_count,
          (SELECT COUNT(*) FROM job_postings WHERE chamber_id = c.id) AS jobs_count
        FROM platform_chambers c
        WHERE c.id = ?
      `;
      const metricsResult = await d1.prepare(metricsQuery).bind(chamberId).all<any>();
      if (metricsResult && metricsResult.results && metricsResult.results.length > 0) {
        metrics = metricsResult.results[0];
      }
    } catch {}

    return mapRecordToDTO(records[0], metrics);
  }

  /**
   * Insert a newly provisioned chamber using Drizzle ORM
   */
  static async insertChamber(
    d1: D1Database,
    record: NewPlatformChamberRecord
  ): Promise<PlatformChamberDTO> {
    const db = drizzle(d1);
    const created = await db.insert(platformChambers).values(record).returning();
    if (!created || created.length === 0) {
      throw new Error(`Failed to retrieve newly inserted chamber with id: ${record.id}`);
    }
    return mapRecordToDTO(created[0]);
  }

  /**
   * Update lifecycle status of a chamber (active / suspended / pending_setup)
   */
  static async updateStatus(
    d1: D1Database,
    chamberId: string,
    status: 'active' | 'suspended' | 'pending_setup'
  ): Promise<PlatformChamberDTO | null> {
    const db = drizzle(d1);
    const updatedAt = new Date().toISOString();

    const updated = await db
      .update(platformChambers)
      .set({
        status,
        updatedAt,
      })
      .where(eq(platformChambers.id, chamberId))
      .returning();

    return updated && updated[0] ? mapRecordToDTO(updated[0]) : null;
  }
}
