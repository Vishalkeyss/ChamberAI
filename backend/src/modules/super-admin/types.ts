import { z } from 'zod';

export type ChamberLifecycleStatus = 'active' | 'suspended' | 'pending_setup';
export type DomainVerificationStatus = 'verified' | 'pending_dns' | 'none';

export interface PlatformChamberDTO {
  id: string;
  name: string;
  city: string | null;
  subdomain: string;
  customDomain: string | null;
  domainStatus: DomainVerificationStatus;
  adminContactName: string | null;
  adminEmail: string | null;
  status: ChamberLifecycleStatus;
  onboarded: boolean;
  r2BucketName: string | null;
  membersCount: number;
  revenueTotal: number;
  createdAt: string;
  updatedAt: string | null;
}

export const ProvisionChamberSchema = z.object({
  name: z.string().min(2, 'Chamber name must be at least 2 characters').max(100),
  city: z.string().min(2).max(60),
  subdomain: z
    .string()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(30)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Subdomain must be lowercase alphanumeric and hyphens only'),
  custom_domain: z.string().max(100).optional().nullable(),
  admin_name: z.string().min(2, 'Admin contact name must be at least 2 characters').max(100),
  admin_email: z.string().email('Invalid email address'),
});

export type ProvisionChamberInput = z.infer<typeof ProvisionChamberSchema>;

export const UpdateChamberStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'pending_setup']),
  reason: z.string().max(500).optional(),
});

export type UpdateChamberStatusInput = z.infer<typeof UpdateChamberStatusSchema>;

export const SuperChambersQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['all', 'active', 'suspended', 'pending_setup']).optional().default('all'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(25),
});

export type SuperChambersQuery = z.infer<typeof SuperChambersQuerySchema>;
