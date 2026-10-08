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

  // Initialize tables required for business profile, members, and audit
  sqlite.exec(`
    CREATE TABLE platform_chambers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT,
      subdomain TEXT UNIQUE,
      custom_domain TEXT UNIQUE,
      domain_status TEXT DEFAULT 'none',
      admin_contact_name TEXT,
      admin_email TEXT,
      status TEXT DEFAULT 'active',
      onboarded INTEGER NOT NULL DEFAULT 1,
      r2_bucket_name TEXT,
      members_count INTEGER NOT NULL DEFAULT 0,
      revenue_total REAL NOT NULL DEFAULT 0.0,
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
      personal_api_key_encrypted TEXT,
      personal_api_provider TEXT,
      last_login_at TEXT,
      card_token TEXT UNIQUE,
      card_theme_color TEXT,
      card_views_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
      access_level TEXT NOT NULL DEFAULT 'full_access',
      is_primary_contact INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      UNIQUE(business_id, user_id)
    );

    CREATE TABLE activity_logs (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed baseline chamber, business, and users
  sqlite.exec(`
    INSERT INTO platform_chambers (id, name, subdomain, status) VALUES ('cham_belton_001', 'Belton Chamber', 'belton', 'active');

    INSERT INTO users (id, chamber_id, member_verification_token, email, name, highest_role, status)
    VALUES
      ('usr_primary_01', 'cham_belton_001', 'mvt_001', 'sarah.jenkins@acme.com', 'Sarah Jenkins', 'member', 'active'),
      ('usr_billing_02', 'cham_belton_001', 'mvt_002', 'bob.accounting@acme.com', 'Bob Accountant', 'member', 'active'),
      ('usr_other_03', 'cham_belton_001', 'mvt_003', 'dwight@dunder.com', 'Dwight Schrute', 'member', 'active');

    INSERT INTO business_profiles (id, chamber_id, business_name, tagline, description, industry, city, social_links_json, locations_json)
    VALUES
      ('biz_acme_01', 'cham_belton_001', 'Acme Health Innovations', 'Better health for all', 'Pioneering healthcare tech', 'Healthcare', 'Belton', '{"linkedin":"https://linkedin.com/acme"}', '["Belton","Temple"]'),
      ('biz_dunder_02', 'cham_belton_001', 'Dunder Mifflin Paper Co', 'Endless paper', 'Paper distribution', 'Paper & Office', 'Belton', '{}', '["Belton"]');

    INSERT INTO business_members (id, chamber_id, business_id, user_id, access_level, is_primary_contact, status)
    VALUES
      ('bm_001', 'cham_belton_001', 'biz_acme_01', 'usr_primary_01', 'full_access', 1, 'active'),
      ('bm_002', 'cham_belton_001', 'biz_acme_01', 'usr_billing_02', 'billing_only', 0, 'active');
  `);

  // Wrapper providing Cloudflare D1 interface on top of SQLite
  return {
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
        results.push(await s.run());
      }
      return results;
    },
    async exec(sql: string) {
      sqlite.exec(sql);
    },
    _sqlite: sqlite,
  } as unknown as D1Database & { _sqlite: DatabaseSync };
}

describe('Prompt 03.1: Business Profile Management & Team Representatives Integration Tests', () => {
  const kv = createMockKV();
  const d1 = createSqliteD1();

  const primarySession: CachedSession = {
    userId: 'usr_primary_01',
    chamberId: 'cham_belton_001',
    email: 'sarah.jenkins@acme.com',
    firstName: 'Sarah',
    lastName: 'Jenkins',
    avatarUrl: null,
    highestRole: 'member',
    roles: [{ roleId: 'member', scopeType: 'chamber', scopeId: 'cham_belton_001' }],
    pointsBalance: 100,
    chamber: { id: 'cham_belton_001', name: 'Belton Chamber' },
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };

  const billingSession: CachedSession = {
    userId: 'usr_billing_02',
    chamberId: 'cham_belton_001',
    email: 'bob.accounting@acme.com',
    firstName: 'Bob',
    lastName: 'Accountant',
    avatarUrl: null,
    highestRole: 'member',
    roles: [{ roleId: 'member', scopeType: 'chamber', scopeId: 'cham_belton_001' }],
    pointsBalance: 50,
    chamber: { id: 'cham_belton_001', name: 'Belton Chamber' },
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };

  kv.put('session:token_primary', JSON.stringify(primarySession));
  kv.put('session:token_billing', JSON.stringify(billingSession));

  const app = createApp();
  const env: any = {
    DB: d1,
    KV: kv,
    ENVIRONMENT: 'test',
    PLATFORM_DOMAIN: 'localhost',
  };

  it('1. GET /api/v1/member/business-profile returns 200 with profile and team', async () => {
    const res = await app.request('/api/v1/member/business-profile', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer token_primary',
        Host: 'belton.localhost',
      },
    }, env);

    assert.strictEqual(res.status, 200, 'Expected 200 OK');
    const json = await res.json() as any;
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.name, 'Acme Health Innovations');
    assert.strictEqual(json.data.isPrimaryContact, true);
    assert.strictEqual(json.data.myAccessLevel, 'full_access');
    assert.strictEqual(json.data.representatives.length, 2);
  });

  it('2. PUT /api/v1/member/business-profile as primary contact updates profile and returns 200', async () => {
    const updatePayload = {
      name: 'Acme Health & Wellness Global',
      tagline: 'Leading the future of biotechnology',
      industry: 'Biotechnology & Health',
      description: 'Pioneering cutting-edge medical devices and community care.',
      locations: ['Belton', 'Temple', 'Austin'],
      website: 'https://acmehealth.com',
      skills: ['Medical Devices', 'Community Care', 'AI Diagnostics'],
      socialLinks: {
        linkedin: 'https://linkedin.com/company/acme-health-global',
      },
    };

    const res = await app.request('/api/v1/member/business-profile', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer token_primary',
        Host: 'belton.localhost',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    }, env);

    assert.strictEqual(res.status, 200, 'Expected 200 OK for primary contact');
    const json = await res.json() as any;
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.id, 'biz_acme_01');

    // Verify D1 persistence
    const checkStmt = d1._sqlite.prepare('SELECT business_name, tagline, industry FROM business_profiles WHERE id = ?');
    const row = checkStmt.get('biz_acme_01') as any;
    assert.strictEqual(row.business_name, 'Acme Health & Wellness Global');
    assert.strictEqual(row.tagline, 'Leading the future of biotechnology');
    assert.strictEqual(row.industry, 'Biotechnology & Health');
  });

  it('3. PUT /api/v1/member/business-profile as billing_only representative is blocked with 403 Forbidden', async () => {
    const updatePayload = {
      name: 'Hacked by Billing Rep',
      industry: 'Accounting',
    };

    const res = await app.request('/api/v1/member/business-profile', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer token_billing',
        Host: 'belton.localhost',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    }, env);

    assert.strictEqual(res.status, 403, 'Expected 403 Forbidden for billing_only representative');
    const json = await res.json() as any;
    assert.strictEqual(json.success, false);
    assert.match(json.error.message, /Full Access/i);
  });

  it('4. POST /api/v1/member/team/invite invites a new representative and returns 201 Created', async () => {
    const invitePayload = {
      firstName: 'Jim',
      lastName: 'Halpert',
      email: 'jim.halpert@acme.com',
      jobTitle: 'Sales Director',
      accessLevel: 'events_networking',
    };

    const res = await app.request('/api/v1/member/team/invite', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token_primary',
        Host: 'belton.localhost',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invitePayload),
    }, env);

    assert.strictEqual(res.status, 201, 'Expected 201 Created');
    const json = await res.json() as any;
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.email, 'jim.halpert@acme.com');
    assert.strictEqual(json.data.accessLevel, 'events_networking');
    assert.strictEqual(json.data.isPrimaryContact, false);
  });

  it('5. DELETE /api/v1/member/team/:id rejects removing the primary contact with 400 Bad Request', async () => {
    const res = await app.request('/api/v1/member/team/bm_001', {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer token_primary',
        Host: 'belton.localhost',
      },
    }, env);

    assert.strictEqual(res.status, 400, 'Expected 400 Bad Request when attempting to remove primary contact');
    const json = await res.json() as any;
    assert.strictEqual(json.success, false);
    assert.match(json.error.message, /Cannot remove primary contact/i);
  });

  it('6. PATCH /api/v1/member/team/:id/primary atomically transfers primary contact status', async () => {
    const res = await app.request('/api/v1/member/team/bm_002/primary', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token_primary',
        Host: 'belton.localhost',
      },
    }, env);

    assert.strictEqual(res.status, 200, 'Expected 200 OK');
    const json = await res.json() as any;
    assert.strictEqual(json.success, true);

    // Verify database state: bm_001 must be demoted to 0, bm_002 must be promoted to 1
    const checkStmt = d1._sqlite.prepare('SELECT id, is_primary_contact, access_level FROM business_members WHERE business_id = ?');
    const members = checkStmt.all('biz_acme_01') as any[];

    const bm1 = members.find((m) => m.id === 'bm_001');
    const bm2 = members.find((m) => m.id === 'bm_002');

    assert.strictEqual(bm1.is_primary_contact, 0, 'Previous primary contact must be demoted to 0');
    assert.strictEqual(bm2.is_primary_contact, 1, 'Target member must be promoted to 1');
    assert.strictEqual(bm2.access_level, 'full_access', 'Primary contact must be upgraded to full_access');
  });

  it('7. GET /api/v1/member/business-profile/network-search searches chamber businesses excluding self', async () => {
    const res = await app.request('/api/v1/member/business-profile/network-search?q=Dunder', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer token_primary',
        Host: 'belton.localhost',
      },
    }, env);

    assert.strictEqual(res.status, 200, 'Expected 200 OK');
    const json = await res.json() as any;
    assert.strictEqual(json.success, true);
    assert.strictEqual(Array.isArray(json.data), true);
    assert.strictEqual(json.data.length, 1);
    assert.strictEqual(json.data[0].name, 'Dunder Mifflin Paper Co');
  });
});
