import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app';
import { createMigratedD1, createMockKV } from './helpers/sqlite-d1';

/**
 * Prompt 05.3 — B2B referrals with multi-contact lead passing.
 * Runs on the REAL migrations with foreign keys enforced.
 */
describe('Prompt 05.3: B2B Referrals', () => {
  const app = createApp();
  const CH = 'CHAM_AUSTIN';
  const OTHER = 'CHAM_DALLAS';
  const HOST = 'austin.121meet.ai';

  let d1: ReturnType<typeof createMigratedD1>;
  let kv: ReturnType<typeof createMockKV>;
  let env: any;

  async function session(token: string, userId: string, role = 'member', chamberId = CH) {
    await kv.put(
      `session:${token}`,
      JSON.stringify({
        userId,
        chamberId,
        email: `${userId}@test.dev`,
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: null,
        highestRole: role,
        roles: [{ roleId: role, scopeType: 'chamber', scopeId: chamberId }],
        pointsBalance: 0,
        chamber: { id: chamberId, name: 'Austin' },
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      })
    );
  }

  beforeEach(async () => {
    d1 = createMigratedD1();
    kv = createMockKV();
    env = { DB: d1, KV: kv, ENVIRONMENT: 'test', PLATFORM_DOMAIN: '121meet.ai' };
    d1.exec(`
      INSERT INTO platform_chambers (id, name, subdomain, status) VALUES
        ('${CH}', 'Austin', 'austin', 'active'), ('${OTHER}', 'Dallas', 'dallas', 'active');
      INSERT INTO users (id, chamber_id, member_verification_token, email, name, highest_role, status, points_balance) VALUES
        ('usr_apex', '${CH}', 't1', 'apex@test.dev', 'Alice Apex', 'member', 'active', 10),
        ('usr_dm', '${CH}', 't2', 'dm@test.dev', 'Mike Scott', 'member', 'active', 0),
        ('usr_dm2', '${CH}', 't3', 'dm2@test.dev', 'Dwight Schrute', 'member', 'active', 0),
        ('usr_nobiz', '${CH}', 't4', 'nobiz@test.dev', 'No Business', 'member', 'active', 0),
        ('usr_dallas', '${OTHER}', 't5', 'd@test.dev', 'Dallas Rep', 'member', 'active', 0);
      INSERT INTO business_profiles (id, chamber_id, business_name, industry) VALUES
        ('biz_apex', '${CH}', 'Apex Legal Group', 'Legal'),
        ('biz_dm', '${CH}', 'Dunder Mifflin', 'Paper'),
        ('biz_dallas', '${OTHER}', 'Dallas Roofing', 'Roofing');
      INSERT INTO business_members (id, chamber_id, business_id, user_id, access_level, is_primary_contact, status) VALUES
        ('bm_apex', '${CH}', 'biz_apex', 'usr_apex', 'full_access', 1, 'active'),
        ('bm_dm', '${CH}', 'biz_dm', 'usr_dm', 'full_access', 1, 'active'),
        ('bm_dm2', '${CH}', 'biz_dm', 'usr_dm2', 'events_networking', 0, 'active'),
        ('bm_dallas', '${OTHER}', 'biz_dallas', 'usr_dallas', 'full_access', 1, 'active');
    `);
    await session('s_apex', 'usr_apex');
    await session('s_dm', 'usr_dm');
    await session('s_nobiz', 'usr_nobiz');
    await session('s_bill', 'usr_dm2', 'billing_admin');
  });

  const call = (method: string, path: string, body?: unknown, token?: string) =>
    app.request(
      path,
      {
        method,
        headers: {
          Host: HOST,
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      },
      env
    );
  const one = (sql: string) => d1.sqlite.prepare(sql).get() as any;
  const referral = {
    toBusinessId: 'biz_dm',
    message: 'Client needs a big paper supply contract.',
    contacts: [
      { fullName: 'James Wilson', email: 'jwilson@logistics.test', phone: '+1 512-555-0188', profession: 'Warehouse Owner' },
      { fullName: 'Jan Levinson', profession: 'Procurement Head' },
    ],
  };
  const give = async (body: unknown = referral) => call('POST', '/api/v1/referrals', body, 's_apex');

  it('1. Submit referral with 2 contacts → 201, 2 referral_people rows, +200 points with ledger', async () => {
    const res = await give();
    assert.equal(res.status, 201);
    const { data } = (await res.json()) as any;
    assert.equal(data.pointsAwarded, 200);
    assert.match(data.id, /^REF_AUSTIN_\d{8}_[0-9A-Z]{4}$/);
    const ref = one(`SELECT * FROM referrals WHERE id = '${data.id}'`);
    assert.equal(ref.from_business_id, 'biz_apex');
    assert.equal(ref.to_business_id, 'biz_dm');
    assert.equal(ref.created_by_user_id, 'usr_apex');
    assert.equal(ref.status, 'pending');
    assert.equal(one(`SELECT count(*) AS n FROM referral_people WHERE referral_id = '${data.id}' AND chamber_id = '${CH}'`).n, 2);
    assert.equal(one(`SELECT points_balance AS p FROM users WHERE id = 'usr_apex'`).p, 210);
    const ledger = one(`SELECT * FROM points_history WHERE user_id = 'usr_apex'`);
    assert.equal(ledger.points, 200);
    assert.equal(ledger.related_referral_id, data.id);
    // §13: every active representative of the receiving business is notified.
    assert.equal(one(`SELECT count(*) AS n FROM notifications WHERE type = 'referral_received'`).n, 2);
    assert.equal(one(`SELECT action FROM activity_logs WHERE target_id = '${data.id}'`).action, 'referral.created');
  });

  it('2. Self-referral → 400, nothing written', async () => {
    assert.equal((await give({ ...referral, toBusinessId: 'biz_apex' })).status, 400);
    assert.equal(one(`SELECT count(*) AS n FROM referrals`).n, 0);
    assert.equal(one(`SELECT points_balance AS p FROM users WHERE id = 'usr_apex'`).p, 10);
  });

  it('3. Recipient advances to converted with deal value → persisted; giver cannot update', async () => {
    const { data } = (await (await give()).json()) as any;
    const path = `/api/v1/referrals/${data.id}/status`;
    assert.equal((await call('PATCH', path, { status: 'contacted' }, 's_apex')).status, 403);

    assert.equal((await call('PATCH', path, { status: 'contacted' }, 's_dm')).status, 200);
    const res = await call('PATCH', path, { status: 'converted', convertedValue: 4500 }, 's_dm');
    assert.equal(res.status, 200);
    const row = one(`SELECT status, converted_value FROM referrals WHERE id = '${data.id}'`);
    assert.equal(row.status, 'converted');
    assert.equal(row.converted_value, 4500);
    // Final state: no further changes.
    assert.equal((await call('PATCH', path, { status: 'declined' }, 's_dm')).status, 409);

    const list = (await (await call('GET', '/api/v1/referrals', undefined, 's_dm')).json()) as any;
    assert.equal(list.data.received.length, 1);
    assert.equal(list.data.received[0].fromBusiness.name, 'Apex Legal Group');
    assert.equal(list.data.received[0].contacts.length, 2);
    // Contacts come back in the order they were entered.
    assert.deepEqual(list.data.received[0].contacts.map((c: any) => c.fullName), ['James Wilson', 'Jan Levinson']);
    assert.equal(list.data.received[0].canUpdateStatus, false);
    assert.equal(list.data.stats.convertedValue, 4500);
    const giver = (await (await call('GET', '/api/v1/referrals', undefined, 's_apex')).json()) as any;
    assert.equal(giver.data.given.length, 1);
    assert.equal(giver.data.stats.givenCount, 1);
    assert.equal(giver.data.given[0].canUpdateStatus, false);
  });

  it('4. Deal value only with converted; invalid status 422', async () => {
    const { data } = (await (await give()).json()) as any;
    const path = `/api/v1/referrals/${data.id}/status`;
    assert.equal((await call('PATCH', path, { status: 'contacted', convertedValue: 10 }, 's_dm')).status, 422);
    assert.equal((await call('PATCH', path, { status: 'pending' }, 's_dm')).status, 422);
    assert.equal((await call('PATCH', path, { status: 'converted', convertedValue: -5 }, 's_dm')).status, 422);
  });

  it('5. Tenant isolation: other-chamber business 404; referred business must be in chamber', async () => {
    assert.equal((await give({ ...referral, toBusinessId: 'biz_dallas' })).status, 404);
    const bad = { ...referral, contacts: [{ fullName: 'Someone', profession: 'Roofer', referredBusinessId: 'biz_dallas' }] };
    assert.equal((await give(bad)).status, 404);
    assert.equal(one(`SELECT count(*) AS n FROM referrals`).n, 0);
    const search = (await (await call('GET', '/api/v1/referrals/businesses', undefined, 's_apex')).json()) as any;
    assert.deepEqual(search.data.map((b: any) => b.id), ['biz_dm']);
  });

  it('6. Validation: ≥1 contact, ≤10 contacts, profession required', async () => {
    assert.equal((await give({ ...referral, contacts: [] })).status, 422);
    const eleven = Array.from({ length: 11 }, (_, i) => ({ fullName: `Person ${i}`, profession: 'Plumber' }));
    assert.equal((await give({ ...referral, contacts: eleven })).status, 422);
    assert.equal((await give({ ...referral, contacts: [{ fullName: 'No Job' }] })).status, 422);
  });

  it('7. Member without a business → 400; guest 401; billing_admin 403', async () => {
    assert.equal((await call('POST', '/api/v1/referrals', referral, 's_nobiz')).status, 400);
    assert.equal((await call('GET', '/api/v1/referrals')).status, 401);
    assert.equal((await call('GET', '/api/v1/referrals', undefined, 's_bill')).status, 403);
  });

  it('9. Member representing both businesses: referral shows only under Received; cannot refer own businesses', async () => {
    d1.exec(`
      INSERT INTO users (id, chamber_id, member_verification_token, email, name, highest_role, status) VALUES
        ('usr_both', '${CH}', 't9', 'both@test.dev', 'Sam Both', 'member', 'active');
      INSERT INTO business_members (id, chamber_id, business_id, user_id, access_level, is_primary_contact, status) VALUES
        ('bm_both_dm', '${CH}', 'biz_dm', 'usr_both', 'full_access', 0, 'active'),
        ('bm_both_apex', '${CH}', 'biz_apex', 'usr_both', 'events_networking', 0, 'active');
    `);
    await session('s_both', 'usr_both');
    const { data } = (await (await give()).json()) as any; // Apex → Dunder Mifflin

    const list = (await (await call('GET', '/api/v1/referrals', undefined, 's_both')).json()) as any;
    assert.deepEqual(list.data.received.map((r: any) => r.id), [data.id]);
    assert.equal(list.data.given.length, 0);
    assert.equal(list.data.stats.givenCount, 0);
    assert.equal(list.data.stats.receivedCount, 1);

    // Both businesses are theirs → referring either one is a self-referral (400).
    assert.equal((await call('POST', '/api/v1/referrals', { ...referral, toBusinessId: 'biz_apex' }, 's_both')).status, 400);
  });

  it('8. Unknown referral 404', async () => {
    assert.equal((await call('PATCH', '/api/v1/referrals/REF_X/status', { status: 'contacted' }, 's_dm')).status, 404);
  });
});
