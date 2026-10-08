import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Handshake, Plus, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fetchChamberCurrency, formatMoney } from '@/features/events/services/events.api';
import { ReferralCard } from '../components/ReferralCard';
import { GiveReferralModal } from '../components/GiveReferralModal';
import { fetchReferrals, type Referral, type ReferralsResponse } from '../services/networking.api';

interface ReferralsPageProps {
  chamberName?: string;
  chamberSlug?: string;
}

type Tab = 'received' | 'given';

function matches(r: Referral, q: string): boolean {
  if (!q) return true;
  return [r.fromBusiness.name, r.toBusiness.name, r.message, ...r.contacts.map((c) => `${c.fullName} ${c.profession || ''}`)]
    .join(' ')
    .toLowerCase()
    .includes(q);
}

/** Prompt 05.3 §5.1 — Member Referrals Hub (`/portal/referrals`). */
export const ReferralsPage: React.FC<ReferralsPageProps> = ({ chamberName, chamberSlug }) => {
  const [data, setData] = useState<ReferralsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('received');
  const [search, setSearch] = useState('');
  const [giveOpen, setGiveOpen] = useState(false);
  const [currency, setCurrency] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async (silent = false) => {
    const current = ++seq.current;
    if (!silent) setLoading(true);
    try {
      const res = await fetchReferrals();
      if (current !== seq.current) return;
      setData(res);
      setError(null);
    } catch (err: any) {
      if (current === seq.current) setError(err.message || 'Failed to load referrals');
    } finally {
      if (current === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetchChamberCurrency(chamberSlug).then(setCurrency).catch(() => setCurrency(null));
  }, [load, chamberSlug]);

  const q = search.trim().toLowerCase();
  const list = (data ? data[tab] : []).filter((r) => matches(r, q));
  const noBusiness = data && data.myBusinessIds.length === 0;

  const stats = [
    { icon: UserPlus, label: 'Referrals Given', value: String(data?.stats.givenCount ?? 0) },
    { icon: Handshake, label: 'Referrals Received', value: String(data?.stats.receivedCount ?? 0) },
    { icon: CheckCircle2, label: 'Converted Business Value', value: formatMoney(data?.stats.convertedValue ?? 0, currency) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Referrals</h1>
          <p className="text-sm text-muted-foreground">Track the referrals you give and receive, and mark them won when they close</p>
        </div>
        <button
          type="button"
          onClick={() => setGiveOpen(true)}
          disabled={!!noBusiness}
          title={noBusiness ? 'Link a business profile to give referrals' : undefined}
          className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
        >
          <Plus size={15} /> Give a Referral
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <s.icon size={20} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              {loading && !data ? <div className="h-6 w-16 mt-1 rounded bg-muted animate-pulse" /> : <p className="text-xl font-bold text-foreground">{s.value}</p>}
            </div>
          </div>
        ))}
      </div>

      {noBusiness && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200 p-4 text-sm">
          Your account is not linked to an active business profile, so you can't give or receive referrals yet.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
          {(['received', 'given'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn('px-3.5 py-2 rounded-md text-sm font-semibold transition', tab === t ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground')}
            >
              {t === 'received' ? 'Received Referrals' : 'Given Referrals'}
              {data ? ` (${data[t].length})` : ''}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search referrals…"
            className="pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm outline-none w-56 focus:border-primary"
          />
        </div>
      </div>

      {loading && !data ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-44 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button type="button" onClick={() => load()} className="mt-2 text-sm font-semibold text-primary hover:underline">
            Retry
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {q ? 'No referrals match your search.' : tab === 'received' ? 'No referrals received yet.' : 'You have not given any referrals yet.'}
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((r) => (
            <ReferralCard key={r.id} referral={r} direction={tab} currency={currency} onChanged={() => load(true)} />
          ))}
        </div>
      )}

      <GiveReferralModal
        open={giveOpen}
        onClose={() => setGiveOpen(false)}
        chamberName={chamberName}
        rewardPoints={data?.rewardPoints}
        onSubmitted={(points) => {
          setGiveOpen(false);
          setTab('given');
          toast.success(`Referral sent ✓ · +${points} points`);
          load(true);
        }}
      />
    </div>
  );
};
