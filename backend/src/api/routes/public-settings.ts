import { Hono } from 'hono';
import type { Env } from '../../core/env';
import type { AppVariables } from '../../core/context';
import { successResponse } from '../../core/shared/response';
import { AppError, ErrorCodes } from '../../core/shared/errors';

export const publicSettingsRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

publicSettingsRouter.get('/public/settings', async (c) => {
  const chamberId = c.get('chamberId');
  const requestId = c.get('requestId');

  if (!chamberId) {
    throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'No chamber context bound to request', 404);
  }

  // Fetch settings from chamber_settings joined with platform_chambers
  const row = await c.env.DB.prepare(`
    SELECT 
      c.id as chamberId,
      c.name,
      s.logo_url as logoUrl,
      s.primary_color as primaryColor,
      s.default_currency as currency,
      s.enabled_languages_json as enabledLanguagesJson,
      s.support_email as contactEmail
    FROM platform_chambers c
    LEFT JOIN chamber_settings s ON s.chamber_id = c.id
    WHERE c.id = ?
    LIMIT 1
  `)
    .bind(chamberId)
    .first<any>();

  if (!row) {
    throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'Chamber records not found in database', 404);
  }

  let supportedLanguages = ['en'];
  if (row.enabledLanguagesJson) {
    try {
      supportedLanguages = JSON.parse(row.enabledLanguagesJson);
    } catch {
      supportedLanguages = ['en'];
    }
  }

  return c.json(
    successResponse(
      {
        chamberId: row.chamberId,
        name: row.name,
        logoUrl: row.logoUrl || null,
        primaryColor: row.primaryColor || '#2563EB',
        accentColor: '#F59E0B',
        currency: row.currency || 'USD',
        supportedLanguages,
        defaultLanguage: supportedLanguages[0] || 'en',
        contactEmail: row.contactEmail || null,
      },
      { requestId }
    )
  );
});

// List all active chambers for the network landing page directory from D1
publicSettingsRouter.get('/public/chambers', async (c) => {
  const requestId = c.get('requestId');
  const results = await c.env.DB.prepare(`
    SELECT 
      c.id,
      c.name,
      c.city,
      c.subdomain,
      c.custom_domain as customDomain,
      c.status,
      c.members_count as membersCount,
      c.admin_contact_name as adminContactName,
      c.created_at as createdAt,
      s.logo_url as logoUrl,
      s.primary_color as primaryColor
    FROM platform_chambers c
    LEFT JOIN chamber_settings s ON s.chamber_id = c.id
    WHERE c.status != 'suspended'
    ORDER BY c.name ASC
  `).all<any>();

  const chambers = (results.results || []).map((ch: any) => ({
    id: ch.id,
    name: ch.name,
    city: ch.city || 'Metro Area',
    slug: ch.subdomain || ch.id,
    customDomain: ch.customDomain || '',
    membersCount: typeof ch.membersCount === 'number' ? ch.membersCount : 0,
    estYear: ch.createdAt ? new Date(ch.createdAt).getFullYear().toString() : '2025',
    headline: `Connecting & Growing ${ch.name}`,
    tagline: `Join ${ch.name} for networking, business growth, verified referrals, and community development.`,
    primaryColor: ch.primaryColor || '#0B2447',
    adminName: ch.adminContactName || undefined,
  }));

  return c.json(
    successResponse(
      {
        chambers,
        total: chambers.length,
      },
      { requestId }
    )
  );
});

// Single chamber lookup by slug or id
publicSettingsRouter.get('/public/chambers/:slug', async (c) => {
  const slug = c.req.param('slug');
  const requestId = c.get('requestId');

  const ch = await c.env.DB.prepare(`
    SELECT 
      c.id,
      c.name,
      c.city,
      c.subdomain,
      c.custom_domain as customDomain,
      c.status,
      c.members_count as membersCount,
      c.admin_contact_name as adminContactName,
      c.created_at as createdAt,
      s.logo_url as logoUrl,
      s.primary_color as primaryColor
    FROM platform_chambers c
    LEFT JOIN chamber_settings s ON s.chamber_id = c.id
    WHERE (c.subdomain = ? OR c.id = ?) AND c.status != 'suspended'
    LIMIT 1
  `)
    .bind(slug, slug)
    .first<any>();

  if (!ch) {
    throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, `Chamber '${slug}' not found`, 404);
  }

  return c.json(
    successResponse(
      {
        id: ch.id,
        name: ch.name,
        city: ch.city || 'Metro Area',
        slug: ch.subdomain || ch.id,
        customDomain: ch.customDomain || '',
        membersCount: typeof ch.membersCount === 'number' ? ch.membersCount : 0,
        estYear: ch.createdAt ? new Date(ch.createdAt).getFullYear().toString() : '2025',
        headline: `Connecting & Growing ${ch.name}`,
        tagline: `Join ${ch.name} for networking, business growth, verified referrals, and community development.`,
        primaryColor: ch.primaryColor || '#0B2447',
        adminName: ch.adminContactName || undefined,
      },
      { requestId }
    )
  );
});
