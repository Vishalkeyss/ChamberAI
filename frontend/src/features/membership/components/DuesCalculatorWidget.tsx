import React, { useState, useEffect, useMemo } from 'react';
import type { ChapterOption, MembershipPlan, TierBracket } from '../types';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, DollarSign, MapPin, Sparkles, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DuesCalculatorWidgetProps {
  plan: MembershipPlan;
  chapters?: ChapterOption[];
  selectedChapterId?: string;
  onChapterChange?: (chapId: string) => void;
  employeeCount?: number | string;
  onEmployeeCountChange?: (val: string) => void;
  annualRevenue?: number | string;
  onAnnualRevenueChange?: (val: string) => void;
  onPriceChange?: (price: number, tier: TierBracket | null, isChapterOverride: boolean) => void;
  accentColor?: string;
  compact?: boolean;
}

export const DuesCalculatorWidget: React.FC<DuesCalculatorWidgetProps> = ({
  plan,
  chapters = [],
  selectedChapterId: controlledChapterId,
  onChapterChange,
  employeeCount: controlledEmployeeCount,
  onEmployeeCountChange,
  annualRevenue: controlledRevenue,
  onAnnualRevenueChange,
  onPriceChange,
  accentColor = '#0B2447',
  compact = false,
}) => {
  const isEmployeeBasis = plan.pricingBasis === 'by_employee_count';
  const isRevenueBasis = plan.pricingBasis === 'by_annual_revenue';

  const [internalEmployeeCount, setInternalEmployeeCount] = useState<number>(5);
  const [internalAnnualRevenue, setInternalAnnualRevenue] = useState<number>(250000);
  const [internalChapterId, setInternalChapterId] = useState<string>(controlledChapterId || 'all');

  const effectiveEmployeeCount =
    controlledEmployeeCount !== undefined
      ? Number(controlledEmployeeCount) || 0
      : internalEmployeeCount;

  const effectiveAnnualRevenue =
    controlledRevenue !== undefined
      ? Number(controlledRevenue) || 0
      : internalAnnualRevenue;

  const effectiveChapterId = controlledChapterId !== undefined ? controlledChapterId : internalChapterId;

  const handleEmployeeChange = (val: number) => {
    setInternalEmployeeCount(val);
    if (onEmployeeCountChange) {
      onEmployeeCountChange(val.toString());
    }
  };

  const handleRevenueChange = (val: number) => {
    setInternalAnnualRevenue(val);
    if (onAnnualRevenueChange) {
      onAnnualRevenueChange(val.toString());
    }
  };

  const handleChapterSelect = (val: string) => {
    setInternalChapterId(val);
    if (onChapterChange) {
      onChapterChange(val);
    }
  };

  // Deterministic calculation strictly mirroring backend PricingCalculatorService
  const calculation = useMemo(() => {
    if (plan.pricingBasis === 'flat') {
      return {
        price: plan.price,
        appliedTier: null,
        isChapterOverride: false,
        fallbackApplied: false,
      };
    }

    const tiers = [...(plan.pricingTiers || [])].sort((a, b) => a.min - b.min);
    if (tiers.length === 0) {
      return {
        price: plan.price,
        appliedTier: null,
        isChapterOverride: false,
        fallbackApplied: false,
      };
    }

    const rawVal = isEmployeeBasis ? effectiveEmployeeCount : effectiveAnnualRevenue;
    const value = Math.max(0, rawVal);

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

      if (!matchedTier && value < tiers[0].min) {
        matchedTier = tiers[0];
      }

      if (!matchedTier && value > (tiers[tiers.length - 1].max ?? 0)) {
        matchedTier = tiers[tiers.length - 1];
        fallbackApplied = true;
      }
    }

    if (!matchedTier) {
      matchedTier = tiers[0];
    }

    const activeChapter = effectiveChapterId === 'all' || !effectiveChapterId ? undefined : effectiveChapterId;
    if (activeChapter && matchedTier.chapter_overrides && matchedTier.chapter_overrides.length > 0) {
      const override = matchedTier.chapter_overrides.find((o) => o.chapter_id === activeChapter);
      if (override) {
        return {
          price: override.price,
          appliedTier: matchedTier,
          isChapterOverride: true,
          fallbackApplied,
        };
      }
    }

    return {
      price: matchedTier.price,
      appliedTier: matchedTier,
      isChapterOverride: false,
      fallbackApplied,
    };
  }, [plan, isEmployeeBasis, effectiveEmployeeCount, effectiveAnnualRevenue, effectiveChapterId]);

  useEffect(() => {
    if (onPriceChange) {
      onPriceChange(calculation.price, calculation.appliedTier, calculation.isChapterOverride);
    }
  }, [calculation, onPriceChange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 dark:border-gray-800 bg-[#F9FAFB] dark:bg-gray-900/50 p-4 space-y-4',
        compact ? 'p-3 space-y-3' : 'p-4'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Interactive Dues Calculation</span>
        </div>
        <div className="flex items-center gap-2">
          {calculation.isChapterOverride && (
            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200">
              Chapter Override
            </Badge>
          )}
          <span className="text-sm font-bold text-gray-900 dark:text-white px-2 py-0.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs">
            {formatCurrency(calculation.price)}
            <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400">
              /{plan.billingFrequency === 'monthly' ? 'mo' : 'yr'}
            </span>
          </span>
        </div>
      </div>

      {/* Employee Count Slider & Input */}
      {isEmployeeBasis && (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <Label className="text-gray-600 dark:text-gray-300 font-medium flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-gray-400" />
              <span>Number of Employees:</span>
            </Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                value={effectiveEmployeeCount || ''}
                onChange={(e) => handleEmployeeChange(Math.max(1, parseInt(e.target.value) || 1))}
                className="h-8 w-20 text-right text-xs font-semibold bg-white dark:bg-gray-800"
              />
              <span className="text-[11px] text-gray-400">staff</span>
            </div>
          </div>
          <Slider
            value={[effectiveEmployeeCount || 1]}
            min={1}
            max={250}
            step={1}
            onValueChange={([val]) => handleEmployeeChange(val)}
            className="cursor-pointer py-1"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>1</span>
            <span>25</span>
            <span>50</span>
            <span>100</span>
            <span>250+</span>
          </div>
        </div>
      )}

      {/* Annual Revenue Slider & Input */}
      {isRevenueBasis && (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <Label className="text-gray-600 dark:text-gray-300 font-medium flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-gray-400" />
              <span>Annual Gross Revenue ($):</span>
            </Label>
            <div className="w-32">
              <Input
                type="number"
                min={0}
                step={25000}
                value={effectiveAnnualRevenue || ''}
                onChange={(e) => handleRevenueChange(Math.max(0, parseInt(e.target.value) || 0))}
                className="h-8 text-right text-xs font-semibold bg-white dark:bg-gray-800"
              />
            </div>
          </div>
          <Slider
            value={[effectiveAnnualRevenue || 0]}
            min={0}
            max={2500000}
            step={25000}
            onValueChange={([val]) => handleRevenueChange(val)}
            className="cursor-pointer py-1"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>$0</span>
            <span>$500k</span>
            <span>$1M</span>
            <span>$2.5M+</span>
          </div>
        </div>
      )}

      {/* Regional Chapter Pricing Selector */}
      {chapters.length > 1 && (
        <div className="space-y-1.5 pt-1">
          <Label className="text-xs text-gray-600 dark:text-gray-300 font-medium flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-gray-400" />
            <span>Regional Chapter:</span>
          </Label>
          <Select value={effectiveChapterId} onValueChange={handleChapterSelect}>
            <SelectTrigger className="h-8 text-xs bg-white dark:bg-gray-800">
              <SelectValue placeholder="Standard Chamber-Wide" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Standard Chamber-Wide</SelectItem>
              {chapters.map((chap) => (
                <SelectItem key={chap.id} value={chap.id}>
                  {chap.name} {chap.city_region ? `(${chap.city_region})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Applied Bracket Feedback */}
      {calculation.appliedTier && (
        <div className="pt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200/80 dark:border-gray-800">
          <span className="flex items-center gap-1 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Applied Bracket:
          </span>
          <span className="font-semibold text-gray-800 dark:text-gray-200 text-[11px]">
            {calculation.appliedTier.min} – {calculation.appliedTier.max !== null && calculation.appliedTier.max < 999999 ? calculation.appliedTier.max : '∞'}{' '}
            {isEmployeeBasis ? 'employees' : isRevenueBasis ? 'USD revenue' : ''}
          </span>
        </div>
      )}
    </div>
  );
};

export default DuesCalculatorWidget;
