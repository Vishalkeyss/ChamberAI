import { z } from 'zod';

export const submitApplicationSchema = z.object({
  applicantName: z.string().min(2, 'Applicant name must be at least 2 characters').max(100).trim(),
  businessEmail: z.string().email('Invalid email address').trim().toLowerCase(),
  businessPhone: z.string().min(7, 'Phone number must be at least 7 digits').max(25).optional(),
  businessName: z.string().min(2, 'Business name must be at least 2 characters').max(150).trim(),
  planId: z.string().min(1, 'Plan selection is required'),
  chapterId: z.string().optional().nullable(),
  customTrackingCode: z.string().optional(),
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
  }).optional().default({}),
});

export const resubmitApplicationSchema = z.object({
  applicantName: z.string().min(2).max(100).trim().optional(),
  businessPhone: z.string().min(7).max(25).optional().nullable(),
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
