import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DirectoryFilterBar } from '../components/DirectoryFilterBar';
import { BusinessCard } from '../components/BusinessCard';
import { PublicBusinessCard } from '../components/PublicBusinessCard';
import { ViewProfileModal } from '../components/ViewProfileModal';
import { GuestJoinModal } from '../components/GuestJoinModal';
import { QuickMessageModal } from '../components/QuickMessageModal';
import { BookMeetingModal } from '../components/BookMeetingModal';
import {
  fetchDirectoryListings,
  fetchDirectoryFilters,
  type DirectoryBusiness,
  type DirectoryMeta,
  type DirectoryFilters,
} from '../services/directory.api';

export interface DirectoryPageProps {
  mode?: 'public' | 'member';
  chamberName?: string;
  chamberSlug?: string;
  onNavigateToPlans?: () => void;
}

export const DirectoryPage: React.FC<DirectoryPageProps> = ({
  mode = 'member',
  chamberName,
  chamberSlug,
  onNavigateToPlans,
}) => {
  // State
  const [businesses, setBusinesses] = useState<DirectoryBusiness[]>([]);
  const [meta, setMeta] = useState<DirectoryMeta>({ page: 1, limit: 12, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState<DirectoryFilters>({ industries: [], cities: [], chapters: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modals state
  const [selectedBusiness, setSelectedBusiness] = useState<DirectoryBusiness | null>(null);
  const [isViewProfileOpen, setIsViewProfileOpen] = useState(false);
  const [isGuestJoinOpen, setIsGuestJoinOpen] = useState(false);
  const [isQuickMessageOpen, setIsQuickMessageOpen] = useState(false);
  const [isBookMeetingOpen, setIsBookMeetingOpen] = useState(false);

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMemberMode = mode === 'member';

  // Load filter options on mount or chamber change
  useEffect(() => {
    fetchDirectoryFilters(chamberSlug)
      .then(setFilters)
      .catch((err) => console.error('Failed to load filters:', err));
  }, [chamberSlug]);

  // Fetch directory listings
  // Latest request wins: a slower earlier response must not overwrite newer results.
  const requestSeqRef = useRef(0);

  const fetchListings = useCallback(
    async (page: number = 1) => {
      const seq = ++requestSeqRef.current;
      setLoading(true);
      setLoadError(false);
      try {
        const result = await fetchDirectoryListings(
          {
            q: searchQuery.trim() || undefined,
            industry: selectedIndustry || undefined,
            city: selectedCity || undefined,
            page,
            limit: 12,
          },
          chamberSlug,
          isMemberMode
        );

        if (seq !== requestSeqRef.current) return;
        setBusinesses(result.businesses);
        setMeta(result.meta);
      } catch (err) {
        if (seq !== requestSeqRef.current) return;
        console.error('Error fetching directory listings:', err);
        setBusinesses([]);
        setMeta({ page: 1, limit: 12, total: 0, totalPages: 0 });
        setLoadError(true);
      } finally {
        if (seq === requestSeqRef.current) setLoading(false);
      }
    },
    [searchQuery, selectedIndustry, selectedCity, chamberSlug, isMemberMode]
  );

  // Debounced search trigger (300ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCurrentPage(1);
      fetchListings(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchListings]);

  // Pagination handler
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchListings(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedIndustry('');
    setSelectedCity('');
    setCurrentPage(1);
  };

  // Connect Handlers
  const handleSendMessage = (business: DirectoryBusiness) => {
    setSelectedBusiness(business);
    if (isMemberMode) {
      setIsQuickMessageOpen(true);
    } else {
      setIsGuestJoinOpen(true);
    }
  };

  const handleBookMeeting = (business: DirectoryBusiness) => {
    setSelectedBusiness(business);
    if (isMemberMode) {
      setIsBookMeetingOpen(true);
    } else {
      setIsGuestJoinOpen(true);
    }
  };

  const handleViewProfile = (business: DirectoryBusiness) => {
    setSelectedBusiness(business);
    setIsViewProfileOpen(true);
  };

  return (
    <div className="min-h-full pb-12">
      {/* Page Title & Subtitle */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          Member & Business Directory
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {mode === 'public'
            ? 'Browse verified local businesses'
            : 'Search and connect with verified chamber members.'}
        </p>
      </div>

      {/* Filter Card */}
      <DirectoryFilterBar
        mode={mode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedIndustry={selectedIndustry}
        onIndustryChange={setSelectedIndustry}
        selectedCity={selectedCity}
        onCityChange={setSelectedCity}
        filters={filters}
        onClearFilters={handleClearFilters}
      />

      {/* Results Header: Count (Member mode only) */}
      {mode === 'member' && (
        <div className="mt-7 mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-gray-900 dark:text-white">{meta.total}</span> members found
          </p>
        </div>
      )}

      {/* Directory Listings (Grid View) */}
      {loading ? (
        /* Animated Skeleton Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-200/90 dark:border-border/80 bg-white dark:bg-card p-5 h-[230px] flex flex-col border-t-4 border-t-gray-300 animate-pulse"
            >
              <div className="flex items-center gap-3.5 mb-3">
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-muted shrink-0" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-muted rounded w-2/3 mb-2" />
                  <div className="h-3 bg-gray-100 dark:bg-muted/60 rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-muted/60 rounded w-3/4 mb-3" />
              <div className="flex gap-2 mb-4">
                <div className="h-5 bg-gray-200 dark:bg-muted rounded-full w-16" />
                <div className="h-5 bg-gray-200 dark:bg-muted rounded-full w-24" />
              </div>
              <div className="mt-auto flex gap-2">
                <div className="h-9 bg-gray-200 dark:bg-muted rounded-xl flex-1" />
                <div className="h-9 bg-gray-200 dark:bg-muted rounded-xl w-10" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-gray-200 dark:border-border bg-white dark:bg-card p-8">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
            Couldn't load the directory
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mb-4">
            Something went wrong while fetching businesses. Please try again.
          </p>
          <button
            type="button"
            onClick={() => fetchListings(currentPage)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0B1E3B] text-white hover:bg-[#102A43] transition cursor-pointer shadow-xs"
          >
            Retry
          </button>
        </div>
      ) : businesses.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-gray-200 dark:border-border bg-white dark:bg-card p-8">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-muted flex items-center justify-center mb-3">
            <Building2 size={26} className="text-gray-400" />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
            No businesses found
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mb-4">
            No businesses match your current search filters. Try adjusting your keywords or clearing filters.
          </p>
          <button
            type="button"
            onClick={handleClearFilters}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0B1E3B] text-white hover:bg-[#102A43] transition cursor-pointer shadow-xs"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        /* Grid View (Default - 3 columns) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {businesses.map((biz) =>
            mode === 'public' ? (
              <PublicBusinessCard
                key={biz.id}
                business={biz}
                onViewProfile={handleViewProfile}
              />
            ) : (
              <BusinessCard
                key={biz.id}
                business={biz}
                isMember={isMemberMode}
                onSendMessage={handleSendMessage}
                onBookMeeting={handleBookMeeting}
                onViewProfile={handleViewProfile}
              />
            )
          )}
        </div>
      )}

      {/* Pagination Controls */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(currentPage - 1)}
            className="p-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>

          {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
            const pageNum = i + 1;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => handlePageChange(pageNum)}
                className={cn(
                  'w-9 h-9 rounded-xl text-xs font-semibold transition cursor-pointer',
                  pageNum === currentPage
                    ? 'bg-[#0B1E3B] text-white shadow-xs'
                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-2xs'
                )}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            type="button"
            disabled={currentPage >= meta.totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
            className="p-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* View Profile Detail Modal */}
      <ViewProfileModal
        isOpen={isViewProfileOpen}
        onClose={() => setIsViewProfileOpen(false)}
        business={selectedBusiness}
        onSendMessage={handleSendMessage}
        onBookMeeting={handleBookMeeting}
      />

      {/* Guest Join Prompt Modal */}
      <GuestJoinModal
        isOpen={isGuestJoinOpen}
        onClose={() => setIsGuestJoinOpen(false)}
        business={selectedBusiness}
        chamberName={chamberName}
        onExplorePlans={onNavigateToPlans}
      />

      {/* Quick Direct Message Modal */}
      <QuickMessageModal
        isOpen={isQuickMessageOpen}
        onClose={() => setIsQuickMessageOpen(false)}
        business={selectedBusiness}
      />

      {/* 1:1 Meeting Scheduler Modal */}
      <BookMeetingModal
        isOpen={isBookMeetingOpen}
        onClose={() => setIsBookMeetingOpen(false)}
        business={selectedBusiness}
      />
    </div>
  );
};
