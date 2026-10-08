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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL REFERENCES platform_chambers(id),
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      visibility TEXT DEFAULT 'public',
      event_date TEXT NOT NULL,
      event_end_date TEXT,
      is_all_day INTEGER NOT NULL DEFAULT 0,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurrence_rule_json TEXT,
      parent_event_id TEXT,
      city TEXT,
      venue TEXT,
      chapter_id TEXT REFERENCES chapters(id),
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
      status TEXT DEFAULT 'published',
      registered_count INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE event_ticket_types (
      id TEXT PRIMARY KEY,
      chamber_id TEXT NOT NULL REFERENCES platform_chambers(id),
      event_id TEXT NOT NULL REFERENCES events(id),
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
      chamber_id TEXT NOT NULL REFERENCES platform_chambers(id),
      event_id TEXT NOT NULL REFERENCES events(id),
      user_id TEXT REFERENCES users(id),
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
  `);

  return {
    exec: (sqlText: string) => sqlite.exec(sqlText),
    prepare(sqlText: string) {
      let boundParams: any[] = [];
      return {
        bind(...params: any[]) {
          boundParams = params;
          return this;
        },
        async all<T = any>() {
          const stmt = sqlite.prepare(sqlText);
          const results = stmt.all(...boundParams) as T[];
          return { results, success: true };
        },
        async first<T = any>() {
          const stmt = sqlite.prepare(sqlText);
          const row = stmt.get(...boundParams);
          return (row as T) || null;
        },
        async run() {
          const stmt = sqlite.prepare(sqlText);
          const info = stmt.run(...boundParams);
          return { success: true, meta: { changes: info.changes } };
        },
        async raw<T = any>() {
          const stmt = sqlite.prepare(sqlText);
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
  };
}

describe('Prompt 04.1: Events Listing, Interactive Calendar View & Filtering Engine', () => {
  const CHAMBER_A_ID = 'cham_austin_001';
  const CHAMBER_B_ID = 'cham_belton_002';
  const CHAPTER_NORTH_ID = 'chap_austin_north';

  function seedEventsData(d1: any) {
    // Seed Chamber A & B
    d1.exec(`
      INSERT INTO platform_chambers (id, name, city, subdomain, status)
      VALUES ('${CHAMBER_A_ID}', 'Austin Chamber of Commerce', 'Austin', 'austin', 'active'),
             ('${CHAMBER_B_ID}', 'Belton Chamber of Commerce', 'Belton', 'belton', 'active');
    `);

    // Seed Chapter
    d1.exec(`
      INSERT INTO chapters (id, chamber_id, name, city_region)
      VALUES ('${CHAPTER_NORTH_ID}', '${CHAMBER_A_ID}', 'Austin North Chapter', 'North');
    `);

    // Seed Users
    d1.exec(`
      INSERT INTO users (id, chamber_id, member_verification_token, email, name, highest_role)
      VALUES ('usr_member_1', '${CHAMBER_A_ID}', 'tok_1', 'member@austin.com', 'Sarah Member', 'member');
    `);

    // Seed Events for Chamber A:
    // 1. Upcoming Public Event
    d1.exec(`
      INSERT INTO events (id, chamber_id, title, description, category, visibility, event_date, venue, city, is_paid, registration_fee, registered_count, max_capacity, status)
      VALUES ('evt_upcoming_pub', '${CHAMBER_A_ID}', 'Annual Business Gala 2026', 'Premier annual gala', 'gala', 'public', datetime('now', '+5 days'), 'Austin Marriott', 'Austin', 1, 75.0, 45, 100, 'published');
    `);

    // 2. Upcoming Members-Only Event
    d1.exec(`
      INSERT INTO events (id, chamber_id, title, description, category, visibility, event_date, venue, city, is_paid, registration_fee, registered_count, max_capacity, status)
      VALUES ('evt_upcoming_members', '${CHAMBER_A_ID}', 'Exclusive Member Roundtable', 'Executive networking', 'networking', 'members_only', datetime('now', '+10 days'), 'Chamber HQ', 'Austin', 0, 0.0, 10, 20, 'published');
    `);

    // 3. Upcoming Sold-Out Event
    d1.exec(`
      INSERT INTO events (id, chamber_id, title, description, category, visibility, event_date, venue, city, is_paid, registration_fee, registered_count, max_capacity, status)
      VALUES ('evt_upcoming_soldout', '${CHAMBER_A_ID}', 'Tech Leadership Summit', 'High-demand summit', 'workshop', 'public', datetime('now', '+15 days'), 'Convention Center', 'Austin', 1, 150.0, 50, 50, 'published');
    `);

    // 4. Past Event
    d1.exec(`
      INSERT INTO events (id, chamber_id, title, description, category, visibility, event_date, venue, city, is_paid, registration_fee, registered_count, max_capacity, status)
      VALUES ('evt_past_pub', '${CHAMBER_A_ID}', 'Autumn Business Mixer', 'Past networking mixer', 'networking', 'public', datetime('now', '-10 days'), 'Downtown Rooftop', 'Austin', 0, 0.0, 80, 100, 'completed');
    `);

    // 5. Draft Event (Should never appear for guest or member)
    d1.exec(`
      INSERT INTO events (id, chamber_id, title, description, category, visibility, event_date, venue, city, is_paid, registration_fee, status)
      VALUES ('evt_draft', '${CHAMBER_A_ID}', 'Unreleased Spring Gala', 'Draft gala', 'gala', 'public', datetime('now', '+20 days'), 'Hotel Grand', 'Austin', 1, 100.0, 'draft');
    `);

    // 6. Chamber B Event (For tenant isolation verification)
    d1.exec(`
      INSERT INTO events (id, chamber_id, title, description, category, visibility, event_date, venue, city, status)
      VALUES ('evt_cham_b', '${CHAMBER_B_ID}', 'Belton Local Expo', 'Belton expo', 'networking', 'public', datetime('now', '+3 days'), 'Belton Civic Center', 'Belton', 'published');
    `);
  }

  it('1. GET /api/v1/public/events returns upcoming public events and excludes members_only, draft, and past events', async () => {
    const d1 = createSqliteD1();
    const kv = createMockKV();
    seedEventsData(d1);
    const app = createApp();

    const res = await app.request(
      '/api/v1/public/events?timeframe=upcoming',
      {
        method: 'GET',
        headers: { Host: 'austin.121meet.ai' },
      },
      {
        DB: d1 as any,
        KV: kv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));

    // Must contain public upcoming events (Gala, Sold-out Summit)
    const titles = body.data.map((e: any) => e.title);
    assert.ok(titles.includes('Annual Business Gala 2026'));
    assert.ok(titles.includes('Tech Leadership Summit'));

    // Must NOT contain members-only event, past event, or draft event
    assert.ok(!titles.includes('Exclusive Member Roundtable'), 'Members-only event must be excluded from public view');
    assert.ok(!titles.includes('Autumn Business Mixer'), 'Past event must be excluded from upcoming timeframe');
    assert.ok(!titles.includes('Unreleased Spring Gala'), 'Draft event must be excluded');
  });

  it('2. GET /api/v1/public/events with timeframe=past returns past completed events', async () => {
    const d1 = createSqliteD1();
    const kv = createMockKV();
    seedEventsData(d1);
    const app = createApp();

    const res = await app.request(
      '/api/v1/public/events?timeframe=past',
      {
        method: 'GET',
        headers: { Host: 'austin.121meet.ai' },
      },
      {
        DB: d1 as any,
        KV: kv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.success, true);

    const titles = body.data.map((e: any) => e.title);
    assert.ok(titles.includes('Autumn Business Mixer'));
    assert.ok(!titles.includes('Annual Business Gala 2026'));
  });

  it('3. Capacity Status: Sold-out event accurately returns isSoldOut=true and spotsRemaining=0', async () => {
    const d1 = createSqliteD1();
    const kv = createMockKV();
    seedEventsData(d1);
    const app = createApp();

    const res = await app.request(
      '/api/v1/public/events?timeframe=upcoming',
      {
        method: 'GET',
        headers: { Host: 'austin.121meet.ai' },
      },
      {
        DB: d1 as any,
        KV: kv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    const body: any = await res.json();
    const soldOutEvent = body.data.find((e: any) => e.id === 'evt_upcoming_soldout');
    assert.ok(soldOutEvent);
    assert.equal(soldOutEvent.isSoldOut, true);
    assert.equal(soldOutEvent.spotsRemaining, 0);

    const openEvent = body.data.find((e: any) => e.id === 'evt_upcoming_pub');
    assert.ok(openEvent);
    assert.equal(openEvent.isSoldOut, false);
    assert.equal(openEvent.spotsRemaining, 55); // 100 - 45
  });

  it('4. GET /api/v1/events as authenticated member includes members_only events', async () => {
    const d1 = createSqliteD1();
    const kv = createMockKV();
    seedEventsData(d1);
    const app = createApp();

    const sessionToken = 'sess_member_token_123';
    const cachedSession: CachedSession = {
      userId: 'usr_member_1',
      chamberId: CHAMBER_A_ID,
      highestRole: 'member',
      email: 'member@austin.com',
      firstName: 'Member',
      lastName: 'User',
      avatarUrl: null,
      pointsBalance: 0,
      roles: [{ roleId: 'member', scopeType: 'chamber', scopeId: CHAMBER_A_ID }],
      chamber: { id: CHAMBER_A_ID, name: 'Austin Chamber of Commerce' },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    await kv.put(`session:${sessionToken}`, JSON.stringify(cachedSession));

    const res = await app.request(
      '/api/v1/events?timeframe=upcoming',
      {
        method: 'GET',
        headers: {
          Host: 'austin.121meet.ai',
          Authorization: `Bearer ${sessionToken}`,
        },
      },
      {
        DB: d1 as any,
        KV: kv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.success, true);

    const titles = body.data.map((e: any) => e.title);
    assert.ok(titles.includes('Annual Business Gala 2026'));
    assert.ok(titles.includes('Exclusive Member Roundtable'), 'Member must see members_only events');
  });

  it('5. Tenant Isolation: Chamber A query never reveals Chamber B events', async () => {
    const d1 = createSqliteD1();
    const kv = createMockKV();
    seedEventsData(d1);
    const app = createApp();

    const res = await app.request(
      '/api/v1/public/events',
      {
        method: 'GET',
        headers: { Host: 'austin.121meet.ai' },
      },
      {
        DB: d1 as any,
        KV: kv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    const body: any = await res.json();
    const titles = body.data.map((e: any) => e.title);
    assert.ok(!titles.includes('Belton Local Expo'), 'Cross-chamber event leakage prevented');
  });
});
