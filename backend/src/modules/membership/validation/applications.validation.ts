import { z } from 'zod';

const phoneSchema = z
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
  });

export const applicationPaymentMethodSchema = z.object({
  type: z.literal('card').default('card'),
  cardholderName: z.string().min(2, 'Cardholder name is required').max(100).trim(),
  brand: z.string().max(30).default('card'),
  lastFour: z.string().regex(/^\d{4}$/, 'Last four digits must be 4 numbers'),
  expiryMonth: z.number().int().min(1).max(12),
  expiryYear: z.number().int().min(2025).max(2099),
  gatewayToken: z.string().max(255).optional(),
});

export const submitApplicationSchema = z.object({
  applicantName: z.string().min(2, 'Applicant name must be at least 2 characters').max(100).trim(),
  businessEmail: z.string().email('Invalid email address').trim().toLowerCase(),
  businessPhone: phoneSchema.optional(),
  businessName: z.string().min(2, 'Business name must be at least 2 characters').max(150).trim(),
  planId: z.string().min(1, 'Plan selection is required'),
  chapterId: z.string().optional().nullable(),
  customTrackingCode: z.string().optional(),
  paymentMethod: applicationPaymentMethodSchema.optional().nullable(),
  businessDetails: z.object({
    dbaName: z.string().max(100).optional().nullable(),
    website: z.string().optional().nullable(),
    landingPage: z.string().optional().nullable(),
    industry: z.string().max(100).optional().default('General'),
    address: z.object({
      street: z.string().max(200).optional().default(''),
      city: z.string().max(100).optional().default(''),
      state: z.string().max(50).optional().default(''),
      zip: z.string().max(20).optional().default(''),
    }).optional(),
    employeeCount: z.number().int().nonnegative().optional().default(1),
    annualRevenue: z.number().nonnegative().optional().default(0),
    description: z.string().max(1000).optional().nullable(),
    jobTitle: z.string().max(100).optional().nullable(),
    preferredLanguage: z.string().max(10).optional().default('en'),
    socials: z.record(z.string()).optional(),
    staff: z.array(z.any()).optional(),
    paymentMethod: applicationPaymentMethodSchema.optional().nullable(),
  }).optional().default({}),
});

export const resubmitApplicationSchema = z.object({
  applicantName: z.string().min(2).max(100).trim().optional(),
  businessPhone: phoneSchema.optional().nullable(),
  businessName: z.string().min(2).max(150).trim().optional(),
  chapterId: z.string().optional().nullable(),
  businessDetails: z.object({
    dbaName: z.string().max(100).optional().nullable(),
    website: z.string().url().optional().or(z.literal('')).nullable(),
    industry: z.string().min(2).max(100).optional(),
    address: z.object({
      street: z.string().min(3).max(200),
      city: z.string().min(2).max(100),
      state: z.string().min(2).max(50),
      zip: z.string().min(3).max(20),
    }).optional(),
    employeeCount: z.number().int().nonnegative().optional(),
    annualRevenue: z.number().nonnegative().optional(),
    description: z.string().max(1000).optional().nullable(),
    jobTitle: z.string().max(100).optional().nullable(),
    preferredLanguage: z.string().max(10).optional(),
  }).optional(),
});

export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>;
export type ResubmitApplicationInput = z.infer<typeof resubmitApplicationSchema>;
