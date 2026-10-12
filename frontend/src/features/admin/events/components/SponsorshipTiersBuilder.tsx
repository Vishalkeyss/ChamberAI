import React from 'react';
import { Award, Plus, X } from 'lucide-react';
import type { EventSponsorshipTierForm } from '../services/admin-events.api';

interface SponsorshipTiersBuilderProps {
  value: EventSponsorshipTierForm[];
  onChange: (value: EventSponsorshipTierForm[]) => void;
  currency: string | null;
  disabled?: boolean;
}

const inputCls =
  'h-9 px-2.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-50';

/**
 * Prompt 04.6 §5.1 (6) — sponsorship packages. Starts empty: every tier, amount and
 * benefit is defined by the admin (no built-in default pricing, OD-034).
 */
export const SponsorshipTiersBuilder: React.FC<SponsorshipTiersBuilderProps> = ({ value, onChange, currency, disabled }) => {
  const patch = (i: number, p: Partial<EventSponsorshipTierForm>) =>
    onChange(value.map((t, j) => (j === i ? { ...t, ...p } : t)));

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Award size={13} /> Sponsorship Tiers & Pricing <span className="font-normal text-muted-foreground">(optional)</span>
      </p>
      <p className="text-[11px] text-muted-foreground">
        Members can sponsor this event by picking a tier. Benefits are shown to them before they commit.
      </p>
      {value.map((t, i) => {
        const sponsors = t.sponsorCount || 0;
        return (
          <div key={t.id || `new-${i}`} className="rounded-xl border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                aria-label="Tier name"
                value={t.tierName}
                disabled={disabled}
                onChange={(e) => patch(i, { tierName: e.target.value })}
                placeholder="Tier name (e.g. Title Sponsor)"
                className={`${inputCls} flex-1`}
              />
              <div className="flex items-center gap-1">
                {currency && <span className="text-[11px] text-muted-foreground">{currency}</span>}
                <input
                  aria-label="Tier amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={t.amount || ''}
                  disabled={disabled}
                  onChange={(e) => patch(i, { amount: Math.max(0, Number(e.target.value) || 0) })}
                  className={`${inputCls} w-28`}
                />
              </div>
              <input
                aria-label="Max sponsors"
                type="number"
                min={Math.max(1, sponsors)}
                step="1"
                value={t.maxSponsors ?? ''}
                disabled={disabled}
                onChange={(e) =>
                  patch(i, { maxSponsors: e.target.value === '' ? null : Math.max(1, Math.floor(Number(e.target.value)) || 1) })
                }
                placeholder="Max spots"
                title="Maximum sponsors for this tier (empty = unlimited)"
                className={`${inputCls} w-24`}
              />
              <button
                type="button"
                aria-label="Remove tier"
                title={sponsors > 0 ? `${sponsors} sponsor(s) — cannot be removed` : 'Remove tier'}
                disabled={disabled || sponsors > 0}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <X size={14} className="text-red-600" />
              </button>
            </div>
            <input
              aria-label="Sponsor benefits"
              value={t.benefits.join(', ')}
              disabled={disabled}
              onChange={(e) =>
                patch(i, {
                  benefits: e.target.value
                    .split(',')
                    .map((s) => s.trimStart())
                    .filter((s, k, arr) => s.length > 0 || k === arr.length - 1),
                })
              }
              placeholder="Benefits, comma separated (e.g. Logo on event page, reserved table)"
              className={`${inputCls} w-full`}
            />
            {sponsors > 0 && <p className="text-[11px] text-muted-foreground">{sponsors} sponsor(s) on this tier</p>}
          </div>
        );
      })}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...value, { tierName: '', amount: 0, benefits: [], maxSponsors: null }])}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted cursor-pointer disabled:opacity-50"
      >
        <Plus size={13} /> Add Tier
      </button>
    </div>
  );
};
