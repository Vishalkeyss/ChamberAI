import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PricingCalculatorService } from '../modules/membership/services/pricing-calculator.service';
import {
  createPlanSchema,
  tierBracketSchema,
} from '../modules/membership/validation/plans.validation';

describe('Pricing Engine - Unit Tests', () => {
  it('1. Flat Pricing: Given price 500, verify calculated dues is 500', () => {
    const plan = {
      id: 'plan_flat_01',
      price: 500,
      pricingBasis: 'flat' as const,
      pricingTiers: [],
      billingFrequency: 'annual' as const,
    };

    const res = PricingCalculatorService.calculate(plan, { planId: plan.id });
    assert.equal(res.calculatedPrice, 500);
    assert.equal(res.isChapterOverride, false);
    assert.equal(res.appliedTier, null);
  });

  it('2. Employee Tier Matching: Correctly matches brackets, boundary 0, and open-ended tier', () => {
    const plan = {
      id: 'plan_tiered_emp',
      price: 0,
      pricingBasis: 'by_employee_count' as const,
      pricingTiers: [
        { min: 1, max: 10, price: 100 },
        { min: 11, max: 50, price: 250 },
        { min: 51, max: null, price: 500 },
      ],
      billingFrequency: 'annual' as const,
    };

    // Input 5 -> $100
    const res5 = PricingCalculatorService.calculate(plan, { planId: plan.id, employeeCount: 5 });
    assert.equal(res5.calculatedPrice, 100);
    assert.equal(res5.appliedTier?.min, 1);
    assert.equal(res5.appliedTier?.max, 10);

    // Input 11 -> $250
    const res11 = PricingCalculatorService.calculate(plan, { planId: plan.id, employeeCount: 11 });
    assert.equal(res11.calculatedPrice, 250);
    assert.equal(res11.appliedTier?.min, 11);
    assert.equal(res11.appliedTier?.max, 50);

    // Input 0 -> $100 (lowest bracket boundary handling)
    const res0 = PricingCalculatorService.calculate(plan, { planId: plan.id, employeeCount: 0 });
    assert.equal(res0.calculatedPrice, 100);
    assert.equal(res0.appliedTier?.min, 1);

    // Input 75 with open-ended tier [51+: $500] -> $500
    const res75 = PricingCalculatorService.calculate(plan, { planId: plan.id, employeeCount: 75 });
    assert.equal(res75.calculatedPrice, 500);
    assert.equal(res75.appliedTier?.min, 51);
    assert.equal(res75.appliedTier?.max, null);
  });

  it('3. Chapter Overrides: Bracket override replaces base bracket price', () => {
    const plan = {
      id: 'plan_override_test',
      price: 0,
      pricingBasis: 'by_employee_count' as const,
      pricingTiers: [
        {
          min: 1,
          max: 10,
          price: 150,
          chapter_overrides: [
            { chapter_id: 'chap_downtown', price: 120 },
            { chapter_id: 'chap_north', price: 135 },
          ],
        },
        {
          min: 11,
          max: null,
          price: 300,
          chapter_overrides: [{ chapter_id: 'chap_downtown', price: 270 }],
        },
      ],
      billingFrequency: 'annual' as const,
    };

    // Downtown chapter gets 120 for 5 employees
    const resDowntown = PricingCalculatorService.calculate(plan, {
      planId: plan.id,
      employeeCount: 5,
      chapterId: 'chap_downtown',
    });
    assert.equal(resDowntown.calculatedPrice, 120);
    assert.equal(resDowntown.isChapterOverride, true);

    // Other chapter falls back to standard bracket price 150
    const resEast = PricingCalculatorService.calculate(plan, {
      planId: plan.id,
      employeeCount: 5,
      chapterId: 'chap_east',
    });
    assert.equal(resEast.calculatedPrice, 150);
    assert.equal(resEast.isChapterOverride, false);
  });

  it('4. Annual Revenue Tier Matching and Fallback Clamping', () => {
    const plan = {
      id: 'plan_revenue_test',
      price: 0,
      pricingBasis: 'by_annual_revenue' as const,
      pricingTiers: [
        { min: 0, max: 250000, price: 300 },
        { min: 250001, max: 1000000, price: 600 },
      ],
      billingFrequency: 'annual' as const,
    };

    // Revenue $150k -> $300
    const res150k = PricingCalculatorService.calculate(plan, {
      planId: plan.id,
      annualRevenue: 150000,
    });
    assert.equal(res150k.calculatedPrice, 300);

    // Revenue $5M exceeds all defined brackets without open-ended -> clamps to highest ($600) with fallbackApplied
    const res5M = PricingCalculatorService.calculate(plan, {
      planId: plan.id,
      annualRevenue: 5000000,
    });
    assert.equal(res5M.calculatedPrice, 600);
    assert.equal(res5M.fallbackApplied, true);
  });

  it('5. Validation: Overlapping tiers and inverted ranges reject with Zod error', () => {
    // Inverted min/max
    const invertedTier = tierBracketSchema.safeParse({
      min: 50,
      max: 20,
      price: 100,
    });
    assert.equal(invertedTier.success, false);

    // Overlapping tiers in createPlanSchema
    const overlappingPlan = createPlanSchema.safeParse({
      name: 'Overlap Tier Plan',
      pricingBasis: 'by_employee_count',
      pricingTiers: [
        { min: 1, max: 20, price: 100 },
        { min: 15, max: 50, price: 200 }, // Overlaps 15 <= 20
      ],
    });
    assert.equal(overlappingPlan.success, false);

    // Non-flat plan without tiers
    const emptyTiersPlan = createPlanSchema.safeParse({
      name: 'No Tiers Plan',
      pricingBasis: 'by_employee_count',
      pricingTiers: [],
    });
    assert.equal(emptyTiersPlan.success, false);
  });
});
