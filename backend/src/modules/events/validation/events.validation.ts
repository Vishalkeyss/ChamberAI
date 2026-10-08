import { z } from 'zod';

/**
 * Prompt 04.1 Section 10: Events Query Validation Schema
 */
export const eventsQuerySchema = z.object({
  timeframe: z.enum(['upcoming', 'past']).default('upcoming'),
  category: z.string().optional(),
  chapterId: z.string().optional(),
  chapter_id: z.string().optional(),
  isVirtual: z
    .union([z.string(), z.boolean(), z.number()])
    .transform((v) => (v === 'true' || v === true || v === 1 || v === '1' ? 1 : 0))
    .optional(),
  is_virtual: z
    .union([z.string(), z.boolean(), z.number()])
    .transform((v) => (v === 'true' || v === true || v === 1 || v === '1' ? 1 : 0))
    .optional(),
  isPaid: z
    .union([z.string(), z.boolean(), z.number()])
    .transform((v) => (v === 'true' || v === true || v === 1 || v === '1' ? 1 : 0))
    .optional(),
  is_paid: z
    .union([z.string(), z.boolean(), z.number()])
    .transform((v) => (v === 'true' || v === true || v === 1 || v === '1' ? 1 : 0))
    .optional(),
  city: z.string().max(50).optional(),
  q: z.string().max(100).optional(),
  // Use preprocess to guard against empty strings or NaN before coercion
  page: z.preprocess(
    (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 1 ? n : 1;
    },
    z.number().int().positive().default(1)
  ),
  limit: z.preprocess(
    (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 1 && n <= 50 ? n : 12;
    },
    z.number().int().min(1).max(50).default(12)
  ),
});

export type EventsQueryParams = z.infer<typeof eventsQuerySchema>;


/**
 * Prompt 04.2 Section 10: Toggle Check-in Validation Schema
 */
export const toggleCheckInSchema = z.object({
  isCheckedIn: z
    .union([z.boolean(), z.number(), z.string()])
    .transform((v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0)),
});

export type ToggleCheckInInput = z.infer<typeof toggleCheckInSchema>;

/**
 * Attendee search & filtering query schema
 */
export const attendeeQuerySchema = z.object({
  q: z.string().max(100).optional(),
  ticketTypeId: z.string().optional(),
  ticket_type_id: z.string().optional(),
  checkInStatus: z.enum(['all', 'checked_in', 'not_checked_in']).default('all'),
  check_in_status: z.enum(['all', 'checked_in', 'not_checked_in']).optional(),
  status: z.enum(['all', 'confirmed', 'waitlisted', 'cancelled']).default('all'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type AttendeeQueryParams = z.infer<typeof attendeeQuerySchema>;

/**
 * Event Registration validation schema for members and guests
 */
export const eventRegisterSchema = z.object({
  ticketTypeId: z.string().optional(),
  promoCode: z.string().max(30).optional(),
  redeemPoints: z.number().int().nonnegative().optional(),
  paymentMethodId: z.string().optional(),
  guestDetails: z
    .object({
      name: z.string().min(2).max(100),
      email: z.string().email(),
      phone: z.string().optional(),
      company: z.string().optional(),
    })
    .optional(),
});

export type EventRegisterInput = z.infer<typeof eventRegisterSchema>;
