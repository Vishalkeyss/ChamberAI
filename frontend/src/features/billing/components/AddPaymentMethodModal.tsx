import React, { useState } from 'react';
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
import { CreditCard, Lock, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { addPaymentMethod } from '../services/billing.api';

export interface AddPaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddPaymentMethodModal: React.FC<AddPaymentMethodModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [brand, setBrand] = useState<string>('Visa');
  const [cardNumber, setCardNumber] = useState<string>('');
  const [expiry, setExpiry] = useState<string>('');
  const [cvv, setCvv] = useState<string>('');
  const [isDefault, setIsDefault] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto-detect brand from card prefix
  const handleCardNumberChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 16);
    // Format in blocks of 4
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardNumber(formatted);

    if (raw.startsWith('4')) setBrand('Visa');
    else if (raw.startsWith('5')) setBrand('Mastercard');
    else if (/^(60|6521|6522|81|82|508)/.test(raw)) setBrand('RuPay');
    else if (raw.startsWith('34') || raw.startsWith('37')) setBrand('Amex');
    else if (raw.startsWith('6')) setBrand('Discover');
  };

  const handleExpiryChange = (val: string) => {
    let raw = val.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 2) {
      raw = raw.slice(0, 2) + '/' + raw.slice(2);
    }
    setExpiry(raw);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawNumber = cardNumber.replace(/\s/g, '');
    if (rawNumber.length < 12) {
      toast.error('Please enter a valid card number');
      return;
    }

    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      toast.error('Please enter the expiration date as MM/YY');
      return;
    }

    const expParts = expiry.split('/');
    const expMonth = parseInt(expParts[0], 10);
    const expYear = 2000 + parseInt(expParts[1], 10);

    if (isNaN(expMonth) || expMonth < 1 || expMonth > 12) {
      toast.error('Invalid expiration month');
      return;
    }

    const currentYear = new Date().getFullYear();
    if (isNaN(expYear) || expYear < currentYear || expYear > currentYear + 20) {
      toast.error('Invalid expiration year');
      return;
    }

    const lastFour = rawNumber.slice(-4);

    setIsSubmitting(true);
    try {
      await addPaymentMethod({
        type: 'card',
        brand,
        last_four: lastFour,
        expiry_month: expMonth,
        expiry_year: expYear,
        is_default: isDefault,
      });

      toast.success(`${brand} ending in ${lastFour} saved successfully`);
      setCardNumber('');
      setExpiry('');
      setCvv('');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save card');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-[#0B2447] dark:text-blue-400">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Add Payment Method</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Securely store a credit card for renewals and event tickets
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Card Brand selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Card Brand</Label>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {['Visa', 'Mastercard', 'RuPay', 'Amex', 'Discover'].map((b) => (
                <button
                  type="button"
                  key={b}
                  onClick={() => setBrand(b)}
                  className={`py-1.5 px-1 text-xs font-bold rounded-lg border transition-colors ${
                    brand === b
                      ? 'border-[#0B2447] bg-blue-50/50 text-[#0B2447] dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300 shadow-2xs'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Card Number */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Card Number</Label>
            <div className="relative">
              <Input
                type="text"
                placeholder="4242 4242 4242 4242"
                value={cardNumber}
                onChange={(e) => handleCardNumberChange(e.target.value)}
                className="font-mono text-xs pr-9 tracking-wider"
                required
              />
              <Lock className="w-3.5 h-3.5 text-muted-foreground absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Expiry and CVV */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Expiration</Label>
              <Input
                type="text"
                placeholder="MM/YY"
                value={expiry}
                onChange={(e) => handleExpiryChange(e.target.value)}
                className="font-mono text-xs text-center"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Security Code (CVV)</Label>
              <Input
                type="password"
                placeholder="123"
                maxLength={4}
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                className="font-mono text-xs text-center"
                required
              />
            </div>
          </div>

          {/* Default Toggle */}
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-gray-300 text-[#0B2447] focus:ring-[#0B2447]"
            />
            <span className="text-xs text-foreground font-medium">
              Set as default payment method for this chamber
            </span>
          </label>

          {/* Security Note */}
          <div className="p-2.5 rounded-xl bg-muted/60 flex items-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Card details are tokenized and encrypted. Raw CVV is never stored.</span>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-[#0B2447] hover:bg-[#16385C] text-white dark:bg-blue-600 dark:hover:bg-blue-500 font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Saving...
                </>
              ) : (
                'Save Card'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
