import React, { useState } from 'react';
import { Award, CheckCircle2, Loader2, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { submitEventFeedback, type EventItem } from '../services/events.api';

interface EventFeedbackModalProps {
  event: EventItem;
  chamberSlug?: string;
  /** Points credited for a review — supplied by the API (GET /events/:id/attendance). */
  rewardPoints: number;
  onClose: () => void;
  onSubmitted: () => void;
  onOpenCertificate: () => void;
}

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Exceptional'];

/**
 * Prompt 04.5 §5.1 — post-event review. OD-035: "would attend again" replaces the NPS scale
 * (canonical schema has `would_attend_again`, matching the reference UI).
 */
export const EventFeedbackModal: React.FC<EventFeedbackModalProps> = ({
  event,
  chamberSlug,
  rewardPoints,
  onClose,
  onSubmitted,
  onOpenCertificate,
}) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [again, setAgain] = useState(true);
  const [likedMost, setLikedMost] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const shown = hover || rating;

  const submit = async () => {
    if (!rating) return;
    setSubmitting(true);
    try {
      const res = await submitEventFeedback(
        event.id,
        {
          starRating: rating,
          wouldAttendAgain: again,
          likedMost: likedMost.trim() || undefined,
          suggestions: suggestions.trim() || undefined,
        },
        chamberSlug
      );
      setDone(res.message);
      onSubmitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const dateLabel = (() => {
    const d = new Date(event.eventDate.replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? event.eventDate : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-card rounded-2xl border border-border shadow-2xl p-6">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer">
          <X size={16} />
        </button>

        <div className="mb-4 pr-8">
          <h3 className="text-base font-bold text-foreground">{event.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{dateLabel}</p>
        </div>

        {done ? (
          <div className="text-center py-4 animate-in zoom-in-95 duration-300">
            <CheckCircle2 className="mx-auto text-emerald-600" size={44} />
            <p className="text-sm font-semibold mt-3">{done}</p>
            <button
              type="button"
              onClick={onOpenCertificate}
              className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B1E3B] text-white text-xs font-semibold cursor-pointer"
            >
              <Award size={14} /> View Attendance Certificate
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-xs font-semibold text-muted-foreground mb-2">How was your experience?</p>
              <div className="flex justify-center gap-1.5" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHover(n)}
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    className="transition-transform hover:scale-110 cursor-pointer"
                  >
                    <Star size={30} strokeWidth={1.5} className={n <= shown ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
                  </button>
                ))}
              </div>
              <p className={cn('text-xs font-semibold mt-1.5 h-4', shown ? 'text-amber-500' : 'text-muted-foreground')}>
                {shown ? RATING_LABELS[shown] : 'Tap a star to rate'}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Would you attend a similar event again?</p>
              <div className="flex gap-2">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setAgain(v)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer',
                      again === v ? 'bg-[#0B1E3B] text-white' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {v ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">What was the most valuable part of the event?</span>
              <textarea
                value={likedMost}
                onChange={(e) => setLikedMost(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Optional"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">What can we improve for next time?</span>
              <textarea
                value={suggestions}
                onChange={(e) => setSuggestions(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Optional"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>

            <button
              type="button"
              disabled={!rating || submitting}
              onClick={submit}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B1E3B] hover:bg-[#102A43] text-white text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {rewardPoints > 0 ? `Submit Review & Claim ${rewardPoints} Loyalty Points` : 'Submit Review'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
