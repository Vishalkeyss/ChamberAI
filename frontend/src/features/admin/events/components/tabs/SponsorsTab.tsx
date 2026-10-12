import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Award, Plus, Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney } from '@/features/events/services/events.api';
import {
  fetchAdminEventSponsors,
  recordAdminSponsor,
  removeAdminSponsor,
  updateAdminSponsorStatus,
  type AdminSponsorsOverview,
  type SponsorStatus,
} from '../../services/admin-events.api';

interface SponsorsTabProps {
  eventId: string;
  chamberSlug?: string;
}

const STATUSES: SponsorStatus[] = ['paid', 'pending', 'overdue'];
const STATUS_LABEL: Record<SponsorStatus, string> = { paid: 'Paid', pending: 'Pending', overdue: 'Overdue' };
const inputCls =
  'h-9 px-2.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none';

/**
 * Prompt 04.4 — Admin Sponsorship Manager (Event Detail Tab 6).
 * The API returns what the caller may do (billing/full: everything; chapter: record; group: view).
 */
export const SponsorsTab: React.FC<SponsorsTabProps> = ({ eventId, chamberSlug }) => {
  const [data, setData] = useState<AdminSponsorsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tierId: '', sponsorName: '', amount: '', status: 'pending' as SponsorStatus });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setIsLoading(true);
    return fetchAdminEventSponsors(eventId, chamberSlug)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load sponsors'))
      .finally(() => setIsLoading(false));
  }, [eventId, chamberSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const money = (n: number) => formatMoney(n, data?.currency ?? null);
  const canRecordPaid = !!data?.permissions.canUpdateStatus;

  const changeStatus = async (sponsorId: string, status: SponsorStatus) => {
    setBusyId(sponsorId);
    try {
      await updateAdminSponsorStatus(eventId, sponsorId, { status }, chamberSlug);
      toast.success(`Marked ${STATUS_LABEL[status].toLowerCase()}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (sponsorId: string, name: string) => {
    if (!window.confirm(`Remove ${name} as a sponsor? Any unpaid sponsorship invoice will be cancelled.`)) return;
    setBusyId(sponsorId);
    try {
      await removeAdminSponsor(eventId, sponsorId, chamberSlug);
      toast.success('Sponsor removed');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove sponsor');
    } finally {
      setBusyId(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tierId || !form.sponsorName.trim()) return;
    setSaving(true);
    try {
      await recordAdminSponsor(
        eventId,
        {
          tierId: form.tierId,
          sponsorName: form.sponsorName.trim(),
          status: form.status,
          ...(form.amount !== '' ? { amount: Number(form.amount) } : {}),
        },
        chamberSlug
      );
      toast.success('Sponsor recorded');
      setShowForm(false);
      setForm({ tierId: '', sponsorName: '', amount: '', status: 'pending' });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record sponsor');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="py-8 text-center text-muted-foreground text-xs">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
        Loading sponsors...
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="py-8 text-center text-xs">
        <p className="text-destructive">{error}</p>
        <Button size="sm" variant="outline" className="mt-3 h-8 text-xs" onClick={() => load()}>
          Retry
        </Button>
      </div>
    );
  }
  if (!data) return null;

  const selectedTier = data.tiers.find((t) => t.id === form.tierId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Event Sponsors & Partners</h3>
          <p className="text-xs text-muted-foreground">Sponsorship packages, bookings and payment status.</p>
        </div>
        {data.permissions.canRecord && data.tiers.length > 0 && (
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showForm ? 'Cancel' : 'Add Sponsor'}
          </Button>
        )}
      </div>

      {/* Revenue summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total committed', value: money(data.summary.totalCommitted) },
          { label: 'Paid', value: money(data.summary.totalPaid) },
          { label: 'Outstanding', value: money(data.summary.totalOutstanding) },
          { label: 'Sponsors', value: String(data.summary.sponsorCount) },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground">{k.label}</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tier availability */}
      {data.tiers.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {data.tiers.map((t) => (
            <Badge key={t.id} variant={t.isSoldOut ? 'secondary' : 'outline'} className="text-[11px] py-1 px-2 font-medium">
              {t.tierName} · {money(t.amount)} ·{' '}
              {t.maxSponsors == null ? `${t.sponsorsCount} booked` : `${t.sponsorsCount}/${t.maxSponsors}${t.isSoldOut ? ' sold out' : ''}`}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No sponsorship packages yet. Add tiers in the event's edit form to offer sponsorships.
        </p>
      )}

      {/* Offline booking */}
      {showForm && (
        <Card>
          <CardContent className="pt-5">
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
              <label className="md:col-span-2 text-[11px] font-semibold text-muted-foreground">
                Sponsor / business name
                <input
                  required
                  maxLength={200}
                  value={form.sponsorName}
                  onChange={(e) => setForm({ ...form, sponsorName: e.target.value })}
                  className={`${inputCls} w-full mt-1 font-normal`}
                />
              </label>
              <label className="text-[11px] font-semibold text-muted-foreground">
                Tier
                <select
                  required
                  value={form.tierId}
                  onChange={(e) => setForm({ ...form, tierId: e.target.value })}
                  className={`${inputCls} w-full mt-1 font-normal`}
                >
                  <option value="">Select…</option>
                  {data.tiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.tierName}
                      {t.isSoldOut ? ' (full)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] font-semibold text-muted-foreground">
                Amount {data.currency ? `(${data.currency})` : ''}
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amount}
                  placeholder={selectedTier ? String(selectedTier.amount) : ''}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className={`${inputCls} w-full mt-1 font-normal`}
                />
              </label>
              <label className="text-[11px] font-semibold text-muted-foreground">
                Status
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as SponsorStatus })}
                  className={`${inputCls} w-full mt-1 font-normal`}
                >
                  {STATUSES.filter((s) => s !== 'paid' || canRecordPaid).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="md:col-span-5 flex justify-end">
                <Button type="submit" size="sm" className="h-8 text-xs" disabled={saving}>
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                  Record Sponsor
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {data.sponsors.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Award className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium text-foreground">No Event Sponsors Yet</p>
              <p className="text-xs mt-1">Packages can be booked by members or recorded here.</p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border font-medium">
                  <tr>
                    <th className="py-2.5 px-3">Sponsor</th>
                    <th className="py-2.5 px-3">Tier</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Payment Date</th>
                    {data.permissions.canRemove && <th className="py-2.5 px-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.sponsors.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-foreground">
                        {s.sponsorName}
                        {!s.businessId && <span className="ml-1.5 text-[10px] text-muted-foreground">(external)</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          {s.tierName || '—'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-foreground">{money(s.amount)}</td>
                      <td className="py-2.5 px-3">
                        {data.permissions.canUpdateStatus ? (
                          <select
                            aria-label={`Payment status for ${s.sponsorName}`}
                            value={s.status}
                            disabled={busyId === s.id}
                            onChange={(e) => changeStatus(s.id, e.target.value as SponsorStatus)}
                            className="h-7 px-1.5 rounded-md border border-border bg-background text-[11px]"
                          >
                            {STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {STATUS_LABEL[st]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge variant={s.status === 'paid' ? 'default' : 'secondary'} className="text-[10px] py-0 px-1.5">
                            {STATUS_LABEL[s.status] || s.status}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {s.paymentDate ? new Date(s.paymentDate).toLocaleDateString() : '—'}
                      </td>
                      {data.permissions.canRemove && (
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            aria-label={`Remove ${s.sponsorName}`}
                            disabled={busyId === s.id}
                            onClick={() => remove(s.id, s.sponsorName)}
                            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
