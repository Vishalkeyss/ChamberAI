import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app';
import { calculateProfileCompleteness } from '../modules/member/services/overview.service';
import type { CachedSession } from '../modules/auth/services/session.service';

function createMockKV() {
  const store = new Map<string, string>();
  return {
    get: async (key: string, type?: string) => {
      const val = store.get(key);
      if (!val) return null;
      if (type === 'json') return JSON.parse(val);
      return val;
    },
    put: async (key: string, val: string, _opts?: any) => {
      store.set(key, val);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    has: (key: string) => store.has(key),
    _store: store,
  };
}

function createMockDb() {
  const usersTable = new Map<string, any>([
    [
      'usr_member_01',
      {
        id: 'usr_member_01',
        chamber_id: 'ch_austin_001',
        email: 'member@austinchamber.com',
        name: 'Sarah Member',
        phone: '+15125550100',
        points_balance: 50,
        onboarding_complete: 0,
        onboarding_steps_json: JSON.stringify({
          profile: false,
          card: false,
          network: false,
          team: false,
        }),
        profile_completion_pct: 0,
      },
    ],
  ]);

  const pointsHistory: any[] = [];
  const notifications: any[] = [];
  const activityLogs: any[] = [];

  return {
    usersTable,
    pointsHistory,
    notifications,
    activityLogs,
    prepare: (query: string) => ({
      bind: (...args: any[]) => ({
        first: async () => {
          const q = query.replace(/\s+/g, ' ');
          if (q.includes('FROM platform_chambers')) {
            return {
              id: 'ch_austin_001',
              name: 'Austin Chamber',
              subdomain: 'austin',
              status: 'active',
            };
          }
          if (q.includes('FROM users WHERE id = ? AND chamber_id = ?')) {
            const [id, chamberId] = args;
            const u = usersTable.get(id);
            if (u && u.chamber_id === chamberId) return { ...u };
            return null;
          }
          if (q.includes('FROM chamber_memberships cm')) {
            const [userId, chamberId] = args;
            if (userId === 'usr_member_01' && chamberId === 'ch_austin_001') {
              return {
                member_id_display: 'AM-2026-08149',
                status: 'active',
                plan_end_date: '2027-10-01',
                tier_name: 'Gold Business',
              };
            }
            return null;
          }
          if (q.includes('SELECT COUNT(*) AS cnt FROM referrals r') && q.includes('from_business_id')) {
            return { cnt: 4 };
          }
          if (q.includes('SELECT COUNT(*) AS cnt FROM referrals r') && q.includes('to_business_id')) {
            return { cnt: 2 };
          }
          if (q.includes('SELECT COUNT(*) AS cnt FROM event_registrations')) {
            return { cnt: 7 };
          }
          return null;
        },
        all: async () => ({ results: [] }),
        run: async () => {
          const q = query.replace(/\s+/g, ' ');
          if (q.includes('UPDATE users SET onboarding_steps_json = ?')) {
            const [stepsJson, pct, complete, id, chamberId] = args;
            const u = usersTable.get(id);
            if (u && u.chamber_id === chamberId) {
              u.onboarding_steps_json = stepsJson;
              u.profile_completion_pct = pct;
              u.onboarding_complete = complete;
            }
            return { success: true };
          }
          if (q.includes('UPDATE users SET points_balance = points_balance + 100')) {
            const [id, chamberId] = args;
            const u = usersTable.get(id);
            if (u && u.chamber_id === chamberId) {
              u.points_balance = (u.points_balance || 0) + 100;
            }
            return { success: true };
          }
          if (q.includes('INSERT INTO points_history')) {
            const [id, chamberId, userId] = args;
            pointsHistory.push({
              id,
              chamber_id: chamberId,
              user_id: userId,
              points: 100,
              type: 'earned',
              reason: 'Completed Member Onboarding',
            });
            return { success: true };
          }
          if (q.includes('INSERT INTO notifications')) {
            const [id, chamberId, userId] = args;
            notifications.push({
              id,
              chamber_id: chamberId,
              user_id: userId,
              type: 'onboarding_complete',
            });
            return { success: true };
          }
          if (q.includes('INSERT INTO activity_logs')) {
            const [id, chamberId, userId, targetId, detailsJson] = args;
            activityLogs.push({
              id,
              chamber_id: chamberId,
              user_id: userId,
              action: 'member.onboarding_completed',
              target_id: targetId,
              details_json: detailsJson,
            });
            return { success: true };
          }
          return { success: true };
        },
      }),
    }),
  };
}

describe('Prompt 02.4: Member Overview Dashboard & Interactive Onboarding Checklist Tests', () => {
  const mockSession: CachedSession = {
    userId: 'usr_member_01',
    chamberId: 'ch_austin_001',
    email: 'member@austinchamber.com',
    firstName: 'Sarah',
    lastName: 'Member',
    avatarUrl: null,
    highestRole: 'member',
    roles: [{ roleId: 'member', scopeType: 'chamber', scopeId: 'ch_austin_001' }],
    pointsBalance: 50,
    chamber: { id: 'ch_austin_001', name: 'Austin Chamber' },
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };

  it('1. Completeness formula returns accurate weighted percentages and 100% when all steps are true', () => {
    // Empty: 0
    assert.equal(
      calculateProfileCompleteness({ profile: false, card: false, network: false, team: false }),
      0
    );

    // Profile only (weight 40)
    assert.equal(
      calculateProfileCompleteness({ profile: true, card: false, network: false, team: false }),
      40
    );

    // Profile + card (40 + 20 = 60)
    assert.equal(
      calculateProfileCompleteness({ profile: true, card: true, network: false, team: false }),
      60
    );

    // Profile + card + network (40 + 20 + 20 = 80)
    assert.equal(
      calculateProfileCompleteness({ profile: true, card: true, network: true, team: false }),
      80
    );

    // All 4 complete: 100
    assert.equal(
      calculateProfileCompleteness({ profile: true, card: true, network: true, team: true }),
      100
    );
  });

  it('2. GET /api/v1/member/overview requires authentication', async () => {
    const app = createApp();
    const mockDb = createMockDb();
    const mockKV = createMockKV();

    const env = {
      DB: mockDb,
      KV: mockKV,
      SESSIONS: mockKV,
      PLATFORM_KV: mockKV,
      JWT_SECRET: 'test-secret',
    } as any;

    const res = await app.request('/api/v1/member/overview', { method: 'GET' }, env);
    assert.equal(res.status, 401);
  });

  it('3. GET /api/v1/member/overview returns membership, kpis, and onboarding checklist state', async () => {
    const app = createApp();
    const mockDb = createMockDb();
    const mockKV = createMockKV();
    const token = 'sess_valid_member_token';

    await mockKV.put(`session:${token}`, JSON.stringify(mockSession));

    const env = {
      DB: mockDb,
      KV: mockKV,
      SESSIONS: mockKV,
      PLATFORM_KV: mockKV,
      JWT_SECRET: 'test-secret',
    } as any;

    const res = await app.request(
      '/api/v1/member/overview',
      {
        method: 'GET',
        headers: {
          Host: 'austin.121meet.ai',
          Authorization: `Bearer ${token}`,
        },
      },
      env
    );

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.membership.tierName, 'Gold Business');
    assert.equal(body.data.membership.status, 'active');
    assert.equal(body.data.membership.memberIdDisplay, 'AM-2026-08149');
    assert.equal(body.data.kpis.referralsGiven, 4);
    assert.equal(body.data.kpis.referralsReceived, 2);
    assert.equal(body.data.kpis.eventsAttended, 7);
    assert.equal(body.data.kpis.pointsBalance, 50);
    assert.equal(body.data.onboarding.isComplete, false);
    assert.equal(body.data.onboarding.completionPct, 0);
    assert.equal(body.data.onboarding.steps.profile, false);
  });

  it('4. POST /api/v1/member/onboarding/complete-step updates steps and awards 100 points on completion', async () => {
    const app = createApp();
    const mockDb = createMockDb();
    const mockKV = createMockKV();
    const token = 'sess_valid_member_token';

    await mockKV.put(`session:${token}`, JSON.stringify(mockSession));

    const env = {
      DB: mockDb,
      KV: mockKV,
      SESSIONS: mockKV,
      PLATFORM_KV: mockKV,
      JWT_SECRET: 'test-secret',
    } as any;

    // Step 1: Complete profile (40%)
    let res = await app.request(
      '/api/v1/member/onboarding/complete-step',
      {
        method: 'POST',
        headers: {
          Host: 'austin.121meet.ai',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stepKey: 'profile' }),
      },
      env
    );
    assert.equal(res.status, 200);
    let body = (await res.json()) as any;
    assert.equal(body.data.completionPct, 40);
    assert.equal(body.data.isComplete, false);

    // Step 2: Complete card (+20 = 60%)
    res = await app.request(
      '/api/v1/member/onboarding/complete-step',
      {
        method: 'POST',
        headers: {
          Host: 'austin.121meet.ai',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stepKey: 'card' }),
      },
      env
    );
    assert.equal(res.status, 200);
    body = (await res.json()) as any;
    assert.equal(body.data.completionPct, 60);

    // Step 3: Complete network (+20 = 80%)
    res = await app.request(
      '/api/v1/member/onboarding/complete-step',
      {
        method: 'POST',
        headers: {
          Host: 'austin.121meet.ai',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stepKey: 'network' }),
      },
      env
    );
    assert.equal(res.status, 200);
    body = (await res.json()) as any;
    assert.equal(body.data.completionPct, 80);

    // Step 4: Complete team (+20 = 100%) -> Triggers completion & +100 points
    res = await app.request(
      '/api/v1/member/onboarding/complete-step',
      {
        method: 'POST',
        headers: {
          Host: 'austin.121meet.ai',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stepKey: 'team' }),
      },
      env
    );
    assert.equal(res.status, 200);
    body = (await res.json()) as any;
    assert.equal(body.data.completionPct, 100);
    assert.equal(body.data.isComplete, true);

    // Verify user balance updated to 50 + 100 = 150
    const user = mockDb.usersTable.get('usr_member_01');
    assert.equal(user.points_balance, 150);
    assert.equal(user.onboarding_complete, 1);

    // Verify row recorded in points_history
    assert.equal(mockDb.pointsHistory.length, 1);
    assert.equal(mockDb.pointsHistory[0].points, 100);
    assert.equal(mockDb.pointsHistory[0].type, 'earned');
    assert.equal(mockDb.pointsHistory[0].reason, 'Completed Member Onboarding');

    // Verify notification sent
    assert.equal(mockDb.notifications.length, 1);
    assert.equal(mockDb.notifications[0].type, 'onboarding_complete');

    // Verify activity log recorded
    assert.equal(mockDb.activityLogs.length, 1);
    assert.equal(mockDb.activityLogs[0].action, 'member.onboarding_completed');
  });

  it('5. Rejects invalid stepKey with 422 Validation Error', async () => {
    const app = createApp();
    const mockDb = createMockDb();
    const mockKV = createMockKV();
    const token = 'sess_valid_member_token';

    await mockKV.put(`session:${token}`, JSON.stringify(mockSession));

    const env = {
      DB: mockDb,
      KV: mockKV,
      SESSIONS: mockKV,
      PLATFORM_KV: mockKV,
      JWT_SECRET: 'test-secret',
    } as any;

    const res = await app.request(
      '/api/v1/member/onboarding/complete-step',
      {
        method: 'POST',
        headers: {
          Host: 'austin.121meet.ai',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stepKey: 'invalid_step' }),
      },
      env
    );

    assert.equal(res.status, 422);
  });
});
