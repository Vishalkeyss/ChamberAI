import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { MemberAvatar } from '@/features/networking/components/MemberAvatar';
import { requestMentorship, type Mentor } from '../services/mentorship.api';

interface MentorshipRequestModalProps {
  mentor: Mentor | null;
  onClose: () => void;
  onSent: () => void;
}

const MIN = 20;
const MAX = 2000;

/** §5.2 Mentorship Request Modal — message with goals + expected frequency (OD-094: message only). */
export const MentorshipRequestModal: React.FC<MentorshipRequestModalProps> = ({ mentor, onClose, onSent }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (mentor) setMessage('');
  }, [mentor]);

  const length = message.trim().length;

  const submit = async () => {
    if (!mentor) return;
    if (length < MIN) return toast.error(`Please provide a message of at least ${MIN} characters`);
    setSending(true);
    try {
      await requestMentorship(mentor.user_id, message.trim());
      toast.success(`Mentorship request sent to ${mentor.name}`);
      onSent();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send request');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={!!mentor} onOpenChange={(open) => !open && !sending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Request Mentorship</DialogTitle>
        <DialogDescription>Tell the mentor what you would like help with.</DialogDescription>
        {mentor && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
              <MemberAvatar name={mentor.name} avatarUrl={mentor.avatar_url} />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{mentor.name}</p>
                <p className="text-xs text-muted-foreground truncate">{mentor.business_name || mentor.expertise_areas.join(', ')}</p>
              </div>
            </div>
            <div>
              <label htmlFor="mentorship-message" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Your goals and expectations *
              </label>
              <textarea
                id="mentorship-message"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
                rows={5}
                placeholder={`Share what you're working on, what you'd like guidance with, and how often you'd like to meet (e.g. bi-weekly for 3 months).`}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary resize-none"
              />
              <p className={`text-[11px] mt-1 ${length > 0 && length < MIN ? 'text-red-600' : 'text-muted-foreground'}`}>
                {length < MIN ? `At least ${MIN} characters (${length}/${MIN})` : `${length}/${MAX}`}
              </p>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={sending || length < MIN}
              className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {sending && <Loader2 size={14} className="animate-spin" />} Send Request
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
