import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getRuntimeConfig, validateDeployedConfig, isAllowedFrontendOrigin, requireEncryptionKey, ConfigError, extractSubdomain } from '../core/config';
import { createApp } from '../app';

const deployed = {
  ENVIRONMENT: 'production',
  PLATFORM_DOMAIN: 'example.com',
  CHAMBER_ENCRYPTION_KEY: 'x'.repeat(64),
  EMAIL_FROM_ADDRESS: 'no-reply@example.com',
  SENDGRID_API_KEY: 'SG.test-key-value',
  SENDGRID_OTP_TEMPLATE_ID: 'd-template',
};

describe('core/config', () => {
  it('unknown ENVIRONMENT is treated as production (fail closed)', () => {
    assert.equal(getRuntimeConfig({ ENVIRONMENT: 'weird' } as any).environment, 'production');
    assert.equal(getRuntimeConfig({} as any).isLocal, false);
  });

  it('deployed env requires domain, encryption key, sender and template', () => {
    assert.deepEqual(validateDeployedConfig(deployed as any), []);
    const issues = validateDeployedConfig({ ENVIRONMENT: 'staging' } as any);
    for (const k of ['PLATFORM_DOMAIN', 'CHAMBER_ENCRYPTION_KEY', 'EMAIL_FROM_ADDRESS', 'SENDGRID_API_KEY', 'SENDGRID_OTP_TEMPLATE_ID']) {
      assert.ok(issues.some((i) => i.startsWith(k)), k);
    }
    assert.deepEqual(validateDeployedConfig({ ENVIRONMENT: 'development' } as any), []);
  });

  it('CORS allowlist: https platform subdomains, ALLOWED_ORIGINS, localhost only when local', () => {
    const prod = getRuntimeConfig({ ...deployed, ALLOWED_ORIGINS: 'https://partner.org/' } as any);
    assert.ok(isAllowedFrontendOrigin('https://rockwell.example.com', prod));
    assert.ok(isAllowedFrontendOrigin('https://example.com', prod));
    assert.ok(isAllowedFrontendOrigin('https://partner.org', prod));
    assert.ok(!isAllowedFrontendOrigin('http://rockwell.example.com', prod));
    assert.ok(!isAllowedFrontendOrigin('https://a.b.example.com', prod));
    assert.ok(!isAllowedFrontendOrigin('https://evil-example.com', prod));
    assert.ok(!isAllowedFrontendOrigin('http://localhost:3000', prod));
    const dev = getRuntimeConfig({ ENVIRONMENT: 'development', PLATFORM_DOMAIN: 'example.com' } as any);
    assert.ok(isAllowedFrontendOrigin('http://rockwell.localhost:3000', dev));
  });

  it('subdomain extraction ignores localhost outside local env', () => {
    assert.equal(extractSubdomain('rockwell.example.com', 'example.com', false), 'rockwell');
    assert.equal(extractSubdomain('rockwell.localhost', 'example.com', false), null);
  });

  it('tenant header: local always, deployed only with ALLOW_TENANT_HEADER=true', () => {
    assert.equal(getRuntimeConfig({ ENVIRONMENT: 'development' } as any).allowTenantHeader, true);
    assert.equal(getRuntimeConfig(deployed as any).allowTenantHeader, false);
    assert.equal(getRuntimeConfig({ ...deployed, ENVIRONMENT: 'staging', ALLOW_TENANT_HEADER: 'true' } as any).allowTenantHeader, true);
  });

  it('encryption key has no fallback (BUG-062)', () => {
    assert.throws(() => requireEncryptionKey({} as any), ConfigError);
    assert.equal(requireEncryptionKey({ CHAMBER_ENCRYPTION_KEY: 'k'.repeat(32) } as any).length, 32);
  });

  it('misconfigured production Worker → API 503, health still 200; foreign origin gets no CORS', async () => {
    const app = createApp();
    const env = { ENVIRONMENT: 'production', DB: {} as any, KV: {} as any } as any;
    const res = await app.request('/api/v1/public/settings', { headers: { Host: 'x.example.com' } }, env);
    assert.equal(res.status, 503);
    const pre = await app.request('/api/v1/public/settings', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.test', 'Access-Control-Request-Method': 'GET' },
    }, { ...deployed, DB: {}, KV: {} } as any);
    assert.equal(pre.headers.get('Access-Control-Allow-Origin'), null);
  });
});
