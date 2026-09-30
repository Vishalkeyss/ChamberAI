import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateTrackingCode } from '../core/shared/crypto';

describe('Prompt 02.2: Tracking Code Generator Unit Tests', () => {
  it('1. Generates tracking code matching ^APP-\\d{4}-\\d{5}$ format', () => {
    const code = generateTrackingCode();
    const trackingCodeRegex = /^APP-\d{4}-\d{5}$/;
    assert.match(code, trackingCodeRegex, `Expected ${code} to match ${trackingCodeRegex}`);
  });

  it('2. Current year is embedded in the tracking code', () => {
    const currentYear = new Date().getFullYear().toString();
    const code = generateTrackingCode();
    assert.ok(code.startsWith(`APP-${currentYear}-`), `Expected code ${code} to start with APP-${currentYear}-`);
  });

  it('3. Generates unique tracking codes across sequential invocations', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateTrackingCode());
    }
    // High probability of 100 unique codes across 90,000 combinations
    assert.ok(codes.size >= 99, `Expected at least 99 unique codes, got ${codes.size}`);
  });
});
