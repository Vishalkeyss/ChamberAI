import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app';
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
        profile_completion_pct: 0,
      },
    ],
  ]);

  return {
    usersTable,
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
        run: async () => ({ success: true }),
      }),
    }),
  };
}

describe('Prompt 02.4: Member Overview Dashboard Tests', () => {
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

  it('1. GET /api/v1/member/overview requires authentication', async () => {
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

  it('2. GET /api/v1/member/overview returns membership and kpis for authenticated member', async () => {
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
    assert.equal(body.data.membership.renewalDate, '2027-10-01');
    assert.equal(body.data.kpis.referralsGiven, 4);
    assert.equal(body.data.kpis.referralsReceived, 2);
    assert.equal(body.data.kpis.eventsAttended, 7);
    assert.equal(body.data.kpis.pointsBalance, 50);
  });

  it('3. GET /api/v1/member/overview enforces tenant chamber isolation', async () => {
    const app = createApp();
    const mockDb = createMockDb();
    const mockKV = createMockKV();
    const token = 'sess_other_chamber_token';

    const otherChamberSession: CachedSession = {
      ...mockSession,
      chamberId: 'ch_denver_999',
      chamber: { id: 'ch_denver_999', name: 'Denver Chamber' },
    };

    await mockKV.put(`session:${token}`, JSON.stringify(otherChamberSession));

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

    // Host header is austin ('ch_austin_001'), but session is for Denver -> 401 Session token does not belong to this chamber
    assert.equal(res.status, 401);
  });

  it('4. POST /api/v1/member/onboarding/complete-step returns valid response', async () => {
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
        body: JSON.stringify({ stepKey: 'profile' }),
      },
      env
    );

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
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
