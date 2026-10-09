import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Award, CheckCircle2, Clock, Inbox, Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { QuickChatDrawer } from '@/features/networking/components/QuickChatDrawer';
import type { NetworkMember } from '@/features/networking/services/networking.api';
import { MentorCard, MentorCardSkeleton } from '../components/MentorCard';
import { MentorshipRequestModal } from '../components/MentorshipRequestModal';
import { ActiveConnectionCard } from '../components/ActiveConnectionCard';
import { RequestCard } from '../components/RequestCard';
import { MentorProfileEditor } from '../components/MentorProfileEditor';
import {
  fetchConnections,
  fetchMentors,
  type ConnectionStats,
  type Mentor,
  type MentorFilters,
  type MentorshipConnection,
} from '../services/mentorship.api';

type Tab = 'find' | 'requests' | 'profile';
const TABS: { id: Tab; label: string }[] = [
  { id: 'find', label: 'Find a Mentor' },
  { id: 'requests', label: 'Requests' },
  { id: 'profile', label: 'My Mentor Profile' },
];

function initialTab(): Tab {
  if (typeof window === 'undefined') return 'find';
  const raw = new URLSearchParams(window.location.search).get('tab');
  // Old links (notifications) pointed at the removed "My Connections" tab.
  const t = raw === 'connections' ? 'requests' : raw;
  return TABS.some((x) => x.id === t) ? (t as Tab) : 'find';
}

interface MentorshipHubPageProps {
  onOpenMessages?: (partnerId: string) => void;
}

/** Prompt 05.6 — Mentorship Hub (`/portal/mentorship`). */
export const MentorshipHubPage: React.FC<MentorshipHubPageProps> = ({ onOpenMessages }) => {
  const [tab, setTabState] = useState<Tab>(initialTab);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [filters, setFilters] = useState<MentorFilters>({ expertise: [], industries: [] });
  const [mentorsLoading, setMentorsLoading] = useState(true);
  const [mentorsError, setMentorsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expertise, setExpertise] = useState('');
  const [industry, setIndustry] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [connections, setConnections] = useState<MentorshipConnection[]>([]);
  const [stats, setStats] = useState<ConnectionStats | null>(null);
  const [connError, setConnError] = useState<string | null>(null);
  const [requestFor, setRequestFor] = useState<Mentor | null>(null);
  const [chatWith, setChatWith] = useState<NetworkMember | null>(null);
  const seq = useRef(0);

  const setTab = (next: Tab) => {
    setTabState(next);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    }
  };

  const loadMentors = useCallback(async () => {
    const current = ++seq.current;
    setMentorsLoading(true);
    try {
      const res = await fetchMentors({ search: search.trim() || undefined, expertise: expertise || undefined, industry: industry || undefined, available: availableOnly });
      if (current !== seq.current) return;
      setMentors(res.mentors);
      setFilters(res.filters);
      setMentorsError(null);
    } catch (err: any) {
      if (current === seq.current) setMentorsError(err.message || 'Failed to load mentors');
    } finally {
      if (current === seq.current) setMentorsLoading(false);
    }
  }, [search, expertise, industry, availableOnly]);

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetchConnections();
      setConnections(res.connections);
      setStats(res.stats);
      setConnError(null);
    } catch (err: any) {
      setConnError(err.message || 'Failed to load mentorships');
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(loadMentors, search ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [loadMentors, search]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const refreshAll = () => {
    loadConnections();
    loadMentors();
  };

  const active = connections.filter((c) => c.status === 'accepted');
  const past = connections.filter((c) => c.status === 'completed');
  const incoming = connections.filter((c) => c.status === 'pending' && c.role === 'mentor');
  const outgoing = connections.filter((c) => c.status === 'pending' && c.role === 'mentee');
  const closedRequests = connections.filter((c) => c.status === 'declined' || c.status === 'cancelled');
  const pendingCount = (stats?.pending_incoming ?? 0) + (stats?.pending_outgoing ?? 0);
  const availableCount = mentors.filter((m) => m.is_available).length;
  const filtersActive = !!(search.trim() || expertise || industry || availableOnly);

  const statCards = [
    { icon: Users, label: 'Mentors available', value: mentorsLoading && !mentors.length ? null : filtersActive ? `${availableCount} of ${mentors.length}` : String(availableCount) },
    { icon: Clock, label: 'Pending requests', value: stats ? String(pendingCount) : null },
    { icon: CheckCircle2, label: 'Active mentorships', value: stats ? String(stats.active) : null },
  ];

  const openChat = (c: MentorshipConnection) => {
    if (c.partner) setChatWith(c.partner);
  };

  const section = (title: string, items: MentorshipConnection[], render: (c: MentorshipConnection) => React.ReactNode) =>
    items.length > 0 && (
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title} ({items.length})</h3>
        {items.map(render)}
      </div>
    );

  const empty = (icon: React.ReactNode, title: string, desc: string, action?: React.ReactNode) => (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">{icon}</div>
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
      {action}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mentorship</h1>
          <p className="text-sm text-muted-foreground">Get paired with an experienced chamber member for 1:1 guidance.</p>
        </div>
        <Button type="button" onClick={() => setTab('profile')}>
          <Award size={15} /> Become a Mentor
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
              <s.icon size={18} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              {s.value === null ? <div className="h-5 w-10 mt-1 rounded bg-muted animate-pulse" /> : <p className="text-lg font-bold">{s.value}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {TABS.map((t) => {
          const badge = t.id === 'requests' ? stats?.pending_incoming : 0;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap flex items-center gap-1.5',
                tab === t.id ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
              {!!badge && (
                <span className={cn('min-w-5 h-5 px-1.5 rounded-full text-[11px] flex items-center justify-center', tab === t.id ? 'bg-primary-foreground/20' : 'bg-red-500 text-white')}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'find' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, business or expertise…" className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary" />
            </div>
            <select value={expertise} onChange={(e) => setExpertise(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none" aria-label="Filter by expertise">
              <option value="">All expertise</option>
              {filters.expertise.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {filters.industries.length > 0 && (
              <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none" aria-label="Filter by industry">
                <option value="">All industries</option>
                {filters.industries.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground px-2 cursor-pointer">
              <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} className="accent-primary" />
              Available only
            </label>
          </div>

          {mentorsError ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-sm">
              <p className="text-red-600">{mentorsError}</p>
              <button type="button" onClick={loadMentors} className="mt-3 px-4 py-2 rounded-lg border border-border text-xs font-semibold">Retry</button>
            </div>
          ) : mentorsLoading && !mentors.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => <MentorCardSkeleton key={i} />)}
            </div>
          ) : mentors.length === 0 ? (
            empty(
              <Award size={20} />,
              filtersActive ? 'No mentors found' : 'No mentors yet',
              'No mentors currently matching this filter criteria. Check back soon or broaden your search.',
              !filtersActive && (
                <button type="button" onClick={() => setTab('profile')} className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">Become the first mentor</button>
              )
            )
          ) : (
            <div className={cn('grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4', mentorsLoading && 'opacity-60')}>
              {mentors.map((m) => <MentorCard key={m.user_id} mentor={m} onRequest={setRequestFor} />)}
            </div>
          )}
        </div>
      )}

      {tab !== 'find' && tab !== 'profile' && connError && (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm">
          <p className="text-red-600">{connError}</p>
          <button type="button" onClick={loadConnections} className="mt-3 px-4 py-2 rounded-lg border border-border text-xs font-semibold">Retry</button>
        </div>
      )}

      {tab === 'requests' && !connError && (
        active.length + past.length + incoming.length + outgoing.length + closedRequests.length === 0
          ? empty(<Inbox size={20} />, 'No mentorship requests yet', 'Browse mentors and send your first request to get started.', (
              <button type="button" onClick={() => setTab('find')} className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">Find a Mentor</button>
            ))
          : (
            <div className="space-y-6">
              {section('Active mentorships', active, (c) => <ActiveConnectionCard key={c.id} connection={c} onChanged={refreshAll} onMessage={openChat} />)}
              {section('Incoming', incoming, (c) => <RequestCard key={c.id} connection={c} onChanged={refreshAll} />)}
              {section('Sent', outgoing, (c) => <RequestCard key={c.id} connection={c} onChanged={refreshAll} />)}
              {section('Completed', past, (c) => <ActiveConnectionCard key={c.id} connection={c} onChanged={refreshAll} onMessage={openChat} />)}
              {section('Closed', closedRequests, (c) => <RequestCard key={c.id} connection={c} onChanged={refreshAll} />)}
            </div>
          )
      )}

      {tab === 'profile' && <MentorProfileEditor suggestions={filters.expertise} onSaved={refreshAll} />}

      <MentorshipRequestModal mentor={requestFor} onClose={() => setRequestFor(null)} onSent={refreshAll} />
      <QuickChatDrawer open={!!chatWith} partner={chatWith} onClose={() => setChatWith(null)} onOpenInbox={onOpenMessages} />
    </div>
  );
};
