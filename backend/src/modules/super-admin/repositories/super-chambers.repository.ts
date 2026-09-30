import { drizzle } from 'drizzle-orm/d1';
import { eq, like, or, and, sql, desc, count } from 'drizzle-orm';
import {
  platformChambers,
  type PlatformChamberRecord,
  type NewPlatformChamberRecord,
} from '../../../db/schema/platform-chambers.schema';
import type { PlatformChamberDTO, SuperChambersQuery } from '../types';

export function mapRecordToDTO(record: PlatformChamberRecord): PlatformChamberDTO {
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
    membersCount: Number(record.membersCount) || 0,
    revenueTotal: Number(record.revenueTotal) || 0,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
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

    return {
      data: records.map(mapRecordToDTO),
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
    return mapRecordToDTO(records[0]);
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
    return mapRecordToDTO(records[0]);
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
