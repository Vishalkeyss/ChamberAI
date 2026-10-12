import React, { useEffect, useState } from 'react';
import { Download, Eye, Loader2, Palette, Printer, RotateCw, Share2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { BusinessCard3D, renderCardQr } from '../components/BusinessCard3D';
import { cardShareUrl, downloadCardVCard, fetchMyCard, updateCardTheme, type MyCard } from '../services/networking.api';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** QR PNG with the chamber logo in the centre (OD-076). */
async function qrPngWithLogo(url: string, logoUrl: string | null): Promise<string> {
  const size = 800;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(await loadImage(await renderCardQr(url, size)), 0, 0, size, size);
  if (logoUrl) {
    try {
      const logo = await loadImage(logoUrl);
      const box = size * 0.24;
      const x = (size - box) / 2;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, x, box, box);
      const pad = box * 0.1;
      ctx.drawImage(logo, x + pad, x + pad, box - pad * 2, box - pad * 2);
    } catch {
      // Logo unavailable → plain QR is still valid.
    }
  }
  return canvas.toDataURL('image/png');
}

/** Prompt 05.4 §5.1 — member's own digital business card (`/portal/card`). */
export const DigitalCardPage: React.FC = () => {
  const [card, setCard] = useState<MyCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [color, setColor] = useState('');

  const load = async () => {
    setError(null);
    try {
      const data = await fetchMyCard();
      setCard(data);
      setColor(data.themeColor && /^#[0-9a-f]{6}$/i.test(data.themeColor) ? data.themeColor : '');
    } catch (err: any) {
      setError(err.message || 'Failed to load your card');
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button type="button" onClick={load} className="mt-2 text-sm font-semibold text-primary hover:underline">Retry</button>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-64 rounded bg-muted animate-pulse" />
        <div className="w-full max-w-[520px] mx-auto aspect-[1.75/1] rounded-2xl bg-muted animate-pulse" />
      </div>
    );
  }

  const shareUrl = cardShareUrl(card.cardToken);
  const fileBase = card.profile.name.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'card';

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const share = () =>
    run('share', async () => {
      const text = [card.profile.name, card.profile.company].filter(Boolean).join(' · ');
      if (navigator.share) {
        try {
          await navigator.share({ title: `${card.profile.name} — Digital Business Card`, text, url: shareUrl });
          return;
        } catch (err: any) {
          if (err?.name === 'AbortError') return;
        }
      }
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Card link copied');
    });

  const saveQr = () =>
    run('qr', async () => {
      const a = document.createElement('a');
      a.href = await qrPngWithLogo(shareUrl, card.chamber.logoUrl);
      a.download = `${fileBase}-QR.png`;
      a.click();
    });

  const saveVcf = () => run('vcf', () => downloadCardVCard(card.cardToken));

  /** Printable card (browser print → "Save as PDF"), all values HTML-escaped. */
  const print = () =>
    run('print', async () => {
      const qr = await qrPngWithLogo(shareUrl, card.chamber.logoUrl);
      const p = card.profile;
      const rows = [p.email, p.phone, p.website, p.address].filter(Boolean) as string[];
      const accent = card.themeColor && /^#[0-9a-f]{6}$/i.test(card.themeColor) ? card.themeColor : '#334155';
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(p.name)}</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;color:#0f172a}.card{display:flex;gap:24px;align-items:center;border:1px solid #e2e8f0;border-radius:16px;padding:24px;max-width:640px;border-top:8px solid ${accent}}
h1{margin:0;font-size:24px}.sub{color:#475569;margin:4px 0 12px}.row{font-size:13px;margin:3px 0}.chamber{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#64748b}img{width:160px;height:160px}</style></head>
<body><div class="card"><div style="flex:1"><div class="chamber">${escapeHtml(card.chamber.name)}</div><h1>${escapeHtml(p.name)}</h1>
<div class="sub">${escapeHtml([p.title, p.company].filter(Boolean).join(' · '))}</div>${rows.map((r) => `<div class="row">${escapeHtml(r)}</div>`).join('')}</div>
<img src="${qr}" alt="QR"></div><script>window.onload=function(){window.print()}</script></body></html>`;
      const w = window.open('', '_blank');
      if (!w) throw new Error('Allow pop-ups to print your card');
      w.document.open();
      w.document.write(html);
      w.document.close();
    });

  const saveTheme = () =>
    run('theme', async () => {
      if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Pick a valid colour');
      setCard(await updateCardTheme(color));
      toast.success('Card colour updated');
    });

  const btn = 'px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 border border-border bg-card hover:bg-muted disabled:opacity-50';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Digital Business Card</h1>
        <p className="text-sm text-muted-foreground">Share your card anywhere — anyone can scan the QR with a normal phone camera, no app needed.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
        <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Eye size={20} /></div>
          <div>
            <p className="text-xs text-muted-foreground">Card Views</p>
            <p className="text-xl font-bold text-foreground">{card.viewsCount}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Palette size={20} /></div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Card Colour{card.customThemeColor ? '' : ' (chamber brand)'}</p>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={color || '#000000'}
                onChange={(e) => setColor(e.target.value.toUpperCase())}
                aria-label="Card colour"
                className="w-9 h-9 rounded cursor-pointer border border-border bg-transparent"
              />
              <span className="text-xs font-mono text-muted-foreground">{color || '—'}</span>
              <button
                type="button"
                onClick={saveTheme}
                disabled={busy === 'theme' || !color || color === card.themeColor}
                className="ml-auto px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40"
              >
                {busy === 'theme' ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {!card.publicCardAvailable && (
        <div className="max-w-3xl mx-auto rounded-xl border border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200 p-4 text-sm">
          Your account is not linked to an active business profile, so your public card link and vCard are not available yet.
        </div>
      )}

      <BusinessCard3D card={card} shareUrl={shareUrl} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
      <p className="text-center text-xs text-muted-foreground -mt-3">Tap the card to flip it</p>

      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className={btn} onClick={() => setFlipped((f) => !f)}><RotateCw size={15} /> Flip Card</button>
        <button type="button" className={btn} onClick={saveVcf} disabled={!card.publicCardAvailable || busy === 'vcf'}>
          {busy === 'vcf' ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Save to Phone (.vcf)
        </button>
        <button type="button" className={btn} onClick={share} disabled={!card.publicCardAvailable || busy === 'share'}><Share2 size={15} /> Share Card</button>
        <button type="button" className={btn} onClick={saveQr} disabled={busy === 'qr'}>
          {busy === 'qr' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Save QR Image
        </button>
        <button type="button" className={btn} onClick={print} disabled={busy === 'print'}><Printer size={15} /> Print / PDF</button>
      </div>
    </div>
  );
};
