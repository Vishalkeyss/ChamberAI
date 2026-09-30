import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app';
import { SessionService, type CachedSession } from '../modules/auth/services/session.service';

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
  const auditLogs: any[] = [];
  return {
    prepare: (query: string) => ({
      bind: (...args: any[]) => ({
        first: async () => {
          if (query.includes('FROM platform_chambers')) {
            const subdomain = args[0];
            if (subdomain === 'austin') {
              return {
                id: 'ch_austin_001',
                name: 'Greater Austin Chamber',
                subdomain: 'austin',
                status: 'active',
              };
            }
            if (subdomain === 'dallas') {
              return {
                id: 'ch_dallas_002',
                name: 'Dallas Regional Chamber',
                subdomain: 'dallas',
                status: 'active',
              };
            }
            return null;
          }
          return null;
        },
        all: async () => ({ results: [] }),
        run: async () => {
          if (query.includes('INSERT INTO platform_audit_logs')) {
            auditLogs.push(args);
          }
          return { success: true };
        },
      }),
    }),
    _auditLogs: auditLogs,
  };
}

describe('Prompt 01.2: Edge-Native Session Management & Invalidation', () => {
  const app = createApp();

  it('rejects GET /api/v1/auth/me without Authorization header with 401', async () => {
    const mockKv = createMockKV();
    const mockDb = createMockDb();

    const res = await app.request(
      '/api/v1/auth/me',
      {
        method: 'GET',
        headers: { Host: 'austin.121meet.ai' },
      },
      {
        DB: mockDb as any,
        KV: mockKv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    assert.equal(res.status, 401);
    const body = (await res.json()) as any;
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  it('rejects GET /api/v1/auth/me with invalid or expired token with 401', async () => {
    const mockKv = createMockKV();
    const mockDb = createMockDb();

    const res = await app.request(
      '/api/v1/auth/me',
      {
        method: 'GET',
        headers: {
          Host: 'austin.121meet.ai',
          Authorization: 'Bearer sess_nonexistent_token_123',
        },
      },
      {
        DB: mockDb as any,
        KV: mockKv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    assert.equal(res.status, 401);
    const body = (await res.json()) as any;
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  it('returns 200 OK with cached user profile and roles for valid session', async () => {
    const mockKv = createMockKV();
    const mockDb = createMockDb();

    const sessionToken = 'sess_valid_token_abc123';
    const mockSession: CachedSession = {
      userId: 'usr_99120',
      chamberId: 'ch_austin_001',
      email: 'sarah.jenkins@austinbiz.com',
      firstName: 'Sarah',
      lastName: 'Jenkins',
      avatarUrl: 'https://r2.121meet.ai/avatars/usr_99120.jpg',
      highestRole: 'chapter_admin',
      roles: [
        { roleId: 'member', scopeType: 'chamber', scopeId: 'ch_austin_001' },
        { roleId: 'chapter_admin', scopeType: 'chapter', scopeId: 'chap_downtown' },
      ],
      pointsBalance: 250,
      chamber: { id: 'ch_austin_001', name: 'Greater Austin Chamber' },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    await mockKv.put(`session:${sessionToken}`, JSON.stringify(mockSession));

    const res = await app.request(
      '/api/v1/auth/me',
      {
        method: 'GET',
        headers: {
          Host: 'austin.121meet.ai',
          Authorization: `Bearer ${sessionToken}`,
        },
      },
      {
        DB: mockDb as any,
        KV: mockKv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.user.id, 'usr_99120');
    assert.equal(body.data.user.firstName, 'Sarah');
    assert.equal(body.data.user.lastName, 'Jenkins');
    assert.equal(body.data.user.highestRole, 'chapter_admin');
    assert.equal(body.data.user.pointsBalance, 250);
    assert.equal(body.data.roles.length, 2);
    assert.equal(body.data.chamber.id, 'ch_austin_001');
  });

  it('enforces multi-tenant isolation: rejects token from Chamber A on Chamber B host', async () => {
    const mockKv = createMockKV();
    const mockDb = createMockDb();

    const sessionToken = 'sess_austin_user';
    const mockSession: CachedSession = {
      userId: 'usr_austin',
      chamberId: 'ch_austin_001', // Belongs to Austin
      email: 'member@austin.com',
      firstName: 'Austin',
      lastName: 'Member',
      avatarUrl: null,
      highestRole: 'member',
      roles: [{ roleId: 'member', scopeType: 'chamber', scopeId: 'ch_austin_001' }],
      pointsBalance: 50,
      chamber: { id: 'ch_austin_001', name: 'Greater Austin Chamber' },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    await mockKv.put(`session:${sessionToken}`, JSON.stringify(mockSession));

    // Request comes in targeting dallas.121meet.ai (ch_dallas_002)
    const res = await app.request(
      '/api/v1/auth/me',
      {
        method: 'GET',
        headers: {
          Host: 'dallas.121meet.ai',
          Authorization: `Bearer ${sessionToken}`,
        },
      },
      {
        DB: mockDb as any,
        KV: mockKv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    assert.equal(res.status, 401);
    const body = (await res.json()) as any;
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'UNAUTHORIZED');
    assert.match(body.error.message, /not belong to this chamber/i);
  });

  it('allows super_admin to access session introspection across any host domain', async () => {
    const mockKv = createMockKV();
    const mockDb = createMockDb();

    const sessionToken = 'sess_superadmin_user';
    const mockSession: CachedSession = {
      userId: 'usr_super',
      chamberId: null,
      email: 'admin@121meet.ai',
      firstName: 'Platform',
      lastName: 'Admin',
      avatarUrl: null,
      highestRole: 'super_admin',
      roles: [{ roleId: 'super_admin', scopeType: 'chamber', scopeId: '*' }],
      pointsBalance: 0,
      chamber: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    await mockKv.put(`session:${sessionToken}`, JSON.stringify(mockSession));

    const res = await app.request(
      '/api/v1/auth/me',
      {
        method: 'GET',
        headers: {
          Host: 'austin.121meet.ai',
          Authorization: `Bearer ${sessionToken}`,
        },
      },
      {
        DB: mockDb as any,
        KV: mockKv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.user.highestRole, 'super_admin');
  });

  it('POST /api/v1/auth/logout deletes KV session and logs audit trail', async () => {
    const mockKv = createMockKV();
    const mockDb = createMockDb();

    const sessionToken = 'sess_to_be_logged_out';
    const mockSession: CachedSession = {
      userId: 'usr_100',
      chamberId: 'ch_austin_001',
      email: 'user@austin.com',
      firstName: 'John',
      lastName: 'Doe',
      avatarUrl: null,
      highestRole: 'member',
      roles: [{ roleId: 'member', scopeType: 'chamber', scopeId: 'ch_austin_001' }],
      pointsBalance: 10,
      chamber: { id: 'ch_austin_001', name: 'Greater Austin Chamber' },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    await mockKv.put(`session:${sessionToken}`, JSON.stringify(mockSession));
    assert.ok(mockKv.has(`session:${sessionToken}`));

    // Call logout
    const logoutRes = await app.request(
      '/api/v1/auth/logout',
      {
        method: 'POST',
        headers: {
          Host: 'austin.121meet.ai',
          Authorization: `Bearer ${sessionToken}`,
        },
      },
      {
        DB: mockDb as any,
        KV: mockKv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    assert.equal(logoutRes.status, 200);
    const logoutBody = (await logoutRes.json()) as any;
    assert.equal(logoutBody.success, true);
    assert.equal(logoutBody.data.message, 'Logged out successfully');

    // Verify key was purged from KV
    assert.equal(mockKv.has(`session:${sessionToken}`), false);

    // Verify audit log was recorded
    assert.equal(mockDb._auditLogs.length, 1);

    // Subsequent GET /me with the same token now fails with 401
    const meRes = await app.request(
      '/api/v1/auth/me',
      {
        method: 'GET',
        headers: {
          Host: 'austin.121meet.ai',
          Authorization: `Bearer ${sessionToken}`,
        },
      },
      {
        DB: mockDb as any,
        KV: mockKv as any,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    assert.equal(meRes.status, 401);
  });

  it('sliding session: updates lastActiveAt when more than 5 minutes elapsed', async () => {
    const mockKv = createMockKV();
    const oldDate = new Date(Date.now() - 6 * 60 * 1000).toISOString(); // 6 mins ago

    const session: CachedSession = {
      userId: 'usr_sliding',
      chamberId: 'ch_austin_001',
      email: 'sliding@test.com',
      firstName: 'Slide',
      lastName: 'Tester',
      avatarUrl: null,
      highestRole: 'member',
      roles: [],
      pointsBalance: 0,
      chamber: null,
      createdAt: oldDate,
      lastActiveAt: oldDate,
    };

    await mockKv.put('session:sess_sliding', JSON.stringify(session));

    const mockContext: any = {
      env: { KV: mockKv },
    };

    await SessionService.touchSession(mockContext, 'sess_sliding', session);

    const updatedRaw = await mockKv.get('session:sess_sliding', 'json');
    const updated = updatedRaw as CachedSession;
    assert.notEqual(updated.lastActiveAt, oldDate);
    const diff = Date.now() - new Date(updated.lastActiveAt).getTime();
    assert.ok(diff < 2000); // Updated just now
  });
});
