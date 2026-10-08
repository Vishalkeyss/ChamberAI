import { z } from 'zod';

/** API stage values (spec §6). DB keeps `proposal` for `proposal_sent` (OD-080). */
export const CRM_STAGES = ['lead', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost'] as const;
export type CrmStage = (typeof CRM_STAGES)[number];

export const stageToDb = (stage: CrmStage): string => (stage === 'proposal_sent' ? 'proposal' : stage);
export const stageFromDb = (stage: string | null): CrmStage =>
  (stage === 'proposal' ? 'proposal_sent' : (CRM_STAGES as readonly string[]).includes(stage || '') ? stage : 'lead') as CrmStage;

/** YYYY-MM-DD or a full ISO date-time. */
const dateString = z
  .string()
  .trim()
  .refine((v) => /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v) && !Number.isNaN(Date.parse(v)), 'Invalid date');

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

/** §10 CreateCrmContactSchema (+ follow_up_date / linked_user_id, OD-082 / OD-083). */
export const createCrmContactSchema = z.object({
  name: z.string().trim().min(2, 'Contact name is required').max(100),
  company_name: optionalText(100),
  email: z.string().trim().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: optionalText(30),
  stage: z.enum(CRM_STAGES).default('lead'),
  deal_value: z.number().nonnegative().max(1_000_000_000).default(0),
  expected_close_date: dateString.optional().nullable().or(z.literal('')),
  follow_up_date: dateString.optional().nullable().or(z.literal('')),
  notes: z.string().max(2000).optional().nullable(),
  linked_user_id: z.string().min(1).optional().nullable(),
});

export const updateCrmContactSchema = createCrmContactSchema.partial();

/** §10 UpdateContactStageSchema */
export const updateContactStageSchema = z.object({ stage: z.enum(CRM_STAGES) });

/** OD-081 interaction log entry. */
export const createActivitySchema = z.object({
  type: z.enum(['note', 'call', 'meeting', 'email']).default('note'),
  body: z.string().trim().min(1, 'Note cannot be empty').max(2000),
});

export type CreateCrmContactInput = z.infer<typeof createCrmContactSchema>;
export type UpdateCrmContactInput = z.infer<typeof updateCrmContactSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
