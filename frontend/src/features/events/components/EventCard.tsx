import React from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Video,
  Building,
  ArrowRight,
  CalendarPlus,
  Share2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { EventItem } from '../services/events.api';

interface EventCardProps {
  event: EventItem;
  timeframe?: 'upcoming' | 'past';
  isMember?: boolean;
  onRegister?: (event: EventItem) => void;
  onViewRecap?: (event: EventItem) => void;
  onAddToCalendar?: (event: EventItem) => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  gala: { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-900/50' },
  networking: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-900/50' },
  workshop: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-900/50' },
  webinar: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-900/50' },
  committee: { bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-900/50' },
};

function formatEventDateTime(dateStr: string, endDateStr?: string | null): { dateBadge: string; timeString: string } {
  try {
    const d = new Date(dateStr.replace(' ', 'T'));
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    const weekday = d.toLocaleString('en-US', { weekday: 'short' });

    let timeString = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (endDateStr) {
      const endD = new Date(endDateStr.replace(' ', 'T'));
      timeString += ` - ${endD.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }

    return {
      dateBadge: `${weekday}, ${month} ${day}`,
      timeString,
    };
  } catch {
    return { dateBadge: dateStr, timeString: '' };
  }
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  timeframe = 'upcoming',
  isMember = false,
  onRegister,
  onViewRecap,
  onAddToCalendar,
}) => {
  const {
    title,
    description,
    category,
    visibility,
    eventDate,
    eventEndDate,
    venue,
    city,
    isVirtual,
    registrationFee,
    nonMemberFee,
    isPaid,
    registeredCount,
    maxCapacity,
    isSoldOut,
    spotsRemaining,
    chapterName,
    coverImageUrl,
  } = event;

  const { dateBadge, timeString } = formatEventDateTime(eventDate, eventEndDate);
  const catStyle = CATEGORY_COLORS[(category || '').toLowerCase()] || {
    bg: 'bg-gray-100 dark:bg-muted',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-200 dark:border-border',
  };

  // Determine pricing label
  let pricingLabel = 'Free';
  if (isPaid || registrationFee > 0) {
    if (isMember) {
      pricingLabel = `$${registrationFee.toFixed(2)}`;
    } else {
      const effectiveFee = nonMemberFee !== null && nonMemberFee !== undefined ? nonMemberFee : registrationFee;
      pricingLabel = effectiveFee > 0 ? `$${effectiveFee.toFixed(2)}` : 'Free';
    }
  }

  // Capacity calculations
  const capacityPercent =
    maxCapacity && maxCapacity > 0
      ? Math.min(100, Math.round((registeredCount / maxCapacity) * 100))
      : null;

  return (
    <Card className="rounded-2xl border border-gray-200/90 dark:border-border/80 bg-white dark:bg-card shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col group">
      {/* Top Banner / Cover Image */}
      <div className="relative h-44 w-full bg-gradient-to-br from-slate-900 to-[#0B1E3B] overflow-hidden">
        {coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-radial from-[#1e3a8a]/30 to-[#0B1E3B] p-6 text-center">
            <Building className="w-12 h-12 text-white/20" />
          </div>
        )}

        {/* Top Badges overlay */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
          <span
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-xs border',
              catStyle.bg,
              catStyle.text,
              catStyle.border
            )}
          >
            {category || 'Event'}
          </span>

          <div className="flex items-center gap-1.5">
            {visibility === 'members_only' && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/90 text-white backdrop-blur-xs shadow-xs">
                Members Only
              </span>
            )}
            {isVirtual === 1 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-600/90 text-white backdrop-blur-xs shadow-xs inline-flex items-center gap-1">
                <Video size={11} /> Virtual
              </span>
            )}
          </div>
        </div>

        {/* Price tag pill on bottom right of cover */}
        <div className="absolute bottom-3 right-3">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/95 dark:bg-slate-900/95 text-gray-900 dark:text-white shadow-md backdrop-blur-xs">
            {pricingLabel}
          </span>
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-5 flex-1 flex flex-col">
        {/* Date & Time Row */}
        <div className="flex items-center gap-3 text-xs font-medium text-gray-600 dark:text-gray-300 mb-2.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
            <Calendar size={13} />
            <span>{dateBadge}</span>
          </span>
          {timeString && (
            <>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} className="text-gray-400" />
                <span>{timeString}</span>
              </span>
            </>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-2">
          {title}
        </h3>

        {/* Venue / Location */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-3">
          <MapPin size={13} className="text-gray-400 shrink-0" />
          <span className="truncate">
            {venue || city || 'Chamber Headquarters'}
            {city && venue && !venue.includes(city) ? `, ${city}` : ''}
          </span>
          {chapterName && (
            <span className="text-[11px] text-muted-foreground ml-auto truncate">
              ({chapterName})
            </span>
          )}
        </div>

        {/* Short description */}
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-4">
            {description}
          </p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Capacity Progress Indicator */}
        {maxCapacity && maxCapacity > 0 && timeframe === 'upcoming' && (
          <div className="mb-4 pt-2 border-t border-gray-100 dark:border-border/60">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-gray-600 dark:text-gray-400 inline-flex items-center gap-1">
                <Users size={11} className="text-gray-400" />
                <span>{registeredCount} / {maxCapacity} registered</span>
              </span>
              <span
                className={cn(
                  'font-semibold',
                  isSoldOut
                    ? 'text-red-600 dark:text-red-400 font-bold'
                    : spotsRemaining !== null && spotsRemaining <= 10
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-gray-500'
                )}
              >
                {isSoldOut ? 'Sold Out' : `${spotsRemaining} spots left`}
              </span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 dark:bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-300 rounded-full',
                  isSoldOut
                    ? 'bg-red-500'
                    : (capacityPercent || 0) > 80
                    ? 'bg-amber-500'
                    : 'bg-[#0B1E3B] dark:bg-primary'
                )}
                style={{ width: `${capacityPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Button Row */}
        <div className="flex items-center gap-2 pt-1">
          {timeframe === 'upcoming' ? (
            <>
              {/* Full events remain registrable as waitlist (Prompt 04.3 §7.2) */}
              <button
                type="button"
                onClick={() => onRegister && onRegister(event)}
                className={cn(
                  'flex-1 text-xs font-semibold py-2.5 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs',
                  isSoldOut
                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'bg-[#0B1E3B] hover:bg-[#102A43] text-white'
                )}
              >
                <span>{isSoldOut ? 'Join Waitlist' : 'Register Now'}</span>
                <ArrowRight size={13} />
              </button>

              <button
                type="button"
                onClick={() => onAddToCalendar && onAddToCalendar(event)}
                className="w-10 h-10 rounded-xl border border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted flex items-center justify-center text-gray-600 dark:text-gray-300 transition cursor-pointer shrink-0"
                title="Add to Calendar"
                aria-label="Add to calendar"
              >
                <CalendarPlus size={15} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onViewRecap && onViewRecap(event)}
              className="flex-1 text-xs font-semibold py-2.5 px-3 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-muted hover:bg-gray-50 text-gray-700 dark:text-gray-200 transition cursor-pointer text-center"
            >
              View Recap & Photos
            </button>
          )}
        </div>
      </div>
    </Card>
  );
};
