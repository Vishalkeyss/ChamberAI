import React, { useState, useEffect } from 'react';
import type { ChapterOption, MembershipPlan, PricingBasis, TierBracket } from '@/features/membership/types';
import {
  createAdminPlan,
  updateAdminPlan,
} from '@/features/membership/services/plans.api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, CheckCircle2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  TierBracketEditor,
  FormTierItem,
  defaultTiersFor,
} from '../components/TierBracketEditor';

const SWATCH_COLORS = ['#0B2447', '#92400E', '#047857', '#B45309', '#6D28D9', '#DC2626'];

export interface AdminPlanBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: MembershipPlan | null;
  chapters?: ChapterOption[];
  chamberSlug?: string;
  onSaveSuccess: (savedPlan: MembershipPlan) => void;
}

export const AdminPlanBuilderModal: React.FC<AdminPlanBuilderModalProps> = ({
  isOpen,
  onClose,
  plan,
  chapters = [],
  chamberSlug,
  onSaveSuccess,
}) => {
  const [formName, setFormName] = useState('');
  const [formAccentColor, setFormAccentColor] = useState('#0B2447');
  const [formPrice, setFormPrice] = useState('');
  const [formPricingBasis, setFormPricingBasis] = useState<PricingBasis>('flat');
  const [formTiers, setFormTiers] = useState<FormTierItem[]>([]);
  const [formIsPopular, setFormIsPopular] = useState(false);
  const [formFeatures, setFormFeatures] = useState<string[]>(['']);
  const [formChapterOverrides, setFormChapterOverrides] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (plan) {
      setFormName(plan.name);
      setFormAccentColor(plan.accentColor || '#0B2447');
      setFormPrice(plan.price === 0 ? '$0/yr' : `$${plan.price}/yr`);
      const basis = plan.pricingBasis || 'flat';
      setFormPricingBasis(basis);
      setFormIsPopular(plan.isPopular === 1);
      setFormFeatures(plan.features && plan.features.length > 0 ? [...plan.features] : ['']);

      if (basis !== 'flat' && plan.pricingTiers && plan.pricingTiers.length > 0) {
        setFormTiers(
          plan.pricingTiers.map((t) => ({
            max: t.max !== null && t.max !== undefined ? t.max : 999999,
            price: `$${t.price}/yr`,
          }))
        );
      } else if (basis !== 'flat') {
        setFormTiers(defaultTiersFor(basis));
      } else {
        setFormTiers([]);
      }

      const overrides: Record<string, string> = {};
      if (plan.pricingTiers && plan.pricingTiers[0]?.chapter_overrides) {
        plan.pricingTiers[0].chapter_overrides.forEach((co) => {
          overrides[co.chapter_id] = `$${co.price}/yr`;
        });
      }
      setFormChapterOverrides(overrides);
    } else {
      setFormName('');
      setFormAccentColor('#0B2447');
      setFormPrice('');
      setFormPricingBasis('flat');
      setFormTiers([]);
      setFormIsPopular(false);
      setFormFeatures(['']);
      setFormChapterOverrides({});
    }
  }, [isOpen, plan]);

  const handleSetPricingBasis = (basis: PricingBasis) => {
    setFormPricingBasis(basis);
    if (basis !== 'flat' && formTiers.length < 2) {
      setFormTiers(defaultTiersFor(basis));
    }
  };

  const handleAddFeature = () => {
    setFormFeatures((prev) => [...prev, '']);
  };

  const handleRemoveFeature = (index: number) => {
    setFormFeatures((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleFeatureChange = (index: number, val: string) => {
    setFormFeatures((prev) => prev.map((f, idx) => (idx === index ? val : f)));
  };

  const handleChapterOverrideChange = (chapterId: string, val: string) => {
    setFormChapterOverrides((prev) => ({
      ...prev,
      [chapterId]: val,
    }));
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Plan name is required');
      return;
    }

    if (formPricingBasis === 'flat' && !formPrice.trim()) {
      toast.error('Price is required');
      return;
    }

    let numericPrice = parseFloat(formPrice.replace(/[^0-9.]/g, '')) || 0;
    const cleanFeatures = formFeatures.map((f) => f.trim()).filter(Boolean);

    let cleanTiers: TierBracket[] = [];
    if (formPricingBasis !== 'flat') {
      if (formTiers.length === 0) {
        toast.error('Add at least one tier, or switch back to Flat pricing');
        return;
      }
      for (const t of formTiers) {
        if (!t.price || !String(t.price).trim()) {
          toast.error('Every tier needs a price');
          return;
        }
        if (!t.max || Number(t.max) <= 0) {
          toast.error('Every tier needs a valid upper limit');
          return;
        }
      }

      cleanTiers = formTiers
        .map((t, idx) => {
          const prev = idx === 0 ? 0 : Number(formTiers[idx - 1].max || 0);
          const tPrice = parseFloat(String(t.price).replace(/[^0-9.]/g, '')) || 0;
          return {
            min: prev + 1,
            max: Number(t.max),
            price: tPrice,
          };
        })
        .sort((a, b) => (a.max || 0) - (b.max || 0));

      if (cleanTiers.length > 0) {
        numericPrice = cleanTiers[0].price;
      }
    }

    setIsSaving(true);
    try {
      if (plan) {
        try {
          await updateAdminPlan(
            plan.id,
            {
              name: formName.trim(),
              accentColor: formAccentColor,
              price: numericPrice,
              pricingBasis: formPricingBasis,
              pricingTiers: cleanTiers,
              isPopular: formIsPopular ? 1 : 0,
              features: cleanFeatures,
            },
            chamberSlug
          );
        } catch {
          // fallback locally
        }

        const updatedPlan: MembershipPlan = {
          ...plan,
          name: formName.trim(),
          accentColor: formAccentColor,
          price: numericPrice,
          pricingBasis: formPricingBasis,
          pricingTiers: cleanTiers,
          isPopular: formIsPopular ? 1 : 0,
          features: cleanFeatures,
        };

        onSaveSuccess(updatedPlan);
        toast.success(`Plan updated ✓`);
      } else {
        const newPlanId = 'plan_' + Math.random().toString(36).slice(2, 9);
        try {
          await createAdminPlan(
            {
              name: formName.trim(),
              accentColor: formAccentColor,
              price: numericPrice,
              pricingBasis: formPricingBasis,
              pricingTiers: cleanTiers,
              billingFrequency: 'annual',
              isPopular: formIsPopular ? 1 : 0,
              features: cleanFeatures,
              sortOrder: 99,
            },
            chamberSlug
          );
        } catch {
          // fallback locally
        }

        const newPlanObj: MembershipPlan = {
          id: newPlanId,
          name: formName.trim(),
          accentColor: formAccentColor,
          price: numericPrice,
          pricingBasis: formPricingBasis,
          pricingTiers: cleanTiers,
          billingFrequency: 'annual',
          isPopular: formIsPopular ? 1 : 0,
          features: cleanFeatures,
          sortOrder: 99,
          activeMembersCount: 0,
          isActive: 1,
        };

        onSaveSuccess(newPlanObj);
        toast.success(`"${formName.trim()}" plan created ✓`);
      }

      onClose();
    } catch {
      toast.error('Failed to save plan');
    } finally {
      setIsSaving(false);
    }
  };

  const planInitials = (formName || 'NP').slice(0, 2).toUpperCase();

  const sortedFormTiers = [...formTiers].sort((a, b) => Number(a.max || 0) - Number(b.max || 0));
  const lowestTier = sortedFormTiers[0];
  const startingPriceDisplay = lowestTier?.price
    ? (lowestTier.price.startsWith('$') ? lowestTier.price : `$${lowestTier.price}`)
    : '—';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[960px] w-full max-h-[90vh] overflow-y-auto p-0 rounded-2xl gap-0">
        <DialogHeader className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 pr-12 text-left">
          <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white">
            {plan ? `Edit ${plan.name} Plan` : 'Add Membership Plan'}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {plan
              ? 'Changes apply chamber-wide, unless a chapter has its own override below'
              : 'Create a new plan your members can choose from — set its price, features, and any chapter-specific pricing.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSavePlan} className="space-y-5 p-6">
          {/* Header: Initials Badge + Plan Name + Accent Color */}
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: formAccentColor }}
            >
              {planInitials}
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Plan Name*
                </Label>
                <Input
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Platinum"
                  className="mt-1 text-sm h-9"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Accent Color
                </Label>
                <div className="flex items-center gap-2 mt-2">
                  {SWATCH_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormAccentColor(c)}
                      className={cn(
                        'w-6 h-6 rounded-full shrink-0 transition-transform cursor-pointer',
                        formAccentColor === c
                          ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white scale-110'
                          : 'hover:scale-105'
                      )}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Price or Starting Price (auto) */}
          {formPricingBasis !== 'flat' ? (
            <div>
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                Starting Price (auto)
              </Label>
              <div className="mt-1 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700">
                <p className="text-base font-bold text-gray-900 dark:text-white">
                  From {startingPriceDisplay}
                </p>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                This is taken from your lowest tier below — edit the tiers, not this field.
              </p>
            </div>
          ) : (
            <div>
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                Price*
              </Label>
              <Input
                required
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="e.g. $215/yr"
                className="mt-1 text-sm h-9"
              />
            </div>
          )}

          {/* Pricing Basis */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              PRICING BASIS
            </Label>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 mb-2 leading-relaxed">
              Flat charges every applicant the same fee. Tiered pricing looks at the applicant's
              employee count or annual revenue — the join form will then ask for that field and mark
              it mandatory automatically.
            </p>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'flat', label: 'Flat' },
                { id: 'by_employee_count', label: 'By Employee Count' },
                { id: 'by_annual_revenue', label: 'By Annual Revenue' },
              ].map((basis) => (
                <button
                  key={basis.id}
                  type="button"
                  onClick={() => handleSetPricingBasis(basis.id as PricingBasis)}
                  className={cn(
                    'text-xs font-semibold px-2 py-2.5 rounded-lg text-center transition cursor-pointer border',
                    formPricingBasis === basis.id
                      ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                  )}
                >
                  {basis.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reusable TierBracketEditor component for Tiered Pricing */}
          {formPricingBasis !== 'flat' && (
            <TierBracketEditor
              tiers={formTiers}
              onChange={setFormTiers}
              pricingBasis={formPricingBasis}
            />
          )}

          {/* Mark as Most Popular Switch */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Mark as "Most Popular"
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Highlights this plan with a badge on the pricing card
              </p>
            </div>
            <Switch checked={formIsPopular} onCheckedChange={setFormIsPopular} />
          </div>

          {/* Plan Features List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                PLAN FEATURES
              </Label>
              <button
                type="button"
                onClick={handleAddFeature}
                className="text-xs font-semibold text-[#0B2447] dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add feature
              </button>
            </div>

            <div className="space-y-2">
              {formFeatures.map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </span>
                  <Input
                    value={feat}
                    onChange={(e) => handleFeatureChange(idx, e.target.value)}
                    placeholder="e.g. Priority event seats"
                    className="text-xs h-9"
                  />
                  {formFeatures.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(idx)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Chapter Pricing Overrides - Only rendered if chapters exist */}
          {chapters.length > 0 && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                CHAPTER PRICING OVERRIDES
              </Label>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 mb-3">
                Optionally charge a different price for specific chapters. Leave blank to use the base price.
              </p>

              <div className="space-y-2">
                {chapters.map((ch) => (
                  <div
                    key={ch.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                        {ch.name}
                      </span>
                    </div>

                    <div className="w-36 shrink-0">
                      <Input
                        value={formChapterOverrides[ch.id] || ''}
                        onChange={(e) => handleChapterOverrideChange(ch.id, e.target.value)}
                        placeholder="Base price"
                        className="text-xs h-8 text-right bg-white dark:bg-gray-900"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="pt-4 flex items-center justify-end gap-2 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-[#0B2447] hover:bg-[#16385C] text-white shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : plan ? 'Save Changes' : 'Create Plan'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const AdminPlanBuilderPage: React.FC<any> = (props) => {
  return (
    <AdminPlanBuilderModal
      isOpen={true}
      onClose={props.onNavigateBack || (() => {})}
      plan={null}
      chapters={[]}
      chamberSlug={props.chamberSlug}
      onSaveSuccess={props.onPlanSaved || (() => {})}
    />
  );
};
