import { z } from 'zod';

export const PayInvoiceSchema = z.object({
  payment_method_id: z.string().optional().nullable(),
  gateway_token: z.string().optional().nullable(),
  card_details: z
    .object({
      brand: z.string().optional(),
      number: z.string().optional(),
      last_four: z.string().length(4).regex(/^\d{4}$/).optional(),
      expiry_month: z.number().int().min(1).max(12).optional(),
      expiry_year: z.number().int().min(2025).max(2045).optional(),
      save_card: z.boolean().optional(),
    })
    .optional()
    .nullable(),
}).refine(
  (data) => data.payment_method_id || data.gateway_token || data.card_details,
  {
    message: 'Must provide either a saved payment_method_id, a gateway_token, or card_details',
  }
);

export const AddPaymentMethodSchema = z.object({
  type: z.enum(['card', 'bank_account', 'upi']).default('card'),
  brand: z.string().min(2).default('Visa'),
  last_four: z.string().length(4).regex(/^\d{4}$/),
  expiry_month: z.number().int().min(1).max(12),
  expiry_year: z.number().int().min(2025).max(2045),
  is_default: z.boolean().default(false),
  gateway_token_encrypted: z.string().optional(),
});
