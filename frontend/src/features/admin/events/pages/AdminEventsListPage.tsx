import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  MapPin,
  Search,
  ScanLine,
  Pencil,
  Trash2,
  Plus,
  List as ListIcon,
  Calendar as CalendarIcon,
  X,
  UserPlus,
  Repeat,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchEvents, type EventItem } from '@/features/events/services/events.api';
import { EventsCalendarGrid } from '@/features/events/components/EventsCalendarGrid';

interface AdminEventsListPageProps {
  chamberSlug?: string;
  onSelectEvent: (eventId: string) => void;
  onCheckIn?: (event: EventItem) => void;
  onEdit?: (event: EventItem) => void;
  onCreateEvent?: () => void;
}

export const AdminEventsListPage: React.FC<AdminEventsListPageProps> = ({
  chamberSlug,
  onSelectEvent,
  onCheckIn,
  onEdit,
  onCreateEvent,
}) => {
  const [tab, setTab] = useState<'Upcoming' | 'Past'>('Upcoming');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Any Category');
  const [monthFilter, setMonthFilter] = useState('Any Month');
  const [sortMode, setSortMode] = useState<'az' | 'date'>('date');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Month helper e.g. "Jul 2026"
  const monthOf = (dateStr: string) => {
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return null;
    }
  };

  const loadData = () => {
    setLoading(true);
    fetchEvents(
      {
        timeframe: tab === 'Upcoming' ? 'upcoming' : 'past',
        limit: 100,
      },
      chamberSlug
    )
      .then((res) => {
        setEvents(res.events || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load events:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [tab, chamberSlug]);

  // Derived filter options
  const categories = Array.from(new Set(events.map((e) => e.category).filter(Boolean))) as string[];
  const months = Array.from(new Set(events.map((e) => monthOf(e.eventDate)).filter(Boolean))) as string[];

  // Filter & sort logic
  const filtered = events.filter((e) => {
    const matchesKeyword =
      !q.trim() ||
      e.title.toLowerCase().includes(q.toLowerCase()) ||
      (e.description && e.description.toLowerCase().includes(q.toLowerCase())) ||
      (e.city && e.city.toLowerCase().includes(q.toLowerCase()));
    const matchesCategory = categoryFilter === 'Any Category' || e.category === categoryFilter;
    const matchesMonth = monthFilter === 'Any Month' || monthOf(e.eventDate) === monthFilter;
    return matchesKeyword && matchesCategory && matchesMonth;
  });

  const sortedFiltered = [...filtered].sort((a, b) => {
    if (sortMode === 'az') return a.title.localeCompare(b.title);
    return new Date(a.eventDate.replace(' ', 'T')).getTime() - new Date(b.eventDate.replace(' ', 'T')).getTime();
  });

  const clearFilters = () => {
    setQ('');
    setCategoryFilter('Any Category');
    setMonthFilter('Any Month');
  };

  const filtersActive = q.trim() || categoryFilter !== 'Any Category' || monthFilter !== 'Any Month';

  const handleDelete = (e: EventItem, evtClick: React.MouseEvent) => {
    evtClick.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${e.title}"?`)) {
      setEvents((prev) => prev.filter((item) => item.id !== e.id));
      toast.success('Event deleted');
    }
  };

  return (
    <div className="w-full text-[#111827]">
      {/* Top action row: Tabs, View switcher, Create Event */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        {/* Upcoming / Past Tabs */}
        <div className="flex gap-2">
          {(['Upcoming', 'Past'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-5 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer shadow-xs"
              style={
                tab === t
                  ? { background: '#0A2540', color: '#fff' }
                  : { background: '#fff', border: '1px solid #E5E7EB', color: '#4B5563' }
              }
            >
              {t}
            </button>
          ))}
        </div>

        {/* View Toggle + Create Event button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl p-1 bg-[#F0F1F3]">
            <button
              onClick={() => setView('list')}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer"
              style={{
                background: view === 'list' ? '#fff' : 'transparent',
                color: view === 'list' ? '#0A2540' : '#6B7280',
                boxShadow: view === 'list' ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
              }}
            >
              <ListIcon size={14} /> List
            </button>
            <button
              onClick={() => setView('calendar')}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer"
              style={{
                background: view === 'calendar' ? '#fff' : 'transparent',
                color: view === 'calendar' ? '#0A2540' : '#6B7280',
                boxShadow: view === 'calendar' ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
              }}
            >
              <CalendarIcon size={14} /> Calendar
            </button>
          </div>

          <button
            onClick={() => {
              if (onCreateEvent) onCreateEvent();
              else toast.info('Event Creation Wizard (Prompt 04.6) is scheduled next in the roadmap.');
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 text-white transition-all cursor-pointer shadow-xs"
            style={{ background: '#0A2540' }}
          >
            <Plus size={15} /> Create Event
          </button>
        </div>
      </div>

      {view === 'calendar' ? (
        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs">
          <EventsCalendarGrid
            events={sortedFiltered}
            onSelectEvent={(evt) => onSelectEvent(evt.id)}
          />
        </div>
      ) : (
        /* Main Layout: Left Filter Sidebar + Right Events Cards Roster */
        <div className="flex gap-6 items-start flex-wrap md:flex-nowrap">
          {/* Narrow Search by Sidebar */}
          <aside className="w-full md:w-64 shrink-0 space-y-4">
            <div className="p-5 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
              <p className="text-xs font-bold mb-3 text-[#111827]">Narrow search by:</p>
              <div className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-semibold block mb-1 text-[#6B7280]">Keyword</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search events..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl text-xs outline-none bg-white border border-[#E5E7EB] focus:border-[#0A2540]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold block mb-1 text-[#6B7280]">Category</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-white border border-[#E5E7EB] text-[#111827] focus:border-[#0A2540]"
                  >
                    <option>Any Category</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold block mb-1 text-[#6B7280]">Month</label>
                  <select
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-white border border-[#E5E7EB] text-[#111827] focus:border-[#0A2540]"
                  >
                    <option>Any Month</option>
                    {months.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filtersActive && (
                <button
                  onClick={clearFilters}
                  className="text-[11px] font-semibold mt-3.5 inline-flex items-center gap-1 text-[#0284C7] hover:underline cursor-pointer"
                >
                  <X size={12} /> Clear Filters
                </button>
              )}
            </div>
          </aside>

          {/* Right Column: Results count, sorting, and event cards */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
              <p className="text-xs font-semibold text-[#6B7280]">
                Results Found: {sortedFiltered.length}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[#6B7280]">Sort by:</span>
                <button
                  onClick={() => setSortMode('az')}
                  className="px-3 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
                  style={
                    sortMode === 'az'
                      ? { background: '#0A2540', color: '#fff' }
                      : { background: '#F0F1F3', color: '#4B5563' }
                  }
                >
                  A–Z
                </button>
                <button
                  onClick={() => setSortMode('date')}
                  className="px-3 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
                  style={
                    sortMode === 'date'
                      ? { background: '#0A2540', color: '#fff' }
                      : { background: '#F0F1F3', color: '#4B5563' }
                  }
                >
                  Date
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3.5">
              {loading ? (
                <div className="p-12 text-center text-xs text-[#6B7280] bg-white rounded-2xl border border-[#E5E7EB]">
                  Loading events...
                </div>
              ) : sortedFiltered.length === 0 ? (
                <div className="p-10 text-center text-xs text-[#6B7280] rounded-2xl border border-[#E5E7EB] bg-white">
                  No events match your filters.
                </div>
              ) : (
                sortedFiltered.map((e) => {
                  const dateObj = new Date(e.eventDate.replace(' ', 'T'));
                  const dateDisplay = dateObj.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });
                  const feeDisplay = e.isPaid && e.registrationFee > 0 ? `$${e.registrationFee}` : 'Free';

                  return (
                    <div
                      key={e.id}
                      className="p-5 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs hover:border-[#0A2540]/30 transition-all cursor-pointer"
                      onClick={() => onSelectEvent(e.id)}
                    >
                      <div className="flex gap-4">
                        {/* Event Left Calendar Icon Box */}
                        <div
                          className="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center text-white"
                          style={{ background: '#0A2540' }}
                        >
                          <CalendarDays size={24} />
                        </div>

                        {/* Event Content Body */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-3">
                            <h3
                              className="font-bold text-base text-[#111827] hover:underline"
                              onClick={() => onSelectEvent(e.id)}
                            >
                              {e.title}
                            </h3>
                            <div className="flex items-center flex-wrap gap-2 sm:shrink-0">
                              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669]">
                                {tab}
                              </span>
                              <span className="text-xs text-[#6B7280]">
                                {e.registeredCount} registered
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs mt-1.5 text-[#6B7280]">
                            <CalendarDays size={13} /> {dateDisplay} · {feeDisplay}
                          </div>

                          <div className="flex items-center gap-2 text-xs mt-1 text-[#6B7280]">
                            <MapPin size={13} /> {e.venue ? `${e.venue}, ${e.city || ''}` : e.city || 'Virtual'}
                          </div>

                          {e.description && (
                            <p className="text-xs mt-2 leading-relaxed text-[#6B7280]">
                              {e.description.length <= 130
                                ? e.description
                                : `${e.description.slice(0, 130)}… `}
                              <span className="font-semibold text-[#0284C7] hover:underline">
                                more details →
                              </span>
                            </p>
                          )}

                          {/* Category and Visibility Badges */}
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            {e.category && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F1F5F9] text-[#0A2540]">
                                {e.category}
                              </span>
                            )}
                            {e.visibility === 'members_only' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF3C7] text-[#D97706]">
                                Members Only
                              </span>
                            )}
                          </div>

                          {/* Action Buttons Row */}
                          <div className="flex flex-wrap gap-2 mt-4 pt-1">
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                if (onCheckIn) onCheckIn(e);
                                else onSelectEvent(e.id);
                              }}
                              className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-gray-50 text-xs font-semibold inline-flex items-center gap-1.5 text-[#111827] cursor-pointer"
                            >
                              <ScanLine size={14} /> QR Check-In
                            </button>

                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                if (onEdit) onEdit(e);
                                else onSelectEvent(e.id);
                              }}
                              className="px-3.5 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-gray-50 text-xs font-semibold text-[#111827] cursor-pointer"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={(ev) => handleDelete(e, ev)}
                              className="px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-xs font-semibold inline-flex items-center gap-1 text-[#DC2626] cursor-pointer"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEventsListPage;
