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
// Prompt 04.3 §10. ticketTypeId is optional here because events without ticket tiers are
// priced from events.registration_fee / non_member_fee (OD-021); the service requires it
// whenever the event has tiers.
export const eventRegisterSchema = z.object({
  ticketTypeId: z.string().min(1).optional(),
  promoCode: z.string().trim().min(2).max(30).optional(),
  redeemPoints: z.number().int().nonnegative().optional(),
  paymentMethodId: z.string().min(1).optional(),
  guestDetails: z
    .object({
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().email(),
      phone: z.string().trim().max(30).optional(),
      company: z.string().trim().max(150).optional(),
    })
    .optional(),
});

export type EventRegisterInput = z.infer<typeof eventRegisterSchema>;

/** Prompt 04.3 §10 */
export const validatePromoSchema = z.object({
  code: z.string().trim().min(2).max(30),
  ticketTypeId: z.string().min(1).optional(),
});

export type ValidatePromoInput = z.infer<typeof validatePromoSchema>;

// ---------------------------------------------------------------------------
// Prompt 04.6 — Admin event creation / editing.
// Field set follows the reference UI mapped onto the canonical events schema
// (OD-031 visibility public|staff_only, OD-032 one price per ticket tier).
// ---------------------------------------------------------------------------

const money = z.coerce.number().nonnegative().max(1_000_000);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const adminTicketTypeSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(100),
  price: money,
  description: optionalText(500),
  allowPayLater: z.boolean().default(false),
  qtyLimit: z.coerce.number().int().positive().nullable().optional().transform((v) => v ?? null),
});

export const adminSponsorshipTierSchema = z.object({
  id: z.string().min(1).optional(),
  tierName: z.string().trim().min(1).max(100),
  amount: z.coerce.number().positive().max(1_000_000),
  benefits: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
});

export const adminPromoCodeSchema = z.object({
  id: z.string().min(1).optional(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/, 'Promo codes may only contain letters, numbers, - and _')
    .transform((v) => v.toUpperCase()),
  discountType: z.enum(['percentage', 'flat']),
  discountValue: z.coerce.number().positive(),
  maxUses: z.coerce.number().int().positive().nullable().optional().transform((v) => v ?? null),
  isActive: z.boolean().default(true),
});

/** Mirrors the reference UI recurrence picker; max occurrences enforced in the service. */
export const recurrenceSchema = z
  .object({
    freq: z.enum(['daily', 'weekly', 'monthly']),
    interval: z.coerce.number().int().min(1).max(52),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    endType: z.enum(['after', 'on']),
    count: z.coerce.number().int().min(1).optional(),
    until: z.string().datetime({ offset: true }).optional(),
    /** Browser Date.getTimezoneOffset() so weekdays/month days match the admin's local calendar */
    tzOffsetMinutes: z.coerce.number().int().min(-840).max(840).default(0),
  })
  .refine((r) => (r.endType === 'after' ? !!r.count : !!r.until), {
    message: 'Recurrence needs an occurrence count or an end date',
  });

const eventFieldsSchema = z.object({
  title: z.string().trim().min(3).max(200),
  category: z.string().trim().min(2).max(50),
  visibility: z.enum(['public', 'staff_only']).default('public'),
  eventDate: z.string().datetime({ offset: true }),
  eventEndDate: z.string().datetime({ offset: true }).optional().nullable(),
  city: optionalText(100),
  venue: z.string().trim().min(2).max(200),
  chapterId: z.string().min(1).optional().nullable(),
  groupId: z.string().min(1).optional().nullable(),
  tableArrangement: optionalText(50),
  numTables: z.coerce.number().int().positive().nullable().optional().transform((v) => v ?? null),
  maxCapacity: z.coerce.number().int().positive().nullable().optional().transform((v) => v ?? null),
  isPaid: z.boolean().default(false),
  registrationFee: money.default(0),
  allowNonMemberRegistration: z.boolean().default(true),
  nonMemberFee: money.nullable().optional().transform((v) => v ?? null),
  description: optionalText(20000),
  videoUrl: z.string().trim().url().max(500).optional().nullable().or(z.literal('')).transform((v) => v || null),
  photos: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  promoteFacebook: z.boolean().default(false),
  promoteMeetup: z.boolean().default(false),
  promoteEventbrite: z.boolean().default(false),
  ticketTypes: z.array(adminTicketTypeSchema).max(20).default([]),
  sponsorshipTiers: z.array(adminSponsorshipTierSchema).max(20).default([]),
  promoCodes: z.array(adminPromoCodeSchema).max(50).default([]),
});

export const createEventSchema = eventFieldsSchema.extend({
  recurrence: recurrenceSchema.optional().nullable(),
});

export const updateEventSchema = eventFieldsSchema.extend({
  /** Reference UI "Apply these changes to all events in this series" (dates stay per occurrence). */
  applyToSeries: z.boolean().default(false),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type RecurrenceInput = z.infer<typeof recurrenceSchema>;
export type AdminTicketTypeInput = z.infer<typeof adminTicketTypeSchema>;
export type AdminSponsorshipTierInput = z.infer<typeof adminSponsorshipTierSchema>;
export type AdminPromoCodeInput = z.infer<typeof adminPromoCodeSchema>;
