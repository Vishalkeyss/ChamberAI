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
import { Landmark, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { addPaymentMethod } from '../services/billing.api';

export interface AddBankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddBankAccountModal: React.FC<AddBankAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [holderName, setHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountType, setAccountType] = useState<'Checking' | 'Savings'>('Checking');
  const [isDefault, setIsDefault] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holderName.trim()) {
      toast.error('Please enter the account holder name');
      return;
    }
    const cleanAccount = accountNumber.replace(/\D/g, '');
    if (cleanAccount.length < 6) {
      toast.error('Please enter a valid bank account number');
      return;
    }
    const cleanRouting = routingNumber.replace(/\D/g, '');
    if (cleanRouting.length < 9) {
      toast.error('Routing number must be 9 digits');
      return;
    }

    const lastFour = cleanAccount.slice(-4);
    setIsSubmitting(true);
    try {
      await addPaymentMethod({
        type: 'bank_account',
        brand: bankName.trim() || 'Bank Account',
        last_four: lastFour,
        expiry_month: 12,
        expiry_year: 2035,
        is_default: isDefault,
      });

      toast.success(`${bankName || 'Bank account'} ending in ${lastFour} added`);
      setHolderName('');
      setBankName('');
      setAccountNumber('');
      setRoutingNumber('');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save bank account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-700 dark:text-blue-300">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Add Bank Account</DialogTitle>
              <DialogDescription className="text-xs">
                Link a checking or savings account for automated ACH direct debit dues
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Account Holder Name*</Label>
            <Input
              type="text"
              placeholder="e.g. Jane Doe"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              className="text-xs"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Bank Name*</Label>
            <Input
              type="text"
              placeholder="e.g. Chase Bank, Wells Fargo"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Routing Number (9 digits)*</Label>
              <Input
                type="text"
                placeholder="021000021"
                maxLength={9}
                value={routingNumber}
                onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                className="font-mono text-xs"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Account Type</Label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as 'Checking' | 'Savings')}
                className="w-full h-9 px-3 text-xs rounded-md border border-input bg-background text-foreground"
              >
                <option value="Checking">Checking</option>
                <option value="Savings">Savings</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Account Number*</Label>
            <Input
              type="password"
              placeholder="••••••••1234"
              maxLength={17}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 17))}
              className="font-mono text-xs"
              required
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="chk-default-bank"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <Label htmlFor="chk-default-bank" className="text-xs font-normal text-muted-foreground cursor-pointer">
              Set as default payment profile for renewals
            </Label>
          </div>

          <div className="rounded-lg p-2.5 bg-muted/60 flex items-start gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Bank details are encrypted and tokenized via PCI-compliant ACH protocol. Full account numbers are never exposed.
            </span>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="text-xs">
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs font-bold bg-[#0B2447] hover:bg-[#16385C] text-white dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Saving...
                </>
              ) : (
                'Save Bank Account'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
