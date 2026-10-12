import React from 'react';
import { Info, Repeat } from 'lucide-react';
import type { EventRecurrenceForm } from '../services/admin-events.api';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Same cap the backend enforces (MAX_RECURRENCE_OCCURRENCES). */
export const MAX_OCCURRENCES = 52;

interface RecurrenceConfiguratorProps {
  value: EventRecurrenceForm | null;
  onChange: (value: EventRecurrenceForm | null) => void;
  /** Local start date of the event (used to default the weekday). */
  startDate: Date | null;
  /** When editing an occurrence of an existing series the rule is read-only. */
  seriesLabel?: string | null;
  disabled?: boolean;
}

export function describeRecurrence(r: EventRecurrenceForm): string {
  const unit = r.freq === 'weekly' ? 'week' : r.freq === 'monthly' ? 'month' : 'day';
  const every = r.interval > 1 ? `Every ${r.interval} ${unit}s` : `Every ${unit}`;
  const days =
    r.freq === 'weekly' && r.weekdays.length
      ? ` on ${[...r.weekdays].sort().map((d) => WEEKDAY_LABELS[d]).join(', ')}`
      : '';
  const end =
    r.endType === 'after'
      ? `, ${r.count || 1} time${(r.count || 1) > 1 ? 's' : ''}`
      : r.until
        ? `, until ${new Date(r.until).toLocaleDateString()}`
        : '';
  return `${every}${days}${end}`;
}

/**
 * Prompt 04.6 §5.1 (2) — "Repeat this event" selector.
 */
export const RecurrenceConfigurator: React.FC<RecurrenceConfiguratorProps> = ({
  value,
  onChange,
  startDate,
  seriesLabel,
  disabled,
}) => {
  if (seriesLabel !== undefined && seriesLabel !== null) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-900 px-3 py-2 text-xs text-indigo-800 dark:text-indigo-300">
        <Repeat size={13} className="mt-0.5 shrink-0" />
        Part of a recurring series — {seriesLabel || 'repeats'}. Recurrence rules can't be edited here, only this
        occurrence's details.
      </div>
    );
  }

  const enabled = !!value;
  const set = (patch: Partial<EventRecurrenceForm>) => value && onChange({ ...value, ...patch });

  const toggle = (checked: boolean) => {
    if (!checked) return onChange(null);
    onChange({
      freq: 'weekly',
      interval: 1,
      weekdays: startDate ? [startDate.getDay()] : [],
      endType: 'after',
      count: 12,
      tzOffsetMinutes: (startDate || new Date()).getTimezoneOffset(),
    });
  };

  const inputCls =
    'h-9 px-2.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-50';

  return (
    <div className="space-y-3">
      <label className="inline-flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
        <input type="checkbox" checked={enabled} disabled={disabled} onChange={(e) => toggle(e.target.checked)} />
        <Repeat size={14} className="text-teal-600" />
        Repeat this event
      </label>

      {value && (
        <div className="rounded-xl border border-border p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rec-freq" className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Frequency
              </label>
              <select
                id="rec-freq"
                value={value.freq}
                disabled={disabled}
                onChange={(e) => set({ freq: e.target.value as EventRecurrenceForm['freq'] })}
                className={`${inputCls} w-full`}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label htmlFor="rec-interval" className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Every
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="rec-interval"
                  type="number"
                  min={1}
                  max={MAX_OCCURRENCES}
                  value={value.interval}
                  disabled={disabled}
                  onChange={(e) => set({ interval: Math.max(1, Number(e.target.value) || 1) })}
                  className={`${inputCls} w-20`}
                />
                <span className="text-xs text-muted-foreground">
                  {value.freq === 'weekly' ? 'week(s)' : value.freq === 'monthly' ? 'month(s)' : 'day(s)'}
                </span>
              </div>
            </div>
          </div>

          {value.freq === 'weekly' && (
            <div>
              <span className="block text-[11px] font-semibold text-muted-foreground mb-1">On</span>
              <div className="flex gap-1.5" role="group" aria-label="Weekdays">
                {WEEKDAY_LABELS.map((label, i) => {
                  const on = value.weekdays.includes(i);
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      aria-label={label}
                      disabled={disabled}
                      onClick={() =>
                        set({ weekdays: on ? value.weekdays.filter((d) => d !== i) : [...value.weekdays, i] })
                      }
                      className={`w-8 h-8 rounded-full text-[11px] font-bold cursor-pointer ${
                        on ? 'bg-teal-600 text-white' : 'border border-border text-muted-foreground bg-background'
                      }`}
                    >
                      {label[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <span className="block text-[11px] font-semibold text-muted-foreground">Ends</span>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="radio"
                name="rec-end"
                checked={value.endType === 'after'}
                disabled={disabled}
                onChange={() => set({ endType: 'after', count: value.count || 12 })}
              />
              After
              <input
                type="number"
                min={1}
                max={MAX_OCCURRENCES}
                aria-label="Number of occurrences"
                value={value.count ?? ''}
                disabled={disabled || value.endType !== 'after'}
                onChange={(e) =>
                  set({ count: Math.min(MAX_OCCURRENCES, Math.max(1, Number(e.target.value) || 1)) })
                }
                className={`${inputCls} w-20`}
              />
              occurrences
            </label>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="radio"
                name="rec-end"
                checked={value.endType === 'on'}
                disabled={disabled}
                onChange={() => set({ endType: 'on' })}
              />
              On date
              <input
                type="date"
                aria-label="End date"
                value={value.until ? value.until.slice(0, 10) : ''}
                disabled={disabled || value.endType !== 'on'}
                onChange={(e) =>
                  set({ until: e.target.value ? new Date(`${e.target.value}T23:59:59`).toISOString() : undefined })
                }
                className={inputCls}
              />
            </label>
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Info size={12} />
            {describeRecurrence(value)} — each occurrence is created as its own event (max {MAX_OCCURRENCES}).
          </p>
        </div>
      )}
    </div>
  );
};
