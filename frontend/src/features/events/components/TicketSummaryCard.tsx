import React from 'react';
import { formatMoney } from '../services/events.api';

interface TicketSummaryCardProps {
  basePrice: number;
  promoDiscount: number;
  pointsDiscount: number;
  totalPayable: number;
  currency: string | null;
}

/**
 * Prompt 04.3 §5.1 Order Summary: Subtotal, Promo Discount, Points Discount, Total Payable.
 * Figures are a preview; the server recalculates them on registration.
 */
export const TicketSummaryCard: React.FC<TicketSummaryCardProps> = ({
  basePrice,
  promoDiscount,
  pointsDiscount,
  totalPayable,
  currency,
}) => (
  <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs space-y-1.5">
    <div className="flex justify-between text-muted-foreground">
      <span>Subtotal</span>
      <span>{formatMoney(basePrice, currency)}</span>
    </div>
    {promoDiscount > 0 && (
      <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
        <span>Promo discount</span>
        <span>−{formatMoney(promoDiscount, currency)}</span>
      </div>
    )}
    {pointsDiscount > 0 && (
      <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
        <span>Points discount</span>
        <span>−{formatMoney(pointsDiscount, currency)}</span>
      </div>
    )}
    <div className="flex justify-between border-t border-border pt-1.5 font-bold text-foreground">
      <span>Total payable</span>
      <span>{formatMoney(totalPayable, currency)}</span>
    </div>
  </div>
);
