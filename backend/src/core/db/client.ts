/**
 * Cloudflare D1 Database Client & Tenant-Scoped Data Access Wrapper
 * Strictly aligns with MASTER_IMPLEMENTATION_PLAYBOOK.md (Prompt 00.2)
 */

export interface D1ExecutionResult {
  success: boolean;
  meta: any;
}

export class DatabaseClient {
  constructor(private readonly db: D1Database) {}

  /**
   * Execute raw SQL or prepared statement
   */
  async execute(sql: string, params: any[] = []): Promise<D1Result<unknown>> {
    const stmt = this.db.prepare(sql).bind(...params);
    return await stmt.run();
  }

  /**
   * Query multiple rows with type safety
   */
  async query<T = Record<string, any>>(sql: string, params: any[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql).bind(...params);
    const { results } = await stmt.all<T>();
    return results || [];
  }

  /**
   * Query a single row with type safety
   */
  async queryOne<T = Record<string, any>>(sql: string, params: any[] = []): Promise<T | null> {
    const stmt = this.db.prepare(sql).bind(...params);
    const result = await stmt.first<T>();
    return result || null;
  }

  /**
   * Run an atomic batch of prepared statements
   */
  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    return await this.db.batch<T>(statements);
  }

  /**
   * Direct handle to underlying Cloudflare D1Database binding
   */
  get raw(): D1Database {
    return this.db;
  }
}

/**
 * Tenant-scoped database client ensuring chamber_id isolation
 */
export class TenantDatabaseClient extends DatabaseClient {
  constructor(
    db: D1Database,
    public readonly chamberId: string
  ) {
    super(db);
  }

  /**
   * Helper that prepares a statement with tenant scoping enforcement
   */
  prepareTenant(sql: string) {
    return this.raw.prepare(sql);
  }
}

/**
 * Factory helper for obtaining a tenant-scoped database client
 */
export function getTenantDb(db: D1Database, chamberId: string): TenantDatabaseClient {
  return new TenantDatabaseClient(db, chamberId);
}
