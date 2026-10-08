import React, { useEffect, useState } from 'react';
import { Building, CheckCircle2, CreditCard, FileText, Globe, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fetchBusinessProfile, resolveAssetUrl, type BusinessProfileData } from '@/features/member/services/business-profile.api';
import {
  bookSponsorship,
  fetchSponsorshipTiers,
  formatMoney,
  type BookSponsorshipResult,
  type EventItem,
  type SponsorshipTiersResponse,
} from '../services/events.api';

interface EventSponsorshipModalProps {
  event: EventItem;
  chamberSlug?: string;
  onClose: () => void;
  onBooked?: (result: BookSponsorshipResult) => void;
}

/**
 * Prompt 04.4 §5.1 — Member self-service sponsorship booking.
 * Packages, prices and spots all come from the API; the server enforces capacity and payment.
 */
export const EventSponsorshipModal: React.FC<EventSponsorshipModalProps> = ({ event, chamberSlug, onClose, onBooked }) => {
  const [data, setData] = useState<SponsorshipTiersResponse | null>(null);
  const [business, setBusiness] = useState<BusinessProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tierId, setTierId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'invoice' | 'card'>('invoice');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookSponsorshipResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchSponsorshipTiers(event.id, chamberSlug), fetchBusinessProfile().catch(() => null)])
      .then(([tiers, biz]) => {
        if (cancelled) return;
        setData(tiers);
        setBusiness(biz);
        const first = tiers.tiers.find((t) => !t.isSoldOut);
        setTierId(first?.id || '');
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Failed to load packages'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [event.id, chamberSlug]);

  const currency = data?.currency ?? null;
  const tier = data?.tiers.find((t) => t.id === tierId) || null;
  const logo = resolveAssetUrl(business?.logoUrl);

  const submit = async () => {
    if (!tier || !business) return;
    setSubmitting(true);
    try {
      const res = await bookSponsorship(event.id, { tierId: tier.id, businessId: business.id, paymentMethod }, chamberSlug);
      setResult(res);
      onBooked?.(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to book sponsorship');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-card rounded-2xl border border-border shadow-2xl">
        {/* §15: loading overlay while the booking is processed */}
        {submitting && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-card/80 rounded-2xl">
            <Loader2 className="animate-spin text-primary" size={24} />
            <p className="text-xs font-medium text-muted-foreground">Processing your sponsorship…</p>
          </div>
        )}

        <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Sponsor this event</span>
            <h3 className="text-base font-bold text-foreground mt-0.5">{event.title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : loadError ? (
            <p className="text-sm text-destructive py-8 text-center">{loadError}</p>
          ) : result ? (
            <div className="text-center py-6">
              <CheckCircle2 className="mx-auto text-emerald-600" size={40} />
              <h4 className="text-base font-bold mt-3">
                {result.status === 'paid' ? 'Sponsorship confirmed' : 'Sponsorship booked — invoice sent'}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                {formatMoney(result.amount, result.currency)}{' '}
                {result.status === 'paid'
                  ? 'paid. Your logo now appears on the event page.'
                  : 'is due within 30 days. Your logo appears on the event page once payment is received.'}
              </p>
              <button type="button" onClick={onClose} className="mt-5 px-4 py-2 rounded-xl bg-[#0B1E3B] text-white text-xs font-semibold cursor-pointer">
                Done
              </button>
            </div>
          ) : !data?.tiers.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No sponsorship packages are offered for this event.</p>
          ) : (
            <div className="space-y-5">
              {/* Tier selection grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.tiers.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={t.isSoldOut}
                    onClick={() => setTierId(t.id)}
                    className={cn(
                      'text-left p-4 rounded-xl border transition',
                      t.isSoldOut
                        ? 'opacity-50 cursor-not-allowed border-border'
                        : tierId === t.id
                          ? 'border-primary ring-2 ring-primary/30 bg-primary/5 cursor-pointer'
                          : 'border-border hover:border-primary/50 cursor-pointer'
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-bold text-foreground">{t.tierName}</span>
                      <span className="text-sm font-bold text-primary">{formatMoney(t.amount, currency)}</span>
                    </div>
                    {t.benefits.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {t.benefits.map((b) => (
                          <li key={b} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 size={12} className="text-emerald-600 mt-0.5 shrink-0" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className={cn('mt-2 text-[11px] font-semibold', t.isSoldOut ? 'text-destructive' : 'text-muted-foreground')}>
                      {t.isSoldOut
                        ? 'Sold out'
                        : t.maxSponsors != null
                          ? `${t.spotsRemaining} of ${t.maxSponsors} remaining`
                          : 'Open availability'}
                    </p>
                  </button>
                ))}
              </div>

              {/* Sponsor business confirmation */}
              <div className="p-4 rounded-xl border border-border bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Sponsoring business</p>
                {business ? (
                  <div className="flex items-center gap-3">
                    {logo ? (
                      <img src={logo} alt={business.name} className="w-12 h-12 rounded-lg object-contain bg-white border border-border" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                        <Building size={18} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{business.name}</p>
                      {business.website ? (
                        <p className="text-xs text-muted-foreground inline-flex items-center gap-1 truncate">
                          <Globe size={11} /> {business.website}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">No website on your business profile</p>
                      )}
                      {!logo && <p className="text-xs text-amber-600 mt-0.5">Add a logo to your business profile so it can appear on the sponsor wall.</p>}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-destructive">You need a business profile to sponsor an event.</p>
                )}
              </div>

              {/* Payment options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={cn(
                    'flex items-start gap-2.5 p-3 rounded-xl border text-left cursor-pointer',
                    paymentMethod === 'card' ? 'border-primary bg-primary/5' : 'border-border'
                  )}
                >
                  <CreditCard size={16} className="mt-0.5 text-primary" />
                  <span>
                    <span className="block text-sm font-semibold">Pay Now via Credit Card</span>
                    <span className="block text-xs text-muted-foreground">Instant confirmation</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('invoice')}
                  className={cn(
                    'flex items-start gap-2.5 p-3 rounded-xl border text-left cursor-pointer',
                    paymentMethod === 'invoice' ? 'border-primary bg-primary/5' : 'border-border'
                  )}
                >
                  <FileText size={16} className="mt-0.5 text-primary" />
                  <span>
                    <span className="block text-sm font-semibold">Invoice My Business (Net 30)</span>
                    <span className="block text-xs text-muted-foreground">An unpaid invoice is added to your billing</span>
                  </span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-sm">
                  Total: <span className="font-bold">{tier ? formatMoney(tier.amount, currency) : '—'}</span>
                </p>
                <button
                  type="button"
                  disabled={!tier || !business || submitting}
                  onClick={submit}
                  className="px-5 py-2.5 rounded-xl bg-[#0B1E3B] hover:bg-[#102A43] text-white text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {paymentMethod === 'card' ? 'Pay & Confirm Sponsorship' : 'Book & Send Invoice'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
