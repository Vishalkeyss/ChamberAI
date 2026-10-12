import React, { useEffect, useMemo, useState } from 'react';
import { Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveAssetUrl } from '@/features/member/services/business-profile.api';
import { fetchSponsorshipTiers, type ConfirmedSponsor } from '../services/events.api';

interface EventSponsorsSectionProps {
  eventId: string;
  chamberSlug?: string;
  /** Re-fetch when this changes (e.g. after a booking). */
  refreshKey?: number;
}

/** Logo size by tier rank (§5.2: top tier large, then medium, then small). */
const SIZE_BY_RANK = ['h-20 max-w-[240px]', 'h-14 max-w-[180px]', 'h-10 max-w-[130px]'];

/**
 * Prompt 04.4 §5.2 — public sponsor wall. Only confirmed (paid) sponsors are returned by the API.
 * Renders nothing when an event has no confirmed sponsors.
 */
export const EventSponsorsSection: React.FC<EventSponsorsSectionProps> = ({ eventId, chamberSlug, refreshKey }) => {
  const [sponsors, setSponsors] = useState<ConfirmedSponsor[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchSponsorshipTiers(eventId, chamberSlug)
      .then((d) => !cancelled && setSponsors(d.confirmedSponsors))
      .catch(() => !cancelled && setSponsors([]));
    return () => {
      cancelled = true;
    };
  }, [eventId, chamberSlug, refreshKey]);

  const groups = useMemo(() => {
    const byTier = new Map<string, { name: string; order: number; items: ConfirmedSponsor[] }>();
    for (const s of sponsors) {
      const key = s.tierId || '';
      const g = byTier.get(key) || { name: s.tierName || 'Sponsors', order: s.tierSortOrder ?? Number.MAX_SAFE_INTEGER, items: [] };
      g.items.push(s);
      byTier.set(key, g);
    }
    return [...byTier.values()].sort((a, b) => a.order - b.order);
  }, [sponsors]);

  if (!groups.length) return null;

  return (
    <section className="pt-4 border-t border-border">
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Event Sponsors</h4>
      <div className="space-y-4">
        {groups.map((g, rank) => {
          const size = SIZE_BY_RANK[Math.min(rank, SIZE_BY_RANK.length - 1)];
          return (
            <div key={g.name + rank}>
              <p className="text-[11px] font-semibold text-muted-foreground mb-2">{g.name}</p>
              <div className="flex flex-wrap items-center gap-4">
                {g.items.map((s) => {
                  const logo = resolveAssetUrl(s.logoUrl);
                  const content = logo ? (
                    <img src={logo} alt={s.businessName} title={s.businessName} className={cn('object-contain', size)} />
                  ) : (
                    <span className={cn('inline-flex items-center gap-2 px-3 rounded-lg bg-muted text-sm font-semibold', size)}>
                      <Building size={14} className="text-muted-foreground" />
                      {s.businessName}
                    </span>
                  );
                  return s.website && /^https?:\/\//i.test(s.website) ? (
                    <a key={s.businessName} href={s.website} target="_blank" rel="noopener noreferrer nofollow">
                      {content}
                    </a>
                  ) : (
                    <span key={s.businessName}>{content}</span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
