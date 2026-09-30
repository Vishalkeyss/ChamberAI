import React from 'react';
import type { ChapterOption, MembershipPlan } from '../types';
import { Layers, CheckCircle2, MapPin, Building, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WizardStepPlanProps {
  plans: MembershipPlan[];
  chapters: ChapterOption[];
  selectedPlanId: string;
  selectedChapterId: string;
  calculatedPrice: number;
  isCalculating: boolean;
  onSelectPlan: (planId: string) => void;
  onSelectChapter: (chapterId: string) => void;
}

export const WizardStepPlan: React.FC<WizardStepPlanProps> = ({
  plans,
  chapters,
  selectedPlanId,
  selectedChapterId,
  calculatedPrice,
  isCalculating,
  onSelectPlan,
  onSelectChapter,
}) => {
  const chosenPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Choose Your Membership Tier & Chapter
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Select the membership plan that best fits your business goals and assign your local chapter.
        </p>
      </div>

      {/* Plan Selection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
        {plans.map((p) => {
          const isSelected = p.id === selectedPlanId;
          const isTiered = p.pricingBasis && p.pricingBasis !== 'flat';
          const displayPrice = isTiered ? `From $${p.price}/yr` : p.price === 0 ? 'Free' : `$${p.price}/yr`;

          return (
            <div
              key={p.id}
              onClick={() => onSelectPlan(p.id)}
              className={cn(
                'relative rounded-xl border p-4 cursor-pointer transition-all flex flex-col justify-between',
                isSelected
                  ? 'border-[#0B2447] dark:border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 ring-1 ring-[#0B2447] dark:ring-blue-500 shadow-xs'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: p.accentColor || '#0B2447' }}
                    />
                    <h3 className="font-bold text-xs text-slate-900 dark:text-white">
                      {p.name}
                    </h3>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-[#0B2447] dark:text-blue-400" />
                  )}
                </div>

                <div className="mt-2.5">
                  <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {displayPrice}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1">
                    /{p.billingFrequency || 'annual'}
                  </span>
                </div>

                {isTiered && (
                  <span className="inline-block mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200/50">
                    Tiered by {p.pricingBasis === 'by_employee_count' ? 'employees' : 'revenue'}
                  </span>
                )}

                {/* Features preview */}
                <ul className="mt-3 space-y-1.5 border-t border-slate-100 dark:border-slate-700/60 pt-2.5">
                  {(p.features || []).slice(0, 3).map((feat, idx) => (
                    <li key={idx} className="text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span className="truncate">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chapter Selection (if available) */}
      {chapters.length > 0 && (
        <div className="pt-2">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Select Your Preferred Chapter (Optional)
          </label>
          <div className="relative">
            <select
              value={selectedChapterId}
              onChange={(e) => onSelectChapter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
            >
              <option value="">At-Large / Chamber-Wide (No specific chapter)</option>
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Live Estimated Dues Callout */}
      {chosenPlan && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Estimated Initial Dues
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Based on {chosenPlan.name} membership tier
            </span>
          </div>
          <div className="text-right">
            <span className="text-xl font-black text-[#0B2447] dark:text-blue-400">
              {isCalculating ? 'Calculating...' : calculatedPrice === 0 ? 'Free' : `$${calculatedPrice.toLocaleString('en-US')}/yr`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
