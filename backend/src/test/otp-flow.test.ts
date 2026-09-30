import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateSecureOtp, hashOtp, generateSessionToken } from '../core/shared/crypto';
import { createApp } from '../app';

describe('OTP Crypto & Security Primitives', () => {
  it('generates a 6-digit numeric OTP within 100000-999999', () => {
    for (let i = 0; i < 50; i++) {
      const otp = generateSecureOtp();
      assert.equal(otp.length, 6);
      assert.match(otp, /^\d{6}$/);
      const num = parseInt(otp, 10);
      assert.ok(num >= 100000 && num <= 999999);
    }
  });

  it('computes deterministic SHA-256 hash for OTPs', async () => {
    const code = '123456';
    const hash1 = await hashOtp(code);
    const hash2 = await hashOtp(code);
    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64); // 256 bits = 64 hex characters
  });

  it('generates high-entropy 256-bit session tokens with sess_ prefix', () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();
    assert.notEqual(token1, token2);
    assert.equal(token1.length, 69);
    assert.match(token1, /^sess_[0-9a-f]{64}$/);
  });
});

describe('OTP Request & Verification Route Validation', () => {
  const app = createApp();
  const mockEnv: any = {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ success: true }),
        }),
      }),
    },
    KV: {
      get: async () => null,
      put: async () => {},
    },
    ENVIRONMENT: 'test',
    PLATFORM_DOMAIN: '121meet.ai',
  };

  it('rejects invalid email format on OTP request with 400 validation error', async () => {
    const res = await app.request(
      '/api/v1/auth/otp/request',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email', portal: 'member' }),
      },
      mockEnv
    );

    assert.equal(res.status, 400);
    const body = (await res.json()) as any;
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  it('rejects invalid OTP code format (less than 6 digits) on verify with 400 validation error', async () => {
    const res = await app.request(
      '/api/v1/auth/otp/verify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sarah@example.com', code: '123', portal: 'member' }),
      },
      mockEnv
    );

    assert.equal(res.status, 400);
    const body = (await res.json()) as any;
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });
});
