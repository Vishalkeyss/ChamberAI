import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app';

describe('Hono Base API & Gateway Tests', () => {
  const app = createApp();

  it('GET /api/v1/health returns 200 OK with success: true and requestId', async () => {
    const res = await app.request('/api/v1/health', {
      headers: {
        'Host': 'localhost',
      },
    }, {
      DB: {} as any,
      KV: { get: async () => null, put: async () => {} } as any,
      ENVIRONMENT: 'test',
      PLATFORM_DOMAIN: '121meet.ai',
    });

    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'healthy');
    assert.ok(body.meta?.requestId);
    assert.ok(res.headers.get('X-Request-ID'));
  });

  it('Unknown route returns standard 404 error envelope', async () => {
    const res = await app.request('/api/v1/unknown-route', {
      headers: {
        'Host': 'localhost',
      },
    }, {
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => null,
          }),
        }),
      } as any,
      KV: { get: async () => null, put: async () => {} } as any,
      ENVIRONMENT: 'test',
      PLATFORM_DOMAIN: '121meet.ai',
    });

    assert.equal(res.status, 404);
    const body = await res.json() as any;
    assert.equal(body.success, false);
    assert.ok(body.error?.code);
  });

  it('rejects unauthenticated request to /api/v1/admin/plans with 401 UNAUTHORIZED', async () => {
    const res = await app.request('/api/v1/admin/plans', {
      headers: { 'Host': 'testchamber.121meet.ai' },
    }, {
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ id: 'ch_test', status: 'active' }),
          }),
        }),
      } as any,
      KV: { get: async () => null, put: async () => {} } as any,
      ENVIRONMENT: 'test',
      PLATFORM_DOMAIN: '121meet.ai',
    });

    assert.equal(res.status, 401);
    const body = await res.json() as any;
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  it('rejects unauthenticated request to /api/v1/member/settings with 401 UNAUTHORIZED', async () => {
    const res = await app.request('/api/v1/member/settings', {
      headers: { 'Host': 'testchamber.121meet.ai' },
    }, {
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ id: 'ch_test', status: 'active' }),
          }),
        }),
      } as any,
      KV: { get: async () => null, put: async () => {} } as any,
      ENVIRONMENT: 'test',
      PLATFORM_DOMAIN: '121meet.ai',
    });

    assert.equal(res.status, 401);
    const body = await res.json() as any;
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  it('rejects unauthenticated request to /api/v1/super-admin/migrations/run with 401 UNAUTHORIZED', async () => {
    const res = await app.request('/api/v1/super-admin/migrations/run', {
      method: 'POST',
      headers: { 'Host': '121meet.ai' },
    }, {
      DB: {} as any,
      KV: { get: async () => null, put: async () => {} } as any,
      ENVIRONMENT: 'test',
      PLATFORM_DOMAIN: '121meet.ai',
    });

    assert.equal(res.status, 401);
    const body = await res.json() as any;
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });
});
