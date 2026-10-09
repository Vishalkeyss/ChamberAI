import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { MemberAvatar } from '@/features/networking/components/MemberAvatar';
import { STATUS_LABELS, formatDate, reviewMentorship, type MentorshipConnection } from '../services/mentorship.api';

interface RequestCardProps {
  connection: MentorshipConnection;
  onChanged: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10',
  declined: 'bg-red-50 text-red-700 dark:bg-red-500/10',
  cancelled: 'bg-muted text-muted-foreground',
};

/** §5 Tab 3 — incoming (Accept / Decline) or outgoing (Withdraw) request. */
export const RequestCard: React.FC<RequestCardProps> = ({ connection: c, onChanged }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState('');
  const incoming = c.role === 'mentor';
  const name = c.partner?.name || (incoming ? c.mentee_name : c.mentor_name) || 'Member';

  const act = async (action: 'accept' | 'decline' | 'cancel') => {
    setBusy(action);
    try {
      await reviewMentorship(c.id, action, action === 'decline' ? { decline_reason: reason.trim() || null } : {});
      toast.success(action === 'accept' ? `You are now mentoring ${name}` : action === 'decline' ? 'Request declined' : 'Request withdrawn');
      setDeclineOpen(false);
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update request');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <MemberAvatar name={name} avatarUrl={c.partner?.avatarUrl} />
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {incoming ? 'Wants you as a mentor' : 'You asked for mentorship'}
              {c.partner?.companyName ? ` · ${c.partner.companyName}` : ''}
            </p>
          </div>
        </div>
        <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold', STATUS_STYLES[c.status] || 'bg-muted text-muted-foreground')}>
          {STATUS_LABELS[c.status]}
        </span>
      </div>
      {c.request_message && <p className="text-xs mt-3 p-2.5 rounded-lg bg-muted/40 text-muted-foreground whitespace-pre-wrap">“{c.request_message}”</p>}
      {c.status === 'declined' && c.decline_reason && <p className="text-xs mt-2 text-red-700 dark:text-red-400">Reason: {c.decline_reason}</p>}
      <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
        <span className="text-[11px] text-muted-foreground">Requested {formatDate(c.created_at)}</span>
        {c.status === 'pending' && (
          <div className="flex gap-2">
            {incoming ? (
              <>
                <button type="button" onClick={() => { setReason(''); setDeclineOpen(true); }} disabled={!!busy} className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted disabled:opacity-50">
                  Decline
                </button>
                <button type="button" onClick={() => act('accept')} disabled={!!busy} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
                  {busy === 'accept' && <Loader2 size={12} className="animate-spin" />} Accept
                </button>
              </>
            ) : (
              <button type="button" onClick={() => act('cancel')} disabled={!!busy} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted flex items-center gap-1.5 disabled:opacity-50">
                {busy === 'cancel' && <Loader2 size={12} className="animate-spin" />} Withdraw
              </button>
            )}
          </div>
        )}
      </div>

      <Dialog open={declineOpen} onOpenChange={(o) => !o && !busy && setDeclineOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>Decline request</DialogTitle>
          <DialogDescription>{name} will be notified. Adding a reason is optional.</DialogDescription>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="e.g. My schedule is full this quarter"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary resize-none"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDeclineOpen(false)} disabled={!!busy} className="px-4 py-2 rounded-lg text-sm font-semibold hover:bg-muted">Back</button>
            <button type="button" onClick={() => act('decline')} disabled={!!busy} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white flex items-center gap-1.5 disabled:opacity-50">
              {busy === 'decline' && <Loader2 size={14} className="animate-spin" />} Decline
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
