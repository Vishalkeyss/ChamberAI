import React from 'react';
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Tag,
  Building,
  Video,
  DollarSign,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EventsFilters } from '../services/events.api';

interface EventsFilterSidebarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  selectedChapter: string;
  onChapterChange: (value: string) => void;
  selectedFormat: string; // 'all' | 'virtual' | 'in_person'
  onFormatChange: (value: string) => void;
  selectedPricing: string; // 'all' | 'free' | 'paid'
  onPricingChange: (value: string) => void;
  selectedCity: string;
  onCityChange: (value: string) => void;
  filters: EventsFilters;
  onClearFilters: () => void;
}

const DEFAULT_CATEGORIES = [
  'Networking',
  'Gala',
  'Workshop',
  'Webinar',
  'Committee',
];

export const EventsFilterSidebar: React.FC<EventsFilterSidebarProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedChapter,
  onChapterChange,
  selectedFormat,
  onFormatChange,
  selectedPricing,
  onPricingChange,
  selectedCity,
  onCityChange,
  filters,
  onClearFilters,
}) => {
  const allCategories = Array.from(
    new Set([
      ...DEFAULT_CATEGORIES,
      ...filters.categories.map((c) => c.charAt(0).toUpperCase() + c.slice(1)),
    ])
  );

  return (
    <div className="bg-white dark:bg-card rounded-2xl border border-gray-200/90 dark:border-border p-5 shadow-xs space-y-6">
      {/* Header with Clear button */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-border/60">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-primary" />
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">
            Filter Events
          </h3>
        </div>
        <button
          type="button"
          onClick={onClearFilters}
          className="text-xs text-muted-foreground hover:text-foreground font-medium transition cursor-pointer"
        >
          Reset All
        </button>
      </div>

      {/* 1. Keyword Search */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
          Search
        </label>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Title, venue, city..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-background text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
          />
        </div>
      </div>

      {/* 2. Category Filter */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Category
        </label>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onCategoryChange('')}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium transition cursor-pointer',
              !selectedCategory
                ? 'bg-[#0B1E3B] text-white shadow-2xs'
                : 'bg-gray-100 dark:bg-muted text-gray-700 dark:text-gray-300 hover:bg-gray-200'
            )}
          >
            All
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat.toLowerCase())}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition cursor-pointer',
                selectedCategory.toLowerCase() === cat.toLowerCase()
                  ? 'bg-[#0B1E3B] text-white shadow-2xs'
                  : 'bg-gray-100 dark:bg-muted text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Event Format (In-person vs Virtual) */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Format
        </label>
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 dark:bg-muted rounded-xl text-xs">
          <button
            type="button"
            onClick={() => onFormatChange('all')}
            className={cn(
              'py-1.5 rounded-lg font-medium transition text-center cursor-pointer',
              selectedFormat === 'all'
                ? 'bg-white dark:bg-card text-gray-900 dark:text-white shadow-xs font-semibold'
                : 'text-gray-600 dark:text-gray-400'
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onFormatChange('in_person')}
            className={cn(
              'py-1.5 rounded-lg font-medium transition text-center cursor-pointer',
              selectedFormat === 'in_person'
                ? 'bg-white dark:bg-card text-gray-900 dark:text-white shadow-xs font-semibold'
                : 'text-gray-600 dark:text-gray-400'
            )}
          >
            In-Person
          </button>
          <button
            type="button"
            onClick={() => onFormatChange('virtual')}
            className={cn(
              'py-1.5 rounded-lg font-medium transition text-center cursor-pointer',
              selectedFormat === 'virtual'
                ? 'bg-white dark:bg-card text-gray-900 dark:text-white shadow-xs font-semibold'
                : 'text-gray-600 dark:text-gray-400'
            )}
          >
            Virtual
          </button>
        </div>
      </div>

      {/* 4. Pricing Filter (Free vs Paid) */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Ticket Pricing
        </label>
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 dark:bg-muted rounded-xl text-xs">
          <button
            type="button"
            onClick={() => onPricingChange('all')}
            className={cn(
              'py-1.5 rounded-lg font-medium transition text-center cursor-pointer',
              selectedPricing === 'all'
                ? 'bg-white dark:bg-card text-gray-900 dark:text-white shadow-xs font-semibold'
                : 'text-gray-600 dark:text-gray-400'
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onPricingChange('free')}
            className={cn(
              'py-1.5 rounded-lg font-medium transition text-center cursor-pointer',
              selectedPricing === 'free'
                ? 'bg-white dark:bg-card text-gray-900 dark:text-white shadow-xs font-semibold'
                : 'text-gray-600 dark:text-gray-400'
            )}
          >
            Free
          </button>
          <button
            type="button"
            onClick={() => onPricingChange('paid')}
            className={cn(
              'py-1.5 rounded-lg font-medium transition text-center cursor-pointer',
              selectedPricing === 'paid'
                ? 'bg-white dark:bg-card text-gray-900 dark:text-white shadow-xs font-semibold'
                : 'text-gray-600 dark:text-gray-400'
            )}
          >
            Paid
          </button>
        </div>
      </div>

      {/* 5. Chapter Filter (if chapters exist) */}
      {filters.chapters.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Chapter
          </label>
          <div className="relative">
            <select
              value={selectedChapter}
              onChange={(e) => onChapterChange(e.target.value)}
              className="w-full h-10 pl-3 pr-8 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-background text-xs font-medium appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Chapters</option>
              {filters.chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      )}

      {/* 6. City Filter */}
      {filters.cities.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            City
          </label>
          <div className="relative">
            <select
              value={selectedCity}
              onChange={(e) => onCityChange(e.target.value)}
              className="w-full h-10 pl-3 pr-8 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-background text-xs font-medium appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Cities</option>
              {filters.cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      )}
    </div>
  );
};
