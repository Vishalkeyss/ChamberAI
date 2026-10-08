import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Building2, CheckCheck, Loader2, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { MemberAvatar } from './MemberAvatar';
import {
  fetchThread,
  notifyMessagesChanged,
  sendMessage,
  type ChatMessage,
  type NetworkMember,
} from '../services/networking.api';

/** OD-056: polling instead of WebSockets — open thread refresh interval. */
const THREAD_POLL_MS = 10_000;
const MAX_LENGTH = 5000;

interface ChatThreadViewProps {
  partnerId: string;
  /** Card already known by the caller (list row / directory); refreshed from the thread response. */
  partner?: NetworkMember | null;
  /** Compact header for the drawer. */
  compact?: boolean;
  onViewBusiness?: (partner: NetworkMember) => void;
  onActivity?: () => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Prompt 05.2 §5.1 right panel — thread header, chat bubbles with read receipts, composer. */
export const ChatThreadView: React.FC<ChatThreadViewProps> = ({ partnerId, partner: initialPartner, compact, onViewBusiness, onActivity }) => {
  const { user } = useAuth();
  const [partner, setPartner] = useState<NetworkMember | null>(initialPartner || null);
  const [items, setItems] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestSeq = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      const seq = ++requestSeq.current;
      if (!silent) setLoading(true);
      try {
        const res = await fetchThread(partnerId);
        if (seq !== requestSeq.current) return;
        setItems(res.messages);
        if (res.partner) setPartner(res.partner);
        setError(null);
        // Opening the thread marks incoming messages read on the server → refresh badges.
        notifyMessagesChanged();
      } catch (err: any) {
        if (seq === requestSeq.current && !silent) setError(err.message || 'Failed to load conversation');
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [partnerId]
  );

  useEffect(() => {
    setPartner(initialPartner || null);
    setItems([]);
    setText('');
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, THREAD_POLL_MS);
    return () => {
      window.clearInterval(timer);
      requestSeq.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId]);

  // §15: auto-scroll to the newest message.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length, loading]);

  // Auto-growing textarea (§5.1 input bar).
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const submit = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await sendMessage(partnerId, body);
      setItems((prev) => [...prev, { id: res.id, senderId: user?.id || '', message: body, isRead: 0, readAt: null, createdAt: res.createdAt }]);
      setText('');
      notifyMessagesChanged();
      onActivity?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter adds a new line.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const displayName = partner?.name || 'Member';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Thread header */}
      <div className={cn('flex items-center gap-3 border-b border-border', compact ? 'px-4 py-3' : 'px-5 py-4')}>
        <MemberAvatar name={displayName} avatarUrl={partner?.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
          {partner?.companyName && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <Building2 size={11} /> {partner.companyName}
            </p>
          )}
        </div>
        {partner?.companyName && onViewBusiness && (
          <button
            type="button"
            onClick={() => onViewBusiness(partner)}
            className="text-xs font-semibold text-primary hover:underline shrink-0"
          >
            View Business Profile
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-muted/20">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={cn('flex', i % 2 ? 'justify-end' : 'justify-start')}>
                <div className="h-9 w-2/5 rounded-2xl bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2">
            <p className="text-sm text-destructive">{error}</p>
            <button type="button" onClick={() => load()} className="text-xs font-semibold text-primary hover:underline">
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2 px-6">
            <MessageSquare className="text-muted-foreground" size={28} />
            <p className="text-sm text-muted-foreground">No messages in this conversation yet. Send a greeting to start networking!</p>
          </div>
        ) : (
          items.map((m) => {
            const mine = m.senderId === user?.id;
            return (
              <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                <div
                  className={cn(
                    'px-3.5 py-2 rounded-2xl text-sm max-w-[85%] sm:max-w-[75%] whitespace-pre-wrap break-words',
                    mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border border-border text-foreground rounded-bl-sm'
                  )}
                >
                  {m.message}
                </div>
                <p className="text-[10px] mt-1 px-1 text-muted-foreground flex items-center gap-1">
                  {formatTime(m.createdAt)}
                  {mine && (
                    <CheckCheck
                      size={13}
                      className={m.isRead ? 'text-blue-500' : 'text-muted-foreground'}
                      aria-label={m.isRead ? 'Read' : 'Sent'}
                    />
                  )}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3 flex items-end gap-2 bg-card">
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          maxLength={MAX_LENGTH}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message…"
          className="flex-1 resize-none rounded-2xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || sending}
          className="h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send
        </button>
      </div>
    </div>
  );
};
