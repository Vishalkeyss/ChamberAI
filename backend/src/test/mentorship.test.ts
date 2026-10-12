import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app';
import { createMigratedD1, createMockKV } from './helpers/sqlite-d1';

/**
 * Prompt 05.6 — Mentorship program.
 * Runs on the REAL migrations with foreign keys enforced.
 */
describe('Prompt 05.6: Mentorship', () => {
  const app = createApp();
  const CH = 'CHAM_AUSTIN';
  const OTHER = 'CHAM_DALLAS';
  const HOST = 'austin.121meet.ai';

  let d1: ReturnType<typeof createMigratedD1>;
  let kv: ReturnType<typeof createMockKV>;
  let env: any;

  async function session(token: string, userId: string, role = 'member', chamberId = CH, scope?: { type: string; id: string }) {
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
        roles: [{ roleId: role, scopeType: scope?.type || 'chamber', scopeId: scope?.id || chamberId }],
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
      INSERT INTO chapters (id, chamber_id, name) VALUES ('CHP_A', '${CH}', 'North'), ('CHP_B', '${CH}', 'South');
      INSERT INTO users (id, chamber_id, member_verification_token, email, name, highest_role, status, primary_chapter_id) VALUES
        ('usr_mentor', '${CH}', 't1', 'm@test.dev', 'Elena Mentor', 'member', 'active', 'CHP_A'),
        ('usr_a', '${CH}', 't2', 'a@test.dev', 'Mentee A', 'member', 'active', 'CHP_A'),
        ('usr_b', '${CH}', 't3', 'b@test.dev', 'Mentee B', 'member', 'active', 'CHP_B'),
        ('usr_admin', '${CH}', 't4', 'admin@test.dev', 'Admin', 'full_admin', 'active', NULL),
        ('usr_group', '${CH}', 't5', 'g@test.dev', 'Group Admin', 'group_admin', 'active', NULL),
        ('usr_chapter', '${CH}', 't6', 'c@test.dev', 'Chapter Admin', 'chapter_admin', 'active', NULL),
        ('usr_dallas', '${OTHER}', 't7', 'd@test.dev', 'Dallas Mentor', 'member', 'active', NULL);
    `);
    await session('s_mentor', 'usr_mentor');
    await session('s_a', 'usr_a');
    await session('s_b', 'usr_b');
    await session('s_admin', 'usr_admin', 'full_admin');
    await session('s_group', 'usr_group', 'group_admin', CH, { type: 'group', id: 'GRP_X' });
    await session('s_chapter', 'usr_chapter', 'chapter_admin', CH, { type: 'chapter', id: 'CHP_B' });
    await session('s_dallas', 'usr_dallas', 'member', OTHER);
  });

  const call = (method: string, path: string, body?: unknown, token?: string, host = HOST) =>
    app.request(
      path,
      {
        method,
        headers: { Host: host, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      },
      env
    );
  const json = async (res: Response) => ((await res.json()) as any);
  const one = (sql: string) => d1.sqlite.prepare(sql).get() as any;
  const MSG = 'I would love guidance on scaling our B2B sales team this year.';

  const becomeMentor = async (token: string, extra: Record<string, unknown> = {}) => {
    const res = await call('PUT', '/api/v1/mentorship/profile', {
      is_mentor: true,
      is_mentee: true,
      expertise_areas: ['Fundraising', 'B2B Sales'],
      years_of_experience: 15,
      bio: 'Helping founders grow.',
      max_mentees: 3,
      is_available: true,
      ...extra,
    }, token);
    assert.equal(res.status, 200);
    return (await json(res)).data;
  };
  const request = (token: string, mentorId = 'usr_mentor', message = MSG) =>
    call('POST', '/api/v1/mentorship/requests', { mentor_id: mentorId, request_message: message }, token);
  const review = (token: string, id: string, body: Record<string, unknown>) => call('PATCH', `/api/v1/mentorship/requests/${id}`, body, token);

  it('profile: register as mentor, listed in directory with filters; pausing hides the mentor', async () => {
    const profile = await becomeMentor('s_mentor');
    assert.equal(profile.is_mentor, true);
    assert.equal(profile.rating, null, 'OD-096: no rating before anyone rated');
    assert.equal(one(`SELECT status FROM mentorship_profiles WHERE user_id = 'usr_mentor'`).status, 'active');

    const list = await json(await call('GET', '/api/v1/mentorship/mentors', undefined, 's_a'));
    assert.equal(list.data.length, 1);
    assert.equal(list.data[0].name, 'Elena Mentor');
    assert.equal(list.data[0].is_available, true);
    assert.deepEqual(list.meta.filters.expertise, ['B2B Sales', 'Fundraising']);
    assert.equal((await json(await call('GET', '/api/v1/mentorship/mentors?expertise=fundraising', undefined, 's_a'))).data.length, 1);
    assert.equal((await json(await call('GET', '/api/v1/mentorship/mentors?expertise=Legal', undefined, 's_a'))).data.length, 0);
    assert.equal((await json(await call('GET', '/api/v1/mentorship/mentors?search=elena', undefined, 's_a'))).data.length, 1);
    assert.equal((await json(await call('GET', '/api/v1/mentorship/mentors?search=%25', undefined, 's_a'))).data.length, 0, 'LIKE escaped');
    // Own profile is not in your directory.
    assert.equal((await json(await call('GET', '/api/v1/mentorship/mentors', undefined, 's_mentor'))).data.length, 0);

    await becomeMentor('s_mentor', { is_available: false });
    assert.equal(one(`SELECT status FROM mentorship_profiles WHERE user_id = 'usr_mentor'`).status, 'paused');
    assert.equal((await json(await call('GET', '/api/v1/mentorship/mentors', undefined, 's_a'))).data.length, 0);
    await becomeMentor('s_mentor', { is_mentor: false });
    assert.equal(one(`SELECT status FROM mentorship_profiles WHERE user_id = 'usr_mentor'`).status, 'inactive');
    assert.equal((await request('s_a')).status, 404);
  });

  it('spec test 1: capacity — mentor with max_mentees = 1 accepts one, further requests fail', async () => {
    await becomeMentor('s_mentor', { max_mentees: 1 });
    const ra = await json(await request('s_a'));
    const rb = await json(await request('s_b'));
    assert.equal(ra.data.status, 'pending');

    const accepted = await review('s_mentor', ra.data.id, { action: 'accept' });
    assert.equal(accepted.status, 200);
    assert.equal((await json(accepted)).data.status, 'accepted');
    assert.equal(one(`SELECT active_mentees FROM mentorship_profiles WHERE user_id = 'usr_mentor'`).active_mentees, 1);
    assert.equal(one(`SELECT status, accepted_at FROM mentorship WHERE id = '${ra.data.id}'`).status, 'confirmed');

    // Accepting the second pending request now fails, counter unchanged.
    const second = await review('s_mentor', rb.data.id, { action: 'accept' });
    assert.equal(second.status, 409);
    assert.equal((await json(second)).error.message, 'This mentor has reached maximum capacity.');
    assert.equal(one(`SELECT status FROM mentorship WHERE id = '${rb.data.id}'`).status, 'pending');
    assert.equal(one(`SELECT active_mentees FROM mentorship_profiles WHERE user_id = 'usr_mentor'`).active_mentees, 1);

    // New requests are refused too.
    await call('PATCH', `/api/v1/mentorship/requests/${rb.data.id}`, { action: 'cancel' }, 's_b');
    assert.equal((await request('s_b')).status, 409);
    const listed = await json(await call('GET', '/api/v1/mentorship/mentors', undefined, 's_b'));
    assert.equal(listed.data[0].is_available, false);
    assert.equal(one(`SELECT count(*) AS n FROM activity_logs WHERE action = 'MENTORSHIP_ACCEPTED'`).n, 1);
    assert.equal(one(`SELECT count(*) AS n FROM notifications WHERE user_id = 'usr_a' AND type = 'mentorship_accepted'`).n, 1);
  });

  it('spec test 2: duplicate pending request → 400 (also when sent concurrently)', async () => {
    await becomeMentor('s_mentor');
    assert.equal((await request('s_a')).status, 201);
    assert.equal((await request('s_a')).status, 400);
    const [x, y] = await Promise.all([request('s_b'), request('s_b')]);
    assert.deepEqual([x.status, y.status].sort(), [201, 400]);
    assert.equal(one(`SELECT count(*) AS n FROM mentorship WHERE mentee_id = 'usr_b'`).n, 1);
    assert.equal(one(`SELECT count(*) AS n FROM notifications WHERE user_id = 'usr_mentor' AND type = 'mentorship_request'`).n, 2);
    assert.equal(one(`SELECT count(*) AS n FROM activity_logs WHERE action = 'MENTORSHIP_REQUESTED'`).n, 2);
  });

  it('spec test 3: completing decrements active_mentees; mentee rating updates the average', async () => {
    await becomeMentor('s_mentor');
    const r = (await json(await request('s_a'))).data;
    await review('s_mentor', r.id, { action: 'accept' });
    assert.equal(one(`SELECT active_mentees FROM mentorship_profiles WHERE user_id = 'usr_mentor'`).active_mentees, 1);

    assert.equal((await review('s_mentor', r.id, { action: 'complete', rating: 5 })).status, 400, 'mentor cannot rate');
    const done = await review('s_a', r.id, { action: 'complete', rating: 4 });
    assert.equal(done.status, 200);
    const p = one(`SELECT active_mentees, rating, rating_count FROM mentorship_profiles WHERE user_id = 'usr_mentor'`);
    assert.deepEqual([p.active_mentees, p.rating, p.rating_count], [0, 4, 1]);
    assert.ok(one(`SELECT completed_at FROM mentorship WHERE id = '${r.id}'`).completed_at);
    assert.equal((await review('s_a', r.id, { action: 'complete' })).status, 409, 'already completed');
    assert.equal(one(`SELECT active_mentees FROM mentorship_profiles WHERE user_id = 'usr_mentor'`).active_mentees, 0);
    assert.equal(one(`SELECT count(*) AS n FROM activity_logs WHERE action = 'MENTORSHIP_COMPLETED'`).n, 1);
    // Pair may start again after completion.
    assert.equal((await request('s_a')).status, 201);
  });

  it('spec test 4: cross-tenant — a Dallas mentor cannot be requested from Austin (403)', async () => {
    d1.exec(`INSERT INTO mentorship_profiles (id, chamber_id, user_id, expertise_json, status) VALUES ('MENP_D', '${OTHER}', 'usr_dallas', '["Legal"]', 'active')`);
    assert.equal((await request('s_a', 'usr_dallas')).status, 403);
    assert.equal((await json(await call('GET', '/api/v1/mentorship/mentors', undefined, 's_a'))).data.length, 0);
    // A Dallas session on the Austin host is rejected by the auth middleware (session / chamber mismatch).
    assert.equal((await call('GET', '/api/v1/mentorship/mentors', undefined, 's_dallas')).status, 401);
    assert.equal(one(`SELECT count(*) AS n FROM mentorship`).n, 0);
  });

  it('permissions: only the mentor accepts / declines, only the mentee cancels, outsiders get 404', async () => {
    await becomeMentor('s_mentor');
    const r = (await json(await request('s_a'))).data;
    assert.equal((await review('s_a', r.id, { action: 'accept' })).status, 403);
    assert.equal((await review('s_mentor', r.id, { action: 'cancel' })).status, 403);
    assert.equal((await review('s_b', r.id, { action: 'decline' })).status, 404);
    assert.equal((await call('PATCH', `/api/v1/mentorship/connections/${r.id}/notes`, { notes: 'x' }, 's_b')).status, 404);

    const declined = await review('s_mentor', r.id, { action: 'decline', decline_reason: 'Fully committed this quarter' });
    assert.equal(declined.status, 200);
    const row = one(`SELECT status, decline_reason FROM mentorship WHERE id = '${r.id}'`);
    assert.deepEqual([row.status, row.decline_reason], ['rejected', 'Fully committed this quarter']);
    assert.equal((await review('s_mentor', r.id, { action: 'accept' })).status, 409);

    const conn = await json(await call('GET', '/api/v1/mentorship/connections', undefined, 's_a'));
    assert.equal(conn.data.connections[0].status, 'declined');
    assert.equal(conn.data.connections[0].role, 'mentee');
    assert.equal(conn.data.connections[0].partner.name, 'Elena Mentor');

    // Withdraw a new pending request.
    const r2 = (await json(await request('s_a'))).data;
    assert.equal((await review('s_a', r2.id, { action: 'cancel' })).status, 200);
    assert.ok(one(`SELECT cancelled_at FROM mentorship WHERE id = '${r2.id}'`).cancelled_at);
  });

  it('notes on active mentorship; validation; self-request; roles (group/billing admin denied)', async () => {
    await becomeMentor('s_mentor');
    assert.equal((await request('s_a', 'usr_mentor', 'too short')).status, 422);
    assert.equal((await request('s_mentor', 'usr_mentor')).status, 400);
    const r = (await json(await request('s_a'))).data;
    assert.equal((await call('PATCH', `/api/v1/mentorship/connections/${r.id}/notes`, { notes: 'Goals' }, 's_a')).status, 409);
    await review('s_mentor', r.id, { action: 'accept' });
    assert.equal((await call('PATCH', `/api/v1/mentorship/connections/${r.id}/notes`, { notes: 'Goal: 3 enterprise deals' }, 's_a')).status, 200);
    assert.equal(one(`SELECT notes FROM mentorship WHERE id = '${r.id}'`).notes, 'Goal: 3 enterprise deals');

    const bad = await call('PUT', '/api/v1/mentorship/profile', { is_mentor: true, expertise_areas: [], years_of_experience: 5 }, 's_b');
    assert.equal(bad.status, 422);
    const tooMany = await call('PUT', '/api/v1/mentorship/profile', { is_mentor: true, expertise_areas: Array.from({ length: 11 }, (_, i) => `Tag ${i}`), years_of_experience: 5 }, 's_b');
    assert.equal(tooMany.status, 422);

    // OD-099
    assert.equal((await call('GET', '/api/v1/mentorship/mentors', undefined, 's_group')).status, 403);
    assert.equal((await call('GET', '/api/v1/mentorship/mentors', undefined, 's_admin')).status, 200);
    assert.equal((await call('GET', '/api/v1/mentorship/mentors')).status, 401);
  });

  it('admin overview: full_admin chamber-wide, chapter_admin own chapter only; moderation full_admin only', async () => {
    await becomeMentor('s_mentor');
    const ra = (await json(await request('s_a'))).data; // CHP_A pair
    await review('s_mentor', ra.id, { action: 'accept' });
    await request('s_b'); // mentee in CHP_B

    const full = await json(await call('GET', '/api/v1/admin/mentorship/overview', undefined, 's_admin'));
    assert.equal(full.data.kpis.mentors, 1);
    assert.equal(full.data.kpis.active_pairs, 1);
    assert.equal(full.data.kpis.pending_requests, 1);
    assert.equal(full.data.pairs.length, 2);

    const chapter = await json(await call('GET', '/api/v1/admin/mentorship/overview', undefined, 's_chapter'));
    assert.equal(chapter.data.scope, 'chapter');
    assert.equal(chapter.data.pairs.length, 1);
    assert.equal(chapter.data.pairs[0].mentee.name, 'Mentee B');
    assert.equal(chapter.data.kpis.mentors, 0, 'mentor belongs to CHP_A');

    assert.equal((await call('GET', '/api/v1/admin/mentorship/overview', undefined, 's_a')).status, 403);
    assert.equal((await call('PATCH', '/api/v1/admin/mentorship/mentors/usr_mentor', { status: 'paused' }, 's_chapter')).status, 403);
    assert.equal((await call('PATCH', '/api/v1/admin/mentorship/mentors/usr_mentor', { status: 'paused' }, 's_admin')).status, 200);
    assert.equal(one(`SELECT status FROM mentorship_profiles WHERE user_id = 'usr_mentor'`).status, 'paused');
    // Paused mentor cannot accept pending requests (OD-104).
    const pendingB = one(`SELECT id FROM mentorship WHERE mentee_id = 'usr_b' AND status = 'pending'`).id;
    const res = await review('s_mentor', pendingB, { action: 'accept' });
    assert.equal(res.status, 409);
    assert.equal((await review('s_mentor', pendingB, { action: 'decline' })).status, 200);
  });
});
