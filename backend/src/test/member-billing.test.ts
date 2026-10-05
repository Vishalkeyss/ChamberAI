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
    put: async (key: string, val: string, _opts?: any) => {
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
  const invoicesTable = new Map<string, any>([
    [
      'inv_001',
      {
        id: 'inv_001',
        chamber_id: 'ch_austin_001',
        invoice_number: 'INV-2026-0042',
        user_id: 'usr_member_01',
        business_id: 'biz_01',
        invoice_type: 'membership',
        description: 'Annual Chamber Gold Membership Renewal',
        amount: 450.0,
        tax_amount: 0.0,
        discount_amount: 0.0,
        total_amount: 450.0,
        currency: 'USD',
        status: 'unpaid',
        due_date: '2026-10-15',
        paid_at: null,
        payment_method_id: null,
        payment_gateway_txn_id: null,
        related_plan_id: 'plan_gold',
        created_at: '2026-09-15T00:00:00Z',
      },
    ],
    [
      'inv_002',
      {
        id: 'inv_002',
        chamber_id: 'ch_austin_001',
        invoice_number: 'INV-2026-0010',
        user_id: 'usr_member_01',
        business_id: 'biz_01',
        invoice_type: 'event',
        description: 'Annual Gala Ticket x2',
        amount: 50.0,
        tax_amount: 0.0,
        discount_amount: 0.0,
        total_amount: 50.0,
        currency: 'USD',
        status: 'paid',
        due_date: '2026-08-01',
        paid_at: '2026-07-28T14:20:00Z',
        payment_method_id: 'pm_card_01',
        payment_gateway_txn_id: 'txn_prev_99881',
        related_plan_id: null,
        created_at: '2026-07-25T00:00:00Z',
      },
    ],
    [
      'inv_chamber_b',
      {
        id: 'inv_chamber_b',
        chamber_id: 'ch_dallas_999',
        invoice_number: 'INV-2026-9999',
        user_id: 'usr_member_other',
        business_id: 'biz_dallas',
        invoice_type: 'membership',
        description: 'Dallas Chamber Membership',
        amount: 300.0,
        tax_amount: 0.0,
        discount_amount: 0.0,
        total_amount: 300.0,
        currency: 'USD',
        status: 'unpaid',
        due_date: '2026-11-01',
        paid_at: null,
        created_at: '2026-09-01T00:00:00Z',
      },
    ],
  ]);

  const paymentMethodsTable = new Map<string, any>([
    [
      'pm_card_01',
      {
        id: 'pm_card_01',
        chamber_id: 'ch_austin_001',
        user_id: 'usr_member_01',
        type: 'card',
        brand: 'Visa',
        last_four: '4242',
        expiry_month: 8,
        expiry_year: 2028,
        is_default: 1,
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
  ]);

  const benefitUsageTable = new Map<string, any>([
    [
      'bu_01',
      {
        id: 'bu_01',
        chamber_id: 'ch_austin_001',
        membership_id: 'mbr_01',
        benefit_key: 'free_event_tickets',
        period_start: '2026-01-01',
        period_end: '2026-12-31',
        usage_limit: 5,
        used_count: 2,
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
  ]);

  const plansTable = new Map<string, any>([
    [
      'plan_gold',
      {
        id: 'plan_gold',
        chamber_id: 'ch_austin_001',
        name: 'Gold Business Plan',
        price: 450,
        billing_frequency: 'annual',
        features_json: JSON.stringify(['Free Event Tickets']),
        is_active: 1,
      },
    ],
    [
      'plan_free',
      {
        id: 'plan_free',
        chamber_id: 'ch_austin_001',
        name: 'Free Community',
        price: 0,
        billing_frequency: 'annual',
        features_json: JSON.stringify(['Basic Directory Listing']),
        is_active: 1,
      },
    ],
    [
      'plan_silver',
      {
        id: 'plan_silver',
        chamber_id: 'ch_austin_001',
        name: 'Silver Plan',
        price: 250,
        billing_frequency: 'annual',
        features_json: JSON.stringify([
          'Directory Listing',
          'Monthly Networking Meet',
          'Email Announcements',
        ]),
        is_active: 1,
      },
    ],
  ]);

  const membershipTable = new Map<string, any>([
    [
      'mbr_01',
      {
        id: 'mbr_01',
        chamber_id: 'ch_austin_001',
        business_id: 'biz_01',
        plan_id: 'plan_gold',
        status: 'active',
        period_start: '2026-01-01',
        period_end: '2026-12-31',
      },
    ],
  ]);

  return {
    invoicesTable,
    paymentMethodsTable,
    benefitUsageTable,
    plansTable,
    membershipTable,
    prepare: (query: string) => ({
      bind: (...args: any[]) => ({
        first: async () => {
          const q = query.replace(/\s+/g, ' ');
          if (q.includes('FROM platform_chambers')) {
            return {
              id: 'ch_austin_001',
              name: 'Austin Chamber',
              subdomain: 'austin',
              status: 'active',
            };
          }
          if (q.includes('SELECT business_id FROM business_members')) {
            const [userId, chamberId] = args;
            if (userId === 'usr_member_01' && chamberId === 'ch_austin_001') {
              return { business_id: 'biz_01' };
            }
            return null;
          }
          if (q.includes('SELECT COUNT(*) AS count FROM invoices')) {
            const [chamberId, userId, businessId] = args;
            const matches = Array.from(invoicesTable.values()).filter(
              (inv) =>
                inv.chamber_id === chamberId &&
                (inv.user_id === userId || inv.business_id === businessId) &&
                (!q.includes('status IN') || inv.status === 'unpaid')
            );
            return { count: matches.length };
          }
          if (q.includes('SELECT COALESCE(SUM(total_amount), 0) AS total_due FROM invoices')) {
            const [chamberId, userId, businessId] = args;
            const matches = Array.from(invoicesTable.values()).filter(
              (inv) =>
                inv.chamber_id === chamberId &&
                (inv.user_id === userId || inv.business_id === businessId) &&
                ['unpaid', 'open', 'overdue'].includes(inv.status)
            );
            const total = matches.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
            return { total_due: total };
          }
          if (q.includes('SELECT * FROM invoices WHERE id = ? AND chamber_id = ?')) {
            const [id, chamberId, userId, businessId] = args;
            const inv = invoicesTable.get(id);
            if (
              inv &&
              inv.chamber_id === chamberId &&
              (inv.user_id === userId || inv.business_id === businessId)
            ) {
              return { ...inv };
            }
            return null;
          }
          if (q.includes('SELECT is_default FROM payment_methods WHERE id = ?')) {
            const [id, chamberId, userId] = args;
            const pm = paymentMethodsTable.get(id);
            if (pm && pm.chamber_id === chamberId && pm.user_id === userId) {
              return { is_default: pm.is_default };
            }
            return null;
          }
          if (q.includes('SELECT id FROM payment_methods WHERE id = ?')) {
            const [id, chamberId, userId] = args;
            const pm = paymentMethodsTable.get(id);
            if (pm && pm.chamber_id === chamberId && pm.user_id === userId) {
              return { id: pm.id };
            }
            return null;
          }
          if (q.includes('LEFT JOIN membership_plans mp')) {
            const [chamberId, businessId] = args;
            if (chamberId === 'ch_austin_001' && businessId === 'biz_01') {
              const mem = membershipTable.get('mbr_01')!;
              const pl = plansTable.get(mem.plan_id);
              return {
                membership_id: mem.id,
                plan_id: mem.plan_id,
                plan_name: pl ? pl.name : 'Gold Business Plan',
                features_json: pl
                  ? pl.features_json
                  : JSON.stringify([
                      '5 Free Event Tickets',
                      'Directory Ad Placements',
                      'Press Release Submissions',
                      'Annual Gala VIP Passes',
                    ]),
                period_start: '2026-01-01',
                period_end: '2026-12-31',
              };
            }
            return null;
          }
          if (q.includes('SELECT COUNT(*) AS count FROM payment_methods')) {
            return { count: paymentMethodsTable.size };
          }
          if (q.includes('FROM invoices i LEFT JOIN platform_chambers pc')) {
            const [id, chamberId] = args;
            const inv = invoicesTable.get(id);
            if (inv && inv.chamber_id === chamberId) {
              return {
                ...inv,
                chamber_name: 'Austin Chamber',
                member_name: 'Sarah Member',
                member_email: 'member@austinchamber.com',
              };
            }
            return null;
          }
          if (q.includes('FROM membership_plans WHERE id = ?')) {
            const [planId, chamberId] = args;
            const pl = plansTable.get(planId);
            if (pl && pl.chamber_id === chamberId) {
              return { ...pl };
            }
            return null;
          }
          if (q.includes('FROM chamber_memberships cm JOIN business_members bm')) {
            const [userId, chamberId] = args;
            if (chamberId === 'ch_austin_001' && userId === 'usr_member_01') {
              const mem = membershipTable.get('mbr_01')!;
              return {
                membership_id: mem.id,
                plan_id: mem.plan_id,
                status: mem.status,
                period_start: mem.period_start,
                period_end: mem.period_end,
              };
            }
            return null;
          }
          return null;
        },
        all: async () => {
          const q = query.replace(/\s+/g, ' ');
          if (q.includes('FROM invoices WHERE chamber_id = ?')) {
            const [chamberId, userId, businessId] = args;
            let results = Array.from(invoicesTable.values()).filter(
              (inv) =>
                inv.chamber_id === chamberId &&
                (inv.user_id === userId || inv.business_id === businessId)
            );
            if (q.includes("status IN ('unpaid', 'open', 'overdue')")) {
              results = results.filter((inv) => ['unpaid', 'open', 'overdue'].includes(inv.status));
            } else if (q.includes("status = 'paid'")) {
              results = results.filter((inv) => inv.status === 'paid');
            }
            return { results };
          }
          if (q.includes('FROM payment_methods WHERE chamber_id = ? AND user_id = ?')) {
            const [chamberId, userId] = args;
            const results = Array.from(paymentMethodsTable.values()).filter(
              (pm) => pm.chamber_id === chamberId && pm.user_id === userId
            );
            return { results };
          }
          if (q.includes('FROM membership_benefit_usage WHERE chamber_id = ?')) {
            const [chamberId, membershipId] = args;
            const results = Array.from(benefitUsageTable.values()).filter(
              (b) => b.chamber_id === chamberId && b.membership_id === membershipId
            );
            return { results };
          }
          if (q.includes('FROM membership_plans WHERE chamber_id = ?')) {
            const [chamberId] = args;
            const results = Array.from(plansTable.values()).filter(
              (p) => p.chamber_id === chamberId
            );
            return { results };
          }
          return { results: [] };
        },
        run: async () => {
          const q = query.replace(/\s+/g, ' ');
          if (q.includes('UPDATE invoices SET status = ?') || q.includes("UPDATE invoices SET status = 'paid'")) {
            const [now, txnId, pmId, _now2, invoiceId, chamberId] = args;
            const inv = invoicesTable.get(invoiceId);
            if (inv && inv.chamber_id === chamberId) {
              inv.status = 'paid';
              inv.paid_at = now;
              inv.payment_gateway_txn_id = txnId;
              inv.payment_method_id = pmId;
            }
            return { success: true };
          }
          if (q.includes('INSERT INTO payment_methods')) {
            const [id, chamberId, userId, type, brand, lastFour, expMonth, expYear, isDefault] = args;
            paymentMethodsTable.set(id, {
              id,
              chamber_id: chamberId,
              user_id: userId,
              type,
              brand,
              last_four: lastFour,
              expiry_month: expMonth,
              expiry_year: expYear,
              is_default: isDefault,
              created_at: new Date().toISOString(),
            });
            return { success: true };
          }
          if (q.includes('DELETE FROM payment_methods WHERE id = ?')) {
            const [id] = args;
            paymentMethodsTable.delete(id);
            return { success: true };
          }
          if (q.includes('UPDATE payment_methods SET is_default = 1 WHERE id = ?')) {
            const [id] = args;
            const pm = paymentMethodsTable.get(id);
            if (pm) pm.is_default = 1;
            return { success: true };
          }
          if (q.includes('UPDATE payment_methods SET is_default = 0')) {
            for (const pm of paymentMethodsTable.values()) {
              pm.is_default = 0;
            }
            return { success: true };
          }
          if (q.includes('UPDATE chamber_memberships SET plan_id = ?')) {
            const [newPlanId, membershipId, chamberId] = args;
            const mem = membershipTable.get(membershipId);
            if (mem && mem.chamber_id === chamberId) {
              mem.plan_id = newPlanId;
              mem.status = 'active';
            }
            return { success: true };
          }
          if (q.includes('DELETE FROM membership_benefit_usage')) {
            benefitUsageTable.clear();
            return { success: true };
          }
          return { success: true };
        },
      }),
    }),
  };
}

describe('Prompt 02.5: Member Billing, Invoices, Payment Methods & Benefit Usage Tests', () => {
  const mockSession: CachedSession = {
    userId: 'usr_member_01',
    chamberId: 'ch_austin_001',
    email: 'member@austinchamber.com',
    firstName: 'Sarah',
    lastName: 'Member',
    avatarUrl: null,
    highestRole: 'member',
    roles: [
      {
        roleId: 'member',
        scopeType: 'chamber',
        scopeId: 'ch_austin_001',
      },
    ],
    pointsBalance: 50,
    chamber: { id: 'ch_austin_001', name: 'Austin Chamber' },
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };

  const setupTestEnv = () => {
    const mockDb = createMockDb();
    const mockKV = createMockKV();
    const app = createApp();

    const env = {
      DB: mockDb as any,
      KV: mockKV as any,
      APP_SECRET: 'test-secret-must-be-32-chars-long!',
      ENVIRONMENT: 'test',
    };

    return { app, env, mockKV, mockDb };
  };

  it('1. GET /api/v1/member/invoices requires authentication (401)', async () => {
    const { app, env } = setupTestEnv();
    const req = new Request('http://austin.121meet.ai/api/v1/member/invoices', {
      headers: { Host: 'austin.121meet.ai' },
    });
    const res = await app.fetch(req, env, {} as any);
    assert.equal(res.status, 401);
  });

  it('2. GET /api/v1/member/invoices returns outstanding total, invoice list, and pagination', async () => {
    const { app, env, mockKV } = setupTestEnv();
    const token = 'sess_test_token_billing_01';
    await mockKV.put(`session:${token}`, JSON.stringify(mockSession));

    const req = new Request('http://austin.121meet.ai/api/v1/member/invoices', {
      headers: {
        Host: 'austin.121meet.ai',
        Authorization: `Bearer ${token}`,
      },
    });

    const res = await app.fetch(req, env, {} as any);
    assert.equal(res.status, 200);

    const json = (await res.json()) as any;
    assert.equal(json.success, true);
    assert.equal(json.data.total_outstanding, 450);
    assert.equal(json.data.currency, 'USD');
    assert.equal(json.data.invoices.length, 2);
    assert.equal(json.data.invoices[0].invoice_number, 'INV-2026-0042');
  });

  it('3. GET /api/v1/member/invoices with status=unpaid filters only unpaid items', async () => {
    const { app, env, mockKV } = setupTestEnv();
    const token = 'sess_test_token_billing_02';
    await mockKV.put(`session:${token}`, JSON.stringify(mockSession));

    const req = new Request('http://austin.121meet.ai/api/v1/member/invoices?status=unpaid', {
      headers: {
        Host: 'austin.121meet.ai',
        Authorization: `Bearer ${token}`,
      },
    });

    const res = await app.fetch(req, env, {} as any);
    assert.equal(res.status, 200);

    const json = (await res.json()) as any;
    assert.equal(json.success, true);
    assert.equal(json.data.invoices.length, 1);
    assert.equal(json.data.invoices[0].status, 'unpaid');
  });

  it('4. POST /api/v1/member/invoices/:id/pay settles an invoice and records transaction ID', async () => {
    const { app, env, mockKV, mockDb } = setupTestEnv();
    const token = 'sess_test_token_billing_03';
    await mockKV.put(`session:${token}`, JSON.stringify(mockSession));

    const req = new Request('http://austin.121meet.ai/api/v1/member/invoices/inv_001/pay', {
      method: 'POST',
      headers: {
        Host: 'austin.121meet.ai',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payment_method_id: 'pm_card_01',
      }),
    });

    const res = await app.fetch(req, env, {} as any);
    assert.equal(res.status, 200);

    const json = (await res.json()) as any;
    assert.equal(json.success, true);
    assert.equal(json.data.status, 'paid');
    assert.match(json.data.transaction_id, /^txn_/);

    const updated = mockDb.invoicesTable.get('inv_001');
    assert.equal(updated.status, 'paid');
    assert.ok(updated.paid_at);
  });

  it('5. Tenant Isolation: Rejects payment on invoice belonging to another chamber (404)', async () => {
    const { app, env, mockKV } = setupTestEnv();
    const token = 'sess_test_token_billing_04';
    await mockKV.put(`session:${token}`, JSON.stringify(mockSession));

    const req = new Request('http://austin.121meet.ai/api/v1/member/invoices/inv_chamber_b/pay', {
      method: 'POST',
      headers: {
        Host: 'austin.121meet.ai',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payment_method_id: 'pm_card_01',
      }),
    });

    const res = await app.fetch(req, env, {} as any);
    assert.equal(res.status, 404);
  });

  it('6. GET /api/v1/member/payment-methods returns saved cards list', async () => {
    const { app, env, mockKV } = setupTestEnv();
    const token = 'sess_test_token_billing_05';
    await mockKV.put(`session:${token}`, JSON.stringify(mockSession));

    const req = new Request('http://austin.121meet.ai/api/v1/member/payment-methods', {
      headers: {
        Host: 'austin.121meet.ai',
        Authorization: `Bearer ${token}`,
      },
    });

    const res = await app.fetch(req, env, {} as any);
    assert.equal(res.status, 200);

    const json = (await res.json()) as any;
    assert.equal(json.success, true);
    assert.equal(json.data.length, 1);
    assert.equal(json.data[0].brand, 'Visa');
    assert.equal(json.data[0].last_four, '4242');
    assert.equal(json.data[0].is_default, true);
  });

  it('7. POST /api/v1/member/payment-methods vaults a new card', async () => {
    const { app, env, mockKV, mockDb } = setupTestEnv();
    const token = 'sess_test_token_billing_06';
    await mockKV.put(`session:${token}`, JSON.stringify(mockSession));

    const req = new Request('http://austin.121meet.ai/api/v1/member/payment-methods', {
      method: 'POST',
      headers: {
        Host: 'austin.121meet.ai',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'card',
        brand: 'Mastercard',
        last_four: '8831',
        expiry_month: 11,
        expiry_year: 2029,
        is_default: true,
      }),
    });

    const res = await app.fetch(req, env, {} as any);
    assert.equal(res.status, 201);

    const json = (await res.json()) as any;
    assert.equal(json.success, true);
    assert.equal(json.data.brand, 'Mastercard');
    assert.equal(json.data.last_four, '8831');
    assert.equal(json.data.is_default, true);
  });

  it('8. DELETE /api/v1/member/payment-methods/:id removes a card', async () => {
    const { app, env, mockKV, mockDb } = setupTestEnv();
    const token = 'sess_test_token_billing_07';
    await mockKV.put(`session:${token}`, JSON.stringify(mockSession));

    const req = new Request('http://austin.121meet.ai/api/v1/member/payment-methods/pm_card_01', {
      method: 'DELETE',
      headers: {
        Host: 'austin.121meet.ai',
        Authorization: `Bearer ${token}`,
      },
    });

    const res = await app.fetch(req, env, {} as any);
    assert.equal(res.status, 200);
    assert.equal(mockDb.paymentMethodsTable.has('pm_card_01'), false);
  });

  it('9. GET /api/v1/member/membership/benefits returns quotas and calculated remaining balance', async () => {
    const { app, env, mockKV } = setupTestEnv();
    const token = 'sess_test_token_billing_08';
    await mockKV.put(`session:${token}`, JSON.stringify(mockSession));

    const req = new Request('http://austin.121meet.ai/api/v1/member/membership/benefits', {
      headers: {
        Host: 'austin.121meet.ai',
        Authorization: `Bearer ${token}`,
      },
    });

    const res = await app.fetch(req, env, {} as any);
    assert.equal(res.status, 200);

    const json = (await res.json()) as any;
    assert.equal(json.success, true);
    assert.ok(json.data.length >= 1);
    assert.equal(json.data[0].benefit_key, 'free_event_tickets');
    assert.equal(json.data[0].quota_limit, 5);
    assert.equal(json.data[0].usage_count, 2);
    assert.equal(json.data[0].remaining, 3);
  });

  it('10. GET /api/v1/member/invoices/:id/download returns HTML printable receipt', async () => {
    const { app, env, mockKV } = setupTestEnv();
    const token = 'sess_test_token_billing_09';
    await mockKV.put(`session:${token}`, JSON.stringify(mockSession));

    const req = new Request('http://austin.121meet.ai/api/v1/member/invoices/inv_001/download', {
      headers: {
        Host: 'austin.121meet.ai',
        Authorization: `Bearer ${token}`,
      },
    });

    const res = await app.fetch(req, env, {} as any);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Content-Type'), 'text/html; charset=utf-8');
    const text = await res.text();
    assert.ok(text.includes('Official Membership Invoice & Receipt'));
    assert.ok(text.includes('INV-2026-0042'));
  });

  it('11. POST /api/v1/member/membership/change-plan switches plan and resets benefit usage', async () => {
    const { app, env, mockKV, mockDb } = setupTestEnv();
    const token = 'sess_test_token_billing_10';
    await mockKV.put(`session:${token}`, JSON.stringify(mockSession));

    assert.equal(mockDb.membershipTable.get('mbr_01').plan_id, 'plan_gold');
    assert.equal(mockDb.benefitUsageTable.size, 1);

    const req = new Request('http://austin.121meet.ai/api/v1/member/membership/change-plan', {
      method: 'POST',
      headers: {
        Host: 'austin.121meet.ai',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ planId: 'plan_free' }),
    });

    const res = await app.fetch(req, env, {} as any);
    assert.equal(res.status, 200);

    const json = (await res.json()) as any;
    assert.equal(json.success, true);
    assert.equal(json.data.membershipId, 'mbr_01');
    assert.equal(json.data.previousPlanId, 'plan_gold');
    assert.equal(json.data.newPlanId, 'plan_free');
    assert.equal(json.data.newPlanName, 'Free Community');
    assert.equal(json.data.newPlanPrice, 0);

    // Verify database was actually mutated
    assert.equal(mockDb.membershipTable.get('mbr_01').plan_id, 'plan_free');
    // Verify benefits were cleared to reset quotas for new plan
    assert.equal(mockDb.benefitUsageTable.size, 0);
  });

  it('12. POST /api/v1/member/membership/change-plan rejects non-existent or cross-chamber plan (404)', async () => {
    const { app, env, mockKV } = setupTestEnv();
    const token = 'sess_test_token_billing_11';
    await mockKV.put(`session:${token}`, JSON.stringify(mockSession));

    const req = new Request('http://austin.121meet.ai/api/v1/member/membership/change-plan', {
      method: 'POST',
      headers: {
        Host: 'austin.121meet.ai',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ planId: 'plan_non_existent' }),
    });

    const res = await app.fetch(req, env, {} as any);
    assert.equal(res.status, 404);
  });

  it('13. POST /api/v1/member/membership/change-plan rejects missing planId with 422', async () => {
    const { app, env, mockKV } = setupTestEnv();
    const token = 'sess_test_token_billing_12';
    await mockKV.put(`session:${token}`, JSON.stringify(mockSession));

    const req = new Request('http://austin.121meet.ai/api/v1/member/membership/change-plan', {
      method: 'POST',
      headers: {
        Host: 'austin.121meet.ai',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const res = await app.fetch(req, env, {} as any);
    assert.equal(res.status, 422);
  });

  it('14. GET /api/v1/member/membership/benefits resolves inherited tier benefits and excludes unmetered perks', async () => {
    const { app, env, mockKV, mockDb } = setupTestEnv();
    const token = 'sess_test_token_billing_14';
    await mockKV.put(`session:${token}`, JSON.stringify(mockSession));

    // Update Gold plan to reference Silver and include unmetered perks
    mockDb.plansTable.set('plan_gold', {
      id: 'plan_gold',
      chamber_id: 'ch_austin_001',
      name: 'Gold Business Plan',
      price: 450,
      billing_frequency: 'annual',
      features_json: JSON.stringify([
        'Everything in Silver Plan',
        'Verified Business Badge',
        'Priority Event Seats',
        'Referral Dashboard',
        'Free Event Sponsorship',
      ]),
      is_active: 1,
    });

    const req = new Request('http://austin.121meet.ai/api/v1/member/membership/benefits', {
      headers: {
        Host: 'austin.121meet.ai',
        Authorization: `Bearer ${token}`,
      },
    });

    const res = await app.fetch(req, env, {} as any);
    assert.equal(res.status, 200);

    const json = (await res.json()) as any;
    assert.equal(json.success, true);

    const benefitNames = json.data.map((b: any) => b.benefit_name);
    // Verify "Everything in Silver" is NOT in benefits
    assert.ok(!benefitNames.some((n: string) => n.toLowerCase().includes('everything in')));
    assert.ok(!benefitNames.some((n: string) => n.toLowerCase().includes('priority event seats')));
    assert.ok(!benefitNames.some((n: string) => n.toLowerCase().includes('referral dashboard')));

    // Verify Silver's inherited trackable benefits ARE included
    assert.ok(benefitNames.some((n: string) => n.toLowerCase().includes('directory listing')));
    assert.ok(benefitNames.some((n: string) => n.toLowerCase().includes('networking meet')));
    assert.ok(benefitNames.some((n: string) => n.toLowerCase().includes('email announcements')));
    assert.ok(benefitNames.some((n: string) => n.toLowerCase().includes('sponsorship')));
  });
});
