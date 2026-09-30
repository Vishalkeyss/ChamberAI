import type {
  BillingFrequency,
  CalculateDuesParams,
  CalculateDuesResult,
  MembershipPlanDTO,
  PricingBasis,
  TierBracket,
} from '../types';

export class PricingCalculatorService {
  /**
   * Calculates dynamic dues for a given membership plan and input parameters
   * strictly adhering to Section 8 of the Master Implementation Playbook.
   */
  static calculate(
    plan: {
      id: string;
      price: number;
      pricingBasis: PricingBasis;
      pricingTiers: TierBracket[];
      billingFrequency: BillingFrequency;
    },
    params: CalculateDuesParams
  ): CalculateDuesResult {
    const { employeeCount, annualRevenue, chapterId } = params;

    // 1. Flat Rate Pricing
    if (plan.pricingBasis === 'flat') {
      // Check if any chapter override exists for flat plan in the first bracket or plan tiers
      if (chapterId && plan.pricingTiers.length > 0) {
        const flatOverrides = plan.pricingTiers[0]?.chapter_overrides;
        const matched = flatOverrides?.find((o) => o.chapter_id === chapterId);
        if (matched) {
          return {
            planId: plan.id,
            calculatedPrice: matched.price,
            billingFrequency: plan.billingFrequency,
            pricingBasis: plan.pricingBasis,
            appliedTier: null,
            isChapterOverride: true,
          };
        }
      }

      return {
        planId: plan.id,
        calculatedPrice: plan.price,
        billingFrequency: plan.billingFrequency,
        pricingBasis: plan.pricingBasis,
        appliedTier: null,
        isChapterOverride: false,
      };
    }

    // 2. Tiered Models (by_employee_count or by_annual_revenue)
    const tiers = [...plan.pricingTiers].sort((a, b) => a.min - b.min);

    if (tiers.length === 0) {
      // Fallback to base plan price if tiers are empty
      return {
        planId: plan.id,
        calculatedPrice: plan.price,
        billingFrequency: plan.billingFrequency,
        pricingBasis: plan.pricingBasis,
        appliedTier: null,
        isChapterOverride: false,
      };
    }

    const isEmployee = plan.pricingBasis === 'by_employee_count';
    const rawVal = isEmployee ? (employeeCount ?? 0) : (annualRevenue ?? 0);
    const value = Math.max(0, rawVal);

    // Boundary Handling: If value = 0, evaluate against the lowest defined bracket
    let matchedTier: TierBracket | null = null;
    let fallbackApplied = false;

    if (value === 0) {
      matchedTier = tiers[0];
    } else {
      for (const tier of tiers) {
        const minMatches = value >= tier.min;
        const maxMatches = tier.max === null || value <= tier.max;

        if (minMatches && maxMatches) {
          matchedTier = tier;
          break;
        }
      }

      // If value is below lowest bracket min, use lowest bracket
      if (!matchedTier && value < tiers[0].min) {
        matchedTier = tiers[0];
      }

      // Fallback Clamping: If input exceeds all brackets and no open-ended bracket exists
      if (!matchedTier && value > (tiers[tiers.length - 1].max ?? 0)) {
        matchedTier = tiers[tiers.length - 1];
        fallbackApplied = true;
      }
    }

    if (!matchedTier) {
      matchedTier = tiers[0];
    }

    // Check for chapter override on the matched bracket
    if (chapterId && matchedTier.chapter_overrides && matchedTier.chapter_overrides.length > 0) {
      const override = matchedTier.chapter_overrides.find((o) => o.chapter_id === chapterId);
      if (override) {
        return {
          planId: plan.id,
          calculatedPrice: override.price,
          billingFrequency: plan.billingFrequency,
          pricingBasis: plan.pricingBasis,
          appliedTier: matchedTier,
          isChapterOverride: true,
          ...(fallbackApplied ? { fallbackApplied: true } : {}),
        };
      }
    }

    return {
      planId: plan.id,
      calculatedPrice: matchedTier.price,
      billingFrequency: plan.billingFrequency,
      pricingBasis: plan.pricingBasis,
      appliedTier: matchedTier,
      isChapterOverride: false,
      ...(fallbackApplied ? { fallbackApplied: true } : {}),
    };
  }
}
