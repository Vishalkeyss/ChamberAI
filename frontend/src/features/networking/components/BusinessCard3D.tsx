import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { BadgeCheck, Building2, Globe, Link2, Mail, MapPin, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MemberAvatar } from './MemberAvatar';
import type { CardData } from '../services/networking.api';

/** QR with high error correction so the centre logo watermark never breaks scanning (OD-073). */
export async function renderCardQr(url: string, size = 320): Promise<string> {
  return QRCode.toDataURL(url, { errorCorrectionLevel: 'H', margin: 1, width: size, color: { dark: '#0F172A', light: '#FFFFFF' } });
}

interface BusinessCard3DProps {
  card: CardData;
  shareUrl: string;
  flipped: boolean;
  onFlip?: () => void;
}

const LINE = 'flex items-center gap-2 min-w-0 text-xs text-white/90';

/** Prompt 05.4 §5.1 — front: identity & contact details; back: QR + direct link. Accent = card theme colour. */
export const BusinessCard3D: React.FC<BusinessCard3DProps> = ({ card, shareUrl, flipped, onFlip }) => {
  const [qr, setQr] = useState<string | null>(null);
  const p = card.profile;
  // No theme/brand colour configured → the app's primary colour via CSS variable.
  const accent = card.themeColor || 'var(--primary)';

  useEffect(() => {
    let cancelled = false;
    setQr(null);
    renderCardQr(shareUrl)
      .then((data) => !cancelled && setQr(data))
      .catch(() => !cancelled && setQr(null));
    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  const face = 'absolute inset-0 rounded-2xl overflow-hidden shadow-xl [backface-visibility:hidden]';

  return (
    <div className="w-full max-w-[520px] mx-auto [perspective:1400px]">
      <div
        role="button"
        tabIndex={0}
        aria-label={flipped ? 'Show card front' : 'Show QR code'}
        onClick={onFlip}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onFlip?.()}
        className={cn(
          'relative w-full aspect-[1.75/1] min-h-[260px] transition-transform duration-700 [transform-style:preserve-3d] cursor-pointer',
          flipped && '[transform:rotateY(180deg)]'
        )}
      >
        {/* Front */}
        <div className={cn(face, '[transform:rotateY(0deg)]')} style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 55%, #0F172A))` }}>
          <div className="h-full flex flex-col p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-white/70 truncate">{card.chamber.name}</p>
              {p.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white shrink-0">
                  <BadgeCheck size={12} /> Verified Member
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-3">
              <MemberAvatar name={p.name} avatarUrl={p.avatarUrl} size="lg" className="ring-2 ring-white/40 bg-white/20" />
              <div className="min-w-0">
                <p className="text-white font-bold text-xl leading-tight truncate">{p.name}</p>
                {(p.title || p.company) && (
                  <p className="text-sm text-white/80 truncate">{[p.title, p.company].filter(Boolean).join(' · ')}</p>
                )}
              </div>
              {p.logoUrl && (
                <img src={p.logoUrl} alt={p.company || ''} className="ml-auto w-11 h-11 rounded-lg object-cover bg-white shrink-0" />
              )}
            </div>
            <div className="mt-auto grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 pt-3">
              <p className={LINE}><Mail size={13} className="shrink-0" /><span className="truncate">{p.email}</span></p>
              {p.phone && <p className={LINE}><Phone size={13} className="shrink-0" /><span className="truncate">{p.phone}</span></p>}
              {p.website && <p className={LINE}><Globe size={13} className="shrink-0" /><span className="truncate">{p.website.replace(/^https?:\/\//, '')}</span></p>}
              {p.address && <p className={LINE}><MapPin size={13} className="shrink-0" /><span className="truncate">{p.address}</span></p>}
              {!p.company && <p className={LINE}><Building2 size={13} className="shrink-0" /><span className="truncate">No business linked</span></p>}
            </div>
            {p.socialLinks.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {p.socialLinks.map((s) => (
                  <a
                    key={s.network}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 rounded-full bg-white/15 hover:bg-white/25 px-2 py-0.5 text-[10px] font-semibold text-white capitalize"
                  >
                    <Link2 size={10} /> {s.network}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Back */}
        <div className={cn(face, 'bg-white [transform:rotateY(180deg)] flex flex-col items-center justify-center gap-3 p-5')}>
          <div className="relative w-[58%] max-w-[190px] aspect-square">
            {qr ? (
              <img src={qr} alt="QR code linking to this business card" className="w-full h-full" />
            ) : (
              <div className="w-full h-full rounded-lg bg-slate-100 animate-pulse" />
            )}
            {qr && card.chamber.logoUrl && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <img src={card.chamber.logoUrl} alt="" className="w-[24%] aspect-square object-contain rounded-md bg-white p-1 shadow" />
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-500 text-center break-all max-w-full px-2">{shareUrl}</p>
        </div>
      </div>
    </div>
  );
};
