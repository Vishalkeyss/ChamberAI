import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractSubdomain } from '../core/middleware/tenant-resolver';

describe('Tenant Resolver - extractSubdomain', () => {
  it('correctly extracts slug from tenant subdomain', () => {
    const slug = extractSubdomain('austin.121meet.ai', '121meet.ai');
    assert.equal(slug, 'austin');
  });

  it('correctly extracts slug with port number', () => {
    const slug = extractSubdomain('metro.121meet.ai:8787', '121meet.ai');
    assert.equal(slug, 'metro');
  });

  it('returns null for multi-level subdomains', () => {
    const slug = extractSubdomain('deep.nested.121meet.ai', '121meet.ai');
    assert.equal(slug, null);
  });

  it('returns null for root domain without subdomain', () => {
    const slug = extractSubdomain('121meet.ai', '121meet.ai');
    assert.equal(slug, null);
  });

  it('returns null for custom domain not ending with root domain', () => {
    const slug = extractSubdomain('austinchamber.org', '121meet.ai');
    assert.equal(slug, null);
  });
});
