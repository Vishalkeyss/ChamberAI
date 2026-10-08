import { z } from 'zod';

/**
 * Prompt 03.2 Section 10: Directory Query Validation Schema
 */
export const directoryQuerySchema = z.object({
  q: z.string().max(100).optional(),
  industry: z.string().max(50).optional(),
  chapterId: z.string().optional(),
  chapter_id: z.string().optional(),
  city: z.string().max(50).optional(),
  verified: z
    .union([z.string(), z.boolean(), z.number()])
    .transform((v) => (v === 'true' || v === true || v === 1 || v === '1' ? 1 : 0))
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type DirectoryQueryParams = z.infer<typeof directoryQuerySchema>;
