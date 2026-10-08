import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app';

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
  const chambers = new Map<string, any>([
    [
      'ch_test_tenant',
      {
        id: 'ch_test_tenant',
        name: 'Austin Chamber of Commerce',
        slug: 'austin',
        status: 'active',
      },
    ],
    [
      'ch_other_tenant',
      {
        id: 'ch_other_tenant',
        name: 'Dallas Chamber of Commerce',
        slug: 'dallas',
        status: 'active',
      },
    ],
  ]);

  const plans = new Map<string, any>([
    [
      'plan_gold_001',
      {
        id: 'plan_gold_001',
        chamber_id: 'ch_test_tenant',
        name: 'Gold Business',
        accent_color: '#F59E0B',
        price: 500.0,
        pricing_basis: 'flat',
        features_json: JSON.stringify(['Directory Listing']),
        is_active: 1,
      },
    ],
    [
      'plan_inactive_002',
      {
        id: 'plan_inactive_002',
        chamber_id: 'ch_test_tenant',
        name: 'Old Tier',
        price: 100.0,
        is_active: 0,
      },
    ],
  ]);

  const chapters = new Map<string, any>([
    [
      'chap_downtown',
      {
        id: 'chap_downtown',
        chamber_id: 'ch_test_tenant',
        name: 'Downtown Chapter',
        is_active: 1,
      },
    ],
  ]);

  const applications = new Map<string, any>();
  const activityLogs: any[] = [];
  const settings = new Map<string, number>();
  const paymentMethods: any[] = [];
  const invoices: any[] = [];

  return {
    _applications: applications,
    _activityLogs: activityLogs,
    _settings: settings,
    _paymentMethods: paymentMethods,
    _invoices: invoices,
    batch: async (statements: any[]) => {
      const results: any[] = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      return results;
    },
    prepare: (query: string) => {
      const normalized = query.trim();
      let boundParams: any[] = [];

      const statement = {
        bind: (...params: any[]) => {
          boundParams = params;
          return statement;
        },
        first: async <T = any>(): Promise<T | null> => {
          if (normalized.includes('FROM platform_chambers')) {
            const idOrSubdomain = boundParams[0];
            const ch = chambers.get(idOrSubdomain);
            if (ch) {
              return {
                id: ch.id,
                name: ch.name,
                subdomain: ch.slug,
                custom_domain: null,
                status: ch.status,
              } as T;
            }
            for (const item of chambers.values()) {
              if (item.slug === idOrSubdomain || item.id === idOrSubdomain) {
                return {
                  id: item.id,
                  name: item.name,
                  subdomain: item.slug,
                  custom_domain: null,
                  status: item.status,
                } as T;
              }
            }
            return null;
          }
          if (normalized.includes('FROM membership_plans')) {
            const chamberId = boundParams[0];
            const planId = boundParams[1];
            const plan = plans.get(planId);
            if (plan && plan.chamber_id === chamberId) {
              if (normalized.includes('is_active = 1') && plan.is_active !== 1) {
                return null;
              }
              return plan as T;
            }
            return null;
          }
          if (normalized.includes('SELECT auto_approve_applications FROM chamber_settings WHERE chamber_id = ?')) {
            const chamberId = boundParams[0];
            const s = settings.get(chamberId) ?? 0;
            return { auto_approve_applications: s } as T;
          }
          if (normalized.includes('SELECT chamber_id FROM chamber_settings WHERE chamber_id = ?')) {
            const chamberId = boundParams[0];
            return settings.has(chamberId) ? ({ chamber_id: chamberId } as T) : null;
          }
          if (normalized.includes('SELECT id FROM users WHERE chamber_id = ?')) {
            return { id: 'usr_admin_001' } as T;
          }
          if (normalized.includes('SELECT id, status FROM users WHERE email = ?')) {
            return null; // Simulate new user creation
          }
          if (normalized.includes('FROM applications a') && normalized.includes('WHERE a.chamber_id = ? AND a.id = ?')) {
            const [chamberId, id] = boundParams;
            const app = applications.get(id);
            if (app && app.chamber_id === chamberId) {
              const plan = plans.get(app.plan_id);
              const chapter = app.chapter_id ? chapters.get(app.chapter_id) : null;
              return {
                ...app,
                plan_name: plan?.name,
                plan_accent_color: plan?.accent_color,
                plan_price: plan?.price,
                plan_pricing_basis: plan?.pricing_basis,
                chapter_name: chapter?.name,
              } as T;
            }
            return null;
          }
          if (normalized.includes('FROM applications a') && normalized.includes('WHERE a.chamber_id = ? AND a.tracking_code = ?')) {
            const [chamberId, trackingCode] = boundParams;
            for (const app of applications.values()) {
              if (app.chamber_id === chamberId && app.tracking_code === trackingCode) {
                const plan = plans.get(app.plan_id);
                const chapter = app.chapter_id ? chapters.get(app.chapter_id) : null;
                return {
                  ...app,
                  plan_name: plan?.name,
                  plan_accent_color: plan?.accent_color,
                  plan_price: plan?.price,
                  plan_pricing_basis: plan?.pricing_basis,
                  chapter_name: chapter?.name,
                } as T;
              }
            }
            return null;
          }
          return null;
        },
        all: async <T = any>(): Promise<{ results: T[] }> => {
          if (normalized.includes('FROM applications a')) {
            const chamberId = boundParams[0];
            const results: any[] = [];
            for (const app of applications.values()) {
              if (app.chamber_id === chamberId) {
                const plan = plans.get(app.plan_id);
                const chapter = app.chapter_id ? chapters.get(app.chapter_id) : null;
                results.push({
                  ...app,
                  plan_name: plan?.name,
                  plan_accent_color: plan?.accent_color,
                  plan_price: plan?.price,
                  plan_pricing_basis: plan?.pricing_basis,
                  chapter_name: chapter?.name,
                });
              }
            }
            return { results } as any;
          }
          return { results: [] };
        },
        run: async () => {
          if (normalized.includes('UPDATE chamber_settings SET auto_approve_applications = ?')) {
            const [val, , chamberId] = boundParams;
            settings.set(chamberId, Number(val));
            return { success: true, meta: { changes: 1 } };
          }
          if (normalized.includes('INSERT INTO chamber_settings')) {
            const [, chamberId, , val] = boundParams;
            // INSERT INTO chamber_settings (id, chamber_id, org_name, auto_approve_applications, updated_at) VALUES (?, ?, 'Chamber of Commerce', ?, ?)
            // boundParams: [id, chamberId, val, now]
            settings.set(chamberId, Number(boundParams[2]));
            return { success: true, meta: { changes: 1 } };
          }
          if (normalized.includes('INSERT INTO payment_methods')) {
            // VALUES (?, ?, ?, 'card', ?, ?, ?, ?, 1, ?, ?)
            // boundParams: [pmId, chamber_id, userId, brand, lastFour, expiryMonth, expiryYear, gatewayToken, now]
            const [id, chamberId, userId, brand, lastFour, expiryMonth, expiryYear, gatewayToken] = boundParams;
            paymentMethods.push({
              id,
              chamber_id: chamberId,
              user_id: userId,
              brand,
              last_four: lastFour,
              expiry_month: expiryMonth,
              expiry_year: expiryYear,
              is_default: 1,
              gateway_token: gatewayToken,
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (normalized.includes('INSERT INTO invoices')) {
            const [
              id,
              chamberId,
              invoiceNumber,
              userId,
              description,
              amount,
              totalAmount,
              status,
              dueDate,
              paidAt,
              paymentMethodId,
              txnId,
              planId,
            ] = boundParams;
            invoices.push({
              id,
              chamber_id: chamberId,
              invoice_number: invoiceNumber,
              user_id: userId,
              description,
              amount,
              total_amount: totalAmount,
              currency: 'USD',
              status,
              due_date: dueDate,
              paid_at: paidAt,
              payment_method_id: paymentMethodId,
              payment_gateway_txn_id: txnId,
              related_plan_id: planId,
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (normalized.includes('INSERT INTO applications')) {
            const [
              id,
              chamberId,
              applicantName,
              businessEmail,
              businessPhone,
              businessName,
              businessDetailsJson,
              planId,
              chapterId,
              status,
              kanbanStage,
              trackingCode,
              createdAt,
              updatedAt,
            ] = boundParams;

            const record = {
              id,
              chamber_id: chamberId,
              applicant_name: applicantName,
              business_email: businessEmail,
              business_phone: businessPhone,
              business_name: businessName,
              business_details_json: businessDetailsJson,
              plan_id: planId,
              chapter_id: chapterId,
              status,
              kanban_stage: kanbanStage,
              tracking_code: trackingCode,
              admin_notes: null,
              created_at: createdAt,
              updated_at: updatedAt,
            };
            applications.set(id, record);
            return { success: true, meta: { changes: 1 } };
          }
          if (normalized.includes('INSERT INTO activity_logs')) {
            activityLogs.push(boundParams);
            return { success: true, meta: { changes: 1 } };
          }
          if (normalized.includes('UPDATE applications SET status = ?')) {
            const [status, adminNotes, kanbanStage, updatedAt, chamberId, id] = boundParams;
            const app = applications.get(id);
            if (app && app.chamber_id === chamberId) {
              app.status = status;
              app.admin_notes = adminNotes;
              app.kanban_stage = kanbanStage;
              app.updated_at = updatedAt;
              return { success: true, meta: { changes: 1 } };
            }
            return { success: true, meta: { changes: 0 } };
          }
          if (normalized.includes('UPDATE applications') && normalized.includes('converted_user_id IS NULL')) {
            const [adminNotes, userId, updatedAt, chamberId, id] = boundParams;
            const app = applications.get(id);
            if (
              app &&
              app.chamber_id === chamberId &&
              !app.converted_user_id &&
              ['pending', 'changes_requested', 'approved'].includes(app.status)
            ) {
              app.status = 'approved';
              app.admin_notes = adminNotes;
              app.kanban_stage = 'approved';
              app.converted_user_id = userId;
              app.updated_at = updatedAt;
              return { success: true, meta: { changes: 1 } };
            }
            return { success: true, meta: { changes: 0 } };
          }
          if (normalized.includes('UPDATE applications SET converted_user_id = ?')) {
            const [userId, updatedAt, id] = boundParams;
            const app = applications.get(id);
            if (app) {
              app.converted_user_id = userId;
              app.updated_at = updatedAt;
              return { success: true, meta: { changes: 1 } };
            }
            return { success: true, meta: { changes: 0 } };
          }
          if (normalized.includes('UPDATE applications')) {
            const [
              applicantName,
              businessName,
              businessPhone,
              chapterId,
              businessDetailsJson,
              updatedAt,
              chamberId,
              trackingCode,
            ] = boundParams;

            for (const app of applications.values()) {
              if (app.chamber_id === chamberId && app.tracking_code === trackingCode && app.status === 'changes_requested') {
                app.applicant_name = applicantName;
                app.business_name = businessName;
                app.business_phone = businessPhone;
                app.chapter_id = chapterId;
                app.business_details_json = businessDetailsJson;
                app.status = 'pending';
                app.kanban_stage = 'under_review';
                app.updated_at = updatedAt;
                return { success: true, meta: { changes: 1 } };
              }
            }
            return { success: true, meta: { changes: 0 } };
          }
          return { success: true, meta: { changes: 1 } };
        },
      };

      return statement;
    },
  };
}

describe('Prompt 02.2: Public Membership Applications Integration Tests', () => {
  const env: any = {
    DB: createMockDb(),
    KV: createMockKV(),
    JWT_SECRET: 'test_jwt_secret_value_minimum_32_characters_long_for_security',
    COOKIE_SECRET: 'test_cookie_secret_value_minimum_32_characters_long',
  };

  let createdTrackingCode = '';

  it('1. POST /api/v1/public/applications submits application and generates tracking code', async () => {
    const app = createApp();

    const payload = {
      applicantName: 'Michael Scott',
      businessEmail: 'michael@dundermifflin.com',
      businessPhone: '+1 (570) 555-0144',
      businessName: 'Dunder Mifflin Paper Co.',
      planId: 'plan_gold_001',
      chapterId: 'chap_downtown',
      businessDetails: {
        industry: 'Paper & Office Supplies',
        website: 'https://dundermifflin.com',
        address: {
          street: '1725 Slough Avenue',
          city: 'Scranton',
          state: 'PA',
          zip: '18503',
        },
        employeeCount: 18,
        annualRevenue: 1500000,
        description: 'Mid-size regional paper distributor.',
        jobTitle: 'Regional Manager',
      },
    };

    const res = await app.request('/api/v1/public/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-chamber-id': 'ch_test_tenant',
      },
      body: JSON.stringify(payload),
    }, env);

    assert.equal(res.status, 201);
    const json: any = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.id);
    assert.match(json.data.trackingCode, /^APP-\d{4}-\d{5}$/);
    assert.equal(json.data.status, 'pending');

    createdTrackingCode = json.data.trackingCode;

    // Verify row was written to mock D1
    assert.equal(env.DB._applications.size, 1);
  });

  it('2. GET /api/v1/public/applications/track/:code returns application tracking details', async () => {
    const app = createApp();

    const res = await app.request(`/api/v1/public/applications/track/${createdTrackingCode}`, {
      method: 'GET',
      headers: {
        'x-chamber-id': 'ch_test_tenant',
      },
    }, env);

    assert.equal(res.status, 200);
    const json: any = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.trackingCode, createdTrackingCode);
    assert.equal(json.data.applicantName, 'Michael Scott');
    assert.equal(json.data.businessName, 'Dunder Mifflin Paper Co.');
    assert.equal(json.data.planName, 'Gold Business');
    assert.equal(json.data.status, 'pending');
    assert.equal(json.data.businessDetails.industry, 'Paper & Office Supplies');
  });

  it('3. POST /api/v1/public/applications rejects invalid email with 400 Bad Request', async () => {
    const app = createApp();

    const payload = {
      applicantName: 'Dwight Schrute',
      businessEmail: 'not-an-email',
      businessName: 'Schrute Farms',
      planId: 'plan_gold_001',
      businessDetails: {
        industry: 'Hospitality',
        address: {
          street: 'Schrute Road',
          city: 'Honesdale',
          state: 'PA',
          zip: '18431',
        },
      },
    };

    const res = await app.request('/api/v1/public/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-chamber-id': 'ch_test_tenant',
      },
      body: JSON.stringify(payload),
    }, env);

    assert.equal(res.status, 400);
    const json: any = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'VALIDATION_ERROR');
  });

  it('4. POST /api/v1/public/applications rejects inactive plan with 400 Bad Request', async () => {
    const app = createApp();

    const payload = {
      applicantName: 'Jim Halpert',
      businessEmail: 'jim@athlead.com',
      businessName: 'Athlead',
      planId: 'plan_inactive_002',
      businessDetails: {
        industry: 'Sports Marketing',
        address: {
          street: 'Market St',
          city: 'Philadelphia',
          state: 'PA',
          zip: '19107',
        },
      },
    };

    const res = await app.request('/api/v1/public/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-chamber-id': 'ch_test_tenant',
      },
      body: JSON.stringify(payload),
    }, env);

    assert.equal(res.status, 400);
    const json: any = await res.json();
    assert.equal(json.success, false);
    assert.match(json.error.message, /Selected plan is no longer available/i);
  });

  it('5. Tenant Isolation: Rejects tracking lookup with non-matching chamber context', async () => {
    const app = createApp();

    const res = await app.request(`/api/v1/public/applications/track/${createdTrackingCode}`, {
      method: 'GET',
      headers: {
        'x-chamber-id': 'ch_other_tenant', // Wrong tenant!
      },
    }, env);

    assert.equal(res.status, 404);
  });

  it('6. PUT /api/v1/public/applications/track/:code allows resubmission when changes_requested', async () => {
    const app = createApp();

    // Set status to changes_requested
    for (const a of env.DB._applications.values()) {
      if (a.tracking_code === createdTrackingCode) {
        a.status = 'changes_requested';
        a.admin_notes = 'Please update your business phone number.';
      }
    }

    const updatePayload = {
      businessPhone: '+1 (570) 555-9999',
      businessDetails: {
        description: 'Updated company description with full contact info.',
      },
    };

    const res = await app.request(`/api/v1/public/applications/track/${createdTrackingCode}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-chamber-id': 'ch_test_tenant',
      },
      body: JSON.stringify(updatePayload),
    }, env);

    assert.equal(res.status, 200);
    const json: any = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.status, 'pending');

    // Verify application status was reset to pending in DB
    const checkRes = await app.request(`/api/v1/public/applications/track/${createdTrackingCode}`, {
      method: 'GET',
      headers: {
        'x-chamber-id': 'ch_test_tenant',
      },
    }, env);

    const checkJson: any = await checkRes.json();
    assert.equal(checkJson.data.status, 'pending');
    assert.equal(checkJson.data.businessPhone, '+1 (570) 555-9999');
  });

  it('7. POST /api/v1/public/applications accepts pre-authorized card details', async () => {
    const app = createApp();

    const payload = {
      applicantName: 'Sarah Jenkins',
      businessEmail: 'sarah.jenkins@acmecorp.com',
      businessPhone: '+1 (555) 987-6543',
      businessName: 'Acme Global Ventures',
      planId: 'plan_gold_001',
      paymentMethod: {
        type: 'card',
        cardholderName: 'Sarah Jenkins',
        brand: 'visa',
        lastFour: '4242',
        expiryMonth: 12,
        expiryYear: 2028,
        gatewayToken: 'tok_preauth_test_123',
      },
      businessDetails: {
        website: 'https://acmeglobal.example.com',
        industry: 'Professional Services',
      },
    };

    const res = await app.request('/api/v1/public/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-chamber-id': 'ch_test_tenant',
      },
      body: JSON.stringify(payload),
    }, env);

    assert.equal(res.status, 201);
    const json: any = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.status, 'pending');

    // Verify paymentMethod is stored in application business_details_json
    const createdApp = env.DB._applications.get(json.data.id);
    assert.ok(createdApp);
    const details = JSON.parse(createdApp.business_details_json);
    assert.ok(details.paymentMethod);
    assert.equal(details.paymentMethod.lastFour, '4242');
    assert.equal(details.paymentMethod.brand, 'visa');
  });

  it('8. GET and PATCH /api/v1/admin/applications/approval-mode toggles approval mode', async () => {
    const app = createApp();

    // Authenticate as full_admin
    const token = 'sess_admin_test_token';
    await env.KV.put(
      `session:${token}`,
      JSON.stringify({
        userId: 'usr_admin_001',
        chamberId: 'ch_test_tenant',
        email: 'admin@chamber.org',
        roles: [{ roleId: 'full_admin', scopeType: 'chamber', scopeId: 'ch_test_tenant' }],
        highestRole: 'full_admin',
      })
    );

    // Default mode should be manual review (false)
    const getRes = await app.request('/api/v1/admin/applications/approval-mode', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-chamber-id': 'ch_test_tenant',
      },
    }, env);

    assert.equal(getRes.status, 200);
    const getJson: any = await getRes.json();
    assert.equal(getJson.success, true);
    assert.equal(getJson.data.autoApprove, false);

    // Toggle to auto-approve (true)
    const patchRes = await app.request('/api/v1/admin/applications/approval-mode', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-chamber-id': 'ch_test_tenant',
      },
      body: JSON.stringify({ autoApprove: true }),
    }, env);

    assert.equal(patchRes.status, 200);
    const patchJson: any = await patchRes.json();
    assert.equal(patchJson.success, true);
    assert.equal(patchJson.data.autoApprove, true);

    // Verify updated mode persists on subsequent GET
    const verifyRes = await app.request('/api/v1/admin/applications/approval-mode', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-chamber-id': 'ch_test_tenant',
      },
    }, env);
    const verifyJson: any = await verifyRes.json();
    assert.equal(verifyJson.data.autoApprove, true);

    // Switch back to manual review as default
    await app.request('/api/v1/admin/applications/approval-mode', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-chamber-id': 'ch_test_tenant',
      },
      body: JSON.stringify({ autoApprove: false }),
    }, env);
  });

  it('9. PATCH /api/v1/admin/applications/:id/approve vaults card, issues unpaid invoice, and blocks re-approval', async () => {
    const app = createApp();
    const token = 'sess_admin_test_token';

    // Submit an application with a pre-authorized card
    const submitRes = await app.request('/api/v1/public/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-chamber-id': 'ch_test_tenant',
      },
      body: JSON.stringify({
        applicantName: 'Michael Scott',
        businessEmail: 'michael@dundermifflin.com',
        businessPhone: '+1 (570) 555-0123',
        businessName: 'Dunder Mifflin Paper Co',
        planId: 'plan_gold_001', // Gold plan = $500.00
        paymentMethod: {
          type: 'card',
          cardholderName: 'Michael Scott',
          brand: 'visa',
          lastFour: '8888',
          expiryMonth: 10,
          expiryYear: 2029,
          gatewayToken: 'tok_preauth_dm_8888',
        },
      }),
    }, env);

    const submitJson: any = await submitRes.json();
    const appId = submitJson.data.id;

    // Admin approves the application
    const approveRes = await app.request(`/api/v1/admin/applications/${appId}/approve`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-chamber-id': 'ch_test_tenant',
      },
    }, env);

    assert.equal(approveRes.status, 200);
    const approveJson: any = await approveRes.json();
    assert.equal(approveJson.success, true);
    assert.equal(approveJson.data.status, 'approved');
    // No payment gateway is integrated: approval must never fake a charge.
    assert.equal(approveJson.data.charge.charged, false);
    assert.equal(approveJson.data.charge.amount, 0);
    assert.equal(approveJson.data.charge.transactionId, null);
    assert.ok(approveJson.data.charge.invoiceId);

    // Verify card metadata was vaulted in payment_methods
    const vaulted = env.DB._paymentMethods.find((p: any) => p.last_four === '8888');
    assert.ok(vaulted);
    assert.equal(vaulted.brand, 'visa');

    // Verify invoice was created as unpaid with no gateway transaction
    const invoice = env.DB._invoices.find((i: any) => i.id === approveJson.data.charge.invoiceId);
    assert.ok(invoice);
    assert.equal(invoice.status, 'unpaid');
    assert.equal(invoice.amount, 500);
    assert.ok(!invoice.payment_gateway_txn_id);

    // A second approval must be rejected and must not provision duplicates
    const invoiceCount = env.DB._invoices.length;
    const reapproveRes = await app.request(`/api/v1/admin/applications/${appId}/approve`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-chamber-id': 'ch_test_tenant',
      },
    }, env);
    assert.equal(reapproveRes.status, 409);
    assert.equal(env.DB._invoices.length, invoiceCount);
  });

  it('10. Auto-Approve Mode: Automatically approves on submission without faking a charge', async () => {
    const app = createApp();

    // Set auto-approve setting in chamber
    env.DB._settings.set('ch_test_tenant', 1);

    const res = await app.request('/api/v1/public/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-chamber-id': 'ch_test_tenant',
      },
      body: JSON.stringify({
        applicantName: 'Pam Beesly',
        businessEmail: 'pam@artstudio.com',
        businessPhone: '+1 (570) 555-5555',
        businessName: 'Pam Art Studio',
        planId: 'plan_gold_001',
        paymentMethod: {
          type: 'card',
          cardholderName: 'Pam Beesly',
          brand: 'mastercard',
          lastFour: '1234',
          expiryMonth: 5,
          expiryYear: 2028,
        },
      }),
    }, env);

    assert.equal(res.status, 201);
    const json: any = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.status, 'approved');
    // Without a payment gateway, auto-approval must not claim a charge.
    assert.doesNotMatch(json.data.message, /charged/i);

    // Reset back to manual review default
    env.DB._settings.set('ch_test_tenant', 0);
  });
});
