import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  formatReadableId,
  formatChamberId,
  slugifyIdPart,
  newId,
  chamberKeyedId,
  resolveChamberScope,
} from '../core/shared/ids';

/** Minimal D1 shim over node:sqlite (prepare/bind/first). */
function createD1(sql: string) {
  const db = new DatabaseSync(':memory:');
  db.exec(sql);
  return {
    prepare(query: string) {
      let params: any[] = [];
      const stmt = {
        bind(...args: any[]) {
          params = args;
          return stmt;
        },
        async first() {
          return (db.prepare(query).get(...params) as any) ?? null;
        },
      };
      return stmt;
    },
    raw: db,
  } as any;
}

describe('Readable IDs (core/shared/ids)', () => {
  it('formats PREFIX_scope_YYYYMMDD_SUFFIX with no ambiguous chars', () => {
    const id = formatReadableId('USR', 'rockwell', 4, new Date('2026-10-08T12:00:00Z'));
    assert.match(id, /^USR_ROCKWELL_20261008_[0-9A-HJKMNP-TV-Z]{4}$/);
  });

  it('chamber id is CHAM_<subdomain>', () => {
    assert.equal(formatChamberId('Rockwell'), 'CHAM_ROCKWELL');
  });

  it('slugifies scope parts safely', () => {
    assert.equal(slugifyIdPart('  Austin Chamber!! '), 'AUSTIN-CHAMBER');
    assert.equal(slugifyIdPart("x'; DROP TABLE users;--"), 'X-DROP-TABLE-USERS');
  });

  it('newId uses the chamber subdomain as scope and is unique-checked', async () => {
    const d1 = createD1(`
      CREATE TABLE platform_chambers (id TEXT PRIMARY KEY, subdomain TEXT);
      CREATE TABLE users (id TEXT PRIMARY KEY);
      INSERT INTO platform_chambers VALUES ('cham_legacy_1', 'rockwell');
    `);
    const id = await newId(d1, 'users', 'USR', { chamberId: 'cham_legacy_1' });
    assert.match(id, /^USR_ROCKWELL_\d{8}_[0-9A-Z]{4}$/);
  });

  it('platform-level rows use the "platform" scope', async () => {
    const d1 = createD1(`CREATE TABLE platform_audit_logs (id TEXT PRIMARY KEY);`);
    const id = await newId(d1, 'platform_audit_logs', 'PAUD', { suffixLength: 6 });
    assert.match(id, /^PAUD_PLATFORM_\d{8}_[0-9A-Z]{6}$/);
  });

  it('falls back to the chamber id when a chamber has no subdomain', async () => {
    const d1 = createD1(`
      CREATE TABLE platform_chambers (id TEXT PRIMARY KEY, subdomain TEXT);
      INSERT INTO platform_chambers VALUES ('cham_nosub_9', NULL);
    `);
    assert.equal(await resolveChamberScope(d1, 'cham_nosub_9'), 'NOSUB-9');
  });

  it('chamberKeyedId gives a fixed per-chamber key', async () => {
    const d1 = createD1(`
      CREATE TABLE platform_chambers (id TEXT PRIMARY KEY, subdomain TEXT);
      INSERT INTO platform_chambers VALUES ('cham_keyed_2', 'austin');
    `);
    assert.equal(await chamberKeyedId(d1, 'CSET', 'cham_keyed_2'), 'CSET_AUSTIN');
  });

  it('rejects untrusted table names', async () => {
    const d1 = createD1(`CREATE TABLE users (id TEXT PRIMARY KEY);`);
    await assert.rejects(() => newId(d1, 'users; DROP TABLE users', 'USR'));
  });
});
