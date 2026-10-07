import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EventItem } from '../services/events.api';

interface EventsCalendarGridProps {
  events: EventItem[];
  onSelectEvent?: (event: EventItem) => void;
}

const CATEGORY_DOT_COLORS: Record<string, string> = {
  gala: 'bg-purple-500',
  networking: 'bg-blue-500',
  workshop: 'bg-emerald-500',
  webinar: 'bg-amber-500',
  committee: 'bg-indigo-500',
};

export const EventsCalendarGrid: React.FC<EventsCalendarGridProps> = ({
  events,
  onSelectEvent,
}) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDayEvents, setSelectedDayEvents] = useState<EventItem[] | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // First day of current month (0: Sunday, 1: Monday, ...)
  const firstDayIndex = new Date(year, month, 1).getDay();
  // Total days in month
  const totalDays = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDayEvents(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDayEvents(null);
  };

  // Group events by day of current month
  const eventsByDay = React.useMemo(() => {
    const map = new Map<number, EventItem[]>();
    for (const evt of events) {
      try {
        const d = new Date(evt.eventDate.replace(' ', 'T'));
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate();
          const list = map.get(day) || [];
          list.push(evt);
          map.set(day, list);
        }
      } catch {}
    }
    return map;
  }, [events, year, month]);

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white dark:bg-card rounded-2xl border border-gray-200/90 dark:border-border p-6 shadow-xs">
      {/* Calendar Header Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <CalendarIcon className="text-primary w-5 h-5" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {monthName}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="p-2 rounded-xl border border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted text-gray-700 dark:text-gray-300 transition cursor-pointer"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setCurrentDate(new Date());
              setSelectedDayEvents(null);
            }}
            className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted text-xs font-semibold text-gray-700 dark:text-gray-300 transition cursor-pointer"
          >
            Today
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-2 rounded-xl border border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted text-gray-700 dark:text-gray-300 transition cursor-pointer"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-2 mb-2 text-center">
        {daysOfWeek.map((day) => (
          <div
            key={day}
            className="text-xs font-semibold uppercase tracking-wider text-gray-400 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Month Days Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Empty slots before first day */}
        {Array.from({ length: firstDayIndex }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="min-h-[90px] rounded-xl bg-gray-50/50 dark:bg-muted/20 border border-transparent"
          />
        ))}

        {/* Days of month */}
        {Array.from({ length: totalDays }).map((_, i) => {
          const dayNum = i + 1;
          const dayEvents = eventsByDay.get(dayNum) || [];
          const isToday =
            new Date().getDate() === dayNum &&
            new Date().getMonth() === month &&
            new Date().getFullYear() === year;

          return (
            <div
              key={`day-${dayNum}`}
              onClick={() => {
                if (dayEvents.length > 0) {
                  setSelectedDayEvents(dayEvents);
                }
              }}
              className={cn(
                'min-h-[90px] p-2 rounded-xl border transition-all flex flex-col',
                dayEvents.length > 0
                  ? 'cursor-pointer hover:border-primary hover:shadow-xs'
                  : 'hover:bg-gray-50/60 dark:hover:bg-muted/40',
                isToday
                  ? 'border-primary/60 bg-primary/5 dark:bg-primary/10'
                  : 'border-gray-200/80 dark:border-border/60 bg-white dark:bg-card'
              )}
            >
              {/* Day Number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    'text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center',
                    isToday
                      ? 'bg-primary text-primary-foreground'
                      : 'text-gray-700 dark:text-gray-300'
                  )}
                >
                  {dayNum}
                </span>

                {dayEvents.length > 0 && (
                  <span className="text-[10px] font-bold text-primary">
                    {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                  </span>
                )}
              </div>

              {/* Event Chips in Cell */}
              <div className="space-y-1 mt-auto overflow-hidden">
                {dayEvents.slice(0, 2).map((e) => {
                  const dotColor =
                    CATEGORY_DOT_COLORS[(e.category || '').toLowerCase()] || 'bg-gray-400';
                  return (
                    <div
                      key={e.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onSelectEvent && onSelectEvent(e);
                      }}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium truncate bg-gray-100 dark:bg-muted text-gray-800 dark:text-gray-200 hover:bg-primary/10 hover:text-primary transition flex items-center gap-1 cursor-pointer"
                      title={e.title}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />
                      <span className="truncate">{e.title}</span>
                    </div>
                  );
                })}

                {dayEvents.length > 2 && (
                  <p className="text-[10px] text-gray-400 font-medium pl-1">
                    +{dayEvents.length - 2} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Day Events Preview Modal/Drawer */}
      {selectedDayEvents && (
        <div className="mt-6 pt-5 border-t border-gray-100 dark:border-border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
              Events on this day ({selectedDayEvents.length})
            </h4>
            <button
              type="button"
              onClick={() => setSelectedDayEvents(null)}
              className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {selectedDayEvents.map((evt) => (
              <div
                key={evt.id}
                onClick={() => onSelectEvent && onSelectEvent(evt)}
                className="p-3.5 rounded-xl border border-gray-200 dark:border-border bg-gray-50/50 dark:bg-muted/30 hover:border-primary transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-xs text-primary font-semibold mb-1">
                  <Clock size={12} />
                  <span>
                    {new Date(evt.eventDate.replace(' ', 'T')).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <h5 className="font-bold text-xs text-gray-900 dark:text-white line-clamp-1">
                  {evt.title}
                </h5>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  {evt.venue || evt.city || 'Chamber Event'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
