import { z } from 'zod';

export const updateBusinessProfileSchema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters').max(150).trim(),
  dbaName: z.string().max(100).optional().nullable(),
  logoUrl: z.string().nullable().optional(),
  tagline: z.string().max(150).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  industry: z.string().min(2, 'Industry category is required').max(100),
  businessPhone: z.string().max(20).optional().nullable(),
  businessEmail: z.string().email('Invalid email address').optional().or(z.literal('')).nullable(),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')).nullable(),
  streetAddress: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  socialLinks: z.record(z.string().url('Invalid social link URL').or(z.literal(''))).optional().default({}),
  skills: z.array(z.string().max(50)).default([]),
  interests: z.array(z.string().max(50)).default([]),
  locations: z.array(z.string().max(100)).default([]),
  relatedOrganizations: z.array(
    z.object({
      memberId: z.string().optional(),
      businessName: z.string(),
      relationshipType: z.string(),
      linkedAt: z.string().optional(),
    })
  ).default([]),
});

export const inviteRepresentativeSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50).trim(),
  lastName: z.string().min(1, 'Last name is required').max(50).trim(),
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  jobTitle: z.string().max(100).optional().nullable(),
  accessLevel: z.enum(['full_access', 'billing_only', 'events_networking']),
});
