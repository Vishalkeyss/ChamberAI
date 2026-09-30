import { z } from 'zod';

export const portalEnum = z.enum([
  'member',
  'admin',
  'chamber_admin',
  'superadmin',
  'super_admin',
  'public',
]);

export type PortalType = z.infer<typeof portalEnum>;

/**
 * Normalizes portal string to canonical database enum values:
 * 'member' | 'chamber_admin' | 'super_admin' | 'public'
 */
export function normalizePortal(portal: PortalType): 'member' | 'chamber_admin' | 'super_admin' | 'public' {
  if (portal === 'admin') return 'chamber_admin';
  if (portal === 'superadmin') return 'super_admin';
  return portal;
}

/**
 * Detects whether the identifier is an email or a phone number.
 * Phone: no '@' symbol (digits, spaces, +, -, (), dots allowed)
 * Email: contains '@'
 */
export function detectIdentifierType(identifier: string): 'email' | 'phone' {
  return identifier.includes('@') ? 'email' : 'phone';
}

/**
 * Normalizes a phone identifier: strips all non-digit characters except leading +
 */
export function normalizePhone(phone: string): string {
  // Keep leading + if present
  const hasPlus = phone.startsWith('+');
  const digits = phone.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

const identifierSchema = z
  .string()
  .min(1, 'Email or phone number is required')
  .trim()
  .transform((val) => {
    if (val.includes('@')) return val.toLowerCase();
    return val.trim(); // phone — leave casing as-is, normalize later
  });

export const requestOtpSchema = z.object({
  identifier: identifierSchema,
  portal: portalEnum.default('member'),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  identifier: identifierSchema,
  code: z.string().regex(/^\d{6}$/, 'Verification code must be exactly 6 digits'),
  portal: portalEnum.default('member'),
});

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
