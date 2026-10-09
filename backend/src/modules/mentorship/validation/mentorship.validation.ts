import { z } from 'zod';

/** API statuses (spec §6). DB keeps `confirmed` / `rejected` (OD-090). */
export type MentorshipStatus = 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled';

const STATUS_FROM_DB: Record<string, MentorshipStatus> = {
  pending: 'pending',
  confirmed: 'accepted',
  rejected: 'declined',
  completed: 'completed',
  cancelled: 'cancelled',
};

export const statusFromDb = (status: string): MentorshipStatus => STATUS_FROM_DB[status] || 'pending';

/** §10 UpdateMentorProfileSchema. `is_mentee` is accepted but not stored — every member may request (OD-090). */
export const updateMentorProfileSchema = z.object({
  is_mentor: z.boolean(),
  is_mentee: z.boolean().optional(),
  expertise_areas: z.array(z.string().trim().min(2, 'Each expertise tag needs at least 2 characters').max(50)).max(10, 'Maximum 10 expertise tags'),
  years_of_experience: z.number().int().nonnegative().max(70),
  bio: z.string().trim().max(2000).optional().nullable(),
  max_mentees: z.number().int().min(1).max(20).default(3),
  is_available: z.boolean().default(true),
});

/** §10 CreateMentorshipRequestSchema */
export const createMentorshipRequestSchema = z.object({
  mentor_id: z.string().min(1, 'Mentor ID is required'),
  request_message: z.string().trim().min(20, 'Please provide a message of at least 20 characters').max(2000),
});

/** §10 ReviewMentorshipRequestSchema (+ optional mentee rating on completion, OD-096). */
export const reviewMentorshipRequestSchema = z.object({
  action: z.enum(['accept', 'decline', 'cancel', 'complete']),
  decline_reason: z.string().trim().max(500).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
});

/** OD-095 shared session notes. */
export const updateMentorshipNotesSchema = z.object({
  notes: z.string().max(5000).nullable(),
});

/** OD-098 admin moderation. */
export const adminMentorStatusSchema = z.object({
  status: z.enum(['active', 'paused']),
});

export type UpdateMentorProfileInput = z.infer<typeof updateMentorProfileSchema>;
export type CreateMentorshipRequestInput = z.infer<typeof createMentorshipRequestSchema>;
export type ReviewMentorshipRequestInput = z.infer<typeof reviewMentorshipRequestSchema>;
