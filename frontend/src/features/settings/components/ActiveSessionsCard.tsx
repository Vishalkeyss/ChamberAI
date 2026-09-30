import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Shield,
  Laptop,
  Smartphone,
  Globe,
  Trash2,
  Lock,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import type { ActiveSessionItem } from '../types';

export interface ActiveSessionsCardProps {
  sessions: ActiveSessionItem[];
  onRevokeSession: (sessionId: string) => Promise<void>;
}

export const ActiveSessionsCard: React.FC<ActiveSessionsCardProps> = ({
  sessions,
  onRevokeSession,
}) => {
  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);

  const handleRevoke = async () => {
    if (!sessionToRevoke) return;
    setIsRevoking(true);
    try {
      await onRevokeSession(sessionToRevoke);
    } finally {
      setIsRevoking(false);
      setSessionToRevoke(null);
    }
  };

  const getDeviceIcon = (ua: string) => {
    const lower = ua.toLowerCase();
    if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) {
      return <Smartphone className="h-5 w-5 text-primary" />;
    }
    return <Laptop className="h-5 w-5 text-primary" />;
  };

  return (
    <div className="space-y-6">
      {/* Security Credentials Card */}
      <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight">Security &amp; Password Management</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Secure passwordless OTP authentication is active. You can set an optional account PIN.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPasswordChangeModal(true)}
          className="rounded-lg gap-1.5 shrink-0"
        >
          <KeyRound className="h-4 w-4" /> Change Security PIN
        </Button>
      </div>

      {/* Active Sessions List */}
      <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-4">
          <div>
            <h3 className="text-base font-bold tracking-tight">Active Sessions &amp; Logged-in Devices</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              These are the web browsers and native mobile applications currently signed in to your account.
            </p>
          </div>
          <Badge variant="outline" className="w-fit text-xs font-mono">
            {sessions.length} Active {sessions.length === 1 ? 'Device' : 'Devices'}
          </Badge>
        </div>

        <div className="space-y-3 pt-2">
          {sessions.map((sess) => (
            <div
              key={sess.sessionId}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-start gap-3.5">
                <div className="p-2 rounded-lg bg-background border border-border shrink-0 mt-0.5">
                  {getDeviceIcon(sess.userAgent)}
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {sess.userAgent.slice(0, 45)}...
                    </span>
                    {sess.isCurrent && (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] py-0">
                        Current Device
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" /> {sess.ipAddress}
                    </span>
                    <span>•</span>
                    <span>Last active: {new Date(sess.lastActiveAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {!sess.isCurrent ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive self-end sm:self-center gap-1.5 h-8 text-xs"
                  onClick={() => setSessionToRevoke(sess.sessionId)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Revoke
                </Button>
              ) : (
                <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 self-end sm:self-center font-medium">
                  <CheckCircle2 className="h-4 w-4" /> This Session
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Revoke Session Confirmation Dialog */}
      <AlertDialog open={Boolean(sessionToRevoke)} onOpenChange={() => setSessionToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately terminate the session and disconnect the remote device from Cloudflare KV. The user will be required to authenticate via OTP to sign back in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRevoke();
              }}
              disabled={isRevoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRevoking ? 'Revoking...' : 'Revoke Session'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Security PIN Change Modal */}
      <AlertDialog open={showPasswordChangeModal} onOpenChange={setShowPasswordChangeModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Account Security PIN</AlertDialogTitle>
            <AlertDialogDescription>
              Your account is secured via enterprise passwordless email &amp; SMS OTP codes. You may configure a 6-digit supplementary PIN for high-value actions such as bulk financial payouts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border">
            Primary authentication remains edge-native with 15-minute sliding TTL sessions.
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction onClick={() => setShowPasswordChangeModal(false)}>
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
