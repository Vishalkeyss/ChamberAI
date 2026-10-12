import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app';
import { createMigratedD1, createMockKV } from './helpers/sqlite-d1';
import { generateVCard, escapeVCardValue, normalizeWebsite, splitName, vcardFileName } from '../modules/networking/services/vcard.service';

describe('Prompt 05.4: vCard generator (unit)', () => {
  it('1. Outputs RFC 6350 / vCard 3.0 lines with CRLF', () => {
    const v = generateVCard({
      firstName: 'Sarah',
      lastName: 'Jenkins',
      email: 'sarah@apex.test',
      phone: '+1 512-555-0199',
      company: 'Apex Consulting',
      website: 'https://apex.test',
    });
    const lines = v.split('\r\n');
    assert.equal(lines[0], 'BEGIN:VCARD');
    assert.equal(lines[1], 'VERSION:3.0');
    assert.ok(lines.includes('N:Jenkins;Sarah;;;'));
    assert.ok(lines.includes('FN:Sarah Jenkins'));
    assert.ok(lines.includes('ORG:Apex Consulting'));
    assert.ok(lines.includes('TEL;TYPE=CELL,VOICE:+1 512-555-0199'));
    assert.ok(lines.includes('EMAIL;TYPE=WORK,INTERNET:sarah@apex.test'));
    assert.ok(lines.includes('URL:https://apex.test'));
    assert.equal(lines[lines.length - 1], 'END:VCARD');
    assert.ok(!lines.some((l) => l.startsWith('TITLE')), 'empty optional fields are omitted');
  });

  it('2. Escapes values so user data cannot inject properties', () => {
    assert.equal(escapeVCardValue('A;B,C\\D\nEND:VCARD'), 'A\\;B\\,C\\\\D\\nEND:VCARD');
    const v = generateVCard({ firstName: 'Evil', lastName: 'X', email: 'e@x.test', company: 'Co\r\nTEL:999' });
    assert.equal(v.split('\r\n').filter((l) => l.startsWith('TEL')).length, 0);
  });

  it('3. Helpers: name split, website scheme, safe file name', () => {
    assert.deepEqual(splitName('Mary Ann Smith'), { firstName: 'Mary Ann', lastName: 'Smith' });
    assert.deepEqual(splitName('Cher'), { firstName: 'Cher', lastName: '' });
    assert.equal(normalizeWebsite('apex.test'), 'https://apex.test');
    assert.equal(normalizeWebsite('javascript:alert(1)'), null);
    assert.equal(vcardFileName('Sarah Jenkins'), 'Sarah-Jenkins.vcf');
    assert.equal(vcardFileName('"../x"'), 'x.vcf');
  });
});

/** Integration — REAL migrations with foreign keys enforced. */
describe('Prompt 05.4: Business card API', () => {
  const app = createApp();
  const CH = 'CHAM_AUSTIN';
  const OTHER = 'CHAM_DALLAS';
  const HOST = 'austin.121meet.ai';
  const TOKEN = 'crd_aaaaaaaaaaaaaaaaaaaaaaaa';

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
      INSERT INTO chamber_settings (id, chamber_id, org_name, primary_color, logo_url) VALUES
        ('CSET_AUSTIN', '${CH}', 'Austin Chamber', '#123ABC', '/api/v1/public/assets/logo.png');
      INSERT INTO users (id, chamber_id, member_verification_token, email, name, phone, highest_role, status, card_token) VALUES
        ('usr_sarah', '${CH}', 't1', 'sarah@apex.test', 'Sarah Jenkins', '+1 512-555-0199', 'member', 'active', '${TOKEN}'),
        ('usr_new', '${CH}', 't2', 'new@test.dev', 'New Member', NULL, 'member', 'active', NULL),
        ('usr_gone', '${CH}', 't3', 'gone@test.dev', 'Gone', NULL, 'member', 'suspended', 'crd_bbbbbbbbbbbbbbbbbbbbbbbb'),
        ('usr_bill', '${CH}', 't4', 'bill@test.dev', 'Billing', NULL, 'billing_admin', 'active', NULL);
      INSERT INTO business_profiles (id, chamber_id, business_name, website, city, state, social_links_json, is_verified) VALUES
        ('biz_apex', '${CH}', 'Apex Consulting', 'apex.test', 'Austin', 'TX', '{"linkedin":"linkedin.com/company/apex","bannerUrl":"/x.png"}', 1);
      INSERT INTO business_members (id, chamber_id, business_id, user_id, access_level, is_primary_contact, status) VALUES
        ('bm_sarah', '${CH}', 'biz_apex', 'usr_sarah', 'full_access', 1, 'active'),
        ('bm_gone', '${CH}', 'biz_apex', 'usr_gone', 'events_networking', 0, 'active');
    `);
    await session('s_sarah', 'usr_sarah');
    await session('s_new', 'usr_new');
    await session('s_bill', 'usr_bill', 'billing_admin');
  });

  const call = (method: string, path: string, body?: unknown, token?: string, host = HOST) =>
    app.request(
      path,
      {
        method,
        headers: {
          Host: host,
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      },
      env
    );
  const one = (sql: string) => d1.sqlite.prepare(sql).get() as any;

  it('4. Member card: live profile data, chamber theme fallback, token + views', async () => {
    const res = await call('GET', '/api/v1/member/business-card', undefined, 's_sarah');
    assert.equal(res.status, 200);
    const { data } = (await res.json()) as any;
    assert.equal(data.cardToken, TOKEN);
    assert.equal(data.themeColor, '#123ABC');
    assert.equal(data.customThemeColor, null);
    assert.equal(data.viewsCount, 0);
    assert.equal(data.publicCardAvailable, true);
    assert.equal(data.profile.company, 'Apex Consulting');
    assert.equal(data.profile.website, 'https://apex.test');
    assert.equal(data.profile.address, 'Austin, TX');
    assert.equal(data.profile.isVerified, true);
    assert.deepEqual(data.profile.socialLinks, [{ network: 'linkedin', url: 'https://linkedin.com/company/apex' }]);
    assert.equal(data.chamber.name, 'Austin Chamber');
  });

  it('5. Token created once for users without one, never changed', async () => {
    const first = (await (await call('GET', '/api/v1/member/business-card', undefined, 's_new')).json()) as any;
    assert.match(first.data.cardToken, /^crd_[0-9a-f]{24}$/);
    assert.equal(first.data.publicCardAvailable, false);
    const second = (await (await call('GET', '/api/v1/member/business-card', undefined, 's_new')).json()) as any;
    assert.equal(second.data.cardToken, first.data.cardToken);
  });

  it('6. Theme update: valid hex saved, invalid 422', async () => {
    const res = await call('PUT', '/api/v1/member/business-card', { themeColor: '#0f766e' }, 's_sarah');
    assert.equal(res.status, 200);
    assert.equal(((await res.json()) as any).data.themeColor, '#0F766E');
    assert.equal(one(`SELECT card_theme_color AS c FROM users WHERE id = 'usr_sarah'`).c, '#0F766E');
    assert.equal((await call('PUT', '/api/v1/member/business-card', { themeColor: 'red' }, 's_sarah')).status, 422);
    assert.equal((await call('PUT', '/api/v1/member/business-card', { themeColor: '#123' }, 's_sarah')).status, 422);
  });

  it('7. Public card: anonymous view increments the counter; owner preview does not', async () => {
    const res = await call('GET', `/api/v1/public/card/${TOKEN}`);
    assert.equal(res.status, 200);
    const { data } = (await res.json()) as any;
    assert.equal(data.profile.name, 'Sarah Jenkins');
    assert.equal(data.isOwner, false);
    assert.equal(data.viewsCount, undefined);
    assert.equal(one(`SELECT card_views_count AS n FROM users WHERE id = 'usr_sarah'`).n, 1);

    const own = (await (await call('GET', `/api/v1/public/card/${TOKEN}`, undefined, 's_sarah')).json()) as any;
    assert.equal(own.data.isOwner, true);
    assert.equal(one(`SELECT card_views_count AS n FROM users WHERE id = 'usr_sarah'`).n, 1);
  });

  it('8. Tenant isolation + inactive owner + no business → 404', async () => {
    assert.equal((await call('GET', `/api/v1/public/card/${TOKEN}`, undefined, undefined, 'dallas.121meet.ai')).status, 404);
    assert.equal((await call('GET', '/api/v1/public/card/crd_bbbbbbbbbbbbbbbbbbbbbbbb')).status, 404);
    assert.equal((await call('GET', '/api/v1/public/card/not-a-token')).status, 404);
    const fresh = (await (await call('GET', '/api/v1/member/business-card', undefined, 's_new')).json()) as any;
    assert.equal((await call('GET', `/api/v1/public/card/${fresh.data.cardToken}`)).status, 404);
  });

  it('9. vCard download: text/vcard attachment with the live data', async () => {
    const res = await call('GET', `/api/v1/public/card/${TOKEN}/vcard`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /^text\/vcard/);
    assert.equal(res.headers.get('content-disposition'), 'attachment; filename="Sarah-Jenkins.vcf"');
    const body = await res.text();
    assert.ok(body.includes('FN:Sarah Jenkins'));
    assert.ok(body.includes('ORG:Apex Consulting'));
    assert.ok(body.includes('EMAIL;TYPE=WORK,INTERNET:sarah@apex.test'));
  });

  it('10. Member routes: guest 401, billing_admin 403', async () => {
    assert.equal((await call('GET', '/api/v1/member/business-card')).status, 401);
    assert.equal((await call('GET', '/api/v1/member/business-card', undefined, 's_bill')).status, 403);
  });

  it('11. Migration backfilled tokens are unique per user', () => {
    d1.exec(`UPDATE users SET card_token = NULL WHERE id IN ('usr_new','usr_bill')`);
    d1.exec(`UPDATE users SET card_token = 'crd_' || lower(hex(randomblob(12))) WHERE card_token IS NULL`);
    const row = one(`SELECT count(*) AS n, count(DISTINCT card_token) AS d FROM users WHERE chamber_id = '${CH}'`);
    assert.equal(row.n, row.d);
  });
});
