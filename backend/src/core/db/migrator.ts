/**
 * Cloudflare D1 Idempotent Schema Migration Runner
 * Strictly aligns with MASTER_IMPLEMENTATION_PLAYBOOK.md (Prompt 00.2)
 */

import { MIGRATIONS, type MigrationDefinition } from './migrations-manifest';

export interface MigrationResult {
  applied: string[];
  skipped: string[];
  totalMigrations: number;
}

export interface AppliedMigrationRecord {
  id: number;
  name: string;
  applied_at: string;
  duration_ms: number;
  batch: number;
}

/**
 * Executes unapplied database migrations sequentially within Cloudflare D1
 */
export async function runMigrations(db: D1Database): Promise<MigrationResult> {
  // 1. Ensure _d1_migrations tracking table exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS _d1_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now')),
      duration_ms INTEGER NOT NULL,
      batch INTEGER NOT NULL
    );
  `);

  // 2. Fetch already applied migration names
  const appliedRows = await db
    .prepare('SELECT name FROM _d1_migrations ORDER BY id ASC')
    .all<{ name: string }>();
  const appliedSet = new Set((appliedRows.results || []).map((r) => r.name));

  const applied: string[] = [];
  const skipped: string[] = [];

  // 3. Determine next execution batch number
  const batchRow = await db
    .prepare('SELECT MAX(batch) as max_batch FROM _d1_migrations')
    .first<{ max_batch: number | null }>();
  const currentBatch = (batchRow?.max_batch || 0) + 1;

  // 4. Sequentially process all 11 migration files
  for (const migration of MIGRATIONS) {
    if (appliedSet.has(migration.name)) {
      skipped.push(migration.name);
      continue;
    }

    const start = Date.now();
    try {
      // Execute migration with foreign key checks
      await db.exec(`PRAGMA foreign_keys = ON;\n` + migration.sql);
      const duration = Date.now() - start;

      // Record successful application
      await db
        .prepare('INSERT INTO _d1_migrations (name, duration_ms, batch) VALUES (?, ?, ?)')
        .bind(migration.name, duration, currentBatch)
        .run();

      applied.push(migration.name);
    } catch (error: any) {
      console.error(`[MIGRATION_FAILED] Error in migration ${migration.name}:`, error);
      throw new Error(`Migration ${migration.name} failed: ${error?.message || String(error)}`);
    }
  }

  return {
    applied,
    skipped,
    totalMigrations: MIGRATIONS.length,
  };
}

/**
 * Returns migration telemetry history for Super Admin dashboard
 */
export async function getMigrationHistory(db: D1Database): Promise<AppliedMigrationRecord[]> {
  try {
    const { results } = await db
      .prepare('SELECT id, name, applied_at, duration_ms, batch FROM _d1_migrations ORDER BY id DESC')
      .all<AppliedMigrationRecord>();
    return results || [];
  } catch {
    return [];
  }
}
