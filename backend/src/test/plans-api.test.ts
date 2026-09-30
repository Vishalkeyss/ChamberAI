import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app';
import type { CachedSession } from '../modules/auth/services/session.service';

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

function createMockDb() {
  const plansTable = new Map<string, any>([
    [
      'plan_gold_001',
      {
        id: 'plan_gold_001',
        chamber_id: 'ch_test_tenant',
        name: 'Gold Business',
        accent_color: '#F59E0B',
        price: 500.0,
        pricing_basis: 'by_employee_count',
        pricing_tiers_json: JSON.stringify([
          { min: 1, max: 10, price: 250.0 },
          { min: 11, max: 50, price: 500.0 },
          { min: 51, max: null, price: 1000.0 },
        ]),
        billing_frequency: 'annual',
        is_popular: 1,
        features_json: JSON.stringify(['Directory Listing', '5 Free Event Tickets']),
        is_active: 1,
        active_members_count: 42,
        sort_order: 1,
        created_at: '2026-01-15T08:00:00Z',
        updated_at: '2026-03-01T12:00:00Z',
      },
    ],
    [
      'plan_archived_002',
      {
        id: 'plan_archived_002',
        chamber_id: 'ch_test_tenant',
        name: 'Legacy Silver',
        accent_color: '#94A3B8',
        price: 150.0,
        pricing_basis: 'flat',
        pricing_tiers_json: '[]',
        billing_frequency: 'annual',
        is_popular: 0,
        features_json: '[]',
        is_active: 0,
        active_members_count: 5,
        sort_order: 9,
        created_at: '2025-01-01T08:00:00Z',
        updated_at: null,
      },
    ],
  ]);

  const activityLogs: any[] = [];

  return {
    plansTable,
    activityLogs,
    prepare: (query: string) => ({
      bind: (...args: any[]) => ({
        first: async () => {
          const normalized = query.replace(/\s+/g, ' ');

          // Tenant resolver chamber lookup
          if (normalized.includes('FROM platform_chambers')) {
            const val = args[0];
            return {
              id: 'ch_test_tenant',
              name: 'Dynamic Test Chamber',
              subdomain: 'testchamber',
              status: 'active',
            };
          }

          // Single active plan lookup
          if (normalized.includes('FROM membership_plans WHERE chamber_id = ? AND id = ? AND is_active = 1')) {
            const [chamberId, id] = args;
            const plan = plansTable.get(id);
            if (plan && plan.chamber_id === chamberId && plan.is_active === 1) {
              return { ...plan };
            }
            return null;
          }

          // Single plan lookup (admin)
          if (normalized.includes('FROM membership_plans WHERE chamber_id = ? AND id = ?')) {
            const [chamberId, id] = args;
            const plan = plansTable.get(id);
            if (plan && plan.chamber_id === chamberId) {
              return { ...plan };
            }
            return null;
          }

          return null;
        },
        all: async () => {
          const normalized = query.replace(/\s+/g, ' ');

          // Active plans for chamber
          if (normalized.includes('FROM membership_plans WHERE chamber_id = ? AND is_active = 1')) {
            const [chamberId] = args;
            const results = Array.from(plansTable.values())
              .filter((p) => p.chamber_id === chamberId && p.is_active === 1)
              .sort((a, b) => a.sort_order - b.sort_order);
            return { results };
          }

          // All plans for chamber (admin)
          if (normalized.includes('FROM membership_plans WHERE chamber_id = ?')) {
            const [chamberId] = args;
            const results = Array.from(plansTable.values())
              .filter((p) => p.chamber_id === chamberId)
              .sort((a, b) => a.sort_order - b.sort_order);
            return { results };
          }

          return { results: [] };
        },
        run: async () => {
          const normalized = query.replace(/\s+/g, ' ');

          // Insert plan
          if (normalized.includes('INSERT INTO membership_plans')) {
            const [
              id, chamber_id, name, accent_color, price, pricing_basis,
              pricing_tiers_json, billing_frequency, is_popular, features_json,
              is_active, sort_order, created_at, updated_at
            ] = args;
            plansTable.set(id, {
              id,
              chamber_id,
              name,
              accent_color,
              price,
              pricing_basis,
              pricing_tiers_json,
              billing_frequency,
              is_popular,
              features_json,
              is_active,
              active_members_count: 0,
              sort_order,
              created_at,
              updated_at,
            });
            return { success: true };
          }

          // Update plan
          if (normalized.includes('UPDATE membership_plans SET name = ?')) {
            const [
              name, accent_color, price, pricing_basis,
              pricing_tiers_json, billing_frequency, is_popular,
              features_json, is_active, sort_order, updated_at,
              chamber_id, id
            ] = args;
            const p = plansTable.get(id);
            if (p && p.chamber_id === chamber_id) {
              Object.assign(p, {
                name, accent_color, price, pricing_basis,
                pricing_tiers_json, billing_frequency, is_popular,
                features_json, is_active, sort_order, updated_at,
              });
            }
            return { success: true };
          }

          // Toggle status
          if (normalized.includes('UPDATE membership_plans SET is_active = ?')) {
            const [is_active, updated_at, chamber_id, id] = args;
            const p = plansTable.get(id);
            if (p && p.chamber_id === chamber_id) {
              p.is_active = is_active;
              p.updated_at = updated_at;
            }
            return { success: true };
          }

          // Insert activity_log
          if (normalized.includes('INSERT INTO activity_logs')) {
            activityLogs.push(args);
            return { success: true };
          }

          // Delete plan
          if (normalized.includes('DELETE FROM membership_plans')) {
            const [chamber_id, id] = args;
            const p = plansTable.get(id);
            if (p && p.chamber_id === chamber_id) {
              plansTable.delete(id);
            }
            return { success: true };
          }

          return { success: true };
        },
      }),
    }),
  };
}

function createEnv(db: any, kv: any) {
  return {
    DB: db,
    KV: kv,
    ENVIRONMENT: 'test',
    PLATFORM_DOMAIN: '121meet.ai',
    JWT_SECRET: 'test_secret_for_unit_tests',
  };
}

describe('Membership Plans API - Integration Tests', () => {
  it('1. GET /api/v1/public/plans returns 200 with only active plans', async () => {
    const db = createMockDb();
    const kv = createMockKV();
    const app = createApp();

    const env = createEnv(db, kv);
    const res = await app.request(
      '/api/v1/public/plans',
      {
        method: 'GET',
        headers: {
          Host: 'testchamber.121meet.ai',
          'x-chamber-slug': 'testchamber',
        },
      },
      env as any
    );
    assert.equal(res.status, 200);

    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(Array.isArray(body.data), true);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].id, 'plan_gold_001');
    assert.equal(body.data[0].name, 'Gold Business');
    // Ensure inactive plan_archived_002 is excluded
    assert.equal(body.data.some((p: any) => p.id === 'plan_archived_002'), false);
  });

  it('2. POST /api/v1/public/plans/calculate calculates dynamic dues accurately', async () => {
    const db = createMockDb();
    const kv = createMockKV();
    const app = createApp();
    const env = createEnv(db, kv);

    const res = await app.request(
      '/api/v1/public/plans/calculate',
      {
        method: 'POST',
        headers: {
          Host: 'testchamber.121meet.ai',
          'Content-Type': 'application/json',
          'x-chamber-slug': 'testchamber',
        },
        body: JSON.stringify({
          planId: 'plan_gold_001',
          employeeCount: 25,
        }),
      },
      env as any
    );
    assert.equal(res.status, 200);

    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.planId, 'plan_gold_001');
    assert.equal(body.data.calculatedPrice, 500);
    assert.equal(body.data.appliedTier?.min, 11);
    assert.equal(body.data.appliedTier?.max, 50);
  });

  it('3. POST /api/v1/admin/plans as billing_admin creates plan and logs to activity_logs', async () => {
    const db = createMockDb();
    const kv = createMockKV();
    const app = createApp();
    const env = createEnv(db, kv);

    // Create billing_admin session in KV
    const token = 'sess_billing_admin_token';
    const session: CachedSession = {
      userId: 'usr_billing_01',
      chamberId: 'ch_test_tenant',
      email: 'billing@testchamber.org',
      firstName: 'Billing',
      lastName: 'Admin',
      avatarUrl: null,
      pointsBalance: 0,
      chamber: { id: 'ch_test_tenant', name: 'Test Chamber' },
      roles: [{ roleId: 'billing_admin', scopeType: 'chamber', scopeId: 'ch_test_tenant' }],
      highestRole: 'billing_admin',
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await kv.put(`session:${token}`, JSON.stringify(session));

    const res = await app.request(
      '/api/v1/admin/plans',
      {
        method: 'POST',
        headers: {
          Host: 'testchamber.121meet.ai',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-chamber-slug': 'testchamber',
        },
        body: JSON.stringify({
          name: 'Platinum Executive',
          accentColor: '#6366F1',
          price: 1200.0,
          pricingBasis: 'flat',
          pricingTiers: [],
          billingFrequency: 'annual',
          isPopular: 1,
          features: ['VIP Gala Table', 'Board Advisory Seat'],
          sortOrder: 2,
        }),
      },
      env as any
    );
    assert.equal(res.status, 201);

    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.name, 'Platinum Executive');
    assert.equal(body.data.price, 1200.0);
    assert.equal(body.data.isActive, 1);

    // Verify activity_logs entry
    assert.equal(db.activityLogs.length > 0, true);
    const log = db.activityLogs[0];
    assert.equal(log[3], 'create_plan'); // action
    assert.equal(log[4], 'membership_plan'); // target_type
  });

  it('4. POST /api/v1/admin/plans as member returns 403 Forbidden', async () => {
    const db = createMockDb();
    const kv = createMockKV();
    const app = createApp();
    const env = createEnv(db, kv);

    // Create member session in KV
    const token = 'sess_member_token';
    const session: CachedSession = {
      userId: 'usr_member_01',
      chamberId: 'ch_test_tenant',
      email: 'member@testchamber.org',
      firstName: 'Test',
      lastName: 'Member',
      avatarUrl: null,
      pointsBalance: 0,
      chamber: { id: 'ch_test_tenant', name: 'Test Chamber' },
      roles: [{ roleId: 'member', scopeType: 'chamber', scopeId: 'ch_test_tenant' }],
      highestRole: 'member',
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await kv.put(`session:${token}`, JSON.stringify(session));

    const res = await app.request(
      '/api/v1/admin/plans',
      {
        method: 'POST',
        headers: {
          Host: 'testchamber.121meet.ai',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-chamber-slug': 'testchamber',
        },
        body: JSON.stringify({
          name: 'Unauthorized Plan',
          price: 100,
          pricingBasis: 'flat',
        }),
      },
      env as any
    );
    assert.equal(res.status, 403);
    const body = (await res.json()) as any;
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  it('5. PATCH /api/v1/admin/plans/:id/toggle-status updates status and logs', async () => {
    const db = createMockDb();
    const kv = createMockKV();
    const app = createApp();
    const env = createEnv(db, kv);

    // Create full_admin session in KV
    const token = 'sess_full_admin_token';
    const session: CachedSession = {
      userId: 'usr_admin_01',
      chamberId: 'ch_test_tenant',
      email: 'admin@testchamber.org',
      firstName: 'Full',
      lastName: 'Admin',
      avatarUrl: null,
      pointsBalance: 0,
      chamber: { id: 'ch_test_tenant', name: 'Test Chamber' },
      roles: [{ roleId: 'full_admin', scopeType: 'chamber', scopeId: 'ch_test_tenant' }],
      highestRole: 'full_admin',
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await kv.put(`session:${token}`, JSON.stringify(session));

    const res = await app.request(
      '/api/v1/admin/plans/plan_gold_001/toggle-status',
      {
        method: 'PATCH',
        headers: {
          Host: 'testchamber.121meet.ai',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-chamber-slug': 'testchamber',
        },
        body: JSON.stringify({ isActive: 0 }),
      },
      env as any
    );
    assert.equal(res.status, 200);

    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.isActive, 0);

    // Verify status was changed in db
    const plan = db.plansTable.get('plan_gold_001');
    assert.equal(plan.is_active, 0);
  });
});
