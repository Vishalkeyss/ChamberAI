import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app';
import type { CachedSession } from '../modules/auth/services/session.service';
import { decryptData } from '../core/shared/crypto';

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
      'usr_01',
      {
        id: 'usr_01',
        chamber_id: 'ch_austin_001',
        email: 'sarah.miller@apextech.com',
        name: 'Sarah Miller',
        phone: '+15125550199',
        avatar_url: null,
        ai_credits_used: 2,
        ai_credits_limit: 10,
        personal_api_provider: null,
        personal_api_key_encrypted: null,
      },
    ],
  ]);

  const notifPrefsTable = new Map<string, any>();
  const adminProfilesTable = new Map<string, any>();
  const auditLogs: any[] = [];

  return {
    prepare: (query: string) => ({
      bind: (...args: any[]) => ({
        first: async () => {
          const normalizedQuery = query.replace(/\s+/g, ' ');
          if (normalizedQuery.includes('FROM users WHERE id = ? AND chamber_id = ?')) {
            const [id, chamberId] = args;
            const u = usersTable.get(id);
            if (u && u.chamber_id === chamberId) return { ...u };
            return null;
          }
          if (normalizedQuery.includes('FROM admin_profiles WHERE user_id = ?')) {
            const [userId] = args;
            return adminProfilesTable.get(userId) || null;
          }
          if (normalizedQuery.includes('FROM notification_preferences WHERE chamber_id = ? AND user_id = ?')) {
            const [chamberId, userId] = args;
            return notifPrefsTable.get(`${chamberId}:${userId}`) || null;
          }
          if (query.includes('FROM platform_chambers')) {
            return {
              id: 'ch_austin_001',
              name: 'Austin Chamber',
              subdomain: 'austin',
              status: 'active',
            };
          }
          return null;
        },
        all: async () => ({ results: [] }),
        run: async () => {
          if (query.includes('INSERT INTO notification_preferences')) {
            const [id, chamberId, userId] = args;
            notifPrefsTable.set(`${chamberId}:${userId}`, {
              id,
              chamber_id: chamberId,
              user_id: userId,
              email_events: 1,
              email_announcements: 1,
              email_referrals: 1,
              email_billing: 1,
              email_newsletters: 1,
              push_events: 1,
              push_announcements: 1,
              push_messages: 1,
              sms_enabled: 0,
            });
          }
          if (query.includes('UPDATE notification_preferences')) {
            const chamberId = args[args.length - 2];
            const userId = args[args.length - 1];
            const current = notifPrefsTable.get(`${chamberId}:${userId}`) || {};
            if (query.includes('email_events = ?')) {
              current.email_events = args[0];
            }
            if (query.includes('sms_enabled = ?')) {
              current.sms_enabled = args[args.length - 3];
            }
            notifPrefsTable.set(`${chamberId}:${userId}`, current);
          }
          if (query.includes('UPDATE users') && query.includes('name = ?')) {
            const [name, phone, id] = args;
            const u = usersTable.get(id);
            if (u) {
              u.name = name;
              u.phone = phone;
            }
          }
          if (query.includes('UPDATE users') && query.includes('personal_api_key_encrypted = ?')) {
            const [encrypted, provider, id] = args;
            const u = usersTable.get(id);
            if (u) {
              u.personal_api_key_encrypted = encrypted;
              u.personal_api_provider = provider;
            }
          }
          if (query.includes('INSERT INTO admin_profiles') || query.includes('UPDATE admin_profiles')) {
            if (query.includes('INSERT INTO admin_profiles')) {
              const [, , userId, jobTitle] = args;
              adminProfilesTable.set(userId, { job_title: jobTitle });
            }
          }
          if (query.includes('INSERT INTO platform_audit_logs')) {
            auditLogs.push(args);
          }
          return { success: true };
        },
      }),
    }),
    _users: usersTable,
    _notifPrefs: notifPrefsTable,
    _auditLogs: auditLogs,
  };
}

describe('Prompt 01.4: Account Settings, Notification Preferences & Security Tests', () => {
  const app = createApp();

  const mockSession: CachedSession = {
    userId: 'usr_01',
    chamberId: 'ch_austin_001',
    email: 'sarah.miller@apextech.com',
    firstName: 'Sarah',
    lastName: 'Miller',
    avatarUrl: null,
    highestRole: 'member',
    roles: [{ roleId: 'member', scopeType: 'chamber', scopeId: 'ch_austin_001' }],
    pointsBalance: 150,
    chamber: { id: 'ch_austin_001', name: 'Austin Chamber' },
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };

  it('GET /api/v1/member/settings returns 15-item notification matrix, profile, and active sessions', async () => {
    const mockKv = createMockKV();
    const mockDb = createMockDb();
    const token = 'sess_settings_test_token';

    await mockKv.put(`session:${token}`, JSON.stringify(mockSession));

    const res = await app.request(
      '/api/v1/member/settings',
      {
        method: 'GET',
        headers: {
          Host: 'austin.121meet.ai',
          Authorization: `Bearer ${token}`,
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
    assert.equal(body.data.profile.email, 'sarah.miller@apextech.com');
    assert.equal(body.data.preferences.length, 15);
    assert.equal(body.data.activeSessions.length, 1);
    assert.equal(body.data.activeSessions[0].isCurrent, true);
  });

  it('PUT /api/v1/member/settings/profile updates user name and phone', async () => {
    const mockKv = createMockKV();
    const mockDb = createMockDb();
    const token = 'sess_settings_test_token';

    await mockKv.put(`session:${token}`, JSON.stringify(mockSession));

    const res = await app.request(
      '/api/v1/member/settings/profile',
      {
        method: 'PUT',
        headers: {
          Host: 'austin.121meet.ai',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Sarah Miller-Johnson',
          title: 'VP of Product',
          phone: '+15125550200',
        }),
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

    const user = mockDb._users.get('usr_01');
    assert.equal(user.name, 'Sarah Miller-Johnson');
    assert.equal(user.phone, '+15125550200');
  });

  it('PUT /api/v1/member/settings/notifications updates preferences', async () => {
    const mockKv = createMockKV();
    const mockDb = createMockDb();
    const token = 'sess_settings_test_token';

    await mockKv.put(`session:${token}`, JSON.stringify(mockSession));

    const res = await app.request(
      '/api/v1/member/settings/notifications',
      {
        method: 'PUT',
        headers: {
          Host: 'austin.121meet.ai',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferences: [
            { category: 'announcements', channel: 'sms', is_enabled: true },
            { category: 'messages', channel: 'email', is_enabled: true },
          ],
        }),
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
    assert.equal(body.data.updated_count, 2);
  });

  it('DELETE /api/v1/member/settings/sessions/:sessionId revokes remote session from KV', async () => {
    const mockKv = createMockKV();
    const mockDb = createMockDb();
    const token = 'sess_settings_test_token';
    const remoteToken = 'sess_remote_device_99';

    await mockKv.put(`session:${token}`, JSON.stringify(mockSession));
    await mockKv.put(`session:${remoteToken}`, JSON.stringify({ ...mockSession, userId: 'usr_01' }));
    assert.equal(mockKv.has(`session:${remoteToken}`), true);

    const res = await app.request(
      `/api/v1/member/settings/sessions/${remoteToken}`,
      {
        method: 'DELETE',
        headers: {
          Host: 'austin.121meet.ai',
          Authorization: `Bearer ${token}`,
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
    assert.equal(body.data.revoked, true);
    assert.equal(mockKv.has(`session:${remoteToken}`), false);
  });

  it('POST /api/v1/member/settings/api-key encrypts and saves BYO AI API key', async () => {
    const mockKv = createMockKV();
    const mockDb = createMockDb();
    const token = 'sess_settings_test_token';
    const masterKey = '0123456789abcdef0123456789abcdef';

    await mockKv.put(`session:${token}`, JSON.stringify(mockSession));

    const plainApiKey = 'sk-proj-supersecretopenaikey123456789';

    const res = await app.request(
      '/api/v1/member/settings/api-key',
      {
        method: 'POST',
        headers: {
          Host: 'austin.121meet.ai',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'openai',
          api_key: plainApiKey,
        }),
      },
      {
        DB: mockDb as any,
        KV: mockKv as any,
        CHAMBER_ENCRYPTION_KEY: masterKey,
        ENVIRONMENT: 'test',
        PLATFORM_DOMAIN: '121meet.ai',
      }
    );

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.provider, 'openai');

    const user = mockDb._users.get('usr_01');
    assert.notEqual(user.personal_api_key_encrypted, plainApiKey);
    const decrypted = await decryptData(user.personal_api_key_encrypted, masterKey);
    assert.equal(decrypted, plainApiKey);
  });
});
