import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Users,
  CalendarDays,
  Star,
  ShoppingBag,
  ArrowRight,
  Handshake,
  QrCode,
  Calendar,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { MemberKpiCard } from '../components/MemberKpiCard';
import { OnboardingChecklistCard } from '../components/OnboardingChecklistCard';
import type { OnboardingSteps } from '../components/OnboardingChecklistCard';
import {
  fetchMemberOverview,
  completeOnboardingStep,
  type MemberOverviewData,
} from '../services/member-overview.api';

export interface MemberOverviewPageProps {
  onNavigateSection?: (sectionId: string) => void;
  onOpenCart?: () => void;
}

export const MemberOverviewPage: React.FC<MemberOverviewPageProps> = ({
  onNavigateSection,
  onOpenCart,
}) => {
  const [overview, setOverview] = useState<MemberOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchMemberOverview();
      setOverview(data);
    } catch (err: any) {
      console.error('[MEMBER_OVERVIEW_ERROR]', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleCompleteStep = async (stepKey: keyof OnboardingSteps) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await completeOnboardingStep(stepKey);
      // Optimistic update
      setOverview((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          onboarding: {
            ...prev.onboarding,
            steps: { ...prev.onboarding.steps, [stepKey]: true },
            completionPct: result.completionPct,
            isComplete: result.isComplete,
          },
          // If completion just happened, add 100 points
          kpis: result.isComplete && !prev.onboarding.isComplete
            ? { ...prev.kpis, pointsBalance: prev.kpis.pointsBalance + 100 }
            : prev.kpis,
        };
      });

      if (result.isComplete) {
        toast.success('🎉 Onboarding Completed! +100 Loyalty Points Credited.', {
          duration: 5000,
        });
      } else {
        toast.success(`Step "${stepKey}" completed! ${result.completionPct}% done.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete step');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute renewal badge
  const renewalBadge = overview?.membership.renewalDate
    ? (() => {
        const daysLeft = Math.ceil(
          (new Date(overview.membership.renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return daysLeft > 0 ? `${daysLeft} days left` : 'Expired';
      })()
    : undefined;

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12 transition-colors duration-200">
        {/* Skeleton KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card rounded-2xl border border-border p-5 shadow-xs animate-pulse">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-muted" />
                <div className="w-16 h-6 rounded-full bg-muted" />
              </div>
              <div className="w-24 h-7 bg-muted rounded mb-1" />
              <div className="w-20 h-4 bg-muted rounded" />
            </div>
          ))}
        </div>
        {/* Skeleton Checklist */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-xs animate-pulse">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="w-40 h-5 bg-muted rounded" />
              <div className="w-64 h-3 bg-muted rounded" />
              <div className="w-full h-1.5 bg-muted rounded-full" />
            </div>
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <div className="w-5 h-5 rounded-full bg-muted" />
                <div className="w-8 h-8 rounded-lg bg-muted" />
                <div className="flex-1 space-y-1">
                  <div className="w-48 h-4 bg-muted rounded" />
                  <div className="w-32 h-3 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-7xl mx-auto pb-12">
        <div className="bg-card rounded-2xl border border-destructive/30 p-8 text-center">
          <p className="text-sm text-destructive font-medium">{error}</p>
          <button
            type="button"
            onClick={loadOverview}
            className="mt-3 text-xs font-semibold text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!overview) return null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 transition-colors duration-200">
      {/* 1. Top 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Membership */}
        <MemberKpiCard
          icon={<Shield className="w-5 h-5" />}
          value={`${overview.membership.tierName} — ${overview.membership.status === 'active' ? 'Active' : overview.membership.status}`}
          label="Membership"
          badge={renewalBadge}
          onClick={() => onNavigateSection?.('membership')}
        />

        {/* Card 2: Referrals */}
        <MemberKpiCard
          icon={<Users className="w-5 h-5" />}
          value={`${overview.kpis.referralsGiven} / ${overview.kpis.referralsReceived}`}
          label="Referrals Given / Received"
          subtext="Submit a referral →"
          onClick={() => onNavigateSection?.('referrals')}
        />

        {/* Card 3: Events Attended */}
        <MemberKpiCard
          icon={<CalendarDays className="w-5 h-5" />}
          value={overview.kpis.eventsAttended}
          label="Events Attended"
          subtext="Browse Events →"
          onClick={() => onNavigateSection?.('events')}
        />

        {/* Card 4: Points Balance */}
        <MemberKpiCard
          icon={<Star className="w-5 h-5" />}
          value={overview.kpis.pointsBalance.toLocaleString()}
          label="Rewards & Points"
          subtext="Redeem Rewards →"
          onClick={() => onNavigateSection?.('rewards')}
        />
      </div>

      {/* 2. Interactive Onboarding Checklist */}
      <OnboardingChecklistCard
        steps={overview.onboarding.steps}
        completionPct={overview.onboarding.completionPct}
        isComplete={overview.onboarding.isComplete}
        onCompleteStep={handleCompleteStep}
        isSubmitting={isSubmitting}
      />

      {/* 3. Recent Activity Section */}
      <div className="bg-card text-card-foreground rounded-2xl border border-border p-6 shadow-xs transition-all duration-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-card-foreground">Recent Activity</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Your latest networking actions</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateSection && onNavigateSection('referrals')}
            className="text-xs font-semibold text-primary dark:text-[#38BDF8] hover:underline flex items-center gap-1"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Handshake className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs md:text-sm font-semibold text-card-foreground">
                  New referral sent to Samantha Cole
                </p>
                <p className="text-[11px] text-muted-foreground">Commercial Lease Review · Legal Services</p>
              </div>
            </div>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">2 hours ago</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs md:text-sm font-semibold text-card-foreground">
                  Registered for Annual Chamber Business Summit
                </p>
                <p className="text-[11px] text-muted-foreground">Grand Ballroom · Downtown Chapter</p>
              </div>
            </div>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">Yesterday</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 flex items-center justify-center shrink-0">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs md:text-sm font-semibold text-card-foreground">
                  Digital vCard exchanged with Metro Innovation Hub
                </p>
                <p className="text-[11px] text-muted-foreground">Contact saved to lightweight CRM</p>
              </div>
            </div>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">3 days ago</span>
          </div>
        </div>
      </div>

      {/* 4. Floating Cart Pill Button */}
      <button
        type="button"
        onClick={() => {
          if (onOpenCart) onOpenCart();
          else toast.info('Shopping Cart: 2 items in cart ($45.00 total)');
        }}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-sidebar text-sidebar-foreground shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border border-white/20 dark:border-primary/40"
        aria-label="View shopping cart (2 items)"
      >
        <div className="relative">
          <ShoppingBag className="w-4 h-4" />
          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-600 text-[9px] font-bold flex items-center justify-center text-white">
            2
          </span>
        </div>
        <span className="text-xs font-semibold tracking-wide">Cart · 2 items</span>
      </button>
    </div>
  );
};
