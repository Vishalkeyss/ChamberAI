import React, { useState } from 'react';
import { Loader2, Tag, X } from 'lucide-react';

interface PromoCodeInputProps {
  appliedCode: string | null;
  /** Human-readable label for the applied discount, e.g. "20% off" */
  appliedLabel: string | null;
  error: string | null;
  disabled?: boolean;
  onApply: (code: string) => Promise<void> | void;
  onRemove: () => void;
}

/**
 * Prompt 04.3 §5.1 Promo Code Bar.
 */
export const PromoCodeInput: React.FC<PromoCodeInputProps> = ({
  appliedCode,
  appliedLabel,
  error,
  disabled,
  onApply,
  onRemove,
}) => {
  const [code, setCode] = useState('');
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    const trimmed = code.trim();
    if (trimmed.length < 2) return;
    setApplying(true);
    try {
      await onApply(trimmed);
    } finally {
      setApplying(false);
    }
  };

  if (appliedCode) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Tag size={13} />
          Promo applied: {appliedLabel || appliedCode}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label="Remove promo code"
          className="p-1 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900 cursor-pointer disabled:opacity-50"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          maxLength={30}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleApply();
            }
          }}
          placeholder="Promo code"
          disabled={disabled || applying}
          className="flex-1 h-10 px-3 rounded-xl border border-border bg-background text-xs uppercase focus:ring-2 focus:ring-primary/20 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleApply}
          disabled={disabled || applying || code.trim().length < 2}
          className="h-10 px-4 rounded-xl border border-border text-xs font-semibold hover:bg-muted cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {applying && <Loader2 size={13} className="animate-spin" />}
          Apply
        </button>
      </div>
      {error && <p className="mt-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};
