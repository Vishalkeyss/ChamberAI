import React, { useCallback, useEffect, useState } from 'react';
import { Award, CheckCircle2, Clock, Loader2, Users, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  STATUS_LABELS,
  fetchAdminMentorshipOverview,
  formatDate,
  setAdminMentorStatus,
  type AdminMentorshipOverview,
  type MentorshipStatus,
} from '@/features/mentorship/services/mentorship.api';

const STATUS_STYLES: Record<MentorshipStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10',
  accepted: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10',
  completed: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10',
  declined: 'bg-red-50 text-red-700 dark:bg-red-500/10',
  cancelled: 'bg-muted text-muted-foreground',
};

/** Prompt 05.6 §2 admin program oversight (OD-098): KPIs, mentors, pairs. */
export const AdminMentorshipPage: React.FC = () => {
  const [data, setData] = useState<AdminMentorshipOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | MentorshipStatus>('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchAdminMentorshipOverview());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load mentorship overview');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (userId: string, name: string, next: 'active' | 'paused') => {
    setBusy(userId);
    try {
      await setAdminMentorStatus(userId, next);
      toast.success(next === 'paused' ? `${name} paused` : `${name} re-activated`);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update mentor');
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm">
        <p className="text-red-600">{error}</p>
        <button type="button" onClick={load} className="mt-3 px-4 py-2 rounded-lg border border-border text-xs font-semibold">Retry</button>
      </div>
    );
  }

  const k = data?.kpis;
  const canModerate = data?.scope === 'chamber';
  const kpis = [
    { icon: Award, label: 'Mentors', value: k ? `${k.available_mentors} available / ${k.mentors}` : null },
    { icon: Users, label: 'Active pairs', value: k ? String(k.active_pairs) : null },
    { icon: Clock, label: 'Pending requests', value: k ? String(k.pending_requests) : null },
    { icon: CheckCircle2, label: 'Completed', value: k ? String(k.completed) : null },
    { icon: XCircle, label: 'Declined', value: k ? String(k.declined) : null },
  ];
  const pairs = (data?.pairs || []).filter((p) => !statusFilter || p.status === statusFilter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mentorship Program</h1>
        <p className="text-sm text-muted-foreground">
          {data?.scope === 'chapter' ? 'Mentorships involving members of your chapter.' : 'All mentors and mentorship pairs in the chamber.'}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <s.icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              {s.value === null ? <div className="h-5 w-12 mt-1 rounded bg-muted animate-pulse" /> : <p className="text-lg font-bold truncate">{s.value}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-semibold text-sm">Mentors</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Mentor</th>
                <th className="text-left px-4 py-2 font-semibold">Expertise</th>
                <th className="text-left px-4 py-2 font-semibold">Mentees</th>
                <th className="text-left px-4 py-2 font-semibold">Rating</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
                {canModerate && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr><td colSpan={6} className="px-4 py-6"><div className="h-4 rounded bg-muted animate-pulse" /></td></tr>
              ) : data.mentors.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-xs text-muted-foreground">No members have registered as mentors yet.</td></tr>
              ) : (
                data.mentors.map((m) => (
                  <tr key={m.user_id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium">{m.name}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-xs">{m.expertise_areas.join(', ') || '—'}</td>
                    <td className="px-4 py-2.5">{m.active_mentees_count}/{m.max_mentees}</td>
                    <td className="px-4 py-2.5">{m.rating !== null ? `${m.rating.toFixed(1)} (${m.rating_count})` : '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold', m.status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10' : 'bg-muted text-muted-foreground')}>
                        {m.status === 'active' ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    {canModerate && (
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          disabled={busy === m.user_id}
                          onClick={() => toggle(m.user_id, m.name, m.status === 'active' ? 'paused' : 'active')}
                          className="px-3 py-1 rounded-lg border border-border text-xs font-semibold hover:bg-muted disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {busy === m.user_id && <Loader2 size={12} className="animate-spin" />}
                          {m.status === 'active' ? 'Pause' : 'Activate'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <span className="font-semibold text-sm">Mentorship pairs</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as '' | MentorshipStatus)} className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs outline-none" aria-label="Filter by status">
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABELS) as MentorshipStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Mentor</th>
                <th className="text-left px-4 py-2 font-semibold">Mentee</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
                <th className="text-left px-4 py-2 font-semibold">Requested</th>
                <th className="text-left px-4 py-2 font-semibold">Started</th>
                <th className="text-left px-4 py-2 font-semibold">Ended</th>
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr><td colSpan={6} className="px-4 py-6"><div className="h-4 rounded bg-muted animate-pulse" /></td></tr>
              ) : pairs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-xs text-muted-foreground">No mentorship requests yet.</td></tr>
              ) : (
                pairs.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-2.5">{p.mentor?.name || '—'}</td>
                    <td className="px-4 py-2.5">{p.mentee?.name || '—'}</td>
                    <td className="px-4 py-2.5"><span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold', STATUS_STYLES[p.status])}>{STATUS_LABELS[p.status]}</span></td>
                    <td className="px-4 py-2.5 text-xs">{formatDate(p.requested_at)}</td>
                    <td className="px-4 py-2.5 text-xs">{formatDate(p.start_date)}</td>
                    <td className="px-4 py-2.5 text-xs">{formatDate(p.end_date)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
