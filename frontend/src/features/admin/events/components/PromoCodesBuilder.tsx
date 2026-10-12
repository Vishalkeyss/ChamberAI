import React, { useState } from 'react';
import { Plus, Tag, X } from 'lucide-react';
import type { EventPromoCodeForm } from '../services/admin-events.api';

interface PromoCodesBuilderProps {
  value: EventPromoCodeForm[];
  onChange: (value: EventPromoCodeForm[]) => void;
  currency: string | null;
  disabled?: boolean;
}

const inputCls =
  'h-9 px-2.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-50';

/**
 * Prompt 04.6 §5.1 (7) — promo codes (percentage or flat). A code that has already
 * been used is deactivated instead of removed (OD-040).
 */
export const PromoCodesBuilder: React.FC<PromoCodesBuilderProps> = ({ value, onChange, currency, disabled }) => {
  const [draft, setDraft] = useState({ code: '', discountType: 'percentage' as 'percentage' | 'flat', discountValue: '', maxUses: '' });
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const code = draft.code.trim().toUpperCase();
    const discountValue = Number(draft.discountValue);
    if (!/^[A-Z0-9_-]{2,30}$/.test(code)) return setError('Use 2–30 letters, numbers, - or _');
    if (value.some((p) => p.code === code)) return setError('That code already exists for this event');
    if (!discountValue || discountValue <= 0) return setError('Enter a discount value');
    if (draft.discountType === 'percentage' && discountValue > 100) return setError('A percentage cannot exceed 100');
    setError(null);
    onChange([
      ...value,
      {
        code,
        discountType: draft.discountType,
        discountValue,
        maxUses: draft.maxUses ? Math.max(1, Number(draft.maxUses)) : null,
        isActive: true,
      },
    ]);
    setDraft({ code: '', discountType: draft.discountType, discountValue: '', maxUses: '' });
  };

  const label = (p: EventPromoCodeForm) =>
    p.discountType === 'percentage' ? `${p.discountValue}% off` : `${currency ? `${currency} ` : ''}${p.discountValue} off`;

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Tag size={13} /> Discount / Promo Codes <span className="font-normal text-muted-foreground">(optional)</span>
      </p>
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((p, i) => {
            const used = p.usedCount || 0;
            return (
              <li key={p.id || p.code} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs">
                <span className="font-mono font-semibold text-foreground">{p.code}</span>
                <span className="flex items-center gap-3 text-muted-foreground">
                  {label(p)}
                  {p.maxUses ? ` · ${used}/${p.maxUses} used` : used ? ` · ${used} used` : ''}
                  {used > 0 && (
                    <label className="inline-flex items-center gap-1 text-foreground">
                      <input
                        type="checkbox"
                        checked={p.isActive}
                        disabled={disabled}
                        onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, isActive: e.target.checked } : x)))}
                      />
                      Active
                    </label>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${p.code}`}
                    title={used > 0 ? 'Used codes are deactivated, not deleted' : 'Remove code'}
                    disabled={disabled}
                    onClick={() => onChange(value.filter((_, j) => j !== i))}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer disabled:opacity-40"
                  >
                    <X size={13} className="text-red-600" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Promo code"
          value={draft.code}
          maxLength={30}
          disabled={disabled}
          onChange={(e) => setDraft({ ...draft, code: e.target.value })}
          placeholder="e.g. EARLYBIRD"
          className={`${inputCls} w-36 uppercase`}
        />
        <select
          aria-label="Discount type"
          value={draft.discountType}
          disabled={disabled}
          onChange={(e) => setDraft({ ...draft, discountType: e.target.value as 'percentage' | 'flat' })}
          className={inputCls}
        >
          <option value="percentage">% off</option>
          <option value="flat">{currency ? `${currency} off` : 'Amount off'}</option>
        </select>
        <input
          aria-label="Discount value"
          type="number"
          min={0}
          value={draft.discountValue}
          disabled={disabled}
          onChange={(e) => setDraft({ ...draft, discountValue: e.target.value })}
          placeholder="Value"
          className={`${inputCls} w-24`}
        />
        <input
          aria-label="Maximum uses"
          type="number"
          min={1}
          value={draft.maxUses}
          disabled={disabled}
          onChange={(e) => setDraft({ ...draft, maxUses: e.target.value })}
          placeholder="Max uses ∞"
          className={`${inputCls} w-28`}
        />
        <button
          type="button"
          onClick={add}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs font-semibold hover:bg-muted cursor-pointer disabled:opacity-50"
        >
          <Plus size={13} /> Add
        </button>
      </div>
      {error && <p className="text-[11px] font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};
