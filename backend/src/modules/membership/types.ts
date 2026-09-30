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

export interface MembershipPlanRecord {
  id: string;
  chamber_id: string;
  name: string;
  accent_color: string | null;
  price: number;
  pricing_basis: PricingBasis;
  pricing_tiers_json: string | null;
  billing_frequency: BillingFrequency;
  is_popular: number;
  features_json: string | null;
  is_active: number;
  active_members_count: number;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
}

export interface MembershipPlanDTO {
  id: string;
  chamberId: string;
  name: string;
  accentColor: string;
  price: number;
  pricingBasis: PricingBasis;
  pricingTiers: TierBracket[];
  billingFrequency: BillingFrequency;
  isPopular: number;
  features: string[];
  isActive: number;
  activeMembersCount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreatePlanDTO {
  name: string;
  accentColor?: string;
  price?: number;
  pricingBasis: PricingBasis;
  pricingTiers?: TierBracket[];
  billingFrequency?: BillingFrequency;
  isPopular?: number | boolean;
  features?: string[];
  sortOrder?: number;
}

export interface UpdatePlanDTO {
  name?: string;
  accentColor?: string;
  price?: number;
  pricingBasis?: PricingBasis;
  pricingTiers?: TierBracket[];
  billingFrequency?: BillingFrequency;
  isPopular?: number | boolean;
  features?: string[];
  sortOrder?: number;
  isActive?: number | boolean;
}

export interface CalculateDuesParams {
  planId: string;
  employeeCount?: number;
  annualRevenue?: number;
  chapterId?: string;
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
