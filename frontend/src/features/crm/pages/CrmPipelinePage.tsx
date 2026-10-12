import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, DollarSign, Download, LayoutDashboard, List, Plus, Search, Users, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fetchChamberCurrency, formatMoney } from '@/features/events/services/events.api';
import { PipelineKanbanBoard } from '../components/PipelineKanbanBoard';
import { ContactDetailDrawer } from '../components/ContactDetailDrawer';
import { AddContactModal } from '../components/AddContactModal';
import { formatShortDate } from '../components/ContactCard';
import {
  CRM_STAGES,
  CRM_STAGE_LABELS,
  csvCell,
  fetchCrmContacts,
  todayIso,
  updateCrmStage,
  type CrmContact,
  type CrmMetrics,
  type CrmStage,
} from '../services/crm.api';

interface CrmPipelinePageProps {
  chamberSlug?: string;
}

/** Prompt 05.5 — private CRM pipeline (`/portal/crm`). */
export const CrmPipelinePage: React.FC<CrmPipelinePageProps> = ({ chamberSlug }) => {
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [metrics, setMetrics] = useState<CrmMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'' | CrmStage>('');
  const [view, setView] = useState<'board' | 'table'>('board');
  const [showLost, setShowLost] = useState(false);
  const [currency, setCurrency] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      const current = ++seq.current;
      if (!silent) setLoading(true);
      try {
        const data = await fetchCrmContacts({ stage: stageFilter || undefined, search: search.trim() || undefined });
        if (current !== seq.current) return;
        setContacts(data.contacts);
        setMetrics(data.metrics);
        setError(null);
      } catch (err: any) {
        if (current === seq.current) setError(err.message || 'Failed to load contacts');
      } finally {
        if (current === seq.current) setLoading(false);
      }
    },
    [stageFilter, search]
  );

  useEffect(() => {
    const t = window.setTimeout(() => load(), search ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    fetchChamberCurrency(chamberSlug).then(setCurrency).catch(() => setCurrency(null));
  }, [chamberSlug]);

  /** Drag / menu move — optimistic, rolled back on error (§16 "immediately updates"). */
  const move = async (contact: CrmContact, stage: CrmStage) => {
    const previous = contacts;
    setContacts((all) => all.map((c) => (c.id === contact.id ? { ...c, stage } : c)));
    try {
      await updateCrmStage(contact.id, stage);
      toast.success(`${contact.name} moved to ${CRM_STAGE_LABELS[stage]}`);
      load(true);
    } catch (err: any) {
      setContacts(previous);
      toast.error(err.message || 'Failed to move contact');
    }
  };

  const exportCsv = () => {
    const header = ['Name', 'Company', 'Email', 'Phone', 'Stage', 'Deal Value', 'Expected Close', 'Next Follow-up', 'Notes', 'Created'];
    const rows = contacts.map((c) => [c.name, c.company_name, c.email, c.phone, CRM_STAGE_LABELS[c.stage], c.deal_value, c.expected_close_date, c.follow_up_date, c.notes, c.created_at]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-contacts-${todayIso()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const today = todayIso();
  const followUpsDue = contacts.filter((c) => c.follow_up_date && c.follow_up_date <= today && c.stage !== 'won' && c.stage !== 'lost').length;
  const activeCount = metrics ? metrics.total_contacts - metrics.stage_summaries.won.count - metrics.stage_summaries.lost.count : 0;
  const stages = CRM_STAGES.filter((s) => showLost || s !== 'lost' || stageFilter === 'lost');
  const visible = view === 'table' && !showLost && stageFilter !== 'lost' ? contacts.filter((c) => c.stage !== 'lost') : contacts;

  const stats = [
    { icon: Users, label: 'Active deals', value: String(activeCount) },
    { icon: DollarSign, label: 'Pipeline value', value: formatMoney(metrics?.total_pipeline_value ?? 0, currency) },
    {
      icon: CheckCircle2,
      label: 'Won · win rate',
      value: `${metrics?.stage_summaries.won.count ?? 0} · ${metrics?.win_rate === null || metrics?.win_rate === undefined ? '—' : `${metrics.win_rate}%`}`,
    },
    { icon: Clock, label: 'Follow-ups due', value: String(followUpsDue), alert: followUpsDue > 0 },
  ];

  const isEmpty = !loading && !error && metrics?.total_contacts === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM — Deals Pipeline</h1>
          <p className="text-sm text-muted-foreground">Your private pipeline — only you can see these contacts.</p>
        </div>
        <button type="button" onClick={() => setAddOpen(true)} className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1.5">
          <Plus size={15} /> Add Contact
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', s.alert ? 'bg-red-100 text-red-600 dark:bg-red-500/15' : 'bg-primary/10 text-primary')}>
              <s.icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              {loading && !metrics ? <div className="h-5 w-16 mt-1 rounded bg-muted animate-pulse" /> : <p className="text-lg font-bold text-foreground truncate">{s.value}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, company or email…" className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary" />
        </div>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as '' | CrmStage)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none" aria-label="Filter by stage">
          <option value="">All stages</option>
          {CRM_STAGES.map((s) => <option key={s} value={s}>{CRM_STAGE_LABELS[s]}</option>)}
        </select>
        <button type="button" onClick={() => setShowLost((v) => !v)} className={cn('px-3 py-2 rounded-lg border border-border text-xs font-semibold flex items-center gap-1.5', showLost ? 'bg-red-50 text-red-600 dark:bg-red-500/10' : 'text-muted-foreground')}>
          <XCircle size={13} /> {showLost ? 'Hide lost' : `Show lost (${metrics?.stage_summaries.lost.count ?? 0})`}
        </button>
        <button type="button" onClick={exportCsv} disabled={contacts.length === 0} className="px-3 py-2 rounded-lg border border-border text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40">
          <Download size={13} /> Export CSV
        </button>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button type="button" onClick={() => setView('board')} aria-label="Pipeline view" className={cn('px-3 py-2', view === 'board' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}><LayoutDashboard size={14} /></button>
          <button type="button" onClick={() => setView('table')} aria-label="Table view" className={cn('px-3 py-2', view === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}><List size={14} /></button>
        </div>
      </div>

      {loading && !metrics ? (
        <div className="flex gap-3 overflow-hidden">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="w-[250px] h-64 shrink-0 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button type="button" onClick={() => load()} className="mt-2 text-sm font-semibold text-primary hover:underline">Retry</button>
        </div>
      ) : isEmpty ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          You haven't added any sales leads or contacts yet. Click '+ Add Contact' or convert a received referral.
        </div>
      ) : view === 'board' && metrics ? (
        <PipelineKanbanBoard stages={stages} contacts={contacts} metrics={metrics} currency={currency} onOpen={(c) => setOpenId(c.id)} onMove={move} />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="p-3 font-semibold">Name</th>
                <th className="p-3 font-semibold">Company</th>
                <th className="p-3 font-semibold">Stage</th>
                <th className="p-3 font-semibold text-right">Value</th>
                <th className="p-3 font-semibold">Follow-up</th>
                <th className="p-3 font-semibold">Expected close</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No contacts match your filters.</td></tr>
              ) : (
                visible.map((c) => (
                  <tr key={c.id} onClick={() => setOpenId(c.id)} className="border-b border-border/60 last:border-0 hover:bg-muted/40 cursor-pointer">
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3 text-muted-foreground">{c.company_name || '—'}</td>
                    <td className="p-3">{CRM_STAGE_LABELS[c.stage]}</td>
                    <td className="p-3 text-right">{formatMoney(c.deal_value, currency)}</td>
                    <td className={cn('p-3', c.follow_up_date && c.follow_up_date <= today && c.stage !== 'won' && c.stage !== 'lost' ? 'text-red-600 font-semibold' : 'text-muted-foreground')}>{formatShortDate(c.follow_up_date) || '—'}</td>
                    <td className="p-3 text-muted-foreground">{formatShortDate(c.expected_close_date) || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <AddContactModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={() => load(true)} />
      <ContactDetailDrawer contactId={openId} currency={currency} onClose={() => setOpenId(null)} onChanged={() => load(true)} />
    </div>
  );
};
