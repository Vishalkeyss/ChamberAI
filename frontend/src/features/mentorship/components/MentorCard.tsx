import React from 'react';
import { CheckCircle2, Clock, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MemberAvatar } from '@/features/networking/components/MemberAvatar';
import type { Mentor } from '../services/mentorship.api';

interface MentorCardProps {
  mentor: Mentor;
  onRequest: (mentor: Mentor) => void;
}

/** §5 Tab 1 mentor card (reference UI `MemberMentorship`). */
export const MentorCard: React.FC<MentorCardProps> = ({ mentor: m, onRequest }) => {
  const filledPct = m.max_mentees > 0 ? Math.min(100, (m.active_mentees_count / m.max_mentees) * 100) : 100;
  const full = !m.is_available;
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <MemberAvatar name={m.name} avatarUrl={m.avatar_url} />
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{m.name}</p>
            <p className="text-xs text-muted-foreground truncate">{m.business_name || m.industry || 'Chamber member'}</p>
          </div>
        </div>
        {m.rating !== null && (
          <div className="flex items-center gap-1 text-xs font-semibold text-amber-600 shrink-0" title={`${m.rating_count} rating${m.rating_count === 1 ? '' : 's'}`}>
            <Star size={13} className="fill-amber-500 text-amber-500" /> {m.rating.toFixed(1)}
          </div>
        )}
      </div>

      {m.bio && <p className="text-xs mt-3 leading-relaxed text-muted-foreground line-clamp-3">{m.bio}</p>}

      <div className="flex flex-wrap gap-1.5 mt-3">
        {m.expertise_areas.map((e) => (
          <span key={e} className="px-2 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">{e}</span>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs mt-4 pt-3 border-t border-border text-muted-foreground">
        <span>{m.years_of_experience} yrs experience</span>
        <span className={cn('font-semibold', full ? 'text-red-600' : 'text-emerald-600')}>{full ? 'No capacity' : 'Capacity available'}</span>
      </div>

      <div className="mt-2 mb-3">
        <div className="flex items-center justify-between text-[11px] mb-1 text-muted-foreground">
          <span>Mentee slots</span>
          <span>{m.active_mentees_count}/{m.max_mentees} filled</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden bg-muted">
          <div className={cn('h-full rounded-full', full ? 'bg-red-500' : 'bg-emerald-500')} style={{ width: `${filledPct}%` }} />
        </div>
      </div>

      {m.my_request ? (
        <div
          className={cn(
            'mt-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold',
            m.my_request.status === 'pending' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10'
          )}
        >
          {m.my_request.status === 'pending' ? <Clock size={13} /> : <CheckCircle2 size={13} />}
          {m.my_request.status === 'pending' ? 'Request pending' : 'Mentorship active'}
        </div>
      ) : (
        <button
          type="button"
          disabled={full}
          onClick={() => onRequest(m)}
          className={cn(
            'mt-auto w-full px-3 py-2 rounded-lg text-sm font-semibold',
            full ? 'border border-border text-muted-foreground opacity-60 cursor-not-allowed' : 'bg-primary text-primary-foreground hover:opacity-90'
          )}
        >
          {full ? 'Fully booked' : 'Request Mentorship'}
        </button>
      )}
    </div>
  );
};

export const MentorCardSkeleton: React.FC = () => (
  <div className="rounded-xl border border-border bg-card p-5 space-y-3 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-muted" />
      <div className="space-y-1.5 flex-1">
        <div className="h-3 w-1/2 rounded bg-muted" />
        <div className="h-2.5 w-1/3 rounded bg-muted" />
      </div>
    </div>
    <div className="h-2.5 w-full rounded bg-muted" />
    <div className="flex gap-1.5">
      <div className="h-5 w-16 rounded-full bg-muted" />
      <div className="h-5 w-20 rounded-full bg-muted" />
    </div>
    <div className="h-8 w-full rounded-lg bg-muted" />
  </div>
);
