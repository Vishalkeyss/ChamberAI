import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../app';
import type { CachedSession } from '../modules/auth/services/session.service';
import { verifyCheckInQr } from '../modules/events/types/events.types';

// Mock KV
function createMockKV() {
  const store = new Map<string, string>();
  return {
    async get(key: string, type?: string) {
      const val = store.get(key);
      if (!val) return null;
      if (type === 'json') return JSON.parse(val);
      return val;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

// In-Memory SQLite D1 mock
function createSqliteD1(): D1Database {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE platform_chambers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subdomain TEXT NOT NULL UNIQUE,
      custom_domain TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL,
      member_verification_token TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      phone TEXT,
      name TEXT,
      highest_role TEXT DEFAULT 'member',
      status TEXT DEFAULT 'active',
      points_balance INTEGER NOT NULL DEFAULT 0,
      profile_completion_pct INTEGER NOT NULL DEFAULT 100,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE chapters (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      visibility TEXT NOT NULL DEFAULT 'public',
      event_date TEXT NOT NULL,
      event_end_date TEXT,
      is_all_day INTEGER NOT NULL DEFAULT 0,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurrence_rule_json TEXT,
      parent_event_id TEXT,
      city TEXT,
      venue TEXT,
      chapter_id TEXT,
      group_id TEXT,
      table_arrangement TEXT,
      num_tables INTEGER,
      max_capacity INTEGER,
      registration_fee REAL NOT NULL DEFAULT 0.0,
      non_member_fee REAL,
      is_paid INTEGER NOT NULL DEFAULT 0,
      allow_non_member_registration INTEGER NOT NULL DEFAULT 1,
      promote_facebook INTEGER NOT NULL DEFAULT 0,
      promote_meetup INTEGER NOT NULL DEFAULT 0,
      promote_eventbrite INTEGER NOT NULL DEFAULT 0,
      google_calendar_link TEXT,
      photos_json TEXT,
      video_url TEXT,
      status TEXT NOT NULL DEFAULT 'published',
      registered_count INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE event_ticket_types (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0.0,
      description TEXT,
      allow_pay_later INTEGER NOT NULL DEFAULT 0,
      qty_limit INTEGER,
      qty_sold INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE event_registrations (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      user_id TEXT,
      ticket_type_id TEXT,
      guest_name TEXT,
      guest_email TEXT,
      registration_type TEXT NOT NULL DEFAULT 'member',
      promo_code_id TEXT,
      amount_paid REAL NOT NULL DEFAULT 0.0,
      discount_amount REAL NOT NULL DEFAULT 0.0,
      payment_status TEXT DEFAULT 'paid',
      payment_method_id TEXT,
      check_in_status TEXT DEFAULT 'not_checked_in',
      checked_in_at TEXT,
      is_waitlisted INTEGER NOT NULL DEFAULT 0,
      waitlist_position INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE event_feedback (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      star_rating INTEGER NOT NULL,
      liked_most TEXT,
      would_attend_again INTEGER NOT NULL DEFAULT 1,
      suggestions TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE event_sponsorship_tiers (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      tier_name TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0.0,
      benefits TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE event_sponsors (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      business_id TEXT,
      sponsor_name TEXT NOT NULL,
      sponsor_user_id TEXT,
      tier_id TEXT,
      amount REAL NOT NULL DEFAULT 0.0,
      status TEXT DEFAULT 'paid',
      payment_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return {
    exec: (sqlText: string) => db.exec(sqlText),
    prepare(query: string) {
      let boundParams: any[] = [];
      return {
        bind(...params: any[]) {
          boundParams = params;
          return this;
        },
        async first<T = unknown>(col?: string): Promise<T | null> {
          const stmt = db.prepare(query);
          const row: any = stmt.get(...boundParams);
          if (!row) return null;
          if (col) return row[col] ?? null;
          return row as T;
        },
        async all<T = unknown>(): Promise<{ results: T[]; success: boolean }> {
          const stmt = db.prepare(query);
          const results = stmt.all(...boundParams) as T[];
          return { results, success: true };
        },
        async run() {
          const stmt = db.prepare(query);
          const info = stmt.run(...boundParams);
          return { success: true, meta: { changes: info.changes } };
        },
        async raw<T = any>() {
          const stmt = db.prepare(query);
          stmt.setReturnArrays(true);
          return stmt.all(...boundParams) as T[];
        },
      };
    },
    async batch(statements: any[]) {
      const results = [];
      for (const statement of statements) {
        results.push(await statement.all());
      }
      return results;
    },
  } as unknown as D1Database;
}

const CHAMBER_ID = 'cham_austin_123';
const CHAPTER_NORTH_ID = 'chap_north_123';
const CHAPTER_SOUTH_ID = 'chap_south_123';

function seedTestData(d1: D1Database) {
  const sqlite = (d1 as any).prepare;
  // Chambers
  d1.prepare(`INSERT INTO platform_chambers (id, name, subdomain) VALUES (?, ?, ?)`).bind(CHAMBER_ID, 'Austin Chamber', 'austin').run();
  d1.prepare(`INSERT INTO chapters (id, chamber_id, name) VALUES (?, ?, ?)`).bind(CHAPTER_NORTH_ID, CHAMBER_ID, 'North Chapter').run();
  d1.prepare(`INSERT INTO chapters (id, chamber_id, name) VALUES (?, ?, ?)`).bind(CHAPTER_SOUTH_ID, CHAMBER_ID, 'South Chapter').run();

  // Users
  d1.prepare(`INSERT INTO users (id, chamber_id, member_verification_token, email, name, highest_role) VALUES (?, ?, ?, ?, ?, ?)`).bind('usr_1', CHAMBER_ID, 'tok_1', 'member@test.com', 'Alice Smith', 'member').run();

  // Event 1: North Chapter Event
  d1.prepare(`INSERT INTO events (id, chamber_id, title, event_date, chapter_id, max_capacity, registered_count, registration_fee, is_paid) VALUES (?, ?, ?, datetime('now', '+5 days'), ?, 100, 2, 50.0, 1)`).bind('evt_north', CHAMBER_ID, 'North Chapter Mixer', CHAPTER_NORTH_ID).run();

  // Event 2: South Chapter Event
  d1.prepare(`INSERT INTO events (id, chamber_id, title, event_date, chapter_id, max_capacity, registered_count, registration_fee, is_paid) VALUES (?, ?, ?, datetime('now', '+7 days'), ?, 50, 1, 0.0, 0)`).bind('evt_south', CHAMBER_ID, 'South Chapter Gathering', CHAPTER_SOUTH_ID).run();

  // Ticket Types for Event 1
  d1.prepare(`INSERT INTO event_ticket_types (id, chamber_id, event_id, name, price, qty_limit, qty_sold) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind('tkt_vip', CHAMBER_ID, 'evt_north', 'VIP Pass', 100.0, 20, 1).run();
  d1.prepare(`INSERT INTO event_ticket_types (id, chamber_id, event_id, name, price, qty_limit, qty_sold) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind('tkt_gen', CHAMBER_ID, 'evt_north', 'General Pass', 50.0, 80, 1).run();

  // Registrations for Event 1: 1 checked-in, 1 not checked-in, 1 waitlisted
  d1.prepare(`INSERT INTO event_registrations (id, chamber_id, event_id, user_id, ticket_type_id, guest_name, guest_email, amount_paid, payment_status, check_in_status, checked_in_at, is_waitlisted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'checked_in', datetime('now'), 0)`).bind('reg_att_1', CHAMBER_ID, 'evt_north', 'usr_1', 'tkt_vip', 'Alice Smith', 'alice@test.com', 100.0).run();
  d1.prepare(`INSERT INTO event_registrations (id, chamber_id, event_id, user_id, ticket_type_id, guest_name, guest_email, amount_paid, payment_status, check_in_status, is_waitlisted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'not_checked_in', 0)`).bind('reg_att_2', CHAMBER_ID, 'evt_north', null, 'tkt_gen', 'Bob Jones', 'bob@test.com', 50.0).run();
  d1.prepare(`INSERT INTO event_registrations (id, chamber_id, event_id, user_id, ticket_type_id, guest_name, guest_email, amount_paid, payment_status, is_waitlisted, waitlist_position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', 1, 1)`).bind('reg_wait_1', CHAMBER_ID, 'evt_north', null, 'tkt_vip', 'Charlie Brown', 'charlie@test.com', 100.0).run();

  // Feedback for Event 1
  d1.prepare(`INSERT INTO event_feedback (id, chamber_id, event_id, user_id, star_rating, liked_most, would_attend_again, suggestions) VALUES (?, ?, ?, ?, 5, 'Great networking', 1, 'More appetizers')`).bind('fb_1', CHAMBER_ID, 'evt_north', 'usr_1').run();

  // Sponsors for Event 1
  d1.prepare(`INSERT INTO event_sponsorship_tiers (id, chamber_id, event_id, tier_name, amount) VALUES (?, ?, ?, ?, ?)`).bind('tier_gold', CHAMBER_ID, 'evt_north', 'Gold Sponsor', 1500.0).run();
  d1.prepare(`INSERT INTO event_sponsors (id, chamber_id, event_id, sponsor_name, tier_id, amount, status) VALUES (?, ?, ?, ?, ?, ?, 'paid')`).bind('spon_1', CHAMBER_ID, 'evt_north', 'Apex Corp', 'tier_gold', 1500.0).run();
}

describe('Prompt 04.2: Admin 9-Tab Event Details & Scoped Sub-Admin View', () => {
  it('1. GET /api/v1/admin/events/:id/overview returns complete 9-tab summary metrics for full_admin', async () => {
    const d1 = createSqliteD1();
    const kv = createMockKV();
    seedTestData(d1);
    const app = createApp();

    const sessionToken = 'sess_full_admin_tok';
    const cachedSession: CachedSession = {
      userId: 'usr_admin_1',
      chamberId: CHAMBER_ID,
      highestRole: 'full_admin',
      email: 'admin@austin.com',
      firstName: 'Admin',
      lastName: 'User',
      avatarUrl: null,
      pointsBalance: 0,
      roles: [{ roleId: 'full_admin', scopeType: 'chamber', scopeId: CHAMBER_ID }],
      chamber: { id: CHAMBER_ID, name: 'Austin Chamber' },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    await kv.put(`session:${sessionToken}`, JSON.stringify(cachedSession));

    const res = await app.request('/api/v1/admin/events/evt_north/overview', {
      method: 'GET',
      headers: {
        Host: 'austin.121meet.ai',
        Authorization: `Bearer ${sessionToken}`,
      },
    }, { DB: d1, KV: kv, PLATFORM_DOMAIN: '121meet.ai' } as any);

    const json = await res.json() as any;
    if (res.status !== 200) {
      console.error('[TEST 1 ERROR]', json);
    }
    assert.equal(res.status, 200);
    assert.ok(json.success);
    assert.equal(json.data.event.id, 'evt_north');
    assert.equal(json.data.metrics.totalRevenue, 150.0); // 100 VIP + 50 General
    assert.equal(json.data.metrics.confirmedAttendees, 2);
    assert.equal(json.data.metrics.waitlistedCount, 1);
    assert.equal(json.data.metrics.checkedInCount, 1);
    assert.equal(json.data.metrics.avgFeedbackRating, 5);
    assert.equal(json.data.ticketTypes.length, 2);
  });

  it('2. Scoping: Chapter Admin accessing assigned chapter event succeeds (200)', async () => {
    const d1 = createSqliteD1();
    const kv = createMockKV();
    seedTestData(d1);
    const app = createApp();

    const sessionToken = 'sess_north_admin';
    const cachedSession: CachedSession = {
      userId: 'usr_chap_north',
      chamberId: CHAMBER_ID,
      highestRole: 'chapter_admin',
      email: 'north@austin.com',
      firstName: 'North',
      lastName: 'Admin',
      avatarUrl: null,
      pointsBalance: 0,
      roles: [{ roleId: 'chapter_admin', scopeType: 'chapter', scopeId: CHAPTER_NORTH_ID }],
      chamber: { id: CHAMBER_ID, name: 'Austin Chamber' },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    await kv.put(`session:${sessionToken}`, JSON.stringify(cachedSession));

    const res = await app.request('/api/v1/admin/events/evt_north/overview', {
      method: 'GET',
      headers: {
        Host: 'austin.121meet.ai',
        Authorization: `Bearer ${sessionToken}`,
      },
    }, { DB: d1, KV: kv, PLATFORM_DOMAIN: '121meet.ai' } as any);

    assert.equal(res.status, 200);
  });

  it('3. Scoping: Chapter Admin accessing unassigned chapter event receives 403 Forbidden', async () => {
    const d1 = createSqliteD1();
    const kv = createMockKV();
    seedTestData(d1);
    const app = createApp();

    const sessionToken = 'sess_north_admin_blocked';
    const cachedSession: CachedSession = {
      userId: 'usr_chap_north',
      chamberId: CHAMBER_ID,
      highestRole: 'chapter_admin',
      email: 'north@austin.com',
      firstName: 'North',
      lastName: 'Admin',
      avatarUrl: null,
      pointsBalance: 0,
      roles: [{ roleId: 'chapter_admin', scopeType: 'chapter', scopeId: CHAPTER_NORTH_ID }],
      chamber: { id: CHAMBER_ID, name: 'Austin Chamber' },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    await kv.put(`session:${sessionToken}`, JSON.stringify(cachedSession));

    // Attempting to access South Chapter event
    const res = await app.request('/api/v1/admin/events/evt_south/overview', {
      method: 'GET',
      headers: {
        Host: 'austin.121meet.ai',
        Authorization: `Bearer ${sessionToken}`,
      },
    }, { DB: d1, KV: kv, PLATFORM_DOMAIN: '121meet.ai' } as any);

    assert.equal(res.status, 403);
    const json = await res.json() as any;
    assert.equal(json.success, false);
  });

  it('4. PATCH /api/v1/admin/events/:id/attendees/:regId/check-in toggles check-in and updates checkedInAt', async () => {
    const d1 = createSqliteD1();
    const kv = createMockKV();
    seedTestData(d1);
    const app = createApp();

    const sessionToken = 'sess_admin_checkin';
    const cachedSession: CachedSession = {
      userId: 'usr_admin',
      chamberId: CHAMBER_ID,
      highestRole: 'full_admin',
      email: 'admin@austin.com',
      firstName: 'Admin',
      lastName: 'User',
      avatarUrl: null,
      pointsBalance: 0,
      roles: [{ roleId: 'full_admin', scopeType: 'chamber', scopeId: CHAMBER_ID }],
      chamber: { id: CHAMBER_ID, name: 'Austin Chamber' },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    await kv.put(`session:${sessionToken}`, JSON.stringify(cachedSession));

    // Check in reg_att_2
    const res = await app.request('/api/v1/admin/events/evt_north/attendees/reg_att_2/check-in', {
      method: 'PATCH',
      headers: {
        Host: 'austin.121meet.ai',
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isCheckedIn: true }),
    }, { DB: d1, KV: kv, PLATFORM_DOMAIN: '121meet.ai' } as any);

    assert.equal(res.status, 200);
    const json = await res.json() as any;
    assert.equal(json.data.isCheckedIn, true);
    assert.ok(json.data.checkedInAt);
  });

  it('5. POST /api/v1/admin/events/:id/waitlist/:regId/promote promotes waitlisted attendee to confirmed', async () => {
    const d1 = createSqliteD1();
    const kv = createMockKV();
    seedTestData(d1);
    const app = createApp();

    const sessionToken = 'sess_admin_promote';
    const cachedSession: CachedSession = {
      userId: 'usr_admin',
      chamberId: CHAMBER_ID,
      highestRole: 'full_admin',
      email: 'admin@austin.com',
      firstName: 'Admin',
      lastName: 'User',
      avatarUrl: null,
      pointsBalance: 0,
      roles: [{ roleId: 'full_admin', scopeType: 'chamber', scopeId: CHAMBER_ID }],
      chamber: { id: CHAMBER_ID, name: 'Austin Chamber' },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    await kv.put(`session:${sessionToken}`, JSON.stringify(cachedSession));

    const res = await app.request('/api/v1/admin/events/evt_north/waitlist/reg_wait_1/promote', {
      method: 'POST',
      headers: {
        Host: 'austin.121meet.ai',
        Authorization: `Bearer ${sessionToken}`,
      },
    }, { DB: d1, KV: kv, PLATFORM_DOMAIN: '121meet.ai' } as any);

    assert.equal(res.status, 200);
    const json = await res.json() as any;
    assert.equal(json.data.status, 'confirmed');

    // Verify waitlist is now 0 and confirmed is 3
    const ovRes = await app.request('/api/v1/admin/events/evt_north/overview', {
      method: 'GET',
      headers: {
        Host: 'austin.121meet.ai',
        Authorization: `Bearer ${sessionToken}`,
      },
    }, { DB: d1, KV: kv, PLATFORM_DOMAIN: '121meet.ai' } as any);

    const ovJson = await ovRes.json() as any;
    assert.equal(ovJson.data.metrics.waitlistedCount, 0);
    assert.equal(ovJson.data.metrics.confirmedAttendees, 3);
  });

  it('6. QR Hash Validator: verifies format EVT-{last6}-...', () => {
    // For eventId 'evt_000001', slice(-6) is '000001'
    const valid = verifyCheckInQr('EVT-000001-987654321', 'evt_000001');
    assert.equal(valid, true);

    const invalid = verifyCheckInQr('EVT-999999-987654321', 'evt_000001');
    assert.equal(invalid, false);
  });
});
