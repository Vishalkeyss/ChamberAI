import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app';
import { createMigratedD1, createMockKV } from './helpers/sqlite-d1';

/**
 * Prompt 13.2 — Chamber onboarding: re-access guard, validation (BUG-061),
 * gateway keys encrypted + never returned (BUG-060). Real migrations + FK.
 */
describe('Prompt 13.2: Chamber onboarding', () => {
  const app = createApp();
  const CH = 'CHAM_AUSTIN';
  const OTHER = 'CHAM_DALLAS';
  const HOST = 'austin.121meet.ai';

  let d1: ReturnType<typeof createMigratedD1>;
  let kv: ReturnType<typeof createMockKV>;
  let env: any;

  async function session(token: string, userId: string, role: string, chamberId = CH) {
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
    env = { DB: d1, KV: kv, ENVIRONMENT: 'test', PLATFORM_DOMAIN: '121meet.ai', CHAMBER_ENCRYPTION_KEY: 'test-master-key-0123456789abcdef' };
    d1.exec(`
      INSERT INTO platform_chambers (id, name, subdomain, status, onboarded) VALUES
        ('${CH}', 'Austin', 'austin', 'pending_setup', 0), ('${OTHER}', 'Dallas', 'dallas', 'active', 1);
      INSERT INTO users (id, chamber_id, member_verification_token, email, name, highest_role, status) VALUES
        ('usr_admin', '${CH}', 't1', 'admin@test.dev', 'Admin', 'full_admin', 'active'),
        ('usr_chapter', '${CH}', 't2', 'c@test.dev', 'Chapter Admin', 'chapter_admin', 'active');
      INSERT INTO membership_plans (id, chamber_id, name, price) VALUES ('PLAN_DALLAS', '${OTHER}', 'Dallas Gold', 500);
    `);
    await session('s_admin', 'usr_admin', 'full_admin');
    await session('s_chapter', 'usr_chapter', 'chapter_admin');
  });

  const call = (method: string, path: string, body?: unknown, token = 's_admin') =>
    app.request(
      path,
      {
        method,
        headers: { Host: HOST, 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      },
      env
    );
  const json = async (res: Response) => ((await res.json()) as any);
  const one = (sql: string) => d1.sqlite.prepare(sql).get() as any;

  const valid = (extra: Record<string, unknown> = {}) => ({
    profile: { org_name: 'Austin Chamber', city: 'Austin' },
    branding: { primary_color: '#112233', hero_headline: 'Grow together' },
    plans: [{ name: 'Basic', price: 100, billing_frequency: 'annual', pricing_basis: 'flat', features: ['Listing'] }],
    ...extra,
  });

  it('1. finish completes once; second call → 409 (re-access guard) + audit row', async () => {
    let res = await call('GET', '/api/v1/admin/onboarding/state');
    assert.equal((await json(res)).data.is_completed, false);

    res = await call('POST', '/api/v1/admin/onboarding/finish', valid());
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    const ch = one(`SELECT onboarded, status FROM platform_chambers WHERE id='${CH}'`);
    assert.equal(ch.onboarded, 1);
    assert.equal(ch.status, 'active');
    assert.equal(one(`SELECT onboarding_wizard_completed AS v FROM chamber_settings WHERE chamber_id='${CH}'`).v, 1);
    assert.equal(one(`SELECT COUNT(*) AS n FROM activity_logs WHERE action='chamber.onboarding_completed'`).n, 1);

    res = await call('GET', '/api/v1/admin/onboarding/state');
    assert.equal((await json(res)).data.is_completed, true);

    res = await call('POST', '/api/v1/admin/onboarding/finish', valid({ profile: { org_name: 'Changed' } }));
    assert.equal(res.status, 409);
    assert.equal(one(`SELECT name FROM platform_chambers WHERE id='${CH}'`).name, 'Austin Chamber');
  });

  it('2. validation: missing headline / bad colour / no plan → 422, chamber untouched', async () => {
    for (const body of [
      valid({ branding: { primary_color: '#112233' } }),
      valid({ branding: { primary_color: 'blue', hero_headline: 'Grow together' } }),
      valid({ plans: [] }),
    ]) {
      const res = await call('POST', '/api/v1/admin/onboarding/finish', body);
      assert.equal(res.status, 422);
    }
    assert.equal(one(`SELECT onboarded FROM platform_chambers WHERE id='${CH}'`).onboarded, 0);
  });

  it('3. no code defaults: omitted currency / timezone keep DB defaults', async () => {
    const res = await call('POST', '/api/v1/admin/onboarding/finish', valid());
    assert.equal(res.status, 200);
    const s = one(`SELECT default_currency, timezone, primary_color FROM chamber_settings WHERE chamber_id='${CH}'`);
    const defaults = d1.sqlite
      .prepare(`SELECT name, dflt_value FROM pragma_table_info('chamber_settings') WHERE name IN ('default_currency','timezone')`)
      .all() as any[];
    for (const d of defaults) assert.equal(`'${s[d.name]}'`, d.dflt_value);
    assert.equal(s.primary_color, '#112233');
  });

  it('4. BUG-060: gateway keys stored encrypted and never returned', async () => {
    const res = await call('POST', '/api/v1/admin/onboarding/finish', valid({
      payment_gateway: { provider: 'stripe', publishable_key: 'pk_test_abcdef', secret_key: 'sk_test_supersecret' },
    }));
    assert.equal(res.status, 200);
    const gw = one(`SELECT publishable_key_encrypted AS p, secret_key_encrypted AS s FROM payment_gateway_config WHERE chamber_id='${CH}'`);
    assert.ok(!gw.s.includes('sk_test_supersecret'));
    assert.ok(!gw.p.includes('pk_test_abcdef'));

    const state = await call('GET', '/api/v1/admin/onboarding/state');
    const text = await state.text();
    assert.ok(!text.includes('sk_test') && !text.includes('secret_key') && !text.includes(gw.s));
    assert.equal(JSON.parse(text).data.payment_gateway.has_keys, true);
  });

  it('5. gateway without server encryption key → 503, nothing saved', async () => {
    delete env.CHAMBER_ENCRYPTION_KEY;
    const res = await call('POST', '/api/v1/admin/onboarding/finish', valid({
      payment_gateway: { provider: 'stripe', publishable_key: 'pk_test_abcdef', secret_key: 'sk_test_supersecret' },
    }));
    assert.equal(res.status, 503);
    assert.equal(one(`SELECT onboarded FROM platform_chambers WHERE id='${CH}'`).onboarded, 0);
    assert.equal(one(`SELECT COUNT(*) AS n FROM payment_gateway_config`).n, 0);
  });

  it('6. tenant isolation: another chamber plan id is not overwritten; chapter admin denied', async () => {
    const res = await call('POST', '/api/v1/admin/onboarding/finish', valid({
      plans: [{ id: 'PLAN_DALLAS', name: 'Hijack', price: 1, billing_frequency: 'annual', pricing_basis: 'flat', features: [] }],
    }));
    assert.equal(res.status, 200);
    const p = one(`SELECT chamber_id, name FROM membership_plans WHERE id='PLAN_DALLAS'`);
    assert.equal(p.chamber_id, OTHER);
    assert.equal(p.name, 'Dallas Gold');

    const denied = await call('GET', '/api/v1/admin/onboarding/state', undefined, 's_chapter');
    assert.equal(denied.status, 403);
  });
});
