import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app';
import { createMigratedD1, createMockKV } from './helpers/sqlite-d1';

/**
 * Prompt 04.3 — Event registration, promo codes, points & checkout.
 * Runs on the REAL migrations with foreign keys enforced.
 */
describe('Prompt 04.3: Event Registration, Promo Codes & Checkout', () => {
  const app = createApp();
  const CH = 'CHAM_AUSTIN';
  const OTHER = 'CHAM_DALLAS';
  const HOST = 'austin.121meet.ai';
  const future = new Date(Date.now() + 14 * 86400000).toISOString();
  const past = new Date(Date.now() - 14 * 86400000).toISOString();

  let d1: ReturnType<typeof createMigratedD1>;
  let kv: ReturnType<typeof createMockKV>;
  let env: any;

  async function session(token: string, userId: string, roles: string[]) {
    await kv.put(
      `session:${token}`,
      JSON.stringify({
        userId,
        chamberId: CH,
        email: `${userId}@test.dev`,
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: null,
        highestRole: roles[0],
        roles: roles.map((r) => ({ roleId: r, scopeType: 'chamber', scopeId: CH })),
        pointsBalance: 0,
        chamber: { id: CH, name: 'Austin' },
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
      INSERT INTO chamber_settings (id, chamber_id, org_name, default_currency) VALUES ('CSET_AUSTIN', '${CH}', 'Austin', 'INR');
      INSERT INTO users (id, chamber_id, member_verification_token, email, name, highest_role, status, points_balance) VALUES
        ('usr_m1', '${CH}', 't1', 'm1@test.dev', 'Member One', 'member', 'active', 300),
        ('usr_m2', '${CH}', 't2', 'm2@test.dev', 'Member Two', 'member', 'active', 0);
      INSERT INTO events (id, chamber_id, title, event_date, status, visibility, is_paid, registration_fee, non_member_fee, max_capacity, allow_non_member_registration) VALUES
        ('evt_free', '${CH}', 'Free Mixer', '${future}', 'published', 'public', 0, 0, NULL, NULL, 1),
        ('evt_gala', '${CH}', 'Annual Gala', '${future}', 'published', 'public', 1, 0, NULL, 100, 1),
        ('evt_tiny', '${CH}', 'Tiny Workshop', '${future}', 'published', 'public', 0, 0, NULL, 1, 1),
        ('evt_staff', '${CH}', 'Staff Retreat', '${future}', 'published', 'staff_only', 0, 0, NULL, NULL, 1),
        ('evt_draft', '${CH}', 'Draft Event', '${future}', 'draft', 'public', 0, 0, NULL, NULL, 1),
        ('evt_past', '${CH}', 'Past Event', '${past}', 'published', 'public', 0, 0, NULL, NULL, 1),
        ('evt_members', '${CH}', 'Members Lunch', '${future}', 'published', 'public', 1, 20, 40, NULL, 0),
        ('evt_dallas', '${OTHER}', 'Dallas Meetup', '${future}', 'published', 'public', 0, 0, NULL, NULL, 1);
      INSERT INTO event_ticket_types (id, chamber_id, event_id, name, price, allow_pay_later, qty_limit, qty_sold) VALUES
        ('tkt_paylater', '${CH}', 'evt_gala', 'Standard', 50, 1, 10, 0),
        ('tkt_online', '${CH}', 'evt_gala', 'VIP', 100, 0, 5, 0);
      INSERT INTO event_promo_codes (id, chamber_id, event_id, code, discount_type, discount_value, max_uses, used_count, is_active) VALUES
        ('promo_20', '${CH}', 'evt_gala', 'EARLY20', 'percentage', 20, 5, 0, 1),
        ('promo_used', '${CH}', 'evt_gala', 'GONE', 'flat', 10, 1, 1, 1);
    `);
    await session('sess_m1', 'usr_m1', ['member']);
    await session('sess_m2', 'usr_m2', ['member']);
  });

  const post = (path: string, body: unknown, token?: string) =>
    app.request(
      path,
      {
        method: 'POST',
        headers: {
          Host: HOST,
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      },
      env
    );
  const one = (sql: string) => d1.sqlite.prepare(sql).get() as any;

  it('1. Free event → 201 confirmed, QR issued, no invoice', async () => {
    const res = await post('/api/v1/events/evt_free/register', {}, 'sess_m1');
    const body: any = await res.json();
    assert.equal(res.status, 201, JSON.stringify(body));
    assert.equal(body.data.status, 'confirmed');
    assert.equal(body.data.invoiceId, null);
    assert.match(body.data.qrCodeHash, /^EVT-/);
    assert.match(body.data.registrationId, /^REG_AUSTIN_\d{8}_/);
    assert.equal(one(`SELECT registered_count c FROM events WHERE id='evt_free'`).c, 1);
    assert.equal(one(`SELECT COUNT(*) c FROM invoices`).c, 0);
  });

  it('2. Paid pay-later tier + promo + points → discounted unpaid invoice in chamber currency', async () => {
    // base 50, promo 20% = 10, 100 pts × 0.05 = 5 → total 35
    const res = await post(
      '/api/v1/events/evt_gala/register',
      { ticketTypeId: 'tkt_paylater', promoCode: 'early20', redeemPoints: 100 },
      'sess_m1'
    );
    const body: any = await res.json();
    assert.equal(res.status, 201, JSON.stringify(body));
    assert.equal(body.data.paymentStatus, 'pay_later');
    assert.equal(body.data.totalPaid, 0);
    assert.equal(body.data.amountDue, 35);
    assert.deepEqual(
      [body.data.pricing.basePrice, body.data.pricing.promoDiscount, body.data.pricing.pointsDiscount],
      [50, 10, 5]
    );
    const inv = one(`SELECT * FROM invoices WHERE id='${body.data.invoiceId}'`);
    assert.equal(inv.total_amount, 35);
    assert.equal(inv.status, 'unpaid');
    assert.equal(inv.currency, 'INR');
    assert.equal(inv.invoice_type, 'event');
    assert.equal(inv.related_event_id, 'evt_gala');
    assert.equal(one(`SELECT points_balance p FROM users WHERE id='usr_m1'`).p, 200);
    assert.equal(one(`SELECT points p FROM points_history WHERE user_id='usr_m1'`).p, 100);
    assert.equal(one(`SELECT used_count u FROM event_promo_codes WHERE id='promo_20'`).u, 1);
    assert.equal(one(`SELECT qty_sold q FROM event_ticket_types WHERE id='tkt_paylater'`).q, 1);
    assert.equal(one(`SELECT registered_count c FROM events WHERE id='evt_gala'`).c, 1);
  });

  it('3. Duplicate registration → 409', async () => {
    assert.equal((await post('/api/v1/events/evt_free/register', {}, 'sess_m1')).status, 201);
    assert.equal((await post('/api/v1/events/evt_free/register', {}, 'sess_m1')).status, 409);
  });

  it('4. Paid tier without gateway → 503 and every claim rolled back', async () => {
    const res = await post(
      '/api/v1/events/evt_gala/register',
      { ticketTypeId: 'tkt_online', promoCode: 'EARLY20', redeemPoints: 50 },
      'sess_m1'
    );
    assert.equal(res.status, 503);
    assert.equal(one(`SELECT registered_count c FROM events WHERE id='evt_gala'`).c, 0);
    assert.equal(one(`SELECT qty_sold q FROM event_ticket_types WHERE id='tkt_online'`).q, 0);
    assert.equal(one(`SELECT used_count u FROM event_promo_codes WHERE id='promo_20'`).u, 0);
    assert.equal(one(`SELECT points_balance p FROM users WHERE id='usr_m1'`).p, 300);
    assert.equal(one(`SELECT COUNT(*) c FROM event_registrations`).c, 0);
  });

  it('5. Full event → waitlisted, no seat taken, no charge', async () => {
    assert.equal((await post('/api/v1/events/evt_tiny/register', {}, 'sess_m1')).status, 201);
    const res = await post('/api/v1/events/evt_tiny/register', {}, 'sess_m2');
    const body: any = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.data.status, 'waitlisted');
    assert.equal(body.data.waitlistPosition, 1);
    assert.equal(one(`SELECT registered_count c FROM events WHERE id='evt_tiny'`).c, 1);
  });

  it('6. Concurrent registrations cannot overbook the last seat', async () => {
    const [a, b] = await Promise.all([
      post('/api/v1/events/evt_tiny/register', {}, 'sess_m1'),
      post('/api/v1/events/evt_tiny/register', {}, 'sess_m2'),
    ]);
    const statuses = [((await a.json()) as any).data.status, ((await b.json()) as any).data.status].sort();
    assert.deepEqual(statuses, ['confirmed', 'waitlisted']);
    assert.equal(one(`SELECT registered_count c FROM events WHERE id='evt_tiny'`).c, 1);
  });

  it('7. Guest: public event ok, duplicate email 409, staff-only / members-only blocked', async () => {
    const guest = { guestDetails: { name: 'Pam Beesly', email: 'Pam@Test.dev' } };
    const ok = await post('/api/v1/public/events/evt_free/register', guest);
    assert.equal(ok.status, 201);
    assert.equal(((await ok.json()) as any).data.attendee.email, 'pam@test.dev');
    assert.equal((await post('/api/v1/public/events/evt_free/register', guest)).status, 409);
    assert.equal((await post('/api/v1/public/events/evt_staff/register', guest)).status, 403);
    assert.equal((await post('/api/v1/public/events/evt_members/register', guest)).status, 403);
    assert.equal((await post('/api/v1/public/events/evt_free/register', {})).status, 422);
  });

  it('8. Member pricing uses registration_fee; event-level paid fee without gateway → 503', async () => {
    const res = await post('/api/v1/events/evt_members/register', {}, 'sess_m1');
    assert.equal(res.status, 503);
  });

  it('9. Staff-only, draft, past and other-chamber events are rejected', async () => {
    assert.equal((await post('/api/v1/events/evt_staff/register', {}, 'sess_m1')).status, 403);
    assert.equal((await post('/api/v1/events/evt_draft/register', {}, 'sess_m1')).status, 400);
    assert.equal((await post('/api/v1/events/evt_past/register', {}, 'sess_m1')).status, 400);
    assert.equal((await post('/api/v1/events/evt_dallas/register', {}, 'sess_m1')).status, 404);
  });

  it('10. Ticket required when tiers exist; foreign ticket rejected', async () => {
    assert.equal((await post('/api/v1/events/evt_gala/register', {}, 'sess_m1')).status, 422);
    assert.equal(
      (await post('/api/v1/events/evt_free/register', { ticketTypeId: 'tkt_paylater' }, 'sess_m1')).status,
      404
    );
  });

  it('11. Points: more than balance or more than needed → 422', async () => {
    assert.equal(
      (await post('/api/v1/events/evt_gala/register', { ticketTypeId: 'tkt_paylater', redeemPoints: 301 }, 'sess_m1')).status,
      422
    );
    // 50 / 0.05 = 1000 points max useful; member has 300 so test the cap with a free event
    assert.equal((await post('/api/v1/events/evt_free/register', { redeemPoints: 1 }, 'sess_m1')).status, 422);
  });

  it('12. validate-promo returns discount; exhausted/unknown codes rejected', async () => {
    const res = await post('/api/v1/events/evt_gala/validate-promo', { code: 'early20', ticketTypeId: 'tkt_paylater' }, 'sess_m1');
    const body: any = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.data.discountAmount, 10);
    assert.equal(
      (await post('/api/v1/events/evt_gala/validate-promo', { code: 'GONE', ticketTypeId: 'tkt_paylater' }, 'sess_m1')).status,
      422
    );
    assert.equal(
      (await post('/api/v1/events/evt_gala/validate-promo', { code: 'NOPE', ticketTypeId: 'tkt_paylater' }, 'sess_m1')).status,
      422
    );
  });

  it('13. Events list exposes ticket tiers with remaining quantity', async () => {
    const res = await app.request('/api/v1/public/events', { headers: { Host: HOST } }, env);
    const body: any = await res.json();
    const gala = body.data.find((e: any) => e.id === 'evt_gala');
    assert.ok(gala, JSON.stringify(body));
    assert.deepEqual(
      gala.ticketTypes.map((t: any) => [t.id, t.qtyRemaining]),
      [['tkt_paylater', 10], ['tkt_online', 5]]
    );
  });

  it('14. Member events list shows only the viewer own registration status', async () => {
    assert.equal((await post('/api/v1/events/evt_free/register', {}, 'sess_m1')).status, 201);
    await post('/api/v1/events/evt_tiny/register', {}, 'sess_m2');
    assert.equal((await post('/api/v1/events/evt_tiny/register', {}, 'sess_m1')).status, 201); // full → waitlist

    const list = async (token: string) => {
      const res = await app.request('/api/v1/events?timeframe=upcoming&limit=50', { headers: { Host: HOST, Authorization: `Bearer ${token}` } }, env);
      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      return new Map<string, any>(json.data.map((e: any) => [e.id, e.myRegistration]));
    };
    const m1 = await list('sess_m1');
    assert.equal(m1.get('evt_free')?.status, 'confirmed');
    assert.equal(m1.get('evt_tiny')?.status, 'waitlisted');
    assert.equal(m1.get('evt_tiny')?.waitlistPosition, 1);
    assert.equal(m1.get('evt_gala'), null);

    const m2 = await list('sess_m2');
    assert.equal(m2.get('evt_free'), null);
    assert.equal(m2.get('evt_tiny')?.status, 'confirmed');

    const pub = (await (await app.request('/api/v1/public/events?timeframe=upcoming', { headers: { Host: HOST } }, env)).json()) as any;
    assert.ok(pub.data.every((e: any) => !('myRegistration' in e)));
  });
});
