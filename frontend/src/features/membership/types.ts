export type PricingBasis = 'flat' | 'by_employee_count' | 'by_annual_revenue';
export type BillingFrequency = 'monthly' | 'annual' | 'one_time';

export interface ChapterOverride {
  chapter_id: string;
  price: number;
}

export interface TierBracket {
  min: number;
  max: number | null;
  price: number;
  chapter_overrides?: ChapterOverride[];
}

export interface MembershipPlan {
  id: string;
  name: string;
  accentColor: string;
  price: number;
  pricingBasis: PricingBasis;
  pricingTiers: TierBracket[];
  billingFrequency: BillingFrequency;
  isPopular: number;
  features: string[];
  isActive?: number;
  activeMembersCount?: number;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string | null;
}

export interface CalculateDuesParams {
  planId: string;
  employeeCount?: number | null;
  annualRevenue?: number | null;
  chapterId?: string | null;
}

export interface CalculateDuesResult {
  planId: string;
  calculatedPrice: number;
  billingFrequency: BillingFrequency;
  pricingBasis: PricingBasis;
  appliedTier: TierBracket | null;
  isChapterOverride: boolean;
  fallbackApplied?: boolean;
}

export interface ChapterOption {
  id: string;
  name: string;
  city_region?: string | null;
}

export interface CreatePlanPayload {
  name: string;
  accentColor?: string;
  price: number;
  pricingBasis: PricingBasis;
  pricingTiers?: TierBracket[];
  billingFrequency: BillingFrequency;
  isPopular?: number | boolean;
  features: string[];
  sortOrder?: number;
  isActive?: number | boolean;
}

export interface UpdatePlanPayload extends Partial<CreatePlanPayload> {}
