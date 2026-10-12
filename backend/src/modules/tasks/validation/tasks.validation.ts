import { z } from 'zod';

/** OD-084: status keeps the canonical DB value `done` (spec "completed"); priority adds `urgent`. */
export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

const dueDate = z
  .string()
  .trim()
  .refine((v) => /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v) && !Number.isNaN(Date.parse(v)), 'Invalid due date');

/** §10 CreateTaskSchema (+ optional status for the per-column quick-add bar). */
export const createTaskSchema = z.object({
  title: z.string().trim().min(2, 'Task title is required').max(200),
  description: z.string().max(2000).optional().nullable(),
  crm_contact_id: z.string().min(1).optional().nullable(),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  status: z.enum(TASK_STATUSES).default('todo'),
  due_date: dueDate.optional().nullable().or(z.literal('')),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(2, 'Task title is required').max(200),
    description: z.string().max(2000).nullable(),
    crm_contact_id: z.string().min(1).nullable(),
    priority: z.enum(TASK_PRIORITIES),
    status: z.enum(TASK_STATUSES),
    due_date: dueDate.nullable().or(z.literal('')),
    sort_order: z.number().int().min(0).max(1_000_000),
  })
  .partial();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
