import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  title: z.string().trim().max(100).optional().nullable(),
  phone: z
    .string()
    .trim()
    .superRefine((val, ctx) => {
      if (!val) return;
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
    })
    .optional()
    .nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const notificationPrefItemSchema = z.object({
  category: z.enum(['announcements', 'events', 'invoices', 'referrals', 'messages']),
  channel: z.enum(['email', 'sms', 'in_app']),
  is_enabled: z.boolean(),
});

export const updateNotificationPrefsSchema = z.object({
  preferences: z.array(notificationPrefItemSchema).min(1, 'At least one preference must be provided'),
});

export type UpdateNotificationPrefsInput = z.infer<typeof updateNotificationPrefsSchema>;

export const savePersonalApiKeySchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google']),
  api_key: z.string().min(10, 'API key must be at least 10 characters').max(256),
});

export type SavePersonalApiKeyInput = z.infer<typeof savePersonalApiKeySchema>;
