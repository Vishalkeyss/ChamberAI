import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  title: z.string().trim().max(100).optional().nullable(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid E.164 phone format')
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
