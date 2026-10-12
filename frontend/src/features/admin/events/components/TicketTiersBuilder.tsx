import React from 'react';
import { Plus, Tag, X } from 'lucide-react';
import type { EventTicketTypeForm } from '../services/admin-events.api';

interface TicketTiersBuilderProps {
  value: EventTicketTypeForm[];
  onChange: (value: EventTicketTypeForm[]) => void;
  isPaid: boolean;
  currency: string | null;
  disabled?: boolean;
}

const inputCls =
  'h-9 px-2.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-50';

/**
 * Prompt 04.6 §5.1 (5) — optional ticket types (one price per tier, OD-032).
 * Tiers with sold tickets cannot be removed (the server enforces it too).
 */
export const TicketTiersBuilder: React.FC<TicketTiersBuilderProps> = ({ value, onChange, isPaid, currency, disabled }) => {
  const patch = (i: number, p: Partial<EventTicketTypeForm>) => onChange(value.map((t, j) => (j === i ? { ...t, ...p } : t)));
  const add = () =>
    onChange([...value, { name: '', price: 0, description: null, allowPayLater: false, qtyLimit: null }]);

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Tag size={13} /> Ticket Types <span className="font-normal text-muted-foreground">(optional)</span>
      </p>
      <p className="text-[11px] text-muted-foreground">
        Add ticket types like General, VIP or Member / Non-Member — each with its own price, payment rule and quantity
        limit. Leave empty to use the single event fee.
      </p>
      {value.map((t, i) => {
        const sold = t.qtySold || 0;
        return (
          <div key={t.id || `new-${i}`} className="rounded-xl border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                aria-label="Ticket name"
                value={t.name}
                disabled={disabled}
                onChange={(e) => patch(i, { name: e.target.value })}
                placeholder="Ticket name (e.g. VIP)"
                className={`${inputCls} flex-1`}
              />
              <div className="flex items-center gap-1">
                {currency && <span className="text-[11px] text-muted-foreground">{currency}</span>}
                <input
                  aria-label="Ticket price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={t.price}
                  disabled={disabled || !isPaid}
                  onChange={(e) => patch(i, { price: Math.max(0, Number(e.target.value) || 0) })}
                  className={`${inputCls} w-24`}
                />
              </div>
              <button
                type="button"
                aria-label="Remove ticket type"
                title={sold > 0 ? `${sold} sold — cannot be removed` : 'Remove ticket type'}
                disabled={disabled || sold > 0}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <X size={14} className="text-red-600" />
              </button>
            </div>
            <input
              aria-label="Ticket description"
              value={t.description || ''}
              disabled={disabled}
              onChange={(e) => patch(i, { description: e.target.value || null })}
              placeholder="Description shown to attendees (optional)"
              className={`${inputCls} w-full`}
            />
            <div className="flex flex-wrap items-center gap-4 text-xs text-foreground">
              {isPaid && (
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={t.allowPayLater}
                    disabled={disabled}
                    onChange={(e) => patch(i, { allowPayLater: e.target.checked })}
                  />
                  Allow pay later
                </label>
              )}
              <label className="inline-flex items-center gap-1.5">
                Qty limit
                <input
                  type="number"
                  min={Math.max(1, sold)}
                  value={t.qtyLimit ?? ''}
                  disabled={disabled}
                  placeholder="∞"
                  onChange={(e) => patch(i, { qtyLimit: e.target.value ? Math.max(1, Number(e.target.value)) : null })}
                  className={`${inputCls} w-20`}
                />
              </label>
              {sold > 0 && <span className="text-[11px] text-muted-foreground">{sold} sold</span>}
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted cursor-pointer disabled:opacity-50"
      >
        <Plus size={13} /> Add Ticket Type
      </button>
    </div>
  );
};
