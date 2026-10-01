import { Hono } from 'hono';
import type { Env } from '../../../../core/env';
import type { AppVariables } from '../../../../core/context';
import { requireAuth, requireRole } from '../../../../core/middleware/auth.middleware';
import { generatePrefixedId } from '../../../../core/shared/crypto';
import { AppError, ErrorCodes } from '../../../../core/shared/errors';
import { successResponse } from '../../../../core/shared/response';

export const adminOnboardingRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// Guard all onboarding routes with Chamber Admin authorization
adminOnboardingRoutes.use('/admin/onboarding/*', requireAuth, requireRole(['full_admin', 'super_admin']));
adminOnboardingRoutes.use('/admin/onboarding', requireAuth, requireRole(['full_admin', 'super_admin']));

/**
 * GET /api/v1/admin/onboarding/state
 * Retrieves current onboarding draft state for the authenticated chamber
 */
adminOnboardingRoutes.get('/admin/onboarding/state', async (c) => {
  const chamberId = c.get('chamberId');
  if (!chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Tenant chamber context required', 400);
  }

  // Fetch chamber record
  const chamber = await c.env.DB
    .prepare('SELECT id, name, city, admin_contact_name, admin_email, status, onboarded FROM platform_chambers WHERE id = ?')
    .bind(chamberId)
    .first<any>();

  if (!chamber) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Chamber not found', 404);
  }

  // Fetch chamber settings if exists
  const settings = await c.env.DB
    .prepare('SELECT * FROM chamber_settings WHERE chamber_id = ?')
    .bind(chamberId)
    .first<any>();

  // Fetch payment gateway configuration
  const gateway = await c.env.DB
    .prepare('SELECT provider, publishable_key_encrypted, secret_key_encrypted, status FROM payment_gateway_config WHERE chamber_id = ?')
    .bind(chamberId)
    .first<any>();

  // Fetch existing membership plans from D1
  const plansResult = await c.env.DB
    .prepare('SELECT id, name, price, billing_frequency, pricing_basis, features_json, is_popular, accent_color, is_active FROM membership_plans WHERE chamber_id = ? ORDER BY sort_order ASC')
    .bind(chamberId)
    .all<any>();

  const isCompleted = chamber.onboarded === 1 || settings?.onboarding_wizard_completed === 1;

  const data = {
    is_completed: isCompleted,
    chamber_id: chamber.id,
    profile: {
      org_name: settings?.org_name || chamber.name,
      city: chamber.city || '',
      admin_contact: chamber.admin_contact_name || '',
      support_email: settings?.support_email || chamber.admin_email || '',
      default_currency: settings?.default_currency || 'USD',
      timezone: settings?.timezone || 'America/Chicago',
    },
    branding: {
      primary_color: settings?.primary_color || '#0B2447',
      text_color: settings?.text_color || '#FFFFFF',
      background_color: settings?.background_color || '#F5F7FA',
      logo_url: settings?.logo_url || null,
      hero_headline: settings?.hero_headline || 'Empowering Local Businesses to Connect, Grow, and Thrive',
      hero_tagline: settings?.about_text || 'Join our community of entrepreneurs, civic leaders, and local business pioneers.',
    },
    payment_gateway: gateway ? {
      provider: gateway.provider || 'stripe',
      publishable_key: gateway.publishable_key_encrypted || '',
      secret_key: gateway.secret_key_encrypted || '',
      status: gateway.status || 'not_connected',
    } : null,
    plans: (plansResult.results || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      billing_frequency: p.billing_frequency,
      pricing_basis: p.pricing_basis,
      features: p.features_json ? (typeof p.features_json === 'string' ? JSON.parse(p.features_json) : p.features_json) : [],
      is_popular: p.is_popular === 1,
      accent_color: p.accent_color,
      is_active: p.is_active === 1,
    })),
  };

  const requestId = c.get('requestId');
  return c.json(successResponse(data, { requestId }));
});

/**
 * POST /api/v1/admin/onboarding/finish
 * Persists onboarding setup atomically in D1, activates chamber, and marks onboarding complete
 */
adminOnboardingRoutes.post('/admin/onboarding/finish', async (c) => {
  const chamberId = c.get('chamberId');
  if (!chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Tenant chamber context required', 400);
  }

  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const now = new Date().toISOString();

  // Guard: Chamber onboarding can only be completed once
  const existingChamber = await c.env.DB
    .prepare('SELECT onboarded FROM platform_chambers WHERE id = ?')
    .bind(chamberId)
    .first<any>();

  if (existingChamber?.onboarded === 1) {
    throw new AppError(
      ErrorCodes.BAD_REQUEST,
      'Chamber onboarding has already been completed. Further updates must be managed via Admin Settings and Plan Builder.',
      400
    );
  }

  const profile = body.profile || {};
  const branding = body.branding || {};
  const gateway = body.payment_gateway;
  const plans = body.plans || [];

  const statements: D1PreparedStatement[] = [];

  // 1. Activate chamber tenant
  statements.push(
    c.env.DB
      .prepare(
        `UPDATE platform_chambers
         SET name = COALESCE(?, name),
             city = COALESCE(?, city),
             onboarded = 1,
             status = 'active',
             updated_at = ?
         WHERE id = ?`
      )
      .bind(profile.org_name || null, profile.city || null, now, chamberId)
  );


  // 3. Upsert chamber settings
  const settingsId = generatePrefixedId('cset');
  statements.push(
    c.env.DB
      .prepare(
        `INSERT INTO chamber_settings (
           id, chamber_id, org_name, support_email, default_currency, timezone,
           primary_color, text_color, background_color, logo_url, hero_headline, onboarding_wizard_completed
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(chamber_id) DO UPDATE SET
           org_name = excluded.org_name,
           support_email = excluded.support_email,
           default_currency = excluded.default_currency,
           timezone = excluded.timezone,
           primary_color = excluded.primary_color,
           text_color = excluded.text_color,
           background_color = excluded.background_color,
           logo_url = excluded.logo_url,
           hero_headline = excluded.hero_headline,
           onboarding_wizard_completed = 1`
      )
      .bind(
        settingsId,
        chamberId,
        profile.org_name || 'Chamber of Commerce',
        profile.support_email || null,
        profile.default_currency || 'USD',
        profile.timezone || 'America/Chicago',
        branding.primary_color || '#0B2447',
        branding.text_color || '#FFFFFF',
        branding.background_color || '#F5F7FA',
        branding.logo_url || null,
        branding.hero_headline || 'Empowering Local Businesses'
      )
  );

  // 4. Upsert payment gateway credentials if provided
  if (gateway && gateway.provider && gateway.provider !== 'none') {
    const gwId = generatePrefixedId('gw');
    statements.push(
      c.env.DB
        .prepare(
          `INSERT INTO payment_gateway_config (
             id, chamber_id, provider, publishable_key_encrypted, secret_key_encrypted, status, connected_at
           ) VALUES (?, ?, ?, ?, ?, 'connected', ?)
           ON CONFLICT(chamber_id) DO UPDATE SET
             provider = excluded.provider,
             publishable_key_encrypted = excluded.publishable_key_encrypted,
             secret_key_encrypted = excluded.secret_key_encrypted,
             status = 'connected',
             connected_at = excluded.connected_at`
        )
        .bind(
          gwId,
          chamberId,
          gateway.provider,
          gateway.publishable_key || '',
          gateway.secret_key || '',
          now
        )
    );
  }

  // 5. Insert / update initial membership plans if provided
  if (Array.isArray(plans) && plans.length > 0) {
    for (let i = 0; i < plans.length; i++) {
      const p = plans[i];
      if (p.id) {
        statements.push(
          c.env.DB
            .prepare(
              `INSERT INTO membership_plans (
                 id, chamber_id, name, accent_color, price, pricing_basis,
                 billing_frequency, is_popular, features_json, is_active, sort_order, created_at, updated_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 name = excluded.name,
                 accent_color = excluded.accent_color,
                 price = excluded.price,
                 pricing_basis = excluded.pricing_basis,
                 billing_frequency = excluded.billing_frequency,
                 is_popular = excluded.is_popular,
                 features_json = excluded.features_json,
                 sort_order = excluded.sort_order,
                 updated_at = excluded.updated_at`
            )
            .bind(
              p.id,
              chamberId,
              p.name,
              p.accent_color || '#0B2447',
              Number(p.price) || 0.0,
              p.pricing_basis || 'flat',
              p.billing_frequency || 'annual',
              p.is_popular ? 1 : 0,
              JSON.stringify(p.features || []),
              i + 1,
              now,
              now
            )
        );
      } else {
        const planId = generatePrefixedId('plan');
        statements.push(
          c.env.DB
            .prepare(
              `INSERT INTO membership_plans (
                 id, chamber_id, name, accent_color, price, pricing_basis,
                 billing_frequency, is_popular, features_json, is_active, sort_order, created_at, updated_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
            )
            .bind(
              planId,
              chamberId,
              p.name,
              p.accent_color || '#0B2447',
              Number(p.price) || 0.0,
              p.pricing_basis || 'flat',
              p.billing_frequency || 'annual',
              p.is_popular ? 1 : 0,
              JSON.stringify(p.features || []),
              i + 1,
              now,
              now
            )
        );
      }
    }
  }

  await c.env.DB.batch(statements);

  const requestId = c.get('requestId');
  return c.json(
    successResponse(
      {
        chamber_id: chamberId,
        onboarded: true,
        status: 'active',
        message: 'Chamber onboarding finalized successfully.',
      },
      { requestId }
    )
  );
});
