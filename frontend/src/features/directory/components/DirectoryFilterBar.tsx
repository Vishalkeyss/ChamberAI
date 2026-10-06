import React from 'react';
import {
  Search,
  MapPin,
  Star,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DirectoryFilters } from '../services/directory.api';

interface DirectoryFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedIndustry: string;
  onIndustryChange: (value: string) => void;
  selectedPlan: string;
  onPlanChange: (value: string) => void;
  selectedCity: string;
  onCityChange: (value: string) => void;
  filters: DirectoryFilters;
  onClearFilters: () => void;
}

const DEFAULT_INDUSTRIES = [
  'Electricals',
  'General',
  'Logistics',
  'Manufacturing',
  'Textiles',
  'Retail',
  'Automotive',
  'IT Services',
  'Marketing',
  'FMCG',
  'Interior Design',
  'Handicrafts',
  'Food & Beverage',
];

const PLAN_OPTIONS = [
  'Platinum',
  'Gold',
  'Silver',
  'Bronze',
  'Executive',
];

export const DirectoryFilterBar: React.FC<DirectoryFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedIndustry,
  onIndustryChange,
  selectedPlan,
  onPlanChange,
  selectedCity,
  onCityChange,
  filters,
  onClearFilters,
}) => {
  // Merge dynamic industries from DB with standard categories for rich chips
  const allIndustryOptions = Array.from(
    new Set([
      ...filters.industries.filter(Boolean),
      ...DEFAULT_INDUSTRIES,
    ])
  );

  return (
    <div className="bg-white dark:bg-card rounded-2xl border border-gray-200/90 dark:border-border p-5 shadow-2xs">
      {/* Top Controls Row */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search members or businesses..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-background text-sm text-gray-900 dark:text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0B1E3B]/20 focus:border-[#0B1E3B] transition"
          />
        </div>

        {/* Dropdowns & Clear Action */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* All Cities Dropdown */}
          <div className="relative">
            <select
              value={selectedCity}
              onChange={(e) => onCityChange(e.target.value)}
              className={cn(
                'h-11 pl-8 pr-8 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-background text-xs sm:text-sm font-medium appearance-none cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-[#0B1E3B]/20',
                selectedCity ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-600 dark:text-gray-300'
              )}
            >
              <option value="">All Cities</option>
              {Array.from(new Set([...filters.cities, 'Austin', 'Belton', 'Dallas', 'Houston', 'Denver'])).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <MapPin size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
          </div>

          {/* All Plans Dropdown */}
          <div className="relative">
            <select
              value={selectedPlan}
              onChange={(e) => onPlanChange(e.target.value)}
              className={cn(
                'h-11 pl-8 pr-8 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-background text-xs sm:text-sm font-medium appearance-none cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-[#0B1E3B]/20',
                selectedPlan ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-600 dark:text-gray-300'
              )}
            >
              <option value="">All Plans</option>
              {PLAN_OPTIONS.map((plan) => (
                <option key={plan} value={plan}>{plan}</option>
              ))}
            </select>
            <Star size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
          </div>

          {/* Clear Button */}
          <button
            type="button"
            onClick={onClearFilters}
            className="h-11 px-4 rounded-xl border border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <SlidersHorizontal size={14} className="text-gray-500" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Second Row: Industry Pills */}
      <div className="mt-4 pt-1 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-wrap">
        {/* All Industries pill */}
        <button
          type="button"
          onClick={() => onIndustryChange('')}
          className={cn(
            'px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer',
            !selectedIndustry
              ? 'bg-[#0B1E3B] text-white shadow-xs'
              : 'bg-white dark:bg-card border border-gray-200 dark:border-border text-gray-700 dark:text-gray-300 hover:border-gray-300'
          )}
        >
          All Industries
        </button>

        {/* Specific Industry Pills */}
        {allIndustryOptions.map((ind) => {
          const isSelected = selectedIndustry.toLowerCase() === ind.toLowerCase();
          return (
            <button
              key={ind}
              type="button"
              onClick={() => onIndustryChange(isSelected ? '' : ind)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer',
                isSelected
                  ? 'bg-[#0B1E3B] text-white shadow-xs font-semibold'
                  : 'bg-white dark:bg-card border border-gray-200 dark:border-border text-gray-700 dark:text-gray-300 hover:border-gray-300'
              )}
            >
              {ind}
            </button>
          );
        })}
      </div>
    </div>
  );
};
