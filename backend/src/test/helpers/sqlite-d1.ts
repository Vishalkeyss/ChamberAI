import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'db', 'migrations');

/**
 * In-memory D1 shim backed by node:sqlite with the REAL migrations applied and
 * foreign keys ENFORCED (unlike hand-written mocks). `batch` runs in a transaction,
 * like D1.
 */
export function createMigratedD1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }

  const makeStatement = (sql: string) => {
    let params: any[] = [];
    const stmt = {
      bind(...args: any[]) {
        params = args.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v));
        return stmt;
      },
      async all<T = any>() {
        const s = sqlite.prepare(sql);
        if (/^\s*(insert|update|delete)/i.test(sql) && !/returning/i.test(sql)) {
          const info = s.run(...params);
          return { results: [] as T[], success: true, meta: { changes: Number(info.changes) } };
        }
        return { results: s.all(...params) as T[], success: true, meta: { changes: 0 } };
      },
      async first<T = any>() {
        return ((sqlite.prepare(sql).get(...params) as T) ?? null) as T | null;
      },
      async run() {
        const info = sqlite.prepare(sql).run(...params);
        return { success: true, meta: { changes: Number(info.changes) } };
      },
      async raw<T = any>() {
        const s = sqlite.prepare(sql);
        s.setReturnArrays(true);
        return s.all(...params) as T[];
      },
    };
    return stmt;
  };

  // D1 runs batches one at a time; serialize so concurrent test requests never nest transactions.
  let batchQueue: Promise<unknown> = Promise.resolve();

  return {
    sqlite,
    exec: (sql: string) => sqlite.exec(sql),
    prepare: makeStatement,
    batch(statements: any[]) {
      const run = async () => {
        sqlite.exec('BEGIN');
        try {
          const results = [];
          for (const s of statements) results.push(await s.all());
          sqlite.exec('COMMIT');
          return results;
        } catch (err) {
          sqlite.exec('ROLLBACK');
          throw err;
        }
      };
      const result = batchQueue.then(run, run);
      batchQueue = result.catch(() => undefined);
      return result;
    },
  };
}

export function createMockKV() {
  const store = new Map<string, string>();
  return {
    get: async (key: string, type?: string) => {
      const val = store.get(key);
      if (!val) return null;
      return type === 'json' ? JSON.parse(val) : val;
    },
    put: async (key: string, val: string) => {
      store.set(key, val);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
  };
}
