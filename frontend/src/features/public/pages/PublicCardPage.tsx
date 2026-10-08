import React, { useEffect, useState } from 'react';
import { Globe, Loader2, Mail, Phone, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { BusinessCard3D } from '@/features/networking/components/BusinessCard3D';
import { cardShareUrl, downloadCardVCard, fetchPublicCard, type PublicCard } from '@/features/networking/services/networking.api';

interface PublicCardPageProps {
  token: string;
  chamberSlug?: string;
  /** Wait until the app has resolved the chamber from the host before calling the API. */
  ready: boolean;
  isAuthenticated: boolean;
  /** OD-077: members → chamber directory, guests → join page. */
  onConnect: (card: PublicCard) => void;
}

/** Prompt 05.4 §5.2 — mobile-first page opened by scanning a member's QR (`/card/:token`). */
export const PublicCardPage: React.FC<PublicCardPageProps> = ({ token, chamberSlug, ready, isAuthenticated, onConnect }) => {
  const [card, setCard] = useState<PublicCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    // The chamber slug can resolve after first render — start clean on every attempt.
    setError(null);
    setCard(null);
    fetchPublicCard(token, chamberSlug)
      .then((data) => !cancelled && setCard(data))
      .catch((err) => !cancelled && setError(err.message || 'Card not found'));
    return () => {
      cancelled = true;
    };
  }, [token, chamberSlug, ready]);

  const addToContacts = async () => {
    setSaving(true);
    try {
      await downloadCardVCard(token, chamberSlug);
    } catch (err: any) {
      toast.error(err.message || 'Could not download contact');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8 flex flex-col items-center">
      {error ? (
        <div className="mt-20 max-w-sm text-center space-y-2">
          <p className="text-lg font-semibold text-foreground">This business card is not available</p>
          <p className="text-sm text-muted-foreground">The link may be wrong, or the member is no longer active in this chamber.</p>
        </div>
      ) : !card ? (
        <div className="w-full max-w-[520px] space-y-4">
          <div className="aspect-[1.75/1] rounded-2xl bg-muted animate-pulse" />
          <div className="h-12 rounded-xl bg-muted animate-pulse" />
        </div>
      ) : (
        <div className="w-full max-w-[520px] space-y-5">
          <BusinessCard3D card={card} shareUrl={cardShareUrl(token)} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />

          <button
            type="button"
            onClick={addToContacts}
            disabled={saving}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />} Add to Contacts
          </button>

          <div className="grid grid-cols-3 gap-2">
            <a href={`mailto:${card.profile.email}`} className="py-2.5 rounded-xl border border-border bg-card text-xs font-semibold flex flex-col items-center gap-1">
              <Mail size={16} /> Email
            </a>
            {card.profile.phone ? (
              <a href={`tel:${card.profile.phone.replace(/[^\d+]/g, '')}`} className="py-2.5 rounded-xl border border-border bg-card text-xs font-semibold flex flex-col items-center gap-1">
                <Phone size={16} /> Call
              </a>
            ) : (
              <span className="py-2.5 rounded-xl border border-border bg-card text-xs font-semibold flex flex-col items-center gap-1 opacity-40"><Phone size={16} /> Call</span>
            )}
            {card.profile.website ? (
              <a href={card.profile.website} target="_blank" rel="noopener noreferrer" className="py-2.5 rounded-xl border border-border bg-card text-xs font-semibold flex flex-col items-center gap-1">
                <Globe size={16} /> Website
              </a>
            ) : (
              <span className="py-2.5 rounded-xl border border-border bg-card text-xs font-semibold flex flex-col items-center gap-1 opacity-40"><Globe size={16} /> Website</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onConnect(card)}
            className="w-full py-3 rounded-xl border border-border bg-card font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Users size={16} /> {isAuthenticated ? 'Connect via Chamber Directory' : `Join ${card.chamber.name || 'the chamber'} to connect`}
          </button>

          {card.profile.tagline && <p className="text-center text-sm text-muted-foreground">{card.profile.tagline}</p>}
          <p className="text-center text-xs text-muted-foreground">Digital business card · {card.chamber.name}</p>
        </div>
      )}
    </div>
  );
};
