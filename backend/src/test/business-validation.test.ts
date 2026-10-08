import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { updateBusinessProfileSchema } from '../modules/directory/validation/business-profile.validation';
import {
  getBusinessLogoStorageKey,
  getBusinessBannerStorageKey,
} from '../modules/directory/services/business-profile.service';

describe('Prompt 03.1: Business Validation & Storage Key Unit Tests', () => {
  it('1. Test invalid social link URL fails Zod validation', () => {
    const invalidPayload = {
      name: 'Acme Health Innovations',
      industry: 'Healthcare & Biotechnology',
      socialLinks: {
        linkedin: 'not-a-valid-url',
      },
    };

    const result = updateBusinessProfileSchema.safeParse(invalidPayload);
    assert.strictEqual(result.success, false, 'Expected validation to fail for invalid URL');
    if (!result.success) {
      assert.match(
        result.error.errors[0]?.message || '',
        /Invalid social link URL/i
      );
    }
  });

  it('2. Test valid social links pass Zod validation', () => {
    const validPayload = {
      name: 'Acme Health Innovations',
      industry: 'Healthcare & Biotechnology',
      website: 'https://acmehealth.com',
      businessEmail: 'contact@acmehealth.com',
      socialLinks: {
        linkedin: 'https://linkedin.com/company/acmehealth',
        twitter: 'https://twitter.com/acmehealth',
      },
      skills: ['Medical Devices', 'Clinical Research'],
      locations: ['Austin', 'Round Rock'],
    };

    const result = updateBusinessProfileSchema.safeParse(validPayload);
    assert.strictEqual(result.success, true, 'Expected validation to succeed for valid payload');
  });

  it('3. Test R2 storage key generation creates proper deterministic path with chamber ID', () => {
    const chamberId = 'cham_austin_001';
    const businessId = 'biz_9921';

    const logoKey = getBusinessLogoStorageKey(chamberId, businessId, 'png');
    assert.match(
      logoKey,
      /^tenants\/cham_austin_001\/businesses\/biz_9921\/logo_\d+\.png$/,
      'Logo key must match tenants/{chamberId}/businesses/{businessId}/logo_{timestamp}.png'
    );

    const bannerKey = getBusinessBannerStorageKey(chamberId, businessId, 'jpg');
    assert.match(
      bannerKey,
      /^tenants\/cham_austin_001\/businesses\/biz_9921\/banner_\d+\.jpg$/,
      'Banner key must match tenants/{chamberId}/businesses/{businessId}/banner_{timestamp}.jpg'
    );
  });
});
