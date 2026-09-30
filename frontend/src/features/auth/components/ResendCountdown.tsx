import React, { useState, useEffect } from 'react';
import { RotateCw } from 'lucide-react';

interface ResendCountdownProps {
  initialSeconds?: number;
  onResend: () => Promise<void> | void;
  isResending?: boolean;
}

export const ResendCountdown: React.FC<ResendCountdownProps> = ({
  initialSeconds = 30,
  onResend,
  isResending = false,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  if (secondsLeft > 0) {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1.5 justify-center">
        <span>Resend code in</span>
        <span className="font-semibold text-foreground tabular-nums">
          {formatTime(secondsLeft)}
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await onResend();
          setSecondsLeft(initialSeconds);
        } catch {
          // Keep button active if resend failed
        }
      }}
      disabled={isResending}
      className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
    >
      <RotateCw className={`h-3 w-3 ${isResending ? 'animate-spin' : ''}`} />
      <span>{isResending ? 'Sending...' : 'Resend Code'}</span>
    </button>
  );
};
