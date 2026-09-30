import React from 'react';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';

interface OtpPinInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export const OtpPinInput: React.FC<OtpPinInputProps> = ({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
}) => {
  const handleChange = (newValue: string) => {
    // Keep only numeric characters up to 6 digits
    const cleaned = newValue.replace(/\D/g, '').slice(0, 6);
    onChange(cleaned);
    if (cleaned.length === 6 && onComplete) {
      onComplete(cleaned);
    }
  };

  return (
    <div className="flex justify-center my-4">
      <InputOTP
        maxLength={6}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        autoFocus={autoFocus}
      >
        <InputOTPGroup className="gap-2 sm:gap-3">
          <InputOTPSlot index={0} className="w-11 h-13 sm:w-12 sm:h-14 text-xl font-bold rounded-lg border-2 border-border focus:border-primary transition-all duration-150" />
          <InputOTPSlot index={1} className="w-11 h-13 sm:w-12 sm:h-14 text-xl font-bold rounded-lg border-2 border-border focus:border-primary transition-all duration-150" />
          <InputOTPSlot index={2} className="w-11 h-13 sm:w-12 sm:h-14 text-xl font-bold rounded-lg border-2 border-border focus:border-primary transition-all duration-150" />
          <InputOTPSlot index={3} className="w-11 h-13 sm:w-12 sm:h-14 text-xl font-bold rounded-lg border-2 border-border focus:border-primary transition-all duration-150" />
          <InputOTPSlot index={4} className="w-11 h-13 sm:w-12 sm:h-14 text-xl font-bold rounded-lg border-2 border-border focus:border-primary transition-all duration-150" />
          <InputOTPSlot index={5} className="w-11 h-13 sm:w-12 sm:h-14 text-xl font-bold rounded-lg border-2 border-border focus:border-primary transition-all duration-150" />
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
};
