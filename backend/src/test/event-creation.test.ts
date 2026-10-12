import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app';
import { createMigratedD1, createMockKV } from './helpers/sqlite-d1';
import { generateRecurrenceDates } from '../modules/events/services/recurrence';

/**
 * Prompt 04.6 — Admin event creation wizard API (real migrations, FKs enforced).
 */
describe('Prompt 04.6: Admin Event Creation, Recurrence & Editing', () => {
  const app = createApp();
  const CH = 'CHAM_AUSTIN';
  const OTHER = 'CHAM_DALLAS';
  const HOST = 'austin.121meet.ai';
  const inDays = (n: number, hour = 15) => {
    const d = new Date(Date.now() + n * 86400000);
    d.setUTCHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  let d1: ReturnType<typeof createMigratedD1>;
  let kv: ReturnType<typeof createMockKV>;
  let env: any;

  async function session(token: string, userId: string, roles: Array<[string, string, string]>) {
    await kv.put(
      `session:${token}`,
      JSON.stringify({
        userId,
        chamberId: CH,
        email: `${userId}@test.dev`,
        firstName: 'T',
        lastName: 'U',
        avatarUrl: null,
        highestRole: roles[0][0],
        roles: roles.map(([roleId, scopeType, scopeId]) => ({ roleId, scopeType, scopeId })),
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
      INSERT INTO platform_chambers (id, name, subdomain, city, status) VALUES
        ('${CH}', 'Austin', 'austin', 'Austin', 'active'), ('${OTHER}', 'Dallas', 'dallas', 'Dallas', 'active');
      INSERT INTO chapters (id, chamber_id, name, status) VALUES
        ('chap_dt', '${CH}', 'Downtown', 'active'), ('chap_n', '${CH}', 'North', 'active'), ('chap_dal', '${OTHER}', 'Dallas DT', 'active');
      INSERT INTO groups (id, chamber_id, name) VALUES ('grp_yp', '${CH}', 'Young Professionals');
      INSERT INTO users (id, chamber_id, member_verification_token, email, name, highest_role, status) VALUES
        ('usr_full', '${CH}', 't1', 'full@test.dev', 'Full Admin', 'full_admin', 'active'),
        ('usr_chap', '${CH}', 't2', 'chap@test.dev', 'Chapter Admin', 'chapter_admin', 'active'),
        ('usr_grp', '${CH}', 't3', 'grp@test.dev', 'Group Admin', 'group_admin', 'active'),
        ('usr_bill', '${CH}', 't4', 'bill@test.dev', 'Billing Admin', 'billing_admin', 'active'),
        ('usr_mem', '${CH}', 't5', 'mem@test.dev', 'Member', 'member', 'active');
    `);
    await session('s_full', 'usr_full', [['full_admin', 'chamber', CH]]);
    await session('s_chap', 'usr_chap', [['chapter_admin', 'chapter', 'chap_dt']]);
    await session('s_grp', 'usr_grp', [['group_admin', 'group', 'grp_yp']]);
    await session('s_bill', 'usr_bill', [['billing_admin', 'chamber', CH]]);
    await session('s_mem', 'usr_mem', [['member', 'chamber', CH]]);
  });

  const call = (method: string, path: string, token: string, body?: unknown) =>
    app.request(
      path,
      {
        method,
        headers: { Host: HOST, 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      },
      env
    );
  const rows = (sql: string) => d1.sqlite.prepare(sql).all() as any[];
  const one = (sql: string) => d1.sqlite.prepare(sql).get() as any;

  const baseEvent = (over: Record<string, unknown> = {}) => ({
    title: 'Spring Networking Breakfast',
    category: 'Networking Mixer',
    visibility: 'public',
    eventDate: inDays(10, 14),
    eventEndDate: inDays(10, 16),
    city: 'Austin',
    venue: 'The Capital Grille',
    chapterId: 'chap_dt',
    groupId: 'grp_yp',
    tableArrangement: 'Round Tables (Banquet)',
    numTables: 8,
    maxCapacity: 80,
    isPaid: true,
    registrationFee: 0,
    allowNonMemberRegistration: true,
    ticketTypes: [
      { name: 'Member Registration', price: 0, qtyLimit: 50 },
      { name: 'Non-Member Guest', price: 25, allowPayLater: true, qtyLimit: 30 },
    ],
    sponsorshipTiers: [{ tierName: 'Breakfast Sponsor', amount: 500, benefits: ['Podium mention', '2 Free tickets'] }],
    promoCodes: [{ code: 'early20', discountType: 'percentage', discountValue: 20 }],
    ...over,
  });

  it('1. Full admin creates event with tiers, sponsorship & promo atomically (§17.2)', async () => {
    const res = await call('POST', '/api/v1/admin/events', 's_full', baseEvent());
    const body: any = await res.json();
    assert.equal(res.status, 201, JSON.stringify(body));
    const id = body.data.id;
    assert.match(id, /^EVT_AUSTIN_\d{8}_/);
    assert.equal(body.data.status, 'published');
    const ev = one(`SELECT * FROM events WHERE id='${id}'`);
    assert.equal(ev.chapter_id, 'chap_dt');
    assert.equal(ev.group_id, 'grp_yp');
    assert.equal(ev.num_tables, 8);
    assert.equal(ev.created_by, 'usr_full');
    assert.equal(rows(`SELECT * FROM event_ticket_types WHERE event_id='${id}'`).length, 2);
    assert.deepEqual(JSON.parse(one(`SELECT benefits FROM event_sponsorship_tiers WHERE event_id='${id}'`).benefits), [
      'Podium mention',
      '2 Free tickets',
    ]);
    assert.equal(one(`SELECT code FROM event_promo_codes WHERE event_id='${id}'`).code, 'EARLY20');
    assert.equal(one(`SELECT action FROM activity_logs WHERE target_id='${id}'`).action, 'event.created');
  });

  it('2. Chapter admin: other chapter → 403 (§17.1); omitted chapter is locked to their own', async () => {
    assert.equal((await call('POST', '/api/v1/admin/events', 's_chap', baseEvent({ chapterId: 'chap_n' }))).status, 403);
    const res = await call('POST', '/api/v1/admin/events', 's_chap', baseEvent({ chapterId: null }));
    const body: any = await res.json();
    assert.equal(res.status, 201, JSON.stringify(body));
    assert.equal(one(`SELECT chapter_id c FROM events WHERE id='${body.data.id}'`).c, 'chap_dt');
  });

  it('3. Group admin, billing admin and members cannot create events', async () => {
    assert.equal((await call('POST', '/api/v1/admin/events', 's_grp', baseEvent())).status, 403);
    assert.equal((await call('POST', '/api/v1/admin/events', 's_bill', baseEvent())).status, 403);
    assert.equal((await call('POST', '/api/v1/admin/events', 's_mem', baseEvent())).status, 403);
  });

  it('4. Weekly recurrence creates linked occurrences, each with its own tiers', async () => {
    const res = await call(
      'POST',
      '/api/v1/admin/events',
      's_full',
      baseEvent({ recurrence: { freq: 'weekly', interval: 1, weekdays: [new Date(inDays(10, 14)).getUTCDay()], endType: 'after', count: 4 } })
    );
    const body: any = await res.json();
    assert.equal(res.status, 201, JSON.stringify(body));
    assert.equal(body.data.occurrenceIds.length, 4);
    const series = rows(`SELECT id, parent_event_id p, event_date d, is_recurring r FROM events ORDER BY event_date`);
    assert.equal(series.length, 4);
    assert.equal(series[0].p, null);
    assert.ok(series.slice(1).every((e) => e.p === series[0].id && e.r === 1));
    const gaps = series.slice(1).map((e, i) => (Date.parse(e.d) - Date.parse(series[i].d)) / 86400000);
    assert.deepEqual(gaps, [7, 7, 7]);
    assert.equal(one(`SELECT COUNT(*) c FROM event_ticket_types`).c, 8);
  });

  it('5. Recurrence engine: monthly until a date, local weekday preserved across UTC midnight', () => {
    const start = new Date('2026-01-15T10:00:00Z');
    const monthly = generateRecurrenceDates(start, {
      freq: 'monthly', interval: 1, weekdays: [], endType: 'on', until: '2026-04-20T00:00:00Z', tzOffsetMinutes: 0,
    } as any);
    assert.deepEqual(monthly.map((d) => d.toISOString().slice(0, 10)), ['2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15']);
    // 7pm Tuesday in UTC-6 is 01:00 UTC Wednesday — must stay "Tuesday" for the admin.
    const tue = generateRecurrenceDates(new Date('2026-01-07T01:00:00Z'), {
      freq: 'weekly', interval: 1, weekdays: [2], endType: 'after', count: 3, tzOffsetMinutes: 360,
    } as any);
    assert.deepEqual(tue.map((d) => d.toISOString()), [
      '2026-01-07T01:00:00.000Z', '2026-01-14T01:00:00.000Z', '2026-01-21T01:00:00.000Z',
    ]);
    const capped = generateRecurrenceDates(start, { freq: 'daily', interval: 1, weekdays: [], endType: 'after', count: 500 } as any);
    assert.equal(capped.length, 52);
  });

  it('6. Validation: paid without price, free with promo, dup codes, foreign photo, bad dates, foreign chapter', async () => {
    const bad = async (over: Record<string, unknown>, status = 422) =>
      assert.equal((await call('POST', '/api/v1/admin/events', 's_full', baseEvent(over))).status, status, JSON.stringify(over));
    await bad({ ticketTypes: [{ name: 'A', price: 0 }], registrationFee: 0 });
    await bad({ isPaid: false, ticketTypes: [], promoCodes: [{ code: 'X1', discountType: 'flat', discountValue: 5 }] });
    await bad({ promoCodes: [{ code: 'aa', discountType: 'flat', discountValue: 5 }, { code: 'AA', discountType: 'flat', discountValue: 5 }] });
    await bad({ photos: ['https://evil.example/x.png'] });
    await bad({ eventEndDate: inDays(9) });
    await bad({ chapterId: 'chap_dal' }, 404);
    assert.equal(one(`SELECT COUNT(*) c FROM events`).c, 0);
  });

  it('7. Edit single occurrence: tiers synced; sold tier protected; used promo deactivated; capacity guard', async () => {
    const id = ((await (await call('POST', '/api/v1/admin/events', 's_full', baseEvent())).json()) as any).data.id;
    const edit: any = ((await (await call('GET', `/api/v1/admin/events/${id}`, 's_full')).json()) as any).data;
    const guest = edit.ticketTypes.find((t: any) => t.name === 'Non-Member Guest');
    d1.exec(`UPDATE event_ticket_types SET qty_sold = 3 WHERE id='${guest.id}';
             UPDATE event_promo_codes SET used_count = 1 WHERE event_id='${id}';
             UPDATE events SET registered_count = 5 WHERE id='${id}';`);

    const keepAll = { ...edit, ticketTypes: edit.ticketTypes, promoCodes: [] };
    // Removing a tier with sales → 409
    let res = await call('PUT', `/api/v1/admin/events/${id}`, 's_full', { ...keepAll, registrationFee: 10, ticketTypes: [edit.ticketTypes[0]] });
    assert.equal(res.status, 409);
    // Capacity below registrations → 422
    res = await call('PUT', `/api/v1/admin/events/${id}`, 's_full', { ...keepAll, maxCapacity: 4 });
    assert.equal(res.status, 422);

    res = await call('PUT', `/api/v1/admin/events/${id}`, 's_full', {
      ...keepAll,
      title: 'Spring Breakfast (Updated)',
      ticketTypes: [{ ...guest, name: 'Guest', price: 30 }, { name: 'VIP', price: 75 }],
    });
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    const tiers = rows(`SELECT name, price, qty_sold FROM event_ticket_types WHERE event_id='${id}' ORDER BY name`);
    assert.deepEqual(tiers.map((t) => [t.name, t.price, t.qty_sold]), [['Guest', 30, 3], ['VIP', 75, 0]]);
    assert.equal(one(`SELECT is_active a FROM event_promo_codes WHERE event_id='${id}'`).a, 0);
    assert.equal(one(`SELECT title FROM events WHERE id='${id}'`).title, 'Spring Breakfast (Updated)');
  });

  it('8. Apply to series: fields & renamed tiers propagate, each occurrence keeps its date', async () => {
    const created: any = await (
      await call('POST', '/api/v1/admin/events', 's_full', baseEvent({ recurrence: { freq: 'daily', interval: 7, endType: 'after', count: 3 } }))
    ).json();
    const [first, second] = created.data.occurrenceIds;
    const datesBefore = rows(`SELECT id, event_date FROM events ORDER BY event_date`);
    const edit: any = ((await (await call('GET', `/api/v1/admin/events/${second}`, 's_full')).json()) as any).data;
    assert.equal(edit.series.total, 3);
    const res = await call('PUT', `/api/v1/admin/events/${second}`, 's_full', {
      ...edit,
      applyToSeries: true,
      venue: 'New Venue',
      ticketTypes: edit.ticketTypes.map((t: any) => (t.name === 'Member Registration' ? { ...t, name: 'Members' } : t)),
    });
    const body: any = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.data.updatedOccurrences, 3);
    assert.equal(one(`SELECT COUNT(*) c FROM events WHERE venue='New Venue'`).c, 3);
    assert.equal(one(`SELECT COUNT(*) c FROM event_ticket_types WHERE name='Members'`).c, 3);
    assert.equal(one(`SELECT COUNT(*) c FROM event_ticket_types`).c, 6);
    assert.deepEqual(rows(`SELECT id, event_date FROM events ORDER BY event_date`), datesBefore);
    assert.ok(first);
  });

  it('9. Delete: no registrations → deleted (series re-rooted); with registrations → cancelled', async () => {
    const created: any = await (
      await call('POST', '/api/v1/admin/events', 's_full', baseEvent({ recurrence: { freq: 'daily', interval: 1, endType: 'after', count: 3 } }))
    ).json();
    const [root, b, c] = created.data.occurrenceIds;
    let res = await call('DELETE', `/api/v1/admin/events/${root}`, 's_full');
    assert.equal(((await res.json()) as any).data.deleted, true);
    assert.equal(one(`SELECT parent_event_id p FROM events WHERE id='${b}'`).p, null);
    assert.equal(one(`SELECT parent_event_id p FROM events WHERE id='${c}'`).p, b);

    d1.exec(`INSERT INTO event_registrations (id, chamber_id, event_id, guest_name, guest_email, registration_type)
             VALUES ('REG_X', '${CH}', '${c}', 'G', 'g@test.dev', 'guest');`);
    res = await call('DELETE', `/api/v1/admin/events/${c}`, 's_full');
    assert.equal(((await res.json()) as any).data.status, 'cancelled');
    assert.equal(one(`SELECT status FROM events WHERE id='${c}'`).status, 'cancelled');
    assert.equal(one(`SELECT COUNT(*) n FROM event_registrations`).n, 1);
  });

  it('10. Scoping on read/edit/delete: chapter admin limited to own chapter; cross-chamber 404', async () => {
    const id = ((await (await call('POST', '/api/v1/admin/events', 's_full', baseEvent({ chapterId: 'chap_n' }))).json()) as any).data.id;
    assert.equal((await call('GET', `/api/v1/admin/events/${id}`, 's_chap')).status, 403);
    assert.equal((await call('DELETE', `/api/v1/admin/events/${id}`, 's_chap')).status, 403);
    assert.equal((await call('GET', `/api/v1/admin/events/${id}`, 's_grp')).status, 403);
    d1.exec(`INSERT INTO events (id, chamber_id, title, event_date, status) VALUES ('evt_dal', '${OTHER}', 'Dallas', '${inDays(5)}', 'published');`);
    assert.equal((await call('GET', `/api/v1/admin/events/evt_dal`, 's_full')).status, 404);
    assert.equal((await call('DELETE', `/api/v1/admin/events/evt_dal`, 's_full')).status, 404);
  });

  it('11. Form options are dynamic and chapter-scoped', async () => {
    d1.exec(`INSERT INTO events (id, chamber_id, title, event_date, category, city) VALUES ('evt_old', '${CH}', 'Old', '${inDays(-5)}', 'Gala Dinner', 'Round Rock');`);
    const full: any = ((await (await call('GET', '/api/v1/admin/events/form-options', 's_full')).json()) as any).data;
    assert.deepEqual(full.chapters.map((c: any) => c.id).sort(), ['chap_dt', 'chap_n']);
    assert.deepEqual(full.categories, ['Gala Dinner']);
    assert.deepEqual(full.cities.sort(), ['Austin', 'Round Rock']);
    assert.equal(full.lockedChapterId, null);
    const chap: any = ((await (await call('GET', '/api/v1/admin/events/form-options', 's_chap')).json()) as any).data;
    assert.deepEqual(chap.chapters.map((c: any) => c.id), ['chap_dt']);
    assert.equal(chap.lockedChapterId, 'chap_dt');
  });

  it('12. Created event is registrable through 04.3 with its pay-later tier', async () => {
    const id = ((await (await call('POST', '/api/v1/admin/events', 's_full', baseEvent())).json()) as any).data.id;
    const tier = one(`SELECT id FROM event_ticket_types WHERE event_id='${id}' AND name='Non-Member Guest'`).id;
    const res = await app.request(
      `/api/v1/public/events/${id}/register`,
      {
        method: 'POST',
        headers: { Host: HOST, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketTypeId: tier, guestDetails: { name: 'Pam B', email: 'pam@test.dev' } }),
      },
      env
    );
    const body: any = await res.json();
    assert.equal(res.status, 201, JSON.stringify(body));
    assert.equal(body.data.paymentStatus, 'pay_later');
  });
});
