import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Loader2, MapPin, QrCode, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchChamberCurrency,
  formatMoney,
  registerForEvent,
  validateEventPromo,
  type EventItem,
  type RegistrationResult,
} from '../services/events.api';
import { PromoCodeInput } from './PromoCodeInput';
import { TicketSummaryCard } from './TicketSummaryCard';
import { EventSponsorsSection } from './EventSponsorsSection';

interface EventRegistrationModalProps {
  event: EventItem;
  isMember: boolean;
  chamberSlug?: string;
  /** Value of one loyalty point, from the events list meta (Prompt 04.3 §8). */
  pointRedemptionValue?: number;
  onClose: () => void;
  onRegistered: (result: RegistrationResult) => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Prompt 04.3 §5.1 — Registration & checkout modal for members and guests.
 * All prices shown are a preview; the server recalculates and enforces them.
 */
export const EventRegistrationModal: React.FC<EventRegistrationModalProps> = ({
  event,
  isMember,
  chamberSlug,
  pointRedemptionValue,
  onClose,
  onRegistered,
}) => {
  const { user, refreshSession } = useAuth();
  const memberMode = isMember && !!user;

  const tickets = event.ticketTypes || [];
  const [ticketId, setTicketId] = useState<string>(() => {
    const firstAvailable = tickets.find((t) => t.qtyRemaining == null || t.qtyRemaining > 0);
    return firstAvailable?.id || '';
  });
  const ticket = tickets.find((t) => t.id === ticketId) || null;

  const [currency, setCurrency] = useState<string | null>(null);
  const [guest, setGuest] = useState({ name: '', email: '', phone: '', company: '' });

  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoLabel, setPromoLabel] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const [usePoints, setUsePoints] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegistrationResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchChamberCurrency(chamberSlug).then((c) => {
      if (!cancelled) setCurrency(c);
    });
    return () => {
      cancelled = true;
    };
  }, [chamberSlug]);

  // A promo discount depends on the ticket price — re-validate by clearing on tier change.
  useEffect(() => {
    setPromoCode(null);
    setPromoDiscount(0);
    setPromoLabel(null);
    setPromoError(null);
  }, [ticketId]);

  // OD-021: ticket price when a tier is chosen, else member / non-member event fee.
  const basePrice = useMemo(() => {
    if (ticket) return Number(ticket.price || 0);
    if (!event.isPaid) return 0;
    const fee = memberMode ? event.registrationFee : (event.nonMemberFee ?? event.registrationFee);
    return Number(fee || 0);
  }, [ticket, event, memberMode]);

  const nonMemberPrice =
    !ticket && memberMode && event.isPaid && event.nonMemberFee != null && event.nonMemberFee > basePrice
      ? event.nonMemberFee
      : null;

  const pointsBalance = memberMode ? user?.pointsBalance || 0 : 0;
  const afterPromo = round2(Math.max(0, basePrice - promoDiscount));
  const maxUsefulPoints = pointRedemptionValue
    ? Math.min(pointsBalance, Math.ceil(afterPromo / pointRedemptionValue - 1e-9))
    : 0;
  const redeemPoints = usePoints ? maxUsefulPoints : 0;
  const pointsDiscount = pointRedemptionValue
    ? round2(Math.min(afterPromo, redeemPoints * pointRedemptionValue))
    : 0;
  const totalPayable = round2(Math.max(0, afterPromo - pointsDiscount));

  const isFull = event.isSoldOut;
  const needsOnlinePayment = !isFull && totalPayable > 0 && !ticket?.allowPayLater;
  const ticketSoldOut = !!ticket && ticket.qtyRemaining != null && ticket.qtyRemaining <= 0;
  const missingTicket = tickets.length > 0 && !ticket;

  const handleApplyPromo = async (code: string) => {
    setPromoError(null);
    if (!memberMode) {
      // Guests: the code is validated when the registration is submitted.
      setPromoCode(code);
      setPromoLabel(code.toUpperCase());
      return;
    }
    try {
      const res = await validateEventPromo(event.id, { code, ticketTypeId: ticket?.id }, chamberSlug);
      setPromoCode(code);
      setPromoDiscount(res.discountAmount);
      setPromoLabel(
        res.discountType === 'percentage'
          ? `${res.discountValue}% off`
          : `${formatMoney(res.discountAmount, currency)} off`
      );
    } catch (err: any) {
      setPromoError(err.message || 'Invalid or expired code');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberMode && (!guest.name.trim() || !guest.email.trim())) {
      toast.error('Please provide your name and email');
      return;
    }
    setSubmitting(true);
    try {
      const res = await registerForEvent(
        event.id,
        {
          ticketTypeId: ticket?.id,
          promoCode: promoCode || undefined,
          redeemPoints: redeemPoints > 0 ? redeemPoints : undefined,
          guestDetails: memberMode
            ? undefined
            : {
                name: guest.name.trim(),
                email: guest.email.trim(),
                phone: guest.phone.trim() || undefined,
                company: guest.company.trim() || undefined,
              },
        },
        chamberSlug,
        memberMode
      );
      setResult(res);
      onRegistered(res);
      if (res.pricing?.redeemedPoints) refreshSession().catch(() => {});
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete registration');
    } finally {
      setSubmitting(false);
    }
  };

  const eventDate = new Date(event.eventDate.replace(' ', 'T'));
  const venue = event.isVirtual ? 'Virtual event' : event.venue || event.city || null;

  const submitLabel = isFull
    ? 'Join Waitlist'
    : totalPayable <= 0
      ? 'Confirm Free Registration'
      : ticket?.allowPayLater
        ? `Confirm & Pay ${formatMoney(totalPayable, currency)} Later`
        : `Pay ${formatMoney(totalPayable, currency)} & Confirm Registration`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-card rounded-2xl border border-border shadow-2xl p-6">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="mb-4 pr-8">
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary">{event.category || 'Event'}</span>
          <h3 className="text-base font-bold text-foreground mt-0.5">{event.title}</h3>
          <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Clock size={12} />
              {eventDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: event.isAllDay ? undefined : 'short' })}
            </span>
            {venue && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} />
                {venue}
              </span>
            )}
          </p>
        </div>

        {result ? (
          <div className="text-center py-4">
            <CheckCircle2 size={44} className="text-emerald-500 mx-auto mb-3" />
            <h4 className="text-base font-bold text-foreground">
              {result.status === 'waitlisted' ? 'Added to Waitlist' : 'Registration Confirmed'}
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              {result.status === 'waitlisted'
                ? `This event is full. You are #${result.waitlistPosition} on the waitlist and will not be charged unless a seat opens.`
                : result.paymentStatus === 'pay_later'
                  ? `Your seat is reserved. ${formatMoney(result.amountDue, result.pricing?.currency ?? currency)} is due — an invoice has been added to your billing.`
                  : 'Your seat is reserved.'}
            </p>
            {result.qrCodeHash && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-[11px] font-mono text-foreground">
                <QrCode size={14} />
                {result.qrCodeHash}
              </div>
            )}
            <div className="mt-5">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-[#0B1E3B] hover:bg-[#102A43] text-white text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isFull && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                This event is at capacity. Registering adds you to the waitlist — nothing is charged.
              </div>
            )}

            {/* Ticket selection */}
            {tickets.length > 0 ? (
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-foreground mb-1.5">Ticket</legend>
                {tickets.map((t) => {
                  const soldOut = t.qtyRemaining != null && t.qtyRemaining <= 0;
                  return (
                    <label
                      key={t.id}
                      className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                        ticketId === t.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                      } ${soldOut ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="radio"
                        name="ticket"
                        value={t.id}
                        checked={ticketId === t.id}
                        disabled={soldOut || submitting}
                        onChange={() => setTicketId(t.id)}
                        className="mt-0.5"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="flex justify-between gap-2 text-xs font-semibold text-foreground">
                          <span>{t.name}</span>
                          <span>{t.price > 0 ? formatMoney(t.price, currency) : 'Free'}</span>
                        </span>
                        {t.description && <span className="block text-[11px] text-muted-foreground mt-0.5">{t.description}</span>}
                        <span className="block text-[11px] text-muted-foreground mt-0.5">
                          {soldOut ? 'Sold out' : t.qtyRemaining != null ? `${t.qtyRemaining} remaining` : null}
                          {t.price > 0 && t.allowPayLater ? `${t.qtyRemaining != null && !soldOut ? ' · ' : ''}Pay later available` : null}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            ) : (
              <div className="flex justify-between items-center rounded-xl border border-border p-3 text-xs">
                <span className="font-semibold text-foreground">{memberMode ? 'Member price' : 'Price'}</span>
                <span className="font-semibold text-foreground">
                  {nonMemberPrice != null && (
                    <span className="line-through text-muted-foreground font-normal mr-2">
                      {formatMoney(nonMemberPrice, currency)}
                    </span>
                  )}
                  {basePrice > 0 ? formatMoney(basePrice, currency) : 'Free'}
                </span>
              </div>
            )}

            {/* Attendee details */}
            {memberMode ? (
              <div className="rounded-xl border border-border p-3 text-xs">
                <p className="font-semibold text-foreground">{user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim()}</p>
                <p className="text-muted-foreground">{user?.email}</p>
                {user?.phone && <p className="text-muted-foreground">{user.phone}</p>}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    ['name', 'Full Name *', 'text', true],
                    ['email', 'Email Address *', 'email', true],
                    ['phone', 'Phone', 'tel', false],
                    ['company', 'Company Name', 'text', false],
                  ] as const
                ).map(([key, label, type, required]) => (
                  <div key={key}>
                    <label htmlFor={`reg-guest-${key}`} className="block text-xs font-semibold text-foreground mb-1">{label}</label>
                    <input
                      id={`reg-guest-${key}`}
                      type={type}
                      required={required}
                      value={guest[key]}
                      disabled={submitting}
                      onChange={(e) => setGuest((g) => ({ ...g, [key]: e.target.value }))}
                      className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Promo + points only matter when there is something to pay */}
            {!isFull && basePrice > 0 && (
              <>
                <PromoCodeInput
                  appliedCode={promoCode}
                  appliedLabel={promoLabel}
                  error={promoError}
                  disabled={submitting}
                  onApply={handleApplyPromo}
                  onRemove={() => {
                    setPromoCode(null);
                    setPromoDiscount(0);
                    setPromoLabel(null);
                  }}
                />

                {memberMode && pointRedemptionValue && pointsBalance > 0 && maxUsefulPoints > 0 && (
                  <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={usePoints}
                      disabled={submitting}
                      onChange={(e) => setUsePoints(e.target.checked)}
                    />
                    Redeem {maxUsefulPoints} Points for{' '}
                    {formatMoney(round2(Math.min(afterPromo, maxUsefulPoints * pointRedemptionValue)), currency)} Discount
                    <span className="text-muted-foreground">(Balance: {pointsBalance} pts)</span>
                  </label>
                )}

                <TicketSummaryCard
                  basePrice={basePrice}
                  promoDiscount={promoDiscount}
                  pointsDiscount={pointsDiscount}
                  totalPayable={totalPayable}
                  currency={currency}
                />
              </>
            )}

            {needsOnlinePayment && (
              <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Online card payment is not available yet. Please contact the chamber to register for this ticket.
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || missingTicket || ticketSoldOut || needsOnlinePayment}
                className="flex-[2] py-2.5 rounded-xl bg-[#0B1E3B] hover:bg-[#102A43] text-white text-xs font-semibold shadow-xs cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting && <Loader2 size={13} className="animate-spin" />}
                {submitLabel}
              </button>
            </div>
          </form>
        )}

        {/* Prompt 04.4 §5.2: confirmed sponsors below the event details */}
        <div className="mt-5">
          <EventSponsorsSection eventId={event.id} chamberSlug={chamberSlug} />
        </div>
      </div>
    </div>
  );
};
