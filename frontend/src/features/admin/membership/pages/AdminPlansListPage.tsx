import React, { useState, useEffect } from 'react';
import type { ChapterOption, MembershipPlan } from '@/features/membership/types';
import {
  fetchAdminPlans,
  fetchActiveChapters,
} from '@/features/membership/services/plans.api';
import { AdminPlanBuilderModal } from './AdminPlanBuilderPage';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Settings,
  Users,
  CheckCircle2,
  Mail,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface AdminPlansListPageProps {
  chamberSlug?: string;
  onCreateNewPlan?: () => void;
  onEditPlan?: (planId: string) => void;
}

export const AdminPlansListPage: React.FC<AdminPlansListPageProps> = ({
  chamberSlug,
  onCreateNewPlan,
  onEditPlan,
}) => {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal State for Add/Edit Plan
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [plansData, chaptersData] = await Promise.all([
        fetchAdminPlans(chamberSlug).catch(() => []),
        fetchActiveChapters(chamberSlug).catch(() => []),
      ]);

      setPlans(plansData || []);
      setChapters(chaptersData || []);
    } catch {
      setPlans([]);
      setChapters([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [chamberSlug]);

  const activePlans = plans;
  const totalMembers = activePlans.reduce(
    (sum, p) => sum + (p.activeMembersCount ?? (p as any).members ?? 0),
    0
  );

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingPlan(null);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (plan: MembershipPlan) => {
    setEditingPlan(plan);
    setIsModalOpen(true);
  };

  const handleSaveSuccess = async (savedPlan: MembershipPlan) => {
    await loadData();
  };

  const handleSendReminder = (name: string) => {
    toast.success(`Renewal reminder sent to ${name}`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header: Title, total counts, and + Add Plan button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Membership Plans
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {activePlans.length} plans · {totalMembers.toLocaleString('en-US')} members across all tiers
          </p>
        </div>

        <Button
          onClick={handleOpenCreateModal}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Plan
        </Button>
      </div>

      {/* 2. Plans: Empty State or Cards Grid */}
      {activePlans.length === 0 ? (
        <div className="bg-card text-card-foreground rounded-2xl border border-border p-10 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">No membership plans created yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-5">
            This chamber doesn't have any membership plans configured yet. Click below to add your first membership plan.
          </p>
          <Button
            onClick={handleOpenCreateModal}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs py-2 px-4 rounded-xl inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add First Plan
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {activePlans.map((p) => {
            const isPopular = p.isPopular === 1 || p.isPopular === (true as any);
            const isTiered = p.pricingBasis && p.pricingBasis !== 'flat';
            const lowestTierPrice = p.pricingTiers && p.pricingTiers.length > 0
              ? Math.min(...p.pricingTiers.map((t) => t.price))
              : p.price;
            const displayPrice = isTiered
              ? `From $${lowestTierPrice}/yr`
              : (p.price === 0 ? '$0/yr' : `$${p.price}/yr`);

            return (
              <div
                key={p.id || p.name}
                className="bg-card text-card-foreground rounded-2xl border border-border p-5 flex flex-col justify-between relative overflow-hidden shadow-xs hover:shadow-md transition"
              >
                {/* Most Popular Badge on Top Right */}
                {isPopular && (
                  <span
                    className="absolute top-0 right-0 text-[10px] font-bold px-2.5 py-1 rounded-bl-lg text-white"
                    style={{ background: p.accentColor || '#803507ff' }}
                  >
                    MOST POPULAR
                  </span>
                )}

                <div>
                  {/* Dot + Plan Name */}
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: p.accentColor || (isPopular ? '#92400E' : 'var(--primary)') }}
                    />
                    <p className="font-semibold text-sm text-foreground">{p.name}</p>
                  </div>

                  {/* Price */}
                  <p className="text-2xl font-bold mt-2 text-foreground">
                    {displayPrice}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isTiered ? 'Starting price — varies by tier' : 'Base price — chamber-wide'}
                  </p>

                  {isTiered && (
                    <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full text-[10px] font-semibold w-fit bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      <Layers className="w-2.5 h-2.5" /> Tiered by{' '}
                      {p.pricingBasis === 'by_employee_count'
                        ? 'employee count'
                        : 'annual revenue'}{' '}
                      ({(p.pricingTiers || []).length} tiers)
                    </span>
                  )}

                  {/* Active Members Count */}
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>
                      {(p.activeMembersCount ?? (p as any).members ?? 0)} active members
                    </span>
                  </p>

                  {/* Features List */}
                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                    {(p.features || []).slice(0, 4).map((feat, fIdx) => (
                      <div
                        key={fIdx}
                        className="flex items-start gap-2 text-xs text-foreground"
                      >
                        <CheckCircle2
                          className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                          strokeWidth={2}
                        />
                        <span className="leading-snug">{feat}</span>
                      </div>
                    ))}
                    {(!p.features || p.features.length === 0) && (
                      <p className="text-xs italic text-muted-foreground">No features listed yet.</p>
                    )}
                  </div>
                </div>

                {/* Edit Plan Button */}
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(p)}
                  className="w-full mt-5 py-2 px-3 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" /> Edit Plan
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Renewals — Attention Needed Section */}
      <div className="bg-card text-card-foreground rounded-2xl border border-border p-6 shadow-xs">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-foreground">
            Renewals — Attention Needed
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Members whose renewal is overdue or coming up soon
          </p>
        </div>

        <div className="py-8 text-center text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm font-semibold text-foreground">No renewals requiring attention</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            When members join this chamber, upcoming and overdue renewals will appear here.
          </p>
        </div>
      </div>

      {/* 4. Add / Edit Membership Plan Modal Dialog */}
      <AdminPlanBuilderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        plan={editingPlan}
        chapters={chapters}
        chamberSlug={chamberSlug}
        onSaveSuccess={handleSaveSuccess}
      />
    </div>
  );
};
export default AdminPlansListPage;
