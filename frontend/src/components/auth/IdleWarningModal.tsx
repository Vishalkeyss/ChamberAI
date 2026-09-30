import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock } from 'lucide-react';

export interface IdleWarningModalProps {
  open: boolean;
  remainingSeconds: number;
  onKeepLoggedIn: () => void;
  onLogoutNow: () => void;
}

export const IdleWarningModal: React.FC<IdleWarningModalProps> = ({
  open,
  remainingSeconds,
  onKeepLoggedIn,
  onLogoutNow,
}) => {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedCountdown = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-2 ring-8 ring-amber-500/5">
            <Clock className="h-6 w-6 animate-pulse" />
          </div>
          <AlertDialogTitle className="text-center text-xl font-bold">
            Session Inactivity Warning
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-sm">
            You will be logged out in{' '}
            <span className="font-mono font-bold text-foreground text-base px-1.5 py-0.5 rounded bg-muted">
              {formattedCountdown}
            </span>{' '}
            due to inactivity. Would you like to stay signed in?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center gap-2 mt-4">
          <AlertDialogCancel
            onClick={(e) => {
              e.preventDefault();
              onLogoutNow();
            }}
            className="w-full sm:w-auto"
          >
            Log Out Now
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onKeepLoggedIn();
            }}
            className="w-full sm:w-auto bg-primary"
          >
            Keep Me Logged In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
