import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ShieldAlert } from 'lucide-react';

export interface SessionExpiryModalProps {
  open: boolean;
  onLoginRedirect?: () => void;
  onClose?: () => void;
}

export const SessionExpiryModal: React.FC<SessionExpiryModalProps> = ({
  open,
  onLoginRedirect,
  onClose,
}) => {
  const handleRedirect = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('session_token');
    sessionStorage.removeItem('auth_token');
    if (onLoginRedirect) {
      onLoginRedirect();
    } else if (onClose) {
      onClose();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="rounded-2xl max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 mb-2">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <AlertDialogTitle className="text-center text-lg font-bold">Your session has expired</AlertDialogTitle>
          <AlertDialogDescription className="text-center text-xs text-muted-foreground leading-relaxed">
            For your security, inactive sessions are automatically terminated after 30 minutes of inactivity.
            Please sign in again to continue where you left off.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center pt-2">
          <AlertDialogAction
            onClick={handleRedirect}
            className="w-full sm:w-auto min-w-[140px] bg-[#0B2447] hover:bg-[#16385C] text-white rounded-xl text-xs font-semibold cursor-pointer"
          >
            Sign In with OTP
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SessionExpiryModal;
