import React, { useEffect, useState } from 'react';
import { Loader2, MessageCircle, Star, Video } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { MemberAvatar } from '@/features/networking/components/MemberAvatar';
import { STATUS_LABELS, formatDate, reviewMentorship, saveMentorshipNotes, type MentorshipConnection } from '../services/mentorship.api';

interface ActiveConnectionCardProps {
  connection: MentorshipConnection;
  onChanged: () => void;
  onMessage: (connection: MentorshipConnection) => void;
}

/** §5 Tab 2 — active (and past) mentorship card: notes, Message, Schedule 1:1, End Mentorship. */
export const ActiveConnectionCard: React.FC<ActiveConnectionCardProps> = ({ connection: c, onChanged, onMessage }) => {
  const active = c.status === 'accepted';
  const [notes, setNotes] = useState(c.notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [ending, setEnding] = useState(false);
  const name = c.partner?.name || (c.role === 'mentor' ? c.mentee_name : c.mentor_name) || 'Member';

  useEffect(() => setNotes(c.notes || ''), [c.notes]);

  const dirty = (notes.trim() || null) !== (c.notes?.trim() || null);

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await saveMentorshipNotes(c.id, notes.trim() ? notes : null);
      toast.success('Session notes saved');
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const end = async () => {
    setEnding(true);
    try {
      await reviewMentorship(c.id, 'complete', c.role === 'mentee' && rating ? { rating } : {});
      toast.success('Mentorship marked as completed');
      setEndOpen(false);
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to end mentorship');
    } finally {
      setEnding(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <MemberAvatar name={name} avatarUrl={c.partner?.avatarUrl} />
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {c.role === 'mentor' ? 'Your mentee' : 'Your mentor'}
              {c.partner?.companyName ? ` · ${c.partner.companyName}` : ''}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'px-2.5 py-1 rounded-full text-[11px] font-semibold',
            active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10' : 'bg-muted text-muted-foreground'
          )}
        >
          {STATUS_LABELS[c.status]}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>Started {formatDate(c.start_date)}</span>
        {c.end_date && <span>Ended {formatDate(c.end_date)}</span>}
      </div>

      {c.request_message && <p className="text-xs p-2.5 rounded-lg bg-muted/40 text-muted-foreground">“{c.request_message}”</p>}

      {active ? (
        <div>
          <label htmlFor={`notes-${c.id}`} className="text-xs font-medium text-muted-foreground mb-1 block">Session notes (shared with {name})</label>
          <textarea
            id={`notes-${c.id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 5000))}
            rows={3}
            placeholder="Goals, agreed actions, next session topics…"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary resize-y"
          />
          {dirty && (
            <div className="flex justify-end gap-2 mt-1.5">
              <button type="button" onClick={() => setNotes(c.notes || '')} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted">Discard</button>
              <button type="button" onClick={saveNotes} disabled={savingNotes} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground flex items-center gap-1.5 disabled:opacity-50">
                {savingNotes && <Loader2 size={12} className="animate-spin" />} Save notes
              </button>
            </div>
          )}
        </div>
      ) : (
        c.notes && <p className="text-xs whitespace-pre-wrap text-muted-foreground"><span className="font-semibold">Notes: </span>{c.notes}</p>
      )}

      {active && (
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" onClick={() => onMessage(c)} className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold flex items-center gap-1.5 hover:bg-muted">
            <MessageCircle size={13} /> Message
          </button>
          {/* OD-097: 1:1 Meetings (05.1) is on hold. */}
          <button type="button" disabled title="1:1 meeting scheduling is coming soon" className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold flex items-center gap-1.5 opacity-50 cursor-not-allowed">
            <Video size={13} /> Schedule 1:1 · soon
          </button>
          <button type="button" onClick={() => { setRating(0); setEndOpen(true); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10">
            End Mentorship
          </button>
        </div>
      )}

      <Dialog open={endOpen} onOpenChange={(o) => !o && !ending && setEndOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>End mentorship?</DialogTitle>
          <DialogDescription>This marks your mentorship with {name} as completed and frees a mentee slot.</DialogDescription>
          {c.role === 'mentee' && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Rate your mentor (optional)</p>
              <div className="flex gap-1" role="radiogroup" aria-label="Mentor rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n === rating ? 0 : n)}>
                    <Star size={22} className={n <= rating ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setEndOpen(false)} disabled={ending} className="px-4 py-2 rounded-lg text-sm font-semibold hover:bg-muted">Keep going</button>
            <button type="button" onClick={end} disabled={ending} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white flex items-center gap-1.5 disabled:opacity-50">
              {ending && <Loader2 size={14} className="animate-spin" />} End Mentorship
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
