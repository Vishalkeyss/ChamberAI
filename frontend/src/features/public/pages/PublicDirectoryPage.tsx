import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  X,
  LayoutGrid,
  List,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
  Loader2,
} from 'lucide-react';
import { BusinessCard } from '../components/directory/BusinessCard';
import {
  fetchDirectoryListings,
  fetchDirectoryFilters,
  type DirectoryBusiness,
  type DirectoryMeta,
  type DirectoryFilters,
} from '../services/directory.api';
import { cn } from '@/lib/utils';

interface PublicDirectoryPageProps {
  chamberName?: string;
  chamberSlug?: string;
}

export const PublicDirectoryPage: React.FC<PublicDirectoryPageProps> = ({ chamberName, chamberSlug }) => {
  // State
  const [businesses, setBusinesses] = useState<DirectoryBusiness[]>([]);
  const [meta, setMeta] = useState<DirectoryMeta>({ page: 1, limit: 12, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState<DirectoryFilters>({ industries: [], cities: [], chapters: [] });
  const [loading, setLoading] = useState(true);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load filters on mount
  useEffect(() => {
    setFiltersLoading(true);
    fetchDirectoryFilters(chamberSlug)
      .then(setFilters)
      .finally(() => setFiltersLoading(false));
  }, [chamberSlug]);

  // Fetch directory listings with debounce for search
  const fetchListings = useCallback(
    async (page: number = 1) => {
      setLoading(true);
      try {
        const result = await fetchDirectoryListings({
          q: searchQuery || undefined,
          industry: selectedIndustry || undefined,
          chapter_id: selectedChapter || undefined,
          city: selectedCity || undefined,
          verified: verifiedOnly || undefined,
          page,
          limit: 12,
        }, chamberSlug);
        setBusinesses(result.businesses);
        setMeta(result.meta);
      } finally {
        setLoading(false);
      }
    },
    [searchQuery, selectedIndustry, selectedChapter, selectedCity, verifiedOnly, chamberSlug]
  );

  // Debounced search handler
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCurrentPage(1);
      fetchListings(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, selectedIndustry, selectedChapter, selectedCity, verifiedOnly]);

  // Page change handler
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchListings(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedIndustry('');
    setSelectedChapter('');
    setSelectedCity('');
    setVerifiedOnly(false);
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || selectedIndustry || selectedChapter || selectedCity || verifiedOnly;

  return (
    <div className="bg-background min-h-[calc(100vh-96px)]">
      {/* Header Section */}
      <div className="bg-section-alt border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Member Directory</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Discover and connect with{' '}
                {meta.total > 0 && (
                  <span className="font-semibold text-foreground">{meta.total}</span>
                )}{' '}
                {chamberName ? `${chamberName} ` : ''}member businesses
              </p>
            </div>

            {/* View Switcher */}
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/60 border border-border/50 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 rounded-md transition cursor-pointer',
                  viewMode === 'grid'
                    ? 'bg-card shadow-xs text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label="Grid view"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-2 rounded-md transition cursor-pointer',
                  viewMode === 'list'
                    ? 'bg-card shadow-xs text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label="List view"
              >
                <List size={16} />
              </button>
            </div>
          </div>

          {/* Search & Filters Bar */}
          <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search businesses by name, industry, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-9 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition cursor-pointer text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Industry */}
              <div className="relative">
                <select
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                  className={cn(
                    'h-10 pl-3 pr-8 rounded-lg border border-border bg-card text-sm appearance-none cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-primary/30',
                    selectedIndustry ? 'text-foreground font-medium' : 'text-muted-foreground'
                  )}
                >
                  <option value="">Industry</option>
                  {filters.industries.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
              </div>

              {/* Chapter */}
              {filters.chapters.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedChapter}
                    onChange={(e) => setSelectedChapter(e.target.value)}
                    className={cn(
                      'h-10 pl-3 pr-8 rounded-lg border border-border bg-card text-sm appearance-none cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-primary/30',
                      selectedChapter ? 'text-foreground font-medium' : 'text-muted-foreground'
                    )}
                  >
                    <option value="">Chapter</option>
                    {filters.chapters.map((ch) => (
                      <option key={ch.id} value={ch.id}>{ch.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>
              )}

              {/* City */}
              {filters.cities.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className={cn(
                      'h-10 pl-3 pr-8 rounded-lg border border-border bg-card text-sm appearance-none cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-primary/30',
                      selectedCity ? 'text-foreground font-medium' : 'text-muted-foreground'
                    )}
                  >
                    <option value="">City</option>
                    {filters.cities.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>
              )}

              {/* Verified Only Toggle */}
              <button
                type="button"
                onClick={() => setVerifiedOnly(!verifiedOnly)}
                className={cn(
                  'h-10 px-3 rounded-lg border text-sm font-medium inline-flex items-center gap-1.5 transition cursor-pointer',
                  verifiedOnly
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <ShieldCheck size={14} />
                Verified
              </button>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-10 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border/50 transition cursor-pointer inline-flex items-center gap-1"
                >
                  <X size={12} />
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          /* Skeleton Loader: 6 animated skeleton cards */
          <div className={cn(
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'flex flex-col gap-3'
          )}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className={cn(
                  'rounded-xl border border-border/50 bg-card/50 animate-pulse',
                  viewMode === 'grid' ? 'p-5 h-[220px]' : 'p-4 h-[80px] flex items-center gap-4'
                )}
              >
                {viewMode === 'grid' ? (
                  <>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-12 h-12 rounded-lg bg-muted/80" />
                      <div className="flex-1">
                        <div className="h-4 bg-muted/80 rounded w-3/4 mb-2" />
                        <div className="h-3 bg-muted/60 rounded w-1/2" />
                      </div>
                    </div>
                    <div className="h-3 bg-muted/60 rounded w-full mb-2" />
                    <div className="h-3 bg-muted/60 rounded w-2/3 mb-4" />
                    <div className="mt-auto flex gap-2">
                      <div className="h-3 bg-muted/60 rounded w-16" />
                      <div className="h-3 bg-muted/60 rounded w-16" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-lg bg-muted/80 shrink-0" />
                    <div className="flex-1">
                      <div className="h-4 bg-muted/80 rounded w-1/3 mb-2" />
                      <div className="h-3 bg-muted/60 rounded w-1/2" />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : businesses.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Building2 size={28} className="text-muted-foreground/50" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">No businesses found</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              No businesses match your current search filters. Try adjusting your keywords or clearing filters.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-card hover:bg-muted text-foreground transition cursor-pointer shadow-2xs"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Results count */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-muted-foreground">
                Showing {(meta.page - 1) * meta.limit + 1}–
                {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} businesses
              </p>
            </div>

            {/* Business Cards */}
            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
                  : 'flex flex-col gap-3'
              )}
            >
              {businesses.map((biz) => (
                <BusinessCard key={biz.id} business={biz} viewMode={viewMode} />
              ))}
            </div>

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="p-2 rounded-lg border border-border bg-card text-card-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>

                {/* Page numbers */}
                {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (meta.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= meta.totalPages - 2) {
                    pageNum = meta.totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => handlePageChange(pageNum)}
                      className={cn(
                        'w-9 h-9 rounded-lg text-sm font-medium transition cursor-pointer',
                        pageNum === currentPage
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'border border-border bg-card text-card-foreground hover:bg-muted shadow-2xs'
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
                  className="p-2 rounded-lg border border-border bg-card text-card-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
