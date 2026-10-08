import { z } from 'zod';

/** Prompt 05.2 §10 */
export const sendMessageSchema = z.object({
  recipientId: z.string().min(1),
  message: z.string().trim().min(1, 'Message cannot be empty').max(5000),
});

/** OD-065: up to 10 referred contacts per referral (§15). */
export const MAX_REFERRAL_CONTACTS = 10;

/** Prompt 05.3 §10 (+ optional referredBusinessId for contacts picked from the directory, OD-064). */
export const createReferralSchema = z.object({
  toBusinessId: z.string().min(1),
  message: z.string().trim().min(5, 'Introduction note must be at least 5 characters').max(2000),
  contacts: z
    .array(
      z.object({
        fullName: z.string().trim().min(2, 'Contact name must be at least 2 characters').max(100),
        email: z.string().trim().email('Invalid contact email').optional().or(z.literal('')),
        phone: z.string().trim().max(20).optional(),
        profession: z.string().trim().min(2, 'Profession / service needed is required').max(100),
        referredBusinessId: z.string().min(1).optional(),
      })
    )
    .min(1, 'At least one referred contact is required')
    .max(MAX_REFERRAL_CONTACTS, `At most ${MAX_REFERRAL_CONTACTS} contacts per referral`),
});

export const updateReferralStatusSchema = z.object({
  status: z.enum(['contacted', 'converted', 'declined']),
  convertedValue: z.number().nonnegative().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateReferralInput = z.infer<typeof createReferralSchema>;
export type UpdateReferralStatusInput = z.infer<typeof updateReferralStatusSchema>;
