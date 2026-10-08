import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, CheckCircle2, Lock, Loader2, ShieldCheck, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { payMemberInvoice } from '../services/billing.api';
import type { MemberInvoice, SavedPaymentMethod } from '../types';

export interface InvoicePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: MemberInvoice | null;
  savedCards: SavedPaymentMethod[];
  onSuccess: () => void;
}

export const InvoicePaymentModal: React.FC<InvoicePaymentModalProps> = ({
  isOpen,
  onClose,
  invoice,
  savedCards,
  onSuccess,
}) => {
  const defaultCard = savedCards.find((c) => c.is_default) || savedCards[0] || null;
  const [selectedCardId, setSelectedCardId] = useState<string>(defaultCard ? defaultCard.id : 'new');
  const [newCardNumber, setNewCardNumber] = useState<string>('');
  const [newExpiry, setNewExpiry] = useState<string>('');
  const [newCvv, setNewCvv] = useState<string>('');
  const [saveNewCard, setSaveNewCard] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    if (savedCards.length > 0) {
      const def = savedCards.find((c) => c.is_default) || savedCards[0];
      setSelectedCardId(def.id);
    } else {
      setSelectedCardId('new');
    }
  }, [savedCards]);

  if (!invoice) return null;

  const totalAmount = invoice.total_amount || invoice.amount || 0;
  const usingSavedCard = selectedCardId !== 'new' && savedCards.some((c) => c.id === selectedCardId);

  const handleExpiryChange = (val: string) => {
    let raw = val.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 2) raw = raw.slice(0, 2) + '/' + raw.slice(2);
    setNewExpiry(raw);
  };

  const handlePay = async () => {
    let payload: any = {};

    if (usingSavedCard) {
      payload = { payment_method_id: selectedCardId };
    } else {
      const cleanNum = newCardNumber.replace(/\s/g, '');
      if (cleanNum.length < 12) {
        toast.error('Please enter a valid card number');
        return;
      }
      const expParts = newExpiry.split('/');
      const expMonth = parseInt(expParts[0] || '12', 10);
      let expYear = parseInt(expParts[1] || '28', 10);
      if (expYear < 100) expYear += 2000;

      let brand = 'Visa';
      if (cleanNum.startsWith('5')) brand = 'Mastercard';
      else if (cleanNum.startsWith('3')) brand = 'Amex';
      else if (cleanNum.startsWith('6')) brand = 'Discover';

      payload = {
        card_details: {
          brand,
          last_four: cleanNum.slice(-4),
          expiry_month: expMonth,
          expiry_year: expYear,
          save_card: saveNewCard,
        },
      };
    }

    setIsProcessing(true);
    try {
      const res = await payMemberInvoice(invoice.id, payload);
      toast.success(`Payment of $${totalAmount.toFixed(2)} settled successfully!`, {
        description: `Txn Reference: ${res.transaction_id}`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Payment processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Pay Invoice Online</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Ref: {invoice.invoice_number} · Due {invoice.due_date}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Order Summary Box */}
          <div className="p-3.5 rounded-xl bg-muted/50 border border-border space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-foreground">{invoice.description}</span>
              <span className="font-mono font-bold text-foreground">
                ${invoice.amount.toFixed(2)}
              </span>
            </div>
            {invoice.tax_amount > 0 && (
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Tax</span>
                <span className="font-mono">${invoice.tax_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-border/80 flex justify-between items-center">
              <span className="text-xs font-bold text-foreground">Total Payable</span>
              <span className="text-base font-extrabold text-[#0B2447] dark:text-blue-400 font-mono">
                ${totalAmount.toFixed(2)} {invoice.currency}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
              <CreditCard className="w-3.5 h-3.5" /> Select Payment Method
            </Label>

            {savedCards.length > 0 && (
              <div className="space-y-2">
                {savedCards.map((c) => (
                  <label
                    key={c.id}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                      selectedCardId === c.id
                        ? 'border-[#0B2447] bg-blue-50/40 dark:border-blue-400 dark:bg-blue-950/30'
                        : 'border-border bg-card hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="payCard"
                        checked={selectedCardId === c.id}
                        onChange={() => setSelectedCardId(c.id)}
                        className="text-[#0B2447] focus:ring-[#0B2447]"
                      />
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          {c.brand} •••• {c.last_four}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Expires {c.expiry_month.toString().padStart(2, '0')}/{c.expiry_year}
                        </p>
                      </div>
                    </div>
                    {c.is_default && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-[#0B2447] dark:bg-blue-900/60 dark:text-blue-300">
                        Default
                      </span>
                    )}
                  </label>
                ))}

                <label
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    selectedCardId === 'new'
                      ? 'border-[#0B2447] bg-blue-50/40 dark:border-blue-400 dark:bg-blue-950/30'
                      : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="payCard"
                    checked={selectedCardId === 'new'}
                    onChange={() => setSelectedCardId('new')}
                    className="text-[#0B2447] focus:ring-[#0B2447]"
                  />
                  <span className="text-xs font-semibold text-foreground">
                    Use a different credit card
                  </span>
                </label>
              </div>
            )}

            {selectedCardId === 'new' && (
              <div className="space-y-3 p-3.5 rounded-xl bg-muted/40 border border-border mt-2">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium">Card Number</Label>
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="4242 4242 4242 4242"
                      value={newCardNumber}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
                        setNewCardNumber(raw.replace(/(\d{4})(?=\d)/g, '$1 '));
                      }}
                      className="font-mono text-xs pr-8"
                    />
                    <Lock className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-3 pointer-events-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium">Expiration</Label>
                    <Input
                      type="text"
                      placeholder="MM/YY"
                      value={newExpiry}
                      onChange={(e) => handleExpiryChange(e.target.value)}
                      className="font-mono text-xs text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium">CVV</Label>
                    <Input
                      type="password"
                      placeholder="123"
                      maxLength={4}
                      value={newCvv}
                      onChange={(e) => setNewCvv(e.target.value.replace(/\D/g, ''))}
                      className="font-mono text-xs text-center"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={saveNewCard}
                    onChange={(e) => setSaveNewCard(e.target.checked)}
                    className="rounded border-gray-300 text-[#0B2447] focus:ring-[#0B2447]"
                  />
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Save this card to Payment Profiles for faster checkout
                  </span>
                </label>
              </div>
            )}
          </div>

          <div className="p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 flex items-center gap-2 text-[11px] text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>256-Bit SSL Encrypted & Tokenized Payment Gateway</span>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handlePay}
              disabled={isProcessing}
              className="bg-[#0B2447] hover:bg-[#16385C] text-white dark:bg-blue-600 dark:hover:bg-blue-500 font-semibold"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Processing...
                </>
              ) : (
                `Pay $${totalAmount.toFixed(2)} Now`
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
