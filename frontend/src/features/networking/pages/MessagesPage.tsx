import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationsList } from '../components/ConversationsList';
import { ChatThreadView } from '../components/ChatThreadView';
import { fetchConversations, MESSAGES_CHANGED_EVENT, type Conversation, type NetworkMember } from '../services/networking.api';

/** OD-056: conversation list refresh interval (polling). */
const LIST_POLL_MS = 15_000;

interface MessagesPageProps {
  onViewBusiness?: (partner: NetworkMember) => void;
}

function initialPartnerId(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('with');
}

/** Prompt 05.2 §5.1 — split-pane messaging inbox (`/portal/messages`, `?with=<userId>` opens a thread). */
export const MessagesPage: React.FC<MessagesPageProps> = ({ onViewBusiness }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<{ id: string; partner: NetworkMember | null } | null>(() => {
    const id = initialPartnerId();
    return id ? { id, partner: null } : null;
  });
  const seq = useRef(0);

  const load = useCallback(async (silent = false) => {
    const current = ++seq.current;
    if (!silent) setLoading(true);
    try {
      const data = await fetchConversations();
      if (current !== seq.current) return;
      setConversations(data);
      setError(null);
    } catch (err: any) {
      if (current === seq.current && !silent) setError(err.message || 'Failed to load conversations');
    } finally {
      if (current === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, LIST_POLL_MS);
    const onChanged = () => load(true);
    window.addEventListener(MESSAGES_CHANGED_EVENT, onChanged);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(MESSAGES_CHANGED_EVENT, onChanged);
    };
  }, [load]);

  const select = (partner: NetworkMember) => {
    setActive({ id: partner.id, partner });
    const url = new URL(window.location.href);
    url.searchParams.set('with', partner.id);
    window.history.replaceState({}, '', url.toString());
  };

  const back = () => {
    setActive(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('with');
    window.history.replaceState({}, '', url.toString());
  };

  const activePartner = active ? active.partner || conversations.find((c) => c.partner.id === active.id)?.partner || null : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        <p className="text-sm text-muted-foreground">Direct conversations with fellow chamber members</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 rounded-xl border border-border bg-card overflow-hidden h-[calc(100vh-220px)] min-h-[480px]">
        <div className={cn('border-r border-border min-h-0', active ? 'hidden md:flex md:flex-col' : 'flex flex-col')}>
          <ConversationsList
            conversations={conversations}
            loading={loading}
            error={error}
            activeId={active?.id || null}
            onSelect={select}
            onRetry={() => load()}
          />
        </div>
        <div className={cn('md:col-span-2 min-h-0', active ? 'flex flex-col' : 'hidden md:flex md:flex-col')}>
          {active ? (
            <>
              <button
                type="button"
                onClick={back}
                className="md:hidden flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-primary border-b border-border"
              >
                <ArrowLeft size={14} /> All conversations
              </button>
              <div className="flex-1 min-h-0">
                <ChatThreadView
                  key={active.id}
                  partnerId={active.id}
                  partner={activePartner}
                  onViewBusiness={onViewBusiness}
                  onActivity={() => load(true)}
                />
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2 px-6 text-muted-foreground">
              <MessageSquare size={32} />
              <p className="text-sm font-semibold text-foreground">No conversation selected</p>
              <p className="text-xs">Pick a conversation, or search a member on the left to start chatting.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
