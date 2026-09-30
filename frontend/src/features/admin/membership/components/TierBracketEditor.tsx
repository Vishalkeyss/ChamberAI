import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';

export interface FormTierItem {
  max: number | string;
  price: string;
}

export interface TierBracketEditorProps {
  tiers: FormTierItem[];
  onChange: (tiers: FormTierItem[]) => void;
  pricingBasis: 'by_employee_count' | 'by_annual_revenue';
}

export const defaultTiersFor = (basis: 'by_employee_count' | 'by_annual_revenue'): FormTierItem[] => [
  { max: 10, price: '$120/yr' },
  { max: 50, price: '$250/yr' },
  { max: 999999, price: '$450/yr' },
];

export const TierBracketEditor: React.FC<TierBracketEditorProps> = ({
  tiers,
  onChange,
  pricingBasis,
}) => {
  const handleUpdateTier = (i: number, key: 'max' | 'price', val: string) => {
    const next = tiers.map((t, idx) => (idx === i ? { ...t, [key]: val } : t));
    if (key === 'max') {
      onChange([...next].sort((a, b) => Number(a.max || 0) - Number(b.max || 0)));
    } else {
      onChange(next);
    }
  };

  const handleAddTier = () => {
    onChange([
      ...tiers,
      {
        max: 999999,
        price: '',
      },
    ]);
  };

  const handleRemoveTier = (index: number) => {
    onChange(tiers.filter((_, idx) => idx !== index));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
          {pricingBasis === 'by_employee_count'
            ? 'EMPLOYEE-COUNT TIERS'
            : 'REVENUE TIERS'}
        </Label>
        <button
          type="button"
          onClick={handleAddTier}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add tier
        </button>
      </div>

      <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-[#F9FAFB] dark:bg-gray-900/40 space-y-3">
        {tiers.map((t, i) => {
          const prevMax = i === 0 ? 0 : Number(tiers[i - 1].max || 0);
          const thisMax = Number(t.max || 0);
          const rangeLabel =
            pricingBasis === 'by_employee_count'
              ? thisMax >= 999999
                ? `${prevMax + 1}+ employees`
                : `${prevMax + 1}–${thisMax || '?'} employees`
              : thisMax >= 999999999
              ? `Above $${prevMax.toLocaleString('en-US')} revenue`
              : `$${(prevMax + 1).toLocaleString('en-US')}–$${(thisMax || 0).toLocaleString('en-US')} revenue`;

          return (
            <div
              key={i}
              className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80 shadow-xs space-y-2"
            >
              <p className="text-xs font-semibold text-[#1E3A5F] dark:text-blue-400">
                Condition: {rangeLabel} → pays this price
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-gray-300 font-medium shrink-0">
                  {pricingBasis === 'by_employee_count' ? 'Up to' : 'Up to $'}
                </span>
                <Input
                  type="number"
                  value={t.max}
                  onChange={(e) => handleUpdateTier(i, 'max', e.target.value)}
                  placeholder={pricingBasis === 'by_employee_count' ? '10' : '10'}
                  className="w-24 text-xs h-9 bg-white dark:bg-gray-900"
                />
                <span className="text-xs text-gray-600 dark:text-gray-300 font-medium shrink-0">
                  {pricingBasis === 'by_employee_count' ? 'employees →' : 'revenue →'}
                </span>
                <Input
                  value={t.price}
                  onChange={(e) => handleUpdateTier(i, 'price', e.target.value)}
                  placeholder="$120/yr"
                  className="flex-1 text-xs h-9 bg-white dark:bg-gray-900"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveTier(i)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer shrink-0"
                  title="Remove tier"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          );
        })}

        {tiers.length === 0 && (
          <p className="text-xs italic text-gray-500 dark:text-gray-400 py-2 text-center">
            No tiers yet — click "+ Add tier" above.
          </p>
        )}
      </div>

      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed mt-2">
        Each row is a condition: if the applicant's{' '}
        {pricingBasis === 'by_employee_count' ? 'employee count' : 'annual revenue'} falls
        in that range, they pay that row's price. Rows auto-sort low → high as you edit them.
        Use a large number (e.g. 999999) on the last tier's "Up to" so every applicant above
        your highest bracket still gets a price.
      </p>
    </div>
  );
};
