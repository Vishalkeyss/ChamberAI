export type ChamberLifecycleStatus = 'active' | 'suspended' | 'pending_setup';
export type DomainVerificationStatus = 'verified' | 'pending_dns' | 'none';

export interface ChamberSetupStep {
  key: string;
  label: string;
  done: boolean;
}

export interface ChamberSetupProgress {
  percent: number;
  completedSteps: number;
  totalSteps: number;
  steps: ChamberSetupStep[];
}

export interface PlatformChamber {
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
  setupProgress?: ChamberSetupProgress;
}

export interface ProvisionChamberPayload {
  name: string;
  city: string;
  subdomain: string;
  custom_domain?: string | null;
  admin_name: string;
  admin_email: string;
  admin_phone?: string | null;
}

export interface UpdateChamberStatusPayload {
  status: ChamberLifecycleStatus;
  reason?: string;
}

export interface SuperChambersPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
