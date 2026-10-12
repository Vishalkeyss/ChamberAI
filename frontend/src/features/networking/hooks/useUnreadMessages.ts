import { useEffect, useState } from 'react';
import { fetchUnreadCount, MESSAGES_CHANGED_EVENT } from '../services/networking.api';

/** OD-056: badge polling interval. */
const BADGE_POLL_MS = 30_000;

/**
 * Prompt 05.2 §7.3 — unread direct-message count for the topbar / sidebar badge.
 * Polls, and refreshes immediately when a thread is opened or a message is sent.
 * Returns null until loaded (or when the user has no messaging access).
 */
export function useUnreadMessages(enabled: boolean): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setCount(null);
      return;
    }
    let cancelled = false;
    let seq = 0;
    const refresh = async () => {
      const current = ++seq;
      try {
        const n = await fetchUnreadCount();
        if (!cancelled && current === seq) setCount(n);
      } catch {
        if (!cancelled && current === seq) setCount(null);
      }
    };
    refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, BADGE_POLL_MS);
    window.addEventListener(MESSAGES_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(MESSAGES_CHANGED_EVENT, refresh);
    };
  }, [enabled]);

  return count;
}
