import React, { useState, useEffect } from 'react';
import type { ChapterOption, MembershipPlan } from '../types';
import { fetchActiveChapters, fetchPublicPlans } from '../services/plans.api';
import { PricingCard } from '../components/PricingCard';
import { ApplyPlanModal } from '../components/ApplyPlanModal';
import { toast } from 'sonner';

export interface PublicPricingPageProps {
  chamberName?: string;
  chamberSlug?: string;
  isMember?: boolean;
  onJoinPlan?: (plan: MembershipPlan, price: number, chapterId?: string) => void;
  onUpgradePlan?: (plan: MembershipPlan, price: number) => void;
  onTrackApplication?: (code: string) => void;
}

export const PublicPricingPage: React.FC<PublicPricingPageProps> = ({
  chamberName = 'the Chamber',
  chamberSlug,
  isMember = false,
  onJoinPlan,
  onUpgradePlan,
  onTrackApplication,
}) => {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Application Modal state
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [plansData, chaptersData] = await Promise.all([
        fetchPublicPlans(chamberSlug).catch(() => []),
        fetchActiveChapters(chamberSlug).catch(() => []),
      ]);
      setPlans(plansData || []);
      setChapters(chaptersData || []);
    } catch {
      setPlans([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [chamberSlug]);

  const activePlans = plans;

  const handleApplyClick = (plan: MembershipPlan) => {
    if (isMember && onUpgradePlan) {
      onUpgradePlan(plan, plan.price);
      return;
    }
    setSelectedPlan(plan);
    setIsApplyModalOpen(true);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 py-10 sm:py-14">
      {/* Section Header matching prototype */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Membership Plans
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Choose the plan that fits your business
        </p>
      </div>

      {/* Cards Horizontal Responsive Grid or Empty State */}
      {activePlans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">No membership plans currently available</p>
          <p className="text-xs text-slate-400 mt-1">Please check back soon or contact the chamber office directly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {activePlans.map((plan) => (
            <PricingCard
              key={plan.id || plan.name}
              plan={plan}
              isMember={isMember}
              onJoinClick={handleApplyClick}
              onUpgradeClick={(p) => onUpgradePlan?.(p, p.price)}
            />
          ))}
        </div>
      )}

      {/* Exact Application Form Modal matching reference prototype & user screenshot */}
      <ApplyPlanModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        plan={selectedPlan}
        chamberName={chamberName}
        chamberSlug={chamberSlug}
        chapters={chapters}
        onTrackApplication={onTrackApplication}
      />
    </div>
  );
};
