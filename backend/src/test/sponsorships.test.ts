import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app';
import { createMigratedD1, createMockKV } from './helpers/sqlite-d1';

/**
 * Prompt 04.4 — Event Sponsorship Packages & Member Self-Service Booking.
 * Runs on the REAL migrations with foreign keys enforced.
 */
describe('Prompt 04.4: Event Sponsorships', () => {
  const app = createApp();
  const CH = 'CHAM_AUSTIN';
  const OTHER = 'CHAM_DALLAS';
  const HOST = 'austin.121meet.ai';
  const future = new Date(Date.now() + 14 * 86400000).toISOString();

  let d1: ReturnType<typeof createMigratedD1>;
  let kv: ReturnType<typeof createMockKV>;
  let env: any;

  type Role = { roleId: string; scopeType: string; scopeId: string };
  async function session(token: string, userId: string, roles: Role[], chamberId = CH) {
    await kv.put(
      `session:${token}`,
      JSON.stringify({
        userId,
        chamberId,
        email: `${userId}@test.dev`,
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: null,
        highestRole: roles[0].roleId,
        roles,
        pointsBalance: 0,
        chamber: { id: chamberId, name: 'Austin' },
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      })
    );
  }
  const chamberRole = (roleId: string): Role => ({ roleId, scopeType: 'chamber', scopeId: CH });

  beforeEach(async () => {
    d1 = createMigratedD1();
    kv = createMockKV();
    env = { DB: d1, KV: kv, ENVIRONMENT: 'test', PLATFORM_DOMAIN: '121meet.ai' };
    d1.exec(`
      INSERT INTO platform_chambers (id, name, subdomain, status) VALUES
        ('${CH}', 'Austin', 'austin', 'active'), ('${OTHER}', 'Dallas', 'dallas', 'active');
      INSERT INTO chamber_settings (id, chamber_id, org_name, default_currency) VALUES ('CSET_AUSTIN', '${CH}', 'Austin', 'INR');
      INSERT INTO chapters (id, chamber_id, name) VALUES ('CHP_N', '${CH}', 'North'), ('CHP_S', '${CH}', 'South');
      INSERT INTO groups (id, chamber_id, name) VALUES ('GRP_1', '${CH}', 'Women in Business');
      INSERT INTO users (id, chamber_id, member_verification_token, email, name, highest_role, status) VALUES
        ('usr_m1', '${CH}', 't1', 'm1@test.dev', 'Member One', 'member', 'active'),
        ('usr_m2', '${CH}', 't2', 'm2@test.dev', 'Member Two', 'member', 'active'),
        ('usr_admin', '${CH}', 't3', 'a@test.dev', 'Admin', 'full_admin', 'active'),
        ('usr_bill', '${CH}', 't4', 'b@test.dev', 'Billing', 'billing_admin', 'active'),
        ('usr_chap', '${CH}', 't5', 'c@test.dev', 'Chapter', 'chapter_admin', 'active'),
        ('usr_grp', '${CH}', 't6', 'g@test.dev', 'Group', 'group_admin', 'active'),
        ('usr_d1', '${OTHER}', 't7', 'd@test.dev', 'Dallas', 'member', 'active');
      INSERT INTO business_profiles (id, chamber_id, business_name, business_logo_url, website) VALUES
        ('BIZ_ACME', '${CH}', 'Acme Corp', '/api/v1/public/assets/acme.png', 'https://acme.example'),
        ('BIZ_BETA', '${CH}', 'Beta LLC', NULL, NULL),
        ('BIZ_DAL', '${OTHER}', 'Dallas Co', NULL, NULL);
      INSERT INTO business_members (id, chamber_id, business_id, user_id, access_level, is_primary_contact, status) VALUES
        ('BM_1', '${CH}', 'BIZ_ACME', 'usr_m1', 'full_access', 1, 'active'),
        ('BM_2', '${CH}', 'BIZ_BETA', 'usr_m2', 'full_access', 1, 'removed');
      INSERT INTO events (id, chamber_id, title, event_date, status, visibility, chapter_id, group_id) VALUES
        ('evt_gala', '${CH}', 'Annual Gala', '${future}', 'published', 'public', 'CHP_N', 'GRP_1'),
        ('evt_south', '${CH}', 'South Mixer', '${future}', 'published', 'public', 'CHP_S', NULL),
        ('evt_staff', '${CH}', 'Staff Retreat', '${future}', 'published', 'staff_only', NULL, NULL),
        ('evt_dallas', '${OTHER}', 'Dallas Meetup', '${future}', 'published', 'public', NULL, NULL);
      INSERT INTO event_sponsorship_tiers (id, chamber_id, event_id, tier_name, amount, benefits, max_sponsors, sponsors_count, sort_order) VALUES
        ('STIER_TITLE', '${CH}', 'evt_gala', 'Title', 5000, '["Logo on stage backdrop","4 VIP tickets"]', 1, 0, 0),
        ('STIER_GOLD', '${CH}', 'evt_gala', 'Gold', 1000, '["Podium mention"]', NULL, 0, 1),
        ('STIER_SOUTH', '${CH}', 'evt_south', 'Silver', 500, '[]', NULL, 0, 0),
        ('STIER_DAL', '${OTHER}', 'evt_dallas', 'Gold', 900, '[]', NULL, 0, 0);
    `);
    await session('sess_m1', 'usr_m1', [chamberRole('member')]);
    await session('sess_m2', 'usr_m2', [chamberRole('member')]);
    await session('sess_admin', 'usr_admin', [chamberRole('full_admin')]);
    await session('sess_bill', 'usr_bill', [chamberRole('billing_admin')]);
    await session('sess_chap', 'usr_chap', [{ roleId: 'chapter_admin', scopeType: 'chapter', scopeId: 'CHP_N' }]);
    await session('sess_grp', 'usr_grp', [{ roleId: 'group_admin', scopeType: 'group', scopeId: 'GRP_1' }]);
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
  const book = (tierId: string, token = 'sess_m1', extra: Record<string, unknown> = {}) =>
    call('POST', '/api/v1/events/evt_gala/sponsor', { tierId, businessId: 'BIZ_ACME', paymentMethod: 'invoice', ...extra }, token);

  it('1. Public tiers: availability, only paid sponsors on the wall, staff-only / other chamber hidden', async () => {
    d1.exec(`INSERT INTO event_sponsors (id, chamber_id, event_id, business_id, sponsor_name, tier_id, amount, status) VALUES
      ('SPN_PAID', '${CH}', 'evt_gala', 'BIZ_ACME', 'Acme Corp', 'STIER_GOLD', 1000, 'paid'),
      ('SPN_PEND', '${CH}', 'evt_gala', NULL, 'Pending Partner', 'STIER_GOLD', 1000, 'pending')`);
    const res = await call('GET', '/api/v1/events/evt_gala/sponsorship-tiers');
    assert.equal(res.status, 200);
    const { data } = (await res.json()) as any;
    assert.equal(data.currency, 'INR');
    assert.deepEqual(data.tiers.map((t: any) => t.tierName), ['Title', 'Gold']);
    assert.equal(data.tiers[0].spotsRemaining, 1);
    assert.equal(data.tiers[0].isSoldOut, false);
    assert.deepEqual(data.tiers[0].benefits, ['Logo on stage backdrop', '4 VIP tickets']);
    assert.equal(data.confirmedSponsors.length, 1);
    assert.equal(data.confirmedSponsors[0].businessName, 'Acme Corp');
    assert.equal(data.confirmedSponsors[0].website, 'https://acme.example');

    assert.equal((await call('GET', '/api/v1/events/evt_staff/sponsorship-tiers')).status, 404);
    assert.equal((await call('GET', '/api/v1/events/evt_dallas/sponsorship-tiers')).status, 404);
  });

  it('2. Invoice booking → 201 pending, Net 30 sponsorship invoice, tier count +1, activity log', async () => {
    const res = await book('STIER_GOLD');
    assert.equal(res.status, 201);
    const { data } = (await res.json()) as any;
    assert.equal(data.status, 'pending');
    assert.equal(data.amount, 1000);
    const sponsor = one(`SELECT * FROM event_sponsors WHERE id = '${data.sponsorId}'`);
    assert.equal(sponsor.business_id, 'BIZ_ACME');
    assert.equal(sponsor.sponsor_name, 'Acme Corp');
    assert.equal(sponsor.sponsor_user_id, 'usr_m1');
    const inv = one(`SELECT * FROM invoices WHERE id = '${data.invoiceId}'`);
    assert.equal(inv.invoice_type, 'sponsorship');
    assert.equal(inv.related_event_id, 'evt_gala');
    assert.equal(inv.status, 'unpaid');
    assert.equal(inv.currency, 'INR');
    const days = Math.round((new Date(inv.due_date).getTime() - Date.now()) / 86400000);
    assert.ok(days >= 29 && days <= 30, `due in ${days} days`);
    assert.equal(one(`SELECT sponsors_count AS n FROM event_sponsorship_tiers WHERE id = 'STIER_GOLD'`).n, 1);
    assert.ok(one(`SELECT id FROM activity_logs WHERE action = 'event.sponsorship_booked' AND target_id = '${data.sponsorId}'`));
    // Not paid → not on the public wall yet.
    const wall = (await (await call('GET', '/api/v1/events/evt_gala/sponsorship-tiers')).json()) as any;
    assert.equal(wall.data.confirmedSponsors.length, 0);
  });

  it('3. Card booking without a gateway → 503 and nothing written, spot released', async () => {
    const res = await book('STIER_TITLE', 'sess_m1', { paymentMethod: 'card' });
    assert.equal(res.status, 503);
    assert.equal(one(`SELECT sponsors_count AS n FROM event_sponsorship_tiers WHERE id = 'STIER_TITLE'`).n, 0);
    assert.equal(one(`SELECT count(*) AS n FROM event_sponsors`).n, 0);
    assert.equal(one(`SELECT count(*) AS n FROM invoices`).n, 0);
  });

  it('4. Sold-out tier → 400', async () => {
    d1.exec(`UPDATE event_sponsorship_tiers SET sponsors_count = 1 WHERE id = 'STIER_TITLE'`);
    const res = await book('STIER_TITLE');
    assert.equal(res.status, 400);
    const tiers = (await (await call('GET', '/api/v1/events/evt_gala/sponsorship-tiers')).json()) as any;
    assert.equal(tiers.data.tiers[0].isSoldOut, true);
  });

  it('5. Only active representatives of a business in this chamber can book', async () => {
    const removed = await call(
      'POST',
      '/api/v1/events/evt_gala/sponsor',
      { tierId: 'STIER_GOLD', businessId: 'BIZ_BETA', paymentMethod: 'invoice' },
      'sess_m2'
    );
    assert.equal(removed.status, 403);
    assert.equal((await book('STIER_GOLD', 'sess_m1', { businessId: 'BIZ_DAL' })).status, 403);
    assert.equal((await book('STIER_DAL')).status, 404);
    assert.equal((await call('POST', '/api/v1/events/evt_gala/sponsor', { tierId: 'STIER_GOLD', businessId: 'BIZ_ACME' })).status, 401);
    assert.equal(one(`SELECT count(*) AS n FROM event_sponsors`).n, 0);
  });

  it('6. Same business cannot sponsor the same event twice → 409', async () => {
    assert.equal((await book('STIER_GOLD')).status, 201);
    assert.equal((await book('STIER_TITLE')).status, 409);
    assert.equal(one(`SELECT sponsors_count AS n FROM event_sponsorship_tiers WHERE id = 'STIER_TITLE'`).n, 0);
  });

  it('7. Concurrent bookings cannot oversell the last spot', async () => {
    d1.exec(`INSERT INTO business_members (id, chamber_id, business_id, user_id, access_level, status) VALUES ('BM_3', '${CH}', 'BIZ_BETA', 'usr_m1', 'full_access', 'active')`);
    const results = await Promise.all([
      book('STIER_TITLE'),
      book('STIER_TITLE', 'sess_m1', { businessId: 'BIZ_BETA' }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
    assert.equal(one(`SELECT sponsors_count AS n FROM event_sponsorship_tiers WHERE id = 'STIER_TITLE'`).n, 1);
  });

  it('8. Full admin: overview, offline record, mark paid reconciles invoice, remove frees spot + cancels invoice', async () => {
    const booked = ((await (await book('STIER_GOLD')).json()) as any).data;

    const offline = await call('POST', '/api/v1/admin/events/evt_gala/sponsors', { tierId: 'STIER_TITLE', sponsorName: 'Outside Partner', status: 'paid' }, 'sess_admin');
    assert.equal(offline.status, 201);

    const overview = (await (await call('GET', '/api/v1/admin/events/evt_gala/sponsors', undefined, 'sess_admin')).json()) as any;
    assert.equal(overview.data.summary.sponsorCount, 2);
    assert.equal(overview.data.summary.totalPaid, 5000);
    assert.equal(overview.data.summary.totalOutstanding, 1000);
    assert.equal(overview.data.permissions.canUpdateStatus, true);

    const paid = await call('PATCH', `/api/v1/admin/events/evt_gala/sponsors/${booked.sponsorId}`, { status: 'paid' }, 'sess_admin');
    assert.equal(paid.status, 200);
    assert.equal(one(`SELECT status FROM invoices WHERE id = '${booked.invoiceId}'`).status, 'paid');
    const wall = (await (await call('GET', '/api/v1/events/evt_gala/sponsorship-tiers')).json()) as any;
    assert.equal(wall.data.confirmedSponsors.length, 2);

    d1.exec(`UPDATE invoices SET status = 'unpaid' WHERE id = '${booked.invoiceId}'`);
    const removed = await call('DELETE', `/api/v1/admin/events/evt_gala/sponsors/${booked.sponsorId}`, undefined, 'sess_admin');
    assert.equal(removed.status, 200);
    assert.equal(one(`SELECT status FROM invoices WHERE id = '${booked.invoiceId}'`).status, 'cancelled');
    assert.equal(one(`SELECT sponsors_count AS n FROM event_sponsorship_tiers WHERE id = 'STIER_GOLD'`).n, 0);
    assert.equal(one(`SELECT count(*) AS n FROM event_sponsors WHERE id = '${booked.sponsorId}'`).n, 0);
  });

  it('9. Scoped admins: chapter records own chapter only, billing updates status, group view-only, member denied', async () => {
    // chapter_admin (CHP_N)
    assert.equal((await call('GET', '/api/v1/admin/events/evt_south/sponsors', undefined, 'sess_chap')).status, 403);
    const rec = await call('POST', '/api/v1/admin/events/evt_gala/sponsors', { tierId: 'STIER_GOLD', businessId: 'BIZ_BETA' }, 'sess_chap');
    assert.equal(rec.status, 201);
    const sponsorId = ((await rec.json()) as any).data.sponsorId;
    assert.equal((await call('POST', '/api/v1/admin/events/evt_gala/sponsors', { tierId: 'STIER_TITLE', sponsorName: 'X', status: 'paid' }, 'sess_chap')).status, 403);
    assert.equal((await call('PATCH', `/api/v1/admin/events/evt_gala/sponsors/${sponsorId}`, { status: 'paid' }, 'sess_chap')).status, 403);
    assert.equal((await call('DELETE', `/api/v1/admin/events/evt_gala/sponsors/${sponsorId}`, undefined, 'sess_chap')).status, 403);

    // billing_admin — chamber-wide
    assert.equal((await call('PATCH', `/api/v1/admin/events/evt_gala/sponsors/${sponsorId}`, { status: 'overdue' }, 'sess_bill')).status, 200);
    assert.equal((await call('GET', '/api/v1/admin/events/evt_south/sponsors', undefined, 'sess_bill')).status, 200);

    // group_admin (GRP_1) — view own group's event only
    assert.equal((await call('GET', '/api/v1/admin/events/evt_gala/sponsors', undefined, 'sess_grp')).status, 200);
    assert.equal((await call('GET', '/api/v1/admin/events/evt_south/sponsors', undefined, 'sess_grp')).status, 403);
    assert.equal((await call('POST', '/api/v1/admin/events/evt_gala/sponsors', { tierId: 'STIER_GOLD', sponsorName: 'Y' }, 'sess_grp')).status, 403);

    // plain member
    assert.equal((await call('GET', '/api/v1/admin/events/evt_gala/sponsors', undefined, 'sess_m1')).status, 403);
  });
});
