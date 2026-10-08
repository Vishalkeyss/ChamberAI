import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  Grid,
  List,
  Sparkles,
  CalendarCheck2,
  History,
  Building,
  X,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { EventCard } from '../components/EventCard';
import { EventsCalendarGrid } from '../components/EventsCalendarGrid';
import { EventsFilterSidebar } from '../components/EventsFilterSidebar';
import { EventRegistrationModal } from '../components/EventRegistrationModal';
import {
  fetchEvents,
  fetchEventsFilters,
  type EventItem,
  type EventsMeta,
  type EventsFilters,
} from '../services/events.api';

export interface EventsExplorerPageProps {
  mode?: 'public' | 'member';
  chamberName?: string;
  chamberSlug?: string;
  onNavigateToPlans?: () => void;
}

export const EventsExplorerPage: React.FC<EventsExplorerPageProps> = ({
  mode = 'public',
  chamberName,
  chamberSlug,
  onNavigateToPlans,
}) => {
  const isMember = mode === 'member';

  // State
  const [timeframe, setTimeframe] = useState<'upcoming' | 'past'>('upcoming');
  const [viewMode, setViewMode] = useState<'grid' | 'calendar' | 'list'>('grid');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [meta, setMeta] = useState<EventsMeta>({ page: 1, limit: 12, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState<EventsFilters>({ categories: [], cities: [], chapters: [] });
  const [loading, setLoading] = useState(true);

  // Filter values
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [selectedPricing, setSelectedPricing] = useState('all');
  const [selectedCity, setSelectedCity] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State for Quick Registration & Recap
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isRecapModalOpen, setIsRecapModalOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load dynamic filter options
  useEffect(() => {
    fetchEventsFilters(chamberSlug, isMember)
      .then(setFilters)
      .catch((err) => console.error('Failed to load event filters:', err));
  }, [chamberSlug, isMember]);

  // Fetch events list
  const loadEvents = useCallback(
    async (page: number = 1) => {
      setLoading(true);
      try {
        const isVirtual =
          selectedFormat === 'virtual' ? 1 : selectedFormat === 'in_person' ? 0 : undefined;
        const isPaid =
          selectedPricing === 'paid' ? 1 : selectedPricing === 'free' ? 0 : undefined;

        const res = await fetchEvents(
          {
            timeframe,
            category: selectedCategory || undefined,
            chapter_id: selectedChapter || undefined,
            city: selectedCity || undefined,
            is_virtual: isVirtual,
            is_paid: isPaid,
            q: searchQuery.trim() || undefined,
            page,
            limit: viewMode === 'calendar' ? 50 : 12,
          },
          chamberSlug,
          isMember
        );

        setEvents(res.events);
        setMeta(res.meta);
      } catch (err) {
        console.error('Failed to fetch events:', err);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    },
    [
      timeframe,
      selectedCategory,
      selectedChapter,
      selectedCity,
      selectedFormat,
      selectedPricing,
      searchQuery,
      chamberSlug,
      isMember,
      viewMode,
    ]
  );

  // Debounce search filter triggers
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCurrentPage(1);
      loadEvents(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    timeframe,
    selectedCategory,
    selectedChapter,
    selectedCity,
    selectedFormat,
    selectedPricing,
    searchQuery,
    viewMode,
  ]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedChapter('');
    setSelectedFormat('all');
    setSelectedPricing('all');
    setSelectedCity('');
    setCurrentPage(1);
  };

  const handleRegisterClick = (event: EventItem) => {
    // Full events stay registrable: the server places the registrant on the waitlist (§7.2).
    setSelectedEvent(event);
    setIsRegisterModalOpen(true);
  };

  const handleViewRecapClick = (event: EventItem) => {
    setSelectedEvent(event);
    setIsRecapModalOpen(true);
  };

  const handleAddToCalendar = (event: EventItem) => {
    try {
      const start = new Date(event.eventDate.replace(' ', 'T')).toISOString().replace(/-|:|\.\d\d\d/g, '');
      const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        event.title
      )}&dates=${start}/${start}&details=${encodeURIComponent(
        event.description || ''
      )}&location=${encodeURIComponent(event.venue || event.city || '')}`;
      window.open(googleCalUrl, '_blank');
      toast.success('Opening Google Calendar');
    } catch {
      toast.error('Unable to create calendar entry');
    }
  };


  return (
    <div className="w-full pb-16">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {isMember ? 'Member Events & Gatherings' : 'Chamber Events & Workshops'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isMember
              ? 'Connect, learn, and grow with member roundtable mixers and regional conferences.'
              : 'Browse and register for upcoming chamber gatherings, workshops, and galas.'}
          </p>
        </div>

        {/* Tab & View Mode Toggles */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Upcoming vs Past Pill Tabs */}
          <div className="flex items-center p-1 bg-gray-100 dark:bg-muted rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTimeframe('upcoming')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer',
                timeframe === 'upcoming'
                  ? 'bg-white dark:bg-card text-gray-900 dark:text-white shadow-xs font-bold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              )}
            >
              <CalendarCheck2 size={13} />
              <span>Upcoming</span>
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('past')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer',
                timeframe === 'past'
                  ? 'bg-white dark:bg-card text-gray-900 dark:text-white shadow-xs font-bold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              )}
            >
              <History size={13} />
              <span>Past Events</span>
            </button>
          </div>

          {/* View Mode Toggle: Grid | Calendar | List */}
          <div className="flex items-center p-1 bg-gray-100 dark:bg-muted rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Card Grid View"
              className={cn(
                'p-1.5 rounded-lg transition cursor-pointer',
                viewMode === 'grid'
                  ? 'bg-white dark:bg-card text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              )}
            >
              <Grid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              title="Calendar View"
              className={cn(
                'p-1.5 rounded-lg transition cursor-pointer',
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-card text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              )}
            >
              <Calendar size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="List View"
              className={cn(
                'p-1.5 rounded-lg transition cursor-pointer',
                viewMode === 'list'
                  ? 'bg-white dark:bg-card text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              )}
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout Grid: Filters on Left, Event Results on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Left Filter Sidebar */}
        <div className="lg:col-span-1">
          <EventsFilterSidebar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            selectedChapter={selectedChapter}
            onChapterChange={setSelectedChapter}
            selectedFormat={selectedFormat}
            onFormatChange={setSelectedFormat}
            selectedPricing={selectedPricing}
            onPricingChange={setSelectedPricing}
            selectedCity={selectedCity}
            onCityChange={setSelectedCity}
            filters={filters}
            onClearFilters={handleClearFilters}
          />
        </div>

        {/* Right Content Area */}
        <div className="lg:col-span-3">
          {/* Results Summary Header */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Showing <span className="font-bold text-gray-900 dark:text-white">{meta.total}</span>{' '}
              {timeframe} events
            </p>
          </div>

          {/* Loading Skeleton State */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-gray-200 dark:border-border bg-white dark:bg-card p-5 h-80 animate-pulse flex flex-col"
                >
                  <div className="w-full h-36 bg-gray-200 dark:bg-muted rounded-xl mb-4" />
                  <div className="h-4 bg-gray-200 dark:bg-muted rounded w-1/3 mb-2" />
                  <div className="h-5 bg-gray-200 dark:bg-muted rounded w-3/4 mb-3" />
                  <div className="h-3 bg-gray-100 dark:bg-muted/60 rounded w-1/2 mb-auto" />
                  <div className="h-10 bg-gray-200 dark:bg-muted rounded-xl mt-4" />
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            /* Empty State */
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-border bg-white dark:bg-card p-12 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-muted flex items-center justify-center mb-3 text-gray-400">
                <Calendar size={26} />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                No {timeframe} events found
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mb-4">
                No events match your current filters. Try searching for another keyword or resetting your category selections.
              </p>
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0B1E3B] text-white hover:bg-[#102A43] transition cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : viewMode === 'calendar' ? (
            /* Interactive Calendar View */
            <EventsCalendarGrid
              events={events}
              onSelectEvent={(evt) => {
                if (timeframe === 'upcoming') {
                  handleRegisterClick(evt);
                } else {
                  handleViewRecapClick(evt);
                }
              }}
            />
          ) : viewMode === 'list' ? (
            /* Agenda List View */
            <div className="space-y-4">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className="rounded-2xl border border-gray-200/90 dark:border-border bg-white dark:bg-card p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:shadow-md transition"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#0B1E3B]/10 dark:bg-primary/20 flex flex-col items-center justify-center text-primary shrink-0 font-bold">
                      <span className="text-[10px] uppercase">
                        {new Date(evt.eventDate.replace(' ', 'T')).toLocaleString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-lg leading-none">
                        {new Date(evt.eventDate.replace(' ', 'T')).getDate()}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary">
                          {evt.category || 'Event'}
                        </span>
                        {evt.visibility === 'members_only' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                            Members Only
                          </span>
                        )}
                        {evt.isSoldOut && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold">
                            Sold Out
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-base text-gray-900 dark:text-white">
                        {evt.title}
                      </h3>

                      <p className="text-xs text-gray-500 mt-1">
                        {evt.venue || evt.city || 'Chamber Event'}
                        {evt.isPaid ? ` · $${evt.registrationFee.toFixed(2)}` : ' · Free'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {timeframe === 'upcoming' ? (
                      <button
                        type="button"
                        disabled={evt.isSoldOut}
                        onClick={() => handleRegisterClick(evt)}
                        className={cn(
                          'w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer',
                          evt.isSoldOut
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-[#0B1E3B] hover:bg-[#102A43] text-white'
                        )}
                      >
                        {evt.isSoldOut ? 'Sold Out' : 'Register Now'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleViewRecapClick(evt)}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-border hover:bg-gray-50 text-gray-700 dark:text-gray-200 transition cursor-pointer"
                      >
                        View Recap
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Card Grid View (Default - 2 columns per row in right area) */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {events.map((evt) => (
                <EventCard
                  key={evt.id}
                  event={evt}
                  timeframe={timeframe}
                  isMember={isMember}
                  onRegister={handleRegisterClick}
                  onViewRecap={handleViewRecapClick}
                  onAddToCalendar={handleAddToCalendar}
                />
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {meta.totalPages > 1 && viewMode !== 'calendar' && (
            <div className="flex items-center justify-center gap-2 mt-10">
              {Array.from({ length: meta.totalPages }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => {
                      setCurrentPage(pageNum);
                      loadEvents(pageNum);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={cn(
                      'w-9 h-9 rounded-xl text-xs font-semibold transition cursor-pointer',
                      pageNum === currentPage
                        ? 'bg-[#0B1E3B] text-white shadow-xs'
                        : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Registration & Checkout Modal (Prompt 04.3) */}
      {isRegisterModalOpen && selectedEvent && (
        <EventRegistrationModal
          event={selectedEvent}
          isMember={isMember}
          chamberSlug={chamberSlug}
          pointRedemptionValue={meta.pointRedemptionValue}
          onClose={() => setIsRegisterModalOpen(false)}
          onRegistered={() => loadEvents(currentPage)}
        />
      )}

      {/* Past Event Recap Modal */}
      {isRecapModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl p-6">
            <button
              type="button"
              onClick={() => setIsRecapModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="mb-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                Completed Event
              </span>
              <h3 className="text-base font-bold text-foreground mt-0.5">
                {selectedEvent.title} — Recap
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Concluded with {selectedEvent.registeredCount} verified attendee participants.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-xs text-muted-foreground space-y-2 mb-4">
              <p className="leading-relaxed">
                {selectedEvent.description ||
                  'Thank you to everyone who joined us for this signature chamber gathering! Presentations, photo highlights, and attendee networking contacts are archived in the Chamber archives.'}
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsRecapModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#0B1E3B] text-white text-xs font-semibold cursor-pointer"
              >
                Close Recap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
