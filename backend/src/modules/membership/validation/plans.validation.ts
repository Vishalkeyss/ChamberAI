import { z } from 'zod';

export const chapterOverrideSchema = z.object({
  chapter_id: z.string().min(1, 'Chapter ID is required'),
  price: z.number().nonnegative('Override price must be non-negative'),
});

export const tierBracketSchema = z
  .object({
    min: z.number().int().nonnegative('Minimum bracket value must be non-negative'),
    max: z.number().int().nonnegative('Maximum bracket value must be non-negative').nullable(),
    price: z.number().nonnegative('Bracket price must be non-negative'),
    chapter_overrides: z.array(chapterOverrideSchema).optional(),
  })
  .refine(
    (data) => data.max === null || data.max >= data.min,
    {
      message: 'Tier max must be greater than or equal to min',
      path: ['max'],
    }
  );

export const createPlanSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
    accentColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid 6-character hex color')
      .default('#2563EB'),
    price: z.number().nonnegative('Base price must be non-negative').default(0),
    pricingBasis: z.enum(['flat', 'by_employee_count', 'by_annual_revenue']),
    pricingTiers: z.array(tierBracketSchema).default([]),
    billingFrequency: z.enum(['monthly', 'annual', 'one_time']).default('annual'),
    isPopular: z
      .union([z.boolean(), z.number()])
      .transform((v) => (v ? 1 : 0))
      .default(0),
    features: z.array(z.string().min(1).max(200)).default([]),
    sortOrder: z.number().int().default(0),
    isActive: z
      .union([z.boolean(), z.number()])
      .transform((v) => (v ? 1 : 0))
      .default(1),
  })
  .superRefine((data, ctx) => {
    if (data.pricingBasis !== 'flat' && data.pricingTiers.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tiered pricing models must define at least one bracket in pricingTiers',
        path: ['pricingTiers'],
      });
    }

    // Check for overlapping brackets if multiple brackets are defined
    if (data.pricingTiers.length > 1) {
      const sorted = [...data.pricingTiers].sort((a, b) => a.min - b.min);
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];

        // If current has no max (open-ended), no subsequent bracket can follow
        if (current.max === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Open-ended bracket starting at ${current.min} must be the last tier`,
            path: ['pricingTiers', i, 'max'],
          });
          break;
        }

        // Overlap condition: next.min <= current.max
        if (next.min <= current.max) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Bracket [${current.min}-${current.max}] overlaps with bracket [${next.min}-${next.max ?? '∞'}]`,
            path: ['pricingTiers', i + 1, 'min'],
          });
        }
      }
    }
  });

export const updatePlanSchema = z
  .object({
    name: z.string().min(2).max(100).trim().optional(),
    accentColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid 6-character hex color')
      .optional(),
    price: z.number().nonnegative().optional(),
    pricingBasis: z.enum(['flat', 'by_employee_count', 'by_annual_revenue']).optional(),
    pricingTiers: z.array(tierBracketSchema).optional(),
    billingFrequency: z.enum(['monthly', 'annual', 'one_time']).optional(),
    isPopular: z
      .union([z.boolean(), z.number()])
      .transform((v) => (v ? 1 : 0))
      .optional(),
    features: z.array(z.string().min(1).max(200)).optional(),
    sortOrder: z.number().int().optional(),
    isActive: z
      .union([z.boolean(), z.number()])
      .transform((v) => (v ? 1 : 0))
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.pricingBasis && data.pricingBasis !== 'flat' && data.pricingTiers && data.pricingTiers.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tiered pricing models must define at least one bracket in pricingTiers',
        path: ['pricingTiers'],
      });
    }

    if (data.pricingTiers && data.pricingTiers.length > 1) {
      const sorted = [...data.pricingTiers].sort((a, b) => a.min - b.min);
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];

        if (current.max === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Open-ended bracket starting at ${current.min} must be the last tier`,
            path: ['pricingTiers', i, 'max'],
          });
          break;
        }

        if (next.min <= current.max) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Bracket [${current.min}-${current.max}] overlaps with bracket [${next.min}-${next.max ?? '∞'}]`,
            path: ['pricingTiers', i + 1, 'min'],
          });
        }
      }
    }
  });

export const calculateDuesSchema = z.object({
  planId: z.string().min(1, 'planId is required'),
  employeeCount: z.number().int().nonnegative('employeeCount must be >= 0').optional().nullable(),
  annualRevenue: z.number().nonnegative('annualRevenue must be >= 0').optional().nullable(),
  chapterId: z.string().optional().nullable(),
});

export const toggleStatusSchema = z.object({
  isActive: z.union([z.boolean(), z.number()]).transform((v) => (v ? 1 : 0)),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type CalculateDuesInput = z.infer<typeof calculateDuesSchema>;
export type ToggleStatusInput = z.infer<typeof toggleStatusSchema>;
