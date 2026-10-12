import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app';
import { createMigratedD1, createMockKV } from './helpers/sqlite-d1';

/**
 * Prompt 05.2 — Member direct messaging.
 * Runs on the REAL migrations with foreign keys enforced.
 */
describe('Prompt 05.2: Direct Messaging', () => {
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
      INSERT INTO users (id, chamber_id, member_verification_token, email, name, highest_role, status) VALUES
        ('usr_sarah', '${CH}', 't1', 'sarah@test.dev', 'Sarah Lee', 'member', 'active'),
        ('usr_mike', '${CH}', 't2', 'mike@test.dev', 'Mike Scott', 'member', 'active'),
        ('usr_pam', '${CH}', 't3', 'pam@test.dev', 'Pam Beesly', 'member', 'active'),
        ('usr_gone', '${CH}', 't4', 'gone@test.dev', 'Gone User', 'member', 'suspended'),
        ('usr_bill', '${CH}', 't5', 'bill@test.dev', 'Billing Admin', 'billing_admin', 'active'),
        ('usr_dallas', '${OTHER}', 't6', 'd@test.dev', 'Dallas Member', 'member', 'active');
      INSERT INTO business_profiles (id, chamber_id, business_name, industry) VALUES
        ('biz_dm', '${CH}', 'Dunder Mifflin', 'Paper');
      INSERT INTO business_members (id, chamber_id, business_id, user_id, access_level, is_primary_contact, status) VALUES
        ('bm_mike', '${CH}', 'biz_dm', 'usr_mike', 'full_access', 1, 'active');
    `);
    await session('s_sarah', 'usr_sarah');
    await session('s_mike', 'usr_mike');
    await session('s_pam', 'usr_pam');
    await session('s_bill', 'usr_bill', 'billing_admin');
    await session('s_dallas', 'usr_dallas', 'member', OTHER);
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
  const send = (token: string, recipientId: string, message: string) =>
    call('POST', '/api/v1/messages', { recipientId, message }, token);

  it('1. Send message to a chamber member → 201, is_read = 0, recipient notified', async () => {
    const res = await send('s_sarah', 'usr_mike', 'Hi Mike, coffee next week?');
    assert.equal(res.status, 201);
    const { data } = (await res.json()) as any;
    assert.match(data.id, /^MSG_AUSTIN_\d{8}_[0-9A-Z]{6}$/);
    const row = one(`SELECT * FROM messages WHERE id = '${data.id}'`);
    assert.equal(row.is_read, 0);
    assert.equal(row.chamber_id, CH);
    assert.equal(row.sender_id, 'usr_sarah');
    const ntf = one(`SELECT * FROM notifications WHERE user_id = 'usr_mike'`);
    assert.equal(ntf.type, 'direct_message');
    assert.equal(ntf.action_url, '/portal/messages?with=usr_sarah');
  });

  it('2. Recipient opens the thread → incoming messages marked read (read_at set), badge drops to 0', async () => {
    await send('s_sarah', 'usr_mike', 'First');
    await send('s_sarah', 'usr_mike', 'Second');
    await send('s_mike', 'usr_sarah', 'Reply');

    const before = (await (await call('GET', '/api/v1/messages/unread-count', undefined, 's_mike')).json()) as any;
    assert.equal(before.data.unreadCount, 2);

    const res = await call('GET', '/api/v1/messages/threads/usr_sarah', undefined, 's_mike');
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.deepEqual(body.data.map((m: any) => m.message), ['First', 'Second', 'Reply']);
    assert.equal(body.meta.partner.name, 'Sarah Lee');
    assert.equal(one(`SELECT count(*) AS n FROM messages WHERE recipient_id = 'usr_mike' AND is_read = 1 AND read_at IS NOT NULL`).n, 2);
    // Mike's own reply stays unread for Sarah until she opens the thread.
    assert.equal(one(`SELECT is_read FROM messages WHERE sender_id = 'usr_mike'`).is_read, 0);

    const after = (await (await call('GET', '/api/v1/messages/unread-count', undefined, 's_mike')).json()) as any;
    assert.equal(after.data.unreadCount, 0);
  });

  it('3. Cannot message a user in another chamber, an inactive user, or yourself', async () => {
    assert.equal((await send('s_sarah', 'usr_dallas', 'Hello')).status, 404);
    assert.equal((await send('s_sarah', 'usr_gone', 'Hello')).status, 404);
    assert.equal((await send('s_sarah', 'usr_sarah', 'Hello')).status, 400);
    assert.equal((await call('GET', '/api/v1/messages/threads/usr_dallas', undefined, 's_sarah')).status, 404);
    assert.equal(one(`SELECT count(*) AS n FROM messages`).n, 0);
  });

  it('4. Conversations list: latest message per partner, unread counts, newest thread first', async () => {
    await send('s_mike', 'usr_sarah', 'From Mike 1');
    await send('s_mike', 'usr_sarah', 'From Mike 2');
    await send('s_pam', 'usr_sarah', 'From Pam');

    const res = await call('GET', '/api/v1/messages/conversations', undefined, 's_sarah');
    assert.equal(res.status, 200);
    const { data } = (await res.json()) as any;
    assert.equal(data.length, 2);
    assert.equal(data[0].partner.id, 'usr_pam');
    assert.equal(data[0].lastMessage.text, 'From Pam');
    assert.equal(data[1].partner.id, 'usr_mike');
    assert.equal(data[1].partner.companyName, 'Dunder Mifflin');
    assert.equal(data[1].lastMessage.text, 'From Mike 2');
    assert.equal(data[1].lastMessage.isSender, false);
    assert.equal(data[1].unreadCount, 2);

    // Sending moves the thread to the top (§16).
    await send('s_sarah', 'usr_mike', 'Back to you');
    const again = (await (await call('GET', '/api/v1/messages/conversations', undefined, 's_sarah')).json()) as any;
    assert.equal(again.data[0].partner.id, 'usr_mike');
    assert.equal(again.data[0].lastMessage.isSender, true);
  });

  it('5. Non-participants never see a thread; another tenant sees nothing', async () => {
    await send('s_sarah', 'usr_mike', 'Private');
    const pam = (await (await call('GET', '/api/v1/messages/threads/usr_mike', undefined, 's_pam')).json()) as any;
    assert.equal(pam.data.length, 0);
    const pamList = (await (await call('GET', '/api/v1/messages/conversations', undefined, 's_pam')).json()) as any;
    assert.equal(pamList.data.length, 0);
    // Dallas session on the Austin host → auth chamber mismatch.
    const cross = await call('GET', '/api/v1/messages/conversations', undefined, 's_dallas');
    assert.ok([401, 403].includes(cross.status), `expected 401/403, got ${cross.status}`);
  });

  it('6. Guests 401, billing_admin 403, validation 422', async () => {
    assert.equal((await call('GET', '/api/v1/messages/conversations')).status, 401);
    assert.equal((await call('GET', '/api/v1/messages/conversations', undefined, 's_bill')).status, 403);
    assert.equal((await send('s_sarah', 'usr_mike', '   ')).status, 422);
    assert.equal((await send('s_sarah', 'usr_mike', 'x'.repeat(5001))).status, 422);
  });

  it('7. Contact search returns active same-chamber members by name or company', async () => {
    const res = await call('GET', '/api/v1/messages/contacts?q=dunder', undefined, 's_sarah');
    const { data } = (await res.json()) as any;
    assert.deepEqual(data.map((m: any) => m.id), ['usr_mike']);
    const all = (await (await call('GET', '/api/v1/messages/contacts', undefined, 's_sarah')).json()) as any;
    const ids = all.data.map((m: any) => m.id);
    assert.ok(!ids.includes('usr_sarah') && !ids.includes('usr_gone') && !ids.includes('usr_dallas'));
  });
});
