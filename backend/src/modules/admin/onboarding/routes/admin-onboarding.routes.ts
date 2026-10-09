import { Hono } from 'hono';
import type { Env } from '../../../../core/env';
import type { AppVariables } from '../../../../core/context';
import { requireAuth, requireRole } from '../../../../core/middleware/auth.middleware';
import { newId, chamberKeyedId } from '../../../../core/shared/ids';
import { AppError, ErrorCodes } from '../../../../core/shared/errors';
import { successResponse } from '../../../../core/shared/response';
import { encryptData } from '../../../../core/shared/crypto';
import { chamberOnboardingSchema } from '../validation/onboarding.validation';

export const adminOnboardingRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// Guard all onboarding routes with Chamber Admin authorization
adminOnboardingRoutes.use('/admin/onboarding/*', requireAuth, requireRole(['full_admin', 'super_admin']));
adminOnboardingRoutes.use('/admin/onboarding', requireAuth, requireRole(['full_admin', 'super_admin']));

function requireChamber(chamberId: string | undefined): string {
  if (!chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Tenant chamber context required', 400);
  }
  return chamberId;
}

async function isOnboardingCompleted(db: D1Database, chamberId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT pc.onboarded AS onboarded, cs.onboarding_wizard_completed AS wizard_completed
       FROM platform_chambers pc
       LEFT JOIN chamber_settings cs ON cs.chamber_id = pc.id
       WHERE pc.id = ?`
    )
    .bind(chamberId)
    .first<{ onboarded: number | null; wizard_completed: number | null }>();
  if (!row) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Chamber not found', 404);
  }
  return row.onboarded === 1 || row.wizard_completed === 1;
}

/**
 * GET /api/v1/admin/onboarding/state
 * Retrieves current onboarding draft state for the authenticated chamber.
 * Gateway keys are never returned (BUG-060) — only provider, status and whether keys are stored.
 */
adminOnboardingRoutes.get('/admin/onboarding/state', async (c) => {
  const chamberId = requireChamber(c.get('chamberId'));

  const chamber = await c.env.DB
    .prepare('SELECT id, name, city, admin_contact_name, admin_email, status, onboarded FROM platform_chambers WHERE id = ?')
    .bind(chamberId)
    .first<any>();

  if (!chamber) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Chamber not found', 404);
  }

  const settings = await c.env.DB
    .prepare('SELECT * FROM chamber_settings WHERE chamber_id = ?')
    .bind(chamberId)
    .first<any>();

  const gateway = await c.env.DB
    .prepare(
      `SELECT provider, status,
              (publishable_key_encrypted IS NOT NULL AND publishable_key_encrypted <> '') AS has_publishable_key,
              (secret_key_encrypted IS NOT NULL AND secret_key_encrypted <> '') AS has_secret_key
       FROM payment_gateway_config WHERE chamber_id = ?`
    )
    .bind(chamberId)
    .first<any>();

  const plansResult = await c.env.DB
    .prepare('SELECT id, name, price, billing_frequency, pricing_basis, features_json, is_popular, accent_color, is_active FROM membership_plans WHERE chamber_id = ? ORDER BY sort_order ASC')
    .bind(chamberId)
    .all<any>();

  const isCompleted = chamber.onboarded === 1 || settings?.onboarding_wizard_completed === 1;

  // No code defaults (BUG-061): unset values are returned as null and the wizard keeps its own form state.
  const data = {
    is_completed: isCompleted,
    chamber_id: chamber.id,
    profile: {
      org_name: settings?.org_name || chamber.name,
      city: chamber.city || '',
      admin_contact: chamber.admin_contact_name || '',
      support_email: settings?.support_email || chamber.admin_email || '',
      default_currency: settings?.default_currency ?? null,
      timezone: settings?.timezone ?? null,
    },
    branding: {
      primary_color: settings?.primary_color ?? null,
      text_color: settings?.text_color ?? null,
      background_color: settings?.background_color ?? null,
      logo_url: settings?.logo_url ?? null,
      hero_headline: settings?.hero_headline ?? null,
      hero_tagline: settings?.hero_tagline ?? settings?.about_text ?? null,
    },
    payment_gateway: gateway
      ? {
          provider: gateway.provider || 'none',
          status: gateway.status || 'not_connected',
          has_keys: gateway.has_publishable_key === 1 && gateway.has_secret_key === 1,
        }
      : null,
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
 * Persists onboarding setup atomically in D1, activates chamber, and marks onboarding complete.
 * Runs only once per chamber (spec 13.2 §17 re-access guard) → 409 when already completed.
 */
adminOnboardingRoutes.post('/admin/onboarding/finish', async (c) => {
  const chamberId = requireChamber(c.get('chamberId'));
  const user = c.get('user');

  const parsed = chamberOnboardingSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    const issue = parsed.error.errors[0];
    const field = issue?.path?.join('.');
    throw new AppError(ErrorCodes.VALIDATION_ERROR, field ? `${field}: ${issue.message}` : 'Invalid request', 422);
  }
  const { profile, branding, payment_gateway: gateway, plans } = parsed.data;

  if (await isOnboardingCompleted(c.env.DB, chamberId)) {
    throw new AppError(ErrorCodes.CONFLICT, 'Chamber onboarding is already completed.', 409);
  }

  // Spec §7: at least one membership plan (sent now or already created for this chamber).
  if (plans.length === 0) {
    const existing = await c.env.DB
      .prepare('SELECT COUNT(*) AS cnt FROM membership_plans WHERE chamber_id = ? AND is_active = 1')
      .bind(chamberId)
      .first<{ cnt: number }>();
    if (!existing || existing.cnt < 1) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'At least one membership plan is required', 422);
    }
  }

  // BUG-060: gateway keys are stored AES-GCM encrypted with the server-side master key only.
  let encryptedKeys: { publishable: string; secret: string } | null = null;
  if (gateway) {
    const masterKey = c.env.CHAMBER_ENCRYPTION_KEY;
    if (!masterKey) {
      throw new AppError(
        ErrorCodes.PAYMENT_UNAVAILABLE,
        'Payment gateway keys cannot be saved: encryption is not configured on the server. Skip this step and connect the gateway later.',
        503
      );
    }
    encryptedKeys = {
      publishable: await encryptData(gateway.publishable_key, masterKey),
      secret: await encryptData(gateway.secret_key, masterKey),
    };
  }

  const now = new Date().toISOString();

  // 1. Claim + activate the chamber first (only while not onboarded) so a concurrent second
  //    submit gets 409 instead of overwriting settings. Rolled back if the batch below fails.
  const prev = await c.env.DB
    .prepare('SELECT name, city, status FROM platform_chambers WHERE id = ?')
    .bind(chamberId)
    .first<{ name: string; city: string | null; status: string | null }>();
  const claim = await c.env.DB
    .prepare(
      `UPDATE platform_chambers
       SET name = ?, city = COALESCE(?, city), onboarded = 1, status = 'active', updated_at = ?
       WHERE id = ? AND onboarded = 0`
    )
    .bind(profile.org_name, profile.city || null, now, chamberId)
    .run();
  if (!claim.meta?.changes) {
    throw new AppError(ErrorCodes.CONFLICT, 'Chamber onboarding is already completed.', 409);
  }

  const statements: D1PreparedStatement[] = [];

  // 2. Chamber settings: create the row if missing, then update. Omitted optional values keep the
  //    stored value / column default (no defaults in code).
  const settingsId = await chamberKeyedId(c.env.DB, 'CSET', chamberId);
  statements.push(
    c.env.DB
      .prepare('INSERT OR IGNORE INTO chamber_settings (id, chamber_id, org_name) VALUES (?, ?, ?)')
      .bind(settingsId, chamberId, profile.org_name)
  );
  statements.push(
    c.env.DB
      .prepare(
        `UPDATE chamber_settings SET
           org_name = ?,
           support_email = COALESCE(?, support_email),
           default_currency = COALESCE(?, default_currency),
           timezone = COALESCE(?, timezone),
           primary_color = ?,
           text_color = COALESCE(?, text_color),
           background_color = COALESCE(?, background_color),
           logo_url = ?,
           hero_headline = ?,
           hero_tagline = ?,
           about_text = COALESCE(about_text, ?),
           onboarding_wizard_completed = 1
         WHERE chamber_id = ?`
      )
      .bind(
        profile.org_name,
        profile.support_email || null,
        profile.default_currency || null,
        profile.timezone || null,
        branding.primary_color,
        branding.text_color || null,
        branding.background_color || null,
        branding.logo_url || null,
        branding.hero_headline,
        branding.hero_tagline || null,
        branding.hero_tagline || null,
        chamberId
      )
  );

  // 3. Payment gateway (encrypted keys). Status reflects stored keys; real verification is OD-001.
  if (gateway && encryptedKeys) {
    const gwId = await chamberKeyedId(c.env.DB, 'GW', chamberId);
    statements.push(
      c.env.DB
        .prepare(
          `INSERT INTO payment_gateway_config (
             id, chamber_id, provider, publishable_key_encrypted, secret_key_encrypted, status, connected_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, 'connected', ?, ?)
           ON CONFLICT(chamber_id) DO UPDATE SET
             provider = excluded.provider,
             publishable_key_encrypted = excluded.publishable_key_encrypted,
             secret_key_encrypted = excluded.secret_key_encrypted,
             status = 'connected',
             connected_at = excluded.connected_at,
             updated_at = excluded.updated_at`
        )
        .bind(gwId, chamberId, gateway.provider, encryptedKeys.publishable, encryptedKeys.secret, now, now)
    );
  }

  // 4. Membership plans. Existing ids are only updated when they belong to this chamber.
  for (let i = 0; i < plans.length; i++) {
    const p = plans[i];
    const planId = p.id || (await newId(c.env.DB, 'membership_plans', 'PLAN', { chamberId }));
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
             updated_at = excluded.updated_at
           WHERE membership_plans.chamber_id = excluded.chamber_id`
        )
        .bind(
          planId,
          chamberId,
          p.name,
          p.accent_color || null,
          p.price,
          p.pricing_basis,
          p.billing_frequency,
          p.is_popular ? 1 : 0,
          JSON.stringify(p.features),
          i + 1,
          now,
          now
        )
    );
  }

  // 5. Audit (spec §14). Skipped for super admins, who have no chamber `users` row (FK).
  if (user?.id) {
    const logId = await newId(c.env.DB, 'activity_logs', 'ACT', { chamberId, suffixLength: 6, skipUniqueCheck: true });
    statements.push(
      c.env.DB
        .prepare(
          `INSERT INTO activity_logs (id, chamber_id, user_id, action, target_type, target_id, details_json)
           SELECT ?, ?, ?, 'chamber.onboarding_completed', 'chamber', ?, ?
           WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)`
        )
        .bind(
          logId,
          chamberId,
          user.id,
          chamberId,
          JSON.stringify({ plans: plans.length, gateway: gateway ? gateway.provider : null }),
          user.id
        )
    );
  }

  try {
    await c.env.DB.batch(statements);
  } catch (err) {
    await c.env.DB
      .prepare('UPDATE platform_chambers SET name = ?, city = ?, onboarded = 0, status = ?, updated_at = ? WHERE id = ?')
      .bind(prev?.name ?? profile.org_name, prev?.city ?? null, prev?.status ?? 'pending_setup', now, chamberId)
      .run();
    throw err;
  }

  const requestId = c.get('requestId');
  return c.json(
    successResponse(
      {
        chamber_id: chamberId,
        onboarded: true,
        status: 'active',
        plans_created: plans.length,
        message: 'Chamber onboarding completed successfully.',
      },
      { requestId }
    )
  );
});
