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
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  const hasPlus = trimmed.startsWith('+');
  return hasPlus ? `+${digits}` : digits;
}

const identifierSchema = z
  .string()
  .min(1, 'Email or phone number is required')
  .trim()
  .superRefine((val, ctx) => {
    if (val.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please enter a valid email address',
        });
      }
    } else {
      if (!/^\+?[0-9\s\-().]{10,25}$/.test(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please enter a valid USA phone number (e.g., +1 (555) 019-2834)',
        });
        return;
      }
      if (val.startsWith('+') && !val.startsWith('+1') && !val.startsWith('+ 1')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'USA country code (+1) is required (e.g., +1 (555) 019-2834)',
        });
        return;
      }
      const digits = val.replace(/\D/g, '');
      if (digits.length === 10) {
        if (!/^[2-9]\d{9}$/.test(digits)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please enter a valid 10-digit USA area code and phone number',
          });
        }
      } else if (digits.length === 11) {
        if (!/^1[2-9]\d{9}$/.test(digits)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Phone number must start with USA country code +1 followed by a 10-digit number',
          });
        }
      } else {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please enter a valid USA phone number with country code +1 (e.g., +1 (555) 019-2834)',
        });
      }
    }
  })
  .transform((val) => {
    if (val.includes('@')) return val.toLowerCase();
    return val.trim();
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
