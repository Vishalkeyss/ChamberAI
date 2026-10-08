import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app';
import { createMigratedD1, createMockKV } from './helpers/sqlite-d1';

/**
 * Prompt 04.5 — Post-event feedback & attendance certificates.
 * Runs on the REAL migrations with foreign keys enforced.
 */
describe('Prompt 04.5: Event Feedback & Certificates', () => {
  const app = createApp();
  const CH = 'CHAM_AUSTIN';
  const OTHER = 'CHAM_DALLAS';
  const HOST = 'austin.121meet.ai';
  const past = new Date(Date.now() - 3 * 86400000).toISOString();

  let d1: ReturnType<typeof createMigratedD1>;
  let kv: ReturnType<typeof createMockKV>;
  let env: any;

  async function session(token: string, userId: string, chamberId = CH) {
    await kv.put(
      `session:${token}`,
      JSON.stringify({
        userId,
        chamberId,
        email: `${userId}@test.dev`,
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: null,
        highestRole: 'member',
        roles: [{ roleId: 'member', scopeType: 'chamber', scopeId: chamberId }],
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
      INSERT INTO chamber_settings (id, chamber_id, org_name, timezone, logo_url) VALUES
        ('CSET_AUSTIN', '${CH}', 'Austin <Chamber> & Co', 'America/Chicago', '/api/v1/public/assets/logo.png');
      INSERT INTO users (id, chamber_id, member_verification_token, email, name, highest_role, status, points_balance) VALUES
        ('usr_in', '${CH}', 't1', 'in@test.dev', 'Checked <In>', 'member', 'active', 10),
        ('usr_out', '${CH}', 't2', 'out@test.dev', 'Not Checked', 'member', 'active', 0);
      INSERT INTO events (id, chamber_id, title, event_date, status, visibility) VALUES
        ('evt_done', '${CH}', 'AI Summit', '${past}', 'published', 'public'),
        ('evt_dallas', '${OTHER}', 'Dallas Meetup', '${past}', 'published', 'public');
      INSERT INTO event_registrations (id, chamber_id, event_id, user_id, registration_type, check_in_status) VALUES
        ('REG_AUSTIN_20261001_AB12', '${CH}', 'evt_done', 'usr_in', 'member', 'checked_in'),
        ('REG_AUSTIN_20261001_CD34', '${CH}', 'evt_done', 'usr_out', 'member', 'not_checked_in');
    `);
    await session('sess_in', 'usr_in');
    await session('sess_out', 'usr_out');
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
  const review = { starRating: 5, wouldAttendAgain: true, likedMost: 'Keynote', suggestions: 'More Q&A' };

  it('1. Checked-in attendee submits feedback → 201, +25 points with ledger row', async () => {
    const res = await call('POST', '/api/v1/events/evt_done/feedback', review, 'sess_in');
    assert.equal(res.status, 201);
    const { data } = (await res.json()) as any;
    assert.equal(data.pointsAwarded, 25);
    const fb = one(`SELECT * FROM event_feedback WHERE id = '${data.feedbackId}'`);
    assert.equal(fb.star_rating, 5);
    assert.equal(fb.would_attend_again, 1);
    assert.equal(fb.chamber_id, CH);
    assert.equal(one(`SELECT points_balance AS p FROM users WHERE id = 'usr_in'`).p, 35);
    const ledger = one(`SELECT * FROM points_history WHERE user_id = 'usr_in'`);
    assert.equal(ledger.points, 25);
    assert.equal(ledger.type, 'earned');
    assert.equal(ledger.related_event_id, 'evt_done');
  });

  it('2. Not checked in → 403 for feedback and certificate', async () => {
    assert.equal((await call('POST', '/api/v1/events/evt_done/feedback', review, 'sess_out')).status, 403);
    assert.equal((await call('GET', '/api/v1/events/evt_done/certificate', undefined, 'sess_out')).status, 403);
    assert.equal(one(`SELECT count(*) AS n FROM event_feedback`).n, 0);
  });

  it('3. Second submission → 409 (also when concurrent), points awarded once', async () => {
    const [a, b] = await Promise.all([
      call('POST', '/api/v1/events/evt_done/feedback', review, 'sess_in'),
      call('POST', '/api/v1/events/evt_done/feedback', review, 'sess_in'),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    assert.equal((await call('POST', '/api/v1/events/evt_done/feedback', review, 'sess_in')).status, 409);
    assert.equal(one(`SELECT count(*) AS n FROM event_feedback`).n, 1);
    assert.equal(one(`SELECT points_balance AS p FROM users WHERE id = 'usr_in'`).p, 35);
  });

  it('4. Validation: star rating 1–5 required', async () => {
    assert.equal((await call('POST', '/api/v1/events/evt_done/feedback', { starRating: 6 }, 'sess_in')).status, 422);
    assert.equal((await call('POST', '/api/v1/events/evt_done/feedback', {}, 'sess_in')).status, 422);
  });

  it('5. Low rating is logged for follow-up', async () => {
    await call('POST', '/api/v1/events/evt_done/feedback', { starRating: 2 }, 'sess_in');
    assert.ok(one(`SELECT id FROM activity_logs WHERE action = 'event.feedback_low_rating' AND target_id = 'evt_done'`));
  });

  it('6. Certificate: escaped attendee name, event, chamber, derived certificate id', async () => {
    const res = await call('GET', '/api/v1/events/evt_done/certificate', undefined, 'sess_in');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/html/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    const html = await res.text();
    assert.ok(html.includes('Checked &lt;In&gt;'));
    assert.ok(!html.includes('Checked <In>'));
    assert.ok(html.includes('AI Summit'));
    assert.ok(html.includes('Austin &lt;Chamber&gt; &amp; Co'));
    assert.ok(html.includes('CERT_AUSTIN_20261001_AB12'));
    assert.ok(html.includes('/api/v1/public/assets/logo.png'));
  });

  it('7. Attendance state + tenant isolation', async () => {
    const mine = (await (await call('GET', '/api/v1/events/evt_done/attendance', undefined, 'sess_in')).json()) as any;
    assert.deepEqual(
      { checkedIn: mine.data.checkedIn, feedbackSubmitted: mine.data.feedbackSubmitted },
      { checkedIn: true, feedbackSubmitted: false }
    );
    assert.equal((await call('GET', '/api/v1/events/evt_dallas/attendance', undefined, 'sess_in')).status, 404);
    assert.equal((await call('POST', '/api/v1/events/evt_dallas/feedback', review, 'sess_in')).status, 404);
    assert.equal((await call('GET', '/api/v1/events/evt_done/certificate')).status, 401);
  });
});
