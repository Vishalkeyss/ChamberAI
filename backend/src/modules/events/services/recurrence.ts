import type { RecurrenceInput } from '../validation/events.validation';

/**
 * Prompt 04.6 §8 recurrence expansion, extended to match the reference UI picker
 * (daily / weekly on chosen weekdays / monthly, every N, end after N or on a date).
 *
 * Calendar math is done in the admin's local wall-clock time (via tzOffsetMinutes)
 * so "every Tuesday" stays Tuesday for them; returned instants are real UTC dates.
 */

/** Safety cap, same as the reference UI ("After [1-52] occurrences"). */
export const MAX_RECURRENCE_OCCURRENCES = 52;

const DAY_MS = 86400000;

export function generateRecurrenceDates(start: Date, rule: RecurrenceInput): Date[] {
  const offsetMs = (rule.tzOffsetMinutes || 0) * 60000;
  // Shift into "local wall clock expressed as UTC" so getUTC* reads local fields.
  const toLocal = (d: Date) => new Date(d.getTime() - offsetMs);
  const toUtc = (d: Date) => new Date(d.getTime() + offsetMs);

  const localStart = toLocal(start);
  const localUntil = rule.endType === 'on' && rule.until ? toLocal(new Date(rule.until)) : null;
  // "On date" is inclusive of that whole local day.
  const untilEnd = localUntil
    ? Date.UTC(localUntil.getUTCFullYear(), localUntil.getUTCMonth(), localUntil.getUTCDate()) + DAY_MS - 1
    : null;
  const target =
    rule.endType === 'after'
      ? Math.min(MAX_RECURRENCE_OCCURRENCES, Math.max(1, rule.count || 1))
      : MAX_RECURRENCE_OCCURRENCES;
  const interval = Math.max(1, rule.interval || 1);
  const out: Date[] = [];
  const within = (d: Date) => untilEnd == null || d.getTime() <= untilEnd;

  if (rule.freq === 'weekly' && rule.weekdays.length) {
    const days = new Set(rule.weekdays);
    const weekStart = Date.UTC(
      localStart.getUTCFullYear(),
      localStart.getUTCMonth(),
      localStart.getUTCDate() - localStart.getUTCDay()
    );
    for (let i = 0; out.length < target && i < MAX_RECURRENCE_OCCURRENCES * 7 * interval + 7; i++) {
      const cursor = new Date(localStart.getTime() + i * DAY_MS);
      if (!within(cursor)) break;
      if (!days.has(cursor.getUTCDay())) continue;
      const cursorDay = Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate());
      const weeks = Math.floor((cursorDay - weekStart) / (7 * DAY_MS));
      if (weeks % interval === 0) out.push(toUtc(cursor));
    }
  } else {
    for (let n = 0; out.length < target && n < MAX_RECURRENCE_OCCURRENCES; n++) {
      const cursor =
        rule.freq === 'monthly'
          ? new Date(
              Date.UTC(
                localStart.getUTCFullYear(),
                localStart.getUTCMonth() + n * interval,
                localStart.getUTCDate(),
                localStart.getUTCHours(),
                localStart.getUTCMinutes()
              )
            )
          : new Date(localStart.getTime() + n * interval * DAY_MS);
      // Skip months without that day (e.g. 31st) instead of rolling into the next month.
      if (rule.freq === 'monthly' && cursor.getUTCDate() !== localStart.getUTCDate()) continue;
      if (!within(cursor)) break;
      out.push(toUtc(cursor));
    }
  }
  return out.length ? out : [start];
}

/** Human-readable summary, e.g. "Every 2 weeks on Mon, Wed, 6 times". */
export function describeRecurrence(rule: RecurrenceInput): string {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const unit = rule.freq === 'weekly' ? 'week' : rule.freq === 'monthly' ? 'month' : 'day';
  const every = rule.interval > 1 ? `Every ${rule.interval} ${unit}s` : `Every ${unit}`;
  const days =
    rule.freq === 'weekly' && rule.weekdays.length
      ? ` on ${[...rule.weekdays].sort().map((d) => names[d]).join(', ')}`
      : '';
  const end =
    rule.endType === 'after'
      ? `, ${rule.count} time${(rule.count || 1) > 1 ? 's' : ''}`
      : rule.until
        ? `, until ${rule.until.slice(0, 10)}`
        : '';
  return `${every}${days}${end}`;
}
