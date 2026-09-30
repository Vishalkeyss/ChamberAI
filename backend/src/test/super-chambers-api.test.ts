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
    put: async (key: string, val: string) => {
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
  const chambersTable = new Map<string, any>([
    [
      'cham_austin_001',
      {
        id: 'cham_austin_001',
        name: 'Austin Chamber of Commerce',
        city: 'Austin',
        subdomain: 'austin',
        custom_domain: 'austinchamber.org',
        domain_status: 'verified',
        admin_contact_name: 'Alexander Morgan',
        admin_email: 'alexander@austinchamber.org',
        status: 'active',
        onboarded: 1,
        r2_bucket_name: null,
        members_count: 1240,
        revenue_total: 22200.0,
        created_at: '2026-01-10T08:00:00Z',
        updated_at: '2026-03-01T12:00:00Z',
      },
    ],
    [
      'cham_denver_002',
      {
        id: 'cham_denver_002',
        name: 'Denver Traders Association',
        city: 'Denver',
        subdomain: 'denver',
        custom_domain: null,
        domain_status: 'none',
        admin_contact_name: 'Samantha Cole',
        admin_email: 'samantha@denvertraders.org',
        status: 'active',
        onboarded: 1,
        r2_bucket_name: null,
        members_count: 860,
        revenue_total: 11000.0,
        created_at: '2026-01-15T09:00:00Z',
        updated_at: '2026-03-01T12:00:00Z',
      },
    ],
  ]);

  return {
    _chambers: chambersTable,
    prepare(sqlQuery: string) {
      const normalizedSql = sqlQuery.replace(/\s+/g, ' ').trim();
      let boundParams: any[] = [];

      return {
        bind(...params: any[]) {
          boundParams = params;
          return this;
        },
        async all<T = any>() {
          const list = Array.from(chambersTable.values());
          const lowerSql = normalizedSql.toLowerCase();

          if (lowerSql.includes('platform_chambers')) {
            // Count query
            if (lowerSql.includes('count(') || lowerSql.includes('count(*)')) {
              let count = list.length;
              if (boundParams.length === 1 && typeof boundParams[0] === 'string' && !boundParams[0].includes('%')) {
                count = list.filter((c) => c.status === boundParams[0]).length;
              }
              return { results: [{ count }] as T[], success: true };
            }

            // Subdomain lookup
            if (lowerSql.includes('"subdomain" = ?') || lowerSql.includes('subdomain = ?')) {
              const sub = boundParams[0];
              const match = list.find((c) => c.subdomain === sub);
              return { results: match ? ([match] as T[]) : [], success: true };
            }

            // ID lookup
            if (lowerSql.includes('"id" = ?') || lowerSql.includes('id = ?')) {
              const id = boundParams[0];
              const match = list.find((c) => c.id === id);
              return { results: match ? ([match] as T[]) : [], success: true };
            }

            // Status filter
            let filtered = list;
            if (boundParams.includes('active')) {
              filtered = filtered.filter((c) => c.status === 'active');
            } else if (boundParams.includes('suspended')) {
              filtered = filtered.filter((c) => c.status === 'suspended');
            }

            return { results: filtered as T[], success: true };
          }

          return { results: [] as T[], success: true };
        },
        async first<T = any>() {
          const res = await this.all<T>();
          return (res.results[0] as T) || null;
        },
        async raw<T = any>() {
          const lowerSql = normalizedSql.toLowerCase();
          const list = Array.from(chambersTable.values());

          if (lowerSql.includes('count(') || lowerSql.includes('count(*)')) {
            let count = list.length;
            if (boundParams.length === 1 && typeof boundParams[0] === 'string' && !boundParams[0].includes('%')) {
              count = list.filter((c) => c.status === boundParams[0]).length;
            }
            return [[count]] as T[];
          }

          if (lowerSql.includes('insert into') && lowerSql.includes('platform_chambers')) {
            const newObj: any = {
              id: boundParams[0],
              name: boundParams[1],
              city: boundParams[2],
              subdomain: boundParams[3],
              custom_domain: boundParams[4],
              domain_status: boundParams[5],
              admin_contact_name: boundParams[6],
              admin_email: boundParams[7],
              status: boundParams[8] || 'pending_setup',
              onboarded: boundParams[9] || 0,
              r2_bucket_name: null,
              members_count: boundParams[10] || 0,
              revenue_total: boundParams[11] || 0.0,
              created_at: boundParams[12] || new Date().toISOString(),
              updated_at: boundParams[13] || new Date().toISOString(),
            };
            chambersTable.set(newObj.id, newObj);
            return [[
              newObj.id,
              newObj.name,
              newObj.city,
              newObj.subdomain,
              newObj.custom_domain,
              newObj.domain_status,
              newObj.admin_contact_name,
              newObj.admin_email,
              newObj.status,
              newObj.onboarded,
              newObj.r2_bucket_name,
              newObj.members_count,
              newObj.revenue_total,
              newObj.created_at,
              newObj.updated_at,
            ]] as T[];
          }

          if (lowerSql.includes('update "platform_chambers"') || lowerSql.includes('update platform_chambers')) {
            const status = boundParams[0];
            const updatedAt = boundParams[1];
            const id = boundParams[2];
            const item = chambersTable.get(id);
            if (item) {
              item.status = status;
              item.updated_at = updatedAt;
              chambersTable.set(id, item);
              return [[
                item.id,
                item.name,
                item.city,
                item.subdomain,
                item.custom_domain,
                item.domain_status,
                item.admin_contact_name,
                item.admin_email,
                item.status,
                item.onboarded,
                item.r2_bucket_name,
                item.members_count,
                item.revenue_total,
                item.created_at,
                item.updated_at,
              ]] as T[];
            }
            return [] as T[];
          }

          let filtered = list;
          if (lowerSql.includes('"subdomain" = ?') || lowerSql.includes('subdomain = ?')) {
            const sub = boundParams[0];
            filtered = list.filter((c) => c.subdomain === sub);
          } else if (lowerSql.includes('"id" = ?') || lowerSql.includes('id = ?')) {
            const id = boundParams[0];
            filtered = list.filter((c) => c.id === id);
          } else if (boundParams.includes('active')) {
            filtered = filtered.filter((c) => c.status === 'active');
          } else if (boundParams.includes('suspended')) {
            filtered = filtered.filter((c) => c.status === 'suspended');
          }

          return filtered.map((c) => [
            c.id,
            c.name,
            c.city,
            c.subdomain,
            c.custom_domain,
            c.domain_status,
            c.admin_contact_name,
            c.admin_email,
            c.status,
            c.onboarded,
            c.r2_bucket_name,
            c.members_count,
            c.revenue_total,
            c.created_at,
            c.updated_at,
          ]) as T[];
        },
        async run() {
          const lowerSql = normalizedSql.toLowerCase();

          if (lowerSql.includes('insert into') && lowerSql.includes('platform_chambers')) {
            const newObj: any = {
              id: boundParams[0],
              name: boundParams[1],
              city: boundParams[2],
              subdomain: boundParams[3],
              custom_domain: boundParams[4],
              domain_status: boundParams[5],
              admin_contact_name: boundParams[6],
              admin_email: boundParams[7],
              status: boundParams[8] || 'pending_setup',
              onboarded: boundParams[9] || 0,
              r2_bucket_name: boundParams[10] || null,
              members_count: boundParams[11] || 0,
              revenue_total: boundParams[12] || 0.0,
              created_at: boundParams[13] || new Date().toISOString(),
              updated_at: boundParams[14] || new Date().toISOString(),
            };
            chambersTable.set(newObj.id, newObj);
            return { success: true };
          }

          if (lowerSql.includes('update') && lowerSql.includes('platform_chambers')) {
            const status = boundParams[0];
            const updatedAt = boundParams[1];
            const id = boundParams[2];
            const item = chambersTable.get(id);
            if (item) {
              item.status = status;
              item.updated_at = updatedAt;
              chambersTable.set(id, item);
            }
            return { success: true };
          }

          return { success: true };
        },
      };
    },
    async batch(stmts: any[]) {
      for (const s of stmts) {
        if (s && typeof s.run === 'function') {
          await s.run();
        }
      }
      return stmts.map(() => ({ success: true }));
    },
  };
}

function createEnv(db: any, kv: any) {
  return {
    DB: db,
    KV: kv,
    PLATFORM_DOMAIN: '121meet.ai',
    ENVIRONMENT: 'test',
  };
}

describe('Prompt 14.2: Super Admin Chambers Module (Drizzle ORM)', () => {
  const superAdminSession: CachedSession = {
    userId: 'usr_super_root',
    chamberId: 'plat_root',
    email: 'superadmin@121meet.com',
    highestRole: 'super_admin',
    roles: [{ roleId: 'super_admin', scopeType: 'chamber', scopeId: 'plat_root' }],
    firstName: 'Root',
    lastName: 'Admin',
    avatarUrl: null,
    pointsBalance: 0,
    createdAt: '2026-01-01T00:00:00Z',
    lastActiveAt: '2026-01-01T00:00:00Z',
    chamber: {
      id: 'plat_root',
      name: '121 Meet.AI Platform',
    },
  };

  const chamberAdminSession: CachedSession = {
    userId: 'usr_chamber_admin',
    chamberId: 'cham_austin_001',
    email: 'admin@austin.org',
    highestRole: 'full_admin',
    roles: [{ roleId: 'full_admin', scopeType: 'chamber', scopeId: 'cham_austin_001' }],
    firstName: 'Marcus',
    lastName: 'Vance',
    avatarUrl: null,
    pointsBalance: 0,
    createdAt: '2026-01-01T00:00:00Z',
    lastActiveAt: '2026-01-01T00:00:00Z',
    chamber: {
      id: 'cham_austin_001',
      name: 'Austin Chamber',
    },
  };

  it('1. GET /api/v1/super/chambers rejects non-super_admin with 403 Forbidden', async () => {
    const app = createApp();
    const mockKv = createMockKV();
    const mockDb = createMockDb();

    // Store chamber admin session
    await mockKv.put('session:sess_chamber_adm', JSON.stringify(chamberAdminSession));

    const res = await app.request('/api/v1/super/chambers', {
      headers: {
        Authorization: 'Bearer sess_chamber_adm',
      },
    }, createEnv(mockDb, mockKv) as any);

    assert.equal(res.status, 403);
    const body: any = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  it('2. GET /api/v1/super/chambers returns list of chambers for super_admin', async () => {
    const app = createApp();
    const mockKv = createMockKV();
    const mockDb = createMockDb();

    await mockKv.put('session:sess_super', JSON.stringify(superAdminSession));

    const res = await app.request('/api/v1/super/chambers', {
      headers: {
        Authorization: 'Bearer sess_super',
      },
    }, createEnv(mockDb, mockKv) as any);

    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.pagination);
    assert.equal(body.pagination.total, 2);
  });

  it('3. POST /api/v1/super/chambers rejects duplicate subdomain with 409 Conflict', async () => {
    const app = createApp();
    const mockKv = createMockKV();
    const mockDb = createMockDb();

    await mockKv.put('session:sess_super', JSON.stringify(superAdminSession));

    const res = await app.request('/api/v1/super/chambers', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sess_super',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Austin Another Chamber',
        city: 'Austin',
        subdomain: 'austin', // Already exists in mockDb
        admin_name: 'Jane Doe',
        admin_email: 'jane@austin.org',
      }),
    }, createEnv(mockDb, mockKv) as any);

    assert.equal(res.status, 409);
    const body: any = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'CONFLICT');
  });

  it('4. POST /api/v1/super/chambers provisions new chamber with 201 Created', async () => {
    const app = createApp();
    const mockKv = createMockKV();
    const mockDb = createMockDb();

    await mockKv.put('session:sess_super', JSON.stringify(superAdminSession));

    const res = await app.request('/api/v1/super/chambers', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sess_super',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Portland Business Guild',
        city: 'Portland',
        subdomain: 'portland',
        custom_domain: 'portlandbizguild.com',
        admin_name: 'Ryan Bennett',
        admin_email: 'ryan@portlandbizguild.com',
      }),
    }, createEnv(mockDb, mockKv) as any);

    assert.equal(res.status, 201);
    const body: any = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.chamber_id);
    assert.equal(body.data.subdomain, 'portland');
    assert.equal(body.data.status, 'pending_setup');
  });

  it('5. PATCH /api/v1/super/chambers/:id/status updates status', async () => {
    const app = createApp();
    const mockKv = createMockKV();
    const mockDb = createMockDb();

    await mockKv.put('session:sess_super', JSON.stringify(superAdminSession));

    const res = await app.request('/api/v1/super/chambers/cham_austin_001/status', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer sess_super',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'suspended',
        reason: 'Delinquent account review',
      }),
    }, createEnv(mockDb, mockKv) as any);

    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'suspended');
  });
});
