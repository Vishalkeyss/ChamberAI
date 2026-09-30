import React from 'react';
import type { MembershipPlan } from '../types';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PricingCardProps {
  plan: MembershipPlan;
  isMember?: boolean;
  onJoinClick?: (plan: MembershipPlan) => void;
  onUpgradeClick?: (plan: MembershipPlan) => void;
  className?: string;
}

export const PricingCard: React.FC<PricingCardProps> = ({
  plan,
  isMember = false,
  onJoinClick,
  onUpgradeClick,
  className,
}) => {
  const isPopular = plan.isPopular === 1 || plan.isPopular === (true as any);
  const isTiered = plan.pricingBasis && plan.pricingBasis !== 'flat';

  const lowestPrice =
    isTiered && plan.pricingTiers && plan.pricingTiers.length > 0
      ? Math.min(...plan.pricingTiers.map((t) => t.price))
      : plan.price;

  const displayPrice = isTiered
    ? `From $${lowestPrice}/yr`
    : plan.price === 0
    ? '$0/yr'
    : `$${plan.price}/yr`;

  const handleAction = () => {
    if (isMember) {
      onUpgradeClick?.(plan);
    } else {
      onJoinClick?.(plan);
    }
  };

  return (
    <div
      className={cn(
        'relative bg-white dark:bg-[#111e38] rounded-2xl border p-6 flex flex-col justify-between transition-all duration-200 shadow-xs hover:shadow-md',
        isPopular
          ? 'border-[#92400E]/40 ring-1 ring-[#92400E]/20'
          : 'border-gray-200/90 dark:border-gray-800',
        className
      )}
    >
      {/* Most Popular Badge */}
      {isPopular && (
        <span
          className="absolute -top-3 left-6 px-3 py-0.5 rounded-full text-xs font-semibold text-white shadow-xs"
          style={{ background: '#92400E' }}
        >
          Most Popular
        </span>
      )}

      <div>
        {/* Plan Name */}
        <p
          className="font-semibold text-base"
          style={{ color: isPopular ? '#92400E' : (plan.accentColor || '#475569') }}
        >
          {plan.name}
        </p>

        {/* Price Display */}
        <p className="text-3xl font-bold mt-2 text-gray-900 dark:text-white tracking-tight">
          {displayPrice}
        </p>

        {isTiered && (
          <p className="text-xs mt-1 font-medium text-[#1E3A5F] dark:text-blue-400">
            Priced by your{' '}
            {plan.pricingBasis === 'by_employee_count'
              ? 'employee count'
              : 'annual revenue'}{' '}
            — exact price shown when you apply
          </p>
        )}

        {/* Features List */}
        <div className="mt-6 space-y-3">
          {(plan.features || []).map((feature, fIdx) => (
            <div
              key={fIdx}
              className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-200"
            >
              <CheckCircle2
                className="w-4 h-4 text-gray-700 dark:text-gray-300 shrink-0 mt-0.5"
                strokeWidth={1.8}
              />
              <span className="leading-snug">{feature}</span>
            </div>
          ))}
          {(!plan.features || plan.features.length === 0) && (
            <p className="text-xs italic text-gray-400">Standard chamber membership privileges</p>
          )}
        </div>
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={handleAction}
        className={cn(
          'w-full mt-8 py-2.5 px-4 rounded-xl font-semibold text-sm transition cursor-pointer',
          isPopular
            ? 'bg-[#0B2447] hover:bg-[#16385C] text-white shadow-xs active:scale-[0.99]'
            : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-white'
        )}
      >
        {isMember ? 'Upgrade Plan' : 'Apply Now'}
      </button>
    </div>
  );
};
