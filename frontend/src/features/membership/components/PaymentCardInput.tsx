import React from 'react';
import { CreditCard, Lock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CardFormData {
  cardholderName: string;
  cardNumber: string;
  expiry: string; // MM/YY
  cvc: string;
}

export interface PaymentCardInputProps {
  cardData: CardFormData;
  onChange: (data: CardFormData) => void;
  planPrice: number;
  planName: string;
  billingFrequency?: string;
  error?: string | null;
}

export function detectCardBrand(num: string): 'visa' | 'mastercard' | 'amex' | 'discover' | 'card' {
  const clean = num.replace(/\D/g, '');
  if (/^4/.test(clean)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(clean)) return 'mastercard';
  if (/^3[47]/.test(clean)) return 'amex';
  if (/^(6011|65)/.test(clean)) return 'discover';
  return 'card';
}

export function formatCardNumber(value: string): string {
  const clean = value.replace(/\D/g, '').slice(0, 16);
  const parts = clean.match(/[\s\S]{1,4}/g) || [];
  return parts.join(' ');
}

export function formatExpiry(value: string): string {
  const clean = value.replace(/\D/g, '').slice(0, 4);
  if (clean.length >= 3) {
    return `${clean.slice(0, 2)}/${clean.slice(2)}`;
  }
  return clean;
}

export function validateCardData(data: CardFormData): { valid: boolean; error?: string } {
  if (!data.cardholderName.trim()) {
    return { valid: false, error: 'Please enter the name on the card' };
  }
  const digitsOnly = data.cardNumber.replace(/\D/g, '');
  if (digitsOnly.length < 15) {
    return { valid: false, error: 'Please enter a valid 15 or 16-digit card number' };
  }
  const [mmStr, yyStr] = data.expiry.split('/');
  const mm = parseInt(mmStr, 10);
  const yy = parseInt(yyStr, 10);
  if (!mm || mm < 1 || mm > 12) {
    return { valid: false, error: 'Please enter a valid expiry month (01-12)' };
  }
  const currentYearTwoDigit = new Date().getFullYear() % 100;
  if (!yy || yy < currentYearTwoDigit) {
    return { valid: false, error: 'Card expiration year must be in the future' };
  }
  if (!data.cvc || data.cvc.length < 3) {
    return { valid: false, error: 'Please enter a valid 3 or 4-digit security code (CVC)' };
  }
  return { valid: true };
}

export const PaymentCardInput: React.FC<PaymentCardInputProps> = ({
  cardData,
  onChange,
  planPrice,
  planName,
  billingFrequency = 'annual',
  error,
}) => {
  const brand = detectCardBrand(cardData.cardNumber);

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    onChange({ ...cardData, cardNumber: formatted });
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiry(e.target.value);
    onChange({ ...cardData, expiry: formatted });
  };

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 4);
    onChange({ ...cardData, cvc: clean });
  };

  const getBrandBadge = () => {
    switch (brand) {
      case 'visa':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-black tracking-wider bg-blue-600 text-white uppercase">
            VISA
          </span>
        );
      case 'mastercard':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-black tracking-wider bg-amber-600 text-white uppercase">
            MC
          </span>
        );
      case 'amex':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-black tracking-wider bg-cyan-700 text-white uppercase">
            AMEX
          </span>
        );
      case 'discover':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-black tracking-wider bg-orange-600 text-white uppercase">
            DISC
          </span>
        );
      default:
        return <CreditCard size={15} className="text-slate-400" />;
    }
  };

  return (
    <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-blue-600 dark:text-blue-400" />
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Card Details (Pre-Authorization)
          </h4>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
          <Lock size={10} />
          <span>Charged Only on Approval</span>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
        Enter your card details for membership dues pre-authorization. Your card{' '}
        <strong className="text-slate-700 dark:text-slate-200">will not be charged today</strong>. It will be charged{' '}
        <strong className="text-slate-900 dark:text-white">
          ${planPrice.toLocaleString('en-US')}/{billingFrequency === 'monthly' ? 'mo' : 'yr'}
        </strong>{' '}
        only after chamber administration reviews and approves your application.
      </p>

      {error && (
        <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Cardholder Name */}
      <div>
        <label
          htmlFor="input-cardholder-name"
          className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1"
        >
          Name on Card*
        </label>
        <input
          id="input-cardholder-name"
          type="text"
          value={cardData.cardholderName}
          onChange={(e) => onChange({ ...cardData, cardholderName: e.target.value })}
          placeholder="e.g. Jane Doe"
          className="w-full px-3 py-2 text-xs md:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Card Number */}
      <div>
        <label
          htmlFor="input-card-number"
          className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1"
        >
          Card Number*
        </label>
        <div className="relative">
          <input
            id="input-card-number"
            type="text"
            inputMode="numeric"
            value={cardData.cardNumber}
            onChange={handleNumberChange}
            placeholder="4242  ••••  ••••  4242"
            maxLength={19}
            className="w-full pl-3 pr-14 py-2 text-xs md:text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <div className="absolute right-2.5 top-2.5 pointer-events-none">
            {getBrandBadge()}
          </div>
        </div>
      </div>

      {/* Expiry & CVC */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="input-card-expiry"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1"
          >
            Expiration Date*
          </label>
          <input
            id="input-card-expiry"
            type="text"
            inputMode="numeric"
            value={cardData.expiry}
            onChange={handleExpiryChange}
            placeholder="MM / YY"
            maxLength={5}
            className="w-full px-3 py-2 text-xs md:text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-center"
          />
        </div>

        <div>
          <label
            htmlFor="input-card-cvc"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1"
          >
            CVC / CVV*
          </label>
          <input
            id="input-card-cvc"
            type="password"
            inputMode="numeric"
            value={cardData.cvc}
            onChange={handleCvcChange}
            placeholder="•••"
            maxLength={4}
            className="w-full px-3 py-2 text-xs md:text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-center"
          />
        </div>
      </div>

      <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-700/60">
        <span className="flex items-center gap-1">
          <ShieldCheck size={12} className="text-emerald-500" />
          <span>256-bit encrypted card vaulting</span>
        </span>
        <span>CVV is never stored</span>
      </div>
    </div>
  );
};
