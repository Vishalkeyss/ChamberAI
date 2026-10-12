import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquare, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MemberAvatar } from './MemberAvatar';
import { searchMessageContacts, type Conversation, type NetworkMember } from '../services/networking.api';

interface ConversationsListProps {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  activeId: string | null;
  onSelect: (partner: NetworkMember) => void;
  onRetry: () => void;
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'Now';
  if (diffMin < 60) return `${diffMin}m`;
  if (d.toDateString() === new Date().toDateString()) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Prompt 05.2 §5.1 left panel — threads with unread badges. Typing in the search box filters the
 * threads by name/company and also lists other chamber members to start a new conversation
 * (reference UI MemberMessages).
 */
export const ConversationsList: React.FC<ConversationsListProps> = ({ conversations, loading, error, activeId, onSelect, onRetry }) => {
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<NetworkMember[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setMembers([]);
      return;
    }
    const current = ++seq.current;
    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await searchMessageContacts(q);
        if (current === seq.current) setMembers(res);
      } catch {
        if (current === seq.current) setMembers([]);
      } finally {
        if (current === seq.current) setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const q = query.trim().toLowerCase();
  const threads = q
    ? conversations.filter((c) => [c.partner.name, c.partner.companyName].join(' ').toLowerCase().includes(q))
    : conversations;
  const threadIds = new Set(conversations.map((c) => c.partner.id));
  const newContacts = members.filter((m) => !threadIds.has(m.id));

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by member or company…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Conversations</p>
        {loading ? (
          <div className="px-4 py-2 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-destructive">{error}</p>
            <button type="button" onClick={onRetry} className="mt-2 text-xs font-semibold text-primary hover:underline">
              Retry
            </button>
          </div>
        ) : threads.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <MessageSquare size={20} />
            {q ? 'No conversations match your search.' : 'No conversations yet. Search a member above to start chatting.'}
          </div>
        ) : (
          threads.map((c) => {
            const active = c.partner.id === activeId;
            return (
              <button
                key={c.partner.id}
                type="button"
                onClick={() => onSelect(c.partner)}
                className={cn(
                  'w-full text-left px-4 py-3 flex items-center gap-3 border-l-[3px] transition',
                  active ? 'bg-primary/5 border-primary' : 'border-transparent hover:bg-muted/50'
                )}
              >
                <MemberAvatar name={c.partner.name} avatarUrl={c.partner.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{c.partner.name}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{relativeTime(c.lastMessage.createdAt)}</span>
                  </div>
                  {c.partner.companyName && <p className="text-[11px] text-muted-foreground truncate">{c.partner.companyName}</p>}
                  <p className={cn('text-xs truncate mt-0.5', c.unreadCount > 0 ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
                    {c.lastMessage.isSender ? 'You: ' : ''}
                    {c.lastMessage.text}
                  </p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                    {c.unreadCount}
                  </span>
                )}
              </button>
            );
          })
        )}

        {q && (
          <>
            <p className="px-4 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              Members {searching && <Loader2 size={10} className="animate-spin" />}
            </p>
            {!searching && newContacts.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">No other members found.</p>
            ) : (
              newContacts.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setQuery('');
                    onSelect(m);
                  }}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition"
                >
                  <MemberAvatar name={m.name} avatarUrl={m.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                    {m.companyName && <p className="text-xs text-muted-foreground truncate">{m.companyName}</p>}
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary shrink-0">Chat</span>
                </button>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
};
