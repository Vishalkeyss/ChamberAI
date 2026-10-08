import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app';
import type { CachedSession } from '../modules/auth/services/session.service';
import { DatabaseSync } from 'node:sqlite';

function createMockKV() {
  const store = new Map<string, string>();
  return {
    get: async (key: string, type?: string) => {
      const val = store.get(key);
      if (!val) return null;
      if (type === 'json') return JSON.parse(val);
      return val;
    },
    put: async (key: string, val: string) => {
      store.set(key, val);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    has: (key: string) => store.has(key),
    _store: store,
  };
}

function createSqliteD1() {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
    CREATE TABLE platform_chambers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT,
      subdomain TEXT UNIQUE,
      custom_domain TEXT UNIQUE,
      status TEXT DEFAULT 'active',
      onboarded INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE membership_plans (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL REFERENCES platform_chambers(id),
      name TEXT NOT NULL,
      accent_color TEXT,
      price REAL NOT NULL DEFAULT 0.0,
      pricing_basis TEXT DEFAULT 'flat',
      pricing_tiers_json TEXT,
      billing_frequency TEXT DEFAULT 'annual',
      is_popular INTEGER NOT NULL DEFAULT 0,
      features_json TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      active_members_count INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL REFERENCES platform_chambers(id),
      member_verification_token TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      phone TEXT,
      name TEXT,
      avatar_url TEXT,
      highest_role TEXT DEFAULT 'member',
      status TEXT DEFAULT 'active',
      primary_chapter_id TEXT,
      points_balance INTEGER NOT NULL DEFAULT 0,
      profile_completion_pct INTEGER NOT NULL DEFAULT 0,
      two_factor_enabled INTEGER NOT NULL DEFAULT 0,
      preferred_language TEXT NOT NULL DEFAULT 'en',
      preferred_theme TEXT NOT NULL DEFAULT 'system',
      ai_credits_used INTEGER NOT NULL DEFAULT 0,
      ai_credits_limit INTEGER NOT NULL DEFAULT 5,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE chapters (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL REFERENCES platform_chambers(id),
      name TEXT NOT NULL,
      city_region TEXT,
      status TEXT DEFAULT 'active',
      members_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE user_chapters (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL REFERENCES platform_chambers(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      chapter_id TEXT NOT NULL REFERENCES chapters(id),
      is_primary INTEGER NOT NULL DEFAULT 1,
      status TEXT DEFAULT 'active',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE business_profiles (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL REFERENCES platform_chambers(id),
      business_name TEXT NOT NULL,
      business_logo_url TEXT,
      tagline TEXT,
      description TEXT,
      industry TEXT,
      business_phone TEXT,
      business_email TEXT,
      website TEXT,
      street_address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      social_links_json TEXT,
      skills_json TEXT,
      interests_json TEXT,
      locations_json TEXT,
      related_organizations_json TEXT,
      is_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE business_members (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL REFERENCES platform_chambers(id),
      business_id TEXT NOT NULL REFERENCES business_profiles(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      access_level TEXT DEFAULT 'full_access',
      is_primary_contact INTEGER NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE chamber_memberships (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL REFERENCES platform_chambers(id),
      business_id TEXT NOT NULL REFERENCES business_profiles(id),
      member_id_display TEXT NOT NULL,
      plan_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      plan_start_date TEXT,
      plan_end_date TEXT,
      approved_by TEXT,
      approved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE user_role_assignments (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL REFERENCES platform_chambers(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      role_id TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      assigned_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return {
    exec: (sql: string) => sqlite.exec(sql),
    prepare(sql: string) {
      let boundParams: any[] = [];
      return {
        bind(...params: any[]) {
          boundParams = params;
          return this;
        },
        async all<T = any>() {
          const stmt = sqlite.prepare(sql);
          const results = stmt.all(...boundParams) as T[];
          return { results, success: true };
        },
        async first<T = any>() {
          const stmt = sqlite.prepare(sql);
          const row = stmt.get(...boundParams);
          return (row as T) || null;
        },
        async run() {
          const stmt = sqlite.prepare(sql);
          const info = stmt.run(...boundParams);
          return { success: true, meta: { changes: info.changes } };
        },
        async raw<T = any>() {
          // Drizzle d1 adapter uses .raw() returning array of column values
          const stmt = sqlite.prepare(sql);
          stmt.setReturnArrays(true);
          return stmt.all(...boundParams) as T[];
        },
      };
    },
    async batch(statements: any[]) {
      const results = [];
      for (const s of statements) {
        results.push(await s.all());
      }
      return results;
    },
  };
}

describe('Prompt 03.2: Member & Business Directory Search, Multi-Facet Filtering & Direct Connect', () => {
  const app = createApp();

  const chamberId = 'cham_austin_123';
  const chamberOtherId = 'cham_dallas_999';

  // Seed sample data
  function seedDirectoryData(d1: any) {
    // 1. Chambers
    d1.exec(`
      INSERT INTO platform_chambers (id, name, city, subdomain, status)
      VALUES ('${chamberId}', 'Austin Chamber', 'Austin', 'austin', 'active'),
             ('${chamberOtherId}', 'Dallas Chamber', 'Dallas', 'dallas', 'active');
    `);

    // 2. Chapters
    d1.exec(`
      INSERT INTO chapters (id, chamber_id, name, status)
      VALUES ('chap_downtown', '${chamberId}', 'Downtown Austin Chapter', 'active'),
             ('chap_north', '${chamberId}', 'North Tech Chapter', 'active');
    `);

    // 3. Users (Primary contacts)
    d1.exec(`
      INSERT INTO users (id, chamber_id, member_verification_token, email, name, avatar_url, highest_role, primary_chapter_id)
      VALUES 
        ('usr_dwight', '${chamberId}', 'tok_dwight', 'dwight@dundermifflin.com', 'Dwight Schrute', 'https://r2.121meet.ai/avatars/dwight.png', 'member', 'chap_downtown'),
        ('usr_stanley', '${chamberId}', 'tok_stanley', 'stanley@vance.com', 'Stanley Hudson', null, 'member', 'chap_north'),
        ('usr_inactive', '${chamberId}', 'tok_inactive', 'inactive@closed.com', 'Closed Business Owner', null, 'member', 'chap_downtown'),
        ('usr_dallas', '${chamberOtherId}', 'tok_dallas', 'tex@dallas.com', 'Dallas Cowboy', null, 'member', null);
    `);

    // 4. Business Profiles
    d1.exec(`
      INSERT INTO business_profiles (id, chamber_id, business_name, tagline, description, industry, city, state, website, business_phone, is_verified, skills_json)
      VALUES 
        ('biz_dunder', '${chamberId}', 'Dunder Mifflin Paper Co.', 'Endless Paper in a Paperless World', 'Leading regional supplier of quality office papers.', 'Paper & Office Supplies', 'Austin', 'TX', 'https://dundermifflin.com', '512-555-0100', 1, '["Paper", "Office Supplies", "Printing"]'),
        ('biz_vance', '${chamberId}', 'Vance Refrigeration', 'The Coolest Team in Town', 'Commercial HVAC and refrigeration installation.', 'HVAC & Maintenance', 'Round Rock', 'TX', 'https://vancerefrig.com', '512-555-0200', 0, '["HVAC", "Cooling", "Repairs"]'),
        ('biz_inactive', '${chamberId}', 'Bankrupt Corp', 'Out of business', 'Should not appear in directory', 'Finance', 'Austin', 'TX', null, null, 1, '[]'),
        ('biz_dallas', '${chamberOtherId}', 'Lone Star Steaks', 'Prime Texas Beef', 'Dallas steakhouse', 'Food & Dining', 'Dallas', 'TX', null, null, 1, '[]');
    `);

    // 5. Business Members
    d1.exec(`
      INSERT INTO business_members (id, chamber_id, business_id, user_id, is_primary_contact, access_level, status)
      VALUES 
        ('bm_dwight', '${chamberId}', 'biz_dunder', 'usr_dwight', 1, 'full_access', 'active'),
        ('bm_stanley', '${chamberId}', 'biz_vance', 'usr_stanley', 1, 'full_access', 'active'),
        ('bm_inactive', '${chamberId}', 'biz_inactive', 'usr_inactive', 1, 'full_access', 'active'),
        ('bm_dallas', '${chamberOtherId}', 'biz_dallas', 'usr_dallas', 1, 'full_access', 'active');
    `);

    // 6. Chamber Memberships (Crucial: biz_inactive has status = 'expired')
    d1.exec(`
      INSERT INTO chamber_memberships (id, chamber_id, business_id, member_id_display, status)
      VALUES 
        ('cm_dunder', '${chamberId}', 'biz_dunder', 'AUS-2026-0001', 'active'),
        ('cm_vance', '${chamberId}', 'biz_vance', 'AUS-2026-0002', 'active'),
        ('cm_inactive', '${chamberId}', 'biz_inactive', 'AUS-2026-0003', 'expired'),
        ('cm_dallas', '${chamberOtherId}', 'biz_dallas', 'DAL-2026-0001', 'active');
    `);
  }

  it('1. GET /api/v1/public/directory returns active businesses and excludes inactive memberships', async () => {
    const mockKv = createMockKV();
    const d1 = createSqliteD1();
    seedDirectoryData(d1);

    const res = await app.request(
      '/api/v1/public/directory',
      {
        method: 'GET',
        headers: { Host: 'austin.121meet.ai' },
      },
      {
        DB: d1 as any,
        KV: mockKv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    const body = (await res.json()) as any;
    if (res.status !== 200) console.error('TEST ERROR RESPONSE:', body);
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.length, 2); // Only Dunder and Vance, NOT Bankrupt Corp (expired) or Dallas (other chamber)

    const names = body.data.map((b: any) => b.name);
    assert.ok(names.includes('Dunder Mifflin Paper Co.'));
    assert.ok(names.includes('Vance Refrigeration'));
    assert.ok(!names.includes('Bankrupt Corp'));
    assert.ok(!names.includes('Lone Star Steaks'));

    // Verified business is sorted first
    assert.equal(body.data[0].name, 'Dunder Mifflin Paper Co.');
    assert.equal(body.data[0].isVerified, 1);
  });

  it('2. Keyword search: searches name, tagline, description, and skills', async () => {
    const mockKv = createMockKV();
    const d1 = createSqliteD1();
    seedDirectoryData(d1);

    // Search by skill tag "Printing"
    const res = await app.request(
      '/api/v1/public/directory?q=Printing',
      {
        method: 'GET',
        headers: { Host: 'austin.121meet.ai' },
      },
      {
        DB: d1 as any,
        KV: mockKv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].name, 'Dunder Mifflin Paper Co.');
  });

  it('3. Multi-facet filter: verified only and industry filtering', async () => {
    const mockKv = createMockKV();
    const d1 = createSqliteD1();
    seedDirectoryData(d1);

    // Filter verified=true
    const verifiedRes = await app.request(
      '/api/v1/public/directory?verified=true',
      {
        method: 'GET',
        headers: { Host: 'austin.121meet.ai' },
      },
      {
        DB: d1 as any,
        KV: mockKv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    const verifiedBody = (await verifiedRes.json()) as any;
    assert.equal(verifiedBody.data.length, 1);
    assert.equal(verifiedBody.data[0].name, 'Dunder Mifflin Paper Co.');

    // Filter by industry
    const hvacRes = await app.request(
      '/api/v1/public/directory?industry=HVAC+%26+Maintenance',
      {
        method: 'GET',
        headers: { Host: 'austin.121meet.ai' },
      },
      {
        DB: d1 as any,
        KV: mockKv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    const hvacBody = (await hvacRes.json()) as any;
    assert.equal(hvacBody.data.length, 1);
    assert.equal(hvacBody.data[0].name, 'Vance Refrigeration');
  });

  it('4. GET /api/v1/public/directory/filters returns populated dynamic options', async () => {
    const mockKv = createMockKV();
    const d1 = createSqliteD1();
    seedDirectoryData(d1);

    const res = await app.request(
      '/api/v1/public/directory/filters',
      {
        method: 'GET',
        headers: { Host: 'austin.121meet.ai' },
      },
      {
        DB: d1 as any,
        KV: mockKv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.ok(body.data.industries.includes('Paper & Office Supplies'));
    assert.ok(body.data.industries.includes('HVAC & Maintenance'));
    assert.ok(body.data.cities.includes('Austin'));
    assert.ok(body.data.cities.includes('Round Rock'));
    assert.equal(body.data.chapters.length, 2);
  });

  it('5. GET /api/v1/directory as member returns enhanced representative details', async () => {
    const mockKv = createMockKV();
    const d1 = createSqliteD1();
    seedDirectoryData(d1);

    const sessionToken = 'sess_member_token';
    const mockSession: CachedSession = {
      userId: 'usr_dwight',
      chamberId,
      email: 'dwight@dundermifflin.com',
      firstName: 'Dwight',
      lastName: 'Schrute',
      avatarUrl: null,
      highestRole: 'member',
      roles: [{ roleId: 'member', scopeType: 'chamber', scopeId: chamberId }],
      pointsBalance: 100,
      chamber: { id: chamberId, name: 'Austin Chamber' },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    await mockKv.put(`session:${sessionToken}`, JSON.stringify(mockSession));

    const res = await app.request(
      '/api/v1/directory',
      {
        method: 'GET',
        headers: {
          Host: 'austin.121meet.ai',
          Authorization: `Bearer ${sessionToken}`,
        },
      },
      {
        DB: d1 as any,
        KV: mockKv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.length, 2);

    const dunder = body.data.find((b: any) => b.id === 'biz_dunder');
    assert.ok(dunder);
    assert.ok(dunder.primaryContact);
    assert.equal(dunder.primaryContact.name, 'Dwight Schrute');
    assert.equal(dunder.primaryContact.email, 'dwight@dundermifflin.com');
  });

  it('6. Scoped read access for chapter_admin filters to chapter members', async () => {
    const mockKv = createMockKV();
    const d1 = createSqliteD1();
    seedDirectoryData(d1);

    const sessionToken = 'sess_chapter_admin';
    const mockSession: CachedSession = {
      userId: 'usr_stanley',
      chamberId,
      email: 'stanley@vance.com',
      firstName: 'Stanley',
      lastName: 'Hudson',
      avatarUrl: null,
      highestRole: 'chapter_admin',
      roles: [
        { roleId: 'chapter_admin', scopeType: 'chapter', scopeId: 'chap_north' },
      ],
      pointsBalance: 50,
      chamber: { id: chamberId, name: 'Austin Chamber' },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    await mockKv.put(`session:${sessionToken}`, JSON.stringify(mockSession));

    const res = await app.request(
      '/api/v1/directory',
      {
        method: 'GET',
        headers: {
          Host: 'austin.121meet.ai',
          Authorization: `Bearer ${sessionToken}`,
        },
      },
      {
        DB: d1 as any,
        KV: mockKv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    // Only Vance Refrigeration is in chap_north
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].id, 'biz_vance');
  });

  it('7. Tenant isolation: Chamber A directory does not reveal Chamber B businesses', async () => {
    const mockKv = createMockKV();
    const d1 = createSqliteD1();
    seedDirectoryData(d1);

    const res = await app.request(
      '/api/v1/public/directory',
      {
        method: 'GET',
        headers: { Host: 'dallas.121meet.ai' },
      },
      {
        DB: d1 as any,
        KV: mockKv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].name, 'Lone Star Steaks');
  });

  it('8. LIKE wildcards in search are matched literally', async () => {
    const d1 = createSqliteD1();
    seedDirectoryData(d1);
    const env = { DB: d1 as any, KV: createMockKV() as any, ENVIRONMENT: 'test', PLATFORM_DOMAIN: '121meet.ai' };

    // "%" alone must not match every business
    const res = await app.request('/api/v1/public/directory?q=%25', { headers: { Host: 'austin.121meet.ai' } }, env);
    assert.equal(res.status, 200);
    assert.equal(((await res.json()) as any).data.length, 0);

    d1.exec(`UPDATE business_profiles SET tagline = '100% Recycled' WHERE id = 'biz_vance'`);
    const res2 = await app.request('/api/v1/public/directory?q=100%25', { headers: { Host: 'austin.121meet.ai' } }, env);
    const body2 = (await res2.json()) as any;
    assert.equal(body2.data.length, 1);
    assert.equal(body2.data[0].id, 'biz_vance');
  });

  it('9. Removed primary contact is not exposed in member directory', async () => {
    const mockKv = createMockKV();
    const d1 = createSqliteD1();
    seedDirectoryData(d1);
    d1.exec(`UPDATE business_members SET status = 'removed' WHERE id = 'bm_dwight'`);

    const sessionToken = 'sess_member_token';
    await mockKv.put(`session:${sessionToken}`, JSON.stringify({
      userId: 'usr_stanley',
      chamberId,
      email: 'stanley@vance.com',
      firstName: 'Stanley',
      lastName: 'Hudson',
      avatarUrl: null,
      highestRole: 'member',
      roles: [{ roleId: 'member', scopeType: 'chamber', scopeId: chamberId }],
      pointsBalance: 0,
      chamber: { id: chamberId, name: 'Austin Chamber' },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    }));

    const res = await app.request(
      '/api/v1/directory',
      { headers: { Host: 'austin.121meet.ai', Authorization: `Bearer ${sessionToken}` } },
      { DB: d1 as any, KV: mockKv as any, ENVIRONMENT: 'test', PLATFORM_DOMAIN: '121meet.ai' }
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    const dunder = body.data.find((b: any) => b.id === 'biz_dunder');
    assert.ok(dunder);
    assert.equal(dunder.primaryContact, null);
    const vance = body.data.find((b: any) => b.id === 'biz_vance');
    assert.equal(vance.primaryContact.phone, undefined);
  });
});
