import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app';
import { createMigratedD1, createMockKV } from './helpers/sqlite-d1';

/**
 * Prompt 05.5 — CRM pipeline & Kanban tasks.
 * Runs on the REAL migrations with foreign keys enforced.
 */
describe('Prompt 05.5: CRM & Tasks', () => {
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
        ('usr_a', '${CH}', 't1', 'a@test.dev', 'User A', 'member', 'active'),
        ('usr_b', '${CH}', 't2', 'b@test.dev', 'User B', 'member', 'active'),
        ('usr_admin', '${CH}', 't3', 'admin@test.dev', 'Admin', 'full_admin', 'active'),
        ('usr_dallas', '${OTHER}', 't4', 'd@test.dev', 'Dallas', 'member', 'active');
    `);
    await session('s_a', 'usr_a');
    await session('s_b', 'usr_b');
    await session('s_admin', 'usr_admin', 'full_admin');
  });

  const call = (method: string, path: string, body?: unknown, token?: string) =>
    app.request(
      path,
      {
        method,
        headers: { Host: HOST, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      },
      env
    );
  const one = (sql: string) => d1.sqlite.prepare(sql).get() as any;
  const addContact = async (token: string, body: Record<string, unknown>) => {
    const res = await call('POST', '/api/v1/crm/contacts', { name: 'Marcus Vance', ...body }, token);
    assert.equal(res.status, 201);
    return ((await res.json()) as any).data;
  };

  it('1. Pipeline aggregation: two proposal_sent deals 5,000 + 10,000 → 15,000', async () => {
    await addContact('s_a', { name: 'Deal One', stage: 'proposal_sent', deal_value: 5000 });
    await addContact('s_a', { name: 'Deal Two', stage: 'proposal_sent', deal_value: 10000 });
    await addContact('s_a', { name: 'Lead', deal_value: 700 });
    const { data } = (await (await call('GET', '/api/v1/crm/contacts', undefined, 's_a')).json()) as any;
    assert.deepEqual(data.metrics.stage_summaries.proposal_sent, { count: 2, value: 15000 });
    assert.equal(data.metrics.total_contacts, 3);
    assert.equal(data.metrics.total_pipeline_value, 15700);
    // OD-080: stored as the canonical DB value.
    assert.equal(one(`SELECT count(*) AS n FROM crm_contacts WHERE stage = 'proposal'`).n, 2);
    const filtered = (await (await call('GET', '/api/v1/crm/contacts?stage=proposal_sent', undefined, 's_a')).json()) as any;
    assert.equal(filtered.data.contacts.length, 2);
    assert.equal(filtered.data.metrics.total_contacts, 3, 'metrics cover all contacts, not just the filter');
  });

  it('2. Stage update to won → row updated, win rate, timeline + DEAL_WON audit', async () => {
    const won = await addContact('s_a', { stage: 'proposal_sent', deal_value: 4000 });
    await addContact('s_a', { name: 'Lost One', stage: 'lost' });
    const res = await call('PATCH', `/api/v1/crm/contacts/${won.id}/stage`, { stage: 'won' }, 's_a');
    assert.equal(res.status, 200);
    assert.equal(one(`SELECT stage FROM crm_contacts WHERE id = '${won.id}'`).stage, 'won');
    const { data } = (await (await call('GET', '/api/v1/crm/contacts', undefined, 's_a')).json()) as any;
    assert.equal(data.metrics.win_rate, 50);
    const detail = (await (await call('GET', `/api/v1/crm/contacts/${won.id}`, undefined, 's_a')).json()) as any;
    assert.equal(detail.data.activities[0].type, 'stage');
    assert.equal(detail.data.activities[0].body, 'Moved from Proposal Sent to Won');
    assert.equal(one(`SELECT count(*) AS n FROM activity_logs WHERE action = 'DEAL_WON' AND target_id = '${won.id}'`).n, 1);
    assert.equal(one(`SELECT count(*) AS n FROM activity_logs WHERE action = 'CRM_CONTACT_CREATED'`).n, 2);
  });

  it('3. Task lifecycle: done sets completed_at, back to todo clears it; TASK_COMPLETED logged', async () => {
    const created = await call('POST', '/api/v1/tasks', { title: 'Follow up on proposal', priority: 'urgent', due_date: '2026-09-22T17:00:00Z' }, 's_a');
    assert.equal(created.status, 201);
    const task = ((await created.json()) as any).data;
    assert.equal(task.status, 'todo');
    assert.equal(task.completed_at, null);
    const done = ((await (await call('PATCH', `/api/v1/tasks/${task.id}`, { status: 'done' }, 's_a')).json()) as any).data;
    assert.ok(done.completed_at);
    const back = ((await (await call('PATCH', `/api/v1/tasks/${task.id}`, { status: 'todo' }, 's_a')).json()) as any).data;
    assert.equal(back.completed_at, null);
    assert.equal(one(`SELECT count(*) AS n FROM activity_logs WHERE action = 'TASK_COMPLETED'`).n, 1);
    // Spec query value "completed" maps to done.
    assert.equal((await call('GET', '/api/v1/tasks?status=completed', undefined, 's_a')).status, 200);
  });

  it('4. Privacy: user A never sees user B (or admin sees nobody else); foreign ids are 404', async () => {
    const bContact = await addContact('s_b', { name: 'B Secret' });
    const bTask = ((await (await call('POST', '/api/v1/tasks', { title: 'B task' }, 's_b')).json()) as any).data;
    await addContact('s_a', { name: 'A Lead' });

    const a = (await (await call('GET', '/api/v1/crm/contacts', undefined, 's_a')).json()) as any;
    assert.deepEqual(a.data.contacts.map((c: any) => c.name), ['A Lead']);
    const admin = (await (await call('GET', '/api/v1/crm/contacts', undefined, 's_admin')).json()) as any;
    assert.equal(admin.data.contacts.length, 0);
    assert.equal(((await (await call('GET', '/api/v1/tasks', undefined, 's_a')).json()) as any).data.length, 0);

    assert.equal((await call('GET', `/api/v1/crm/contacts/${bContact.id}`, undefined, 's_a')).status, 404);
    assert.equal((await call('PATCH', `/api/v1/crm/contacts/${bContact.id}/stage`, { stage: 'won' }, 's_a')).status, 404);
    assert.equal((await call('DELETE', `/api/v1/crm/contacts/${bContact.id}`, undefined, 's_a')).status, 404);
    assert.equal((await call('PATCH', `/api/v1/tasks/${bTask.id}`, { status: 'done' }, 's_a')).status, 404);
    // Cannot link a task to someone else's contact.
    assert.equal((await call('POST', '/api/v1/tasks', { title: 'Steal', crm_contact_id: bContact.id }, 's_a')).status, 404);
    assert.equal(one(`SELECT stage FROM crm_contacts WHERE id = '${bContact.id}'`).stage, 'lead');
  });

  it('5. Deleting a contact keeps its tasks (crm_contact_id → NULL) and removes its timeline', async () => {
    const c = await addContact('s_a', { stage: 'lead' });
    await call('POST', `/api/v1/crm/contacts/${c.id}/activities`, { type: 'call', body: 'Intro call' }, 's_a');
    const t = ((await (await call('POST', '/api/v1/tasks', { title: 'Call Marcus', crm_contact_id: c.id }, 's_a')).json()) as any).data;
    assert.equal(t.crm_contact_name, 'Marcus Vance');
    assert.equal((await call('DELETE', `/api/v1/crm/contacts/${c.id}`, undefined, 's_a')).status, 200);
    const task = one(`SELECT crm_contact_id FROM tasks WHERE id = '${t.id}'`);
    assert.equal(task.crm_contact_id, null);
    assert.equal(one(`SELECT count(*) AS n FROM crm_contact_activities`).n, 0);
  });

  it('6. Linked member must be in the same chamber; validation 422; guest 401', async () => {
    assert.equal((await call('POST', '/api/v1/crm/contacts', { name: 'X Y', linked_user_id: 'usr_dallas' }, 's_a')).status, 404);
    const linked = await addContact('s_a', { name: 'Linked', linked_user_id: 'usr_b' });
    const detail = (await (await call('GET', `/api/v1/crm/contacts/${linked.id}`, undefined, 's_a')).json()) as any;
    assert.equal(detail.data.linked_user.name, 'User B');

    assert.equal((await call('POST', '/api/v1/crm/contacts', { name: 'A' }, 's_a')).status, 422);
    assert.equal((await call('POST', '/api/v1/crm/contacts', { name: 'Neg', deal_value: -1 }, 's_a')).status, 422);
    assert.equal((await call('POST', '/api/v1/crm/contacts', { name: 'Bad', stage: 'proposal' }, 's_a')).status, 422);
    assert.equal((await call('POST', '/api/v1/tasks', { title: 'x' }, 's_a')).status, 422);
    assert.equal((await call('POST', '/api/v1/tasks', { title: 'Bad priority', priority: 'critical' }, 's_a')).status, 422);
    assert.equal((await call('GET', '/api/v1/crm/contacts')).status, 401);
    assert.equal((await call('GET', '/api/v1/tasks')).status, 401);
  });

  it('7. Search escapes LIKE wildcards; updates via PUT; activities ordered newest first', async () => {
    const c = await addContact('s_a', { name: 'Percent Co', company_name: '100% Steel' });
    await addContact('s_a', { name: 'Other Person' });
    const s = (await (await call('GET', `/api/v1/crm/contacts?search=${encodeURIComponent('100%')}`, undefined, 's_a')).json()) as any;
    assert.deepEqual(s.data.contacts.map((x: any) => x.id), [c.id]);
    const w = (await (await call('GET', `/api/v1/crm/contacts?search=${encodeURIComponent('%')}`, undefined, 's_a')).json()) as any;
    assert.equal(w.data.contacts.length, 1);

    const put = await call('PUT', `/api/v1/crm/contacts/${c.id}`, { deal_value: 1200, follow_up_date: '2026-10-20', stage: 'contacted' }, 's_a');
    assert.equal(put.status, 200);
    const d = ((await put.json()) as any).data;
    assert.equal(d.deal_value, 1200);
    assert.equal(d.follow_up_date, '2026-10-20');
    assert.equal(d.stage, 'contacted');
    await call('POST', `/api/v1/crm/contacts/${c.id}/activities`, { type: 'meeting', body: 'Coffee' }, 's_a');
    const detail = (await (await call('GET', `/api/v1/crm/contacts/${c.id}`, undefined, 's_a')).json()) as any;
    assert.deepEqual(detail.data.activities.map((a: any) => a.type), ['meeting', 'stage']);
  });
});
