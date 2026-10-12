import { z } from 'zod';

const HEX_COLOR = /^#[0-9A-F]{6}$/i;

// Logo comes from the wizard as an uploaded image data URL or an existing asset path / URL.
const logoUrlSchema = z
  .string()
  .max(1_500_000, 'Logo is too large')
  .refine(
    (v) => /^data:image\/(png|jpeg|webp);base64,/.test(v) || v.startsWith('/') || /^https:\/\//.test(v),
    'Logo must be a PNG, JPG or WEBP image'
  );

/**
 * Prompt 13.2 §10 ChamberOnboardingSchema, using the field names the existing wizard and
 * `membership_plans` columns already use (provider / billing_frequency / DB pricing_basis values).
 * Currency / timezone / colours have no code defaults: when omitted the stored value
 * (or the DB column default) is kept.
 */
export const chamberOnboardingSchema = z.object({
  profile: z.object({
    org_name: z.string().trim().min(2).max(100),
    city: z.string().trim().max(60).optional(),
    support_email: z.string().trim().email().optional(),
    default_currency: z.string().trim().length(3).toUpperCase().optional(),
    timezone: z.string().trim().min(3).max(50).optional(),
  }),
  branding: z.object({
    primary_color: z.string().regex(HEX_COLOR),
    text_color: z.string().regex(HEX_COLOR).optional(),
    background_color: z.string().regex(HEX_COLOR).optional(),
    logo_url: logoUrlSchema.nullable().optional(),
    hero_headline: z.string().trim().min(3).max(100),
    hero_tagline: z.string().trim().max(250).optional(),
  }),
  payment_gateway: z
    .object({
      provider: z.enum(['stripe', 'razorpay', 'paypal']),
      publishable_key: z.string().trim().min(5).max(500),
      secret_key: z.string().trim().min(5).max(500),
    })
    .optional(),
  plans: z
    .array(
      z.object({
        id: z.string().max(80).optional(),
        name: z.string().trim().min(2).max(60),
        price: z.number().min(0),
        billing_frequency: z.enum(['annual', 'monthly']),
        pricing_basis: z.enum(['flat', 'by_employee_count', 'by_annual_revenue']),
        features: z.array(z.string().trim().min(1).max(200)).max(50),
        is_popular: z.boolean().default(false),
        accent_color: z.string().regex(HEX_COLOR).optional(),
      })
    )
    .max(20)
    .default([]),
});

export type ChamberOnboardingInput = z.infer<typeof chamberOnboardingSchema>;
