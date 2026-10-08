import { apiUrl } from '@/core/api/base';
import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  UserCog,
  Shield,
  Mail,
  Smartphone,
  ArrowRight,
  ArrowLeft,
  Lock,
  MailCheck,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import type { RegisteredChamber } from '@/features/public/data/chambers';
import { ResendCountdown } from './ResendCountdown';
import { isValidPhoneNumber, isValidEmail, normalizePhoneNumber } from '@/lib/validation';
import { EMAIL_PLACEHOLDER, PHONE_EXAMPLE } from '@/lib/placeholders';

export interface MemberLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  chamber: RegisteredChamber;
  onSuccess?: (authData: any) => void;
  initialPortal?: 'member' | 'admin' | 'super_admin';
  allowSuperAdmin?: boolean;
  onApplyClick?: () => void;
}

export const MemberLoginModal: React.FC<MemberLoginModalProps> = ({
  isOpen,
  onClose,
  chamber,
  onSuccess,
  initialPortal = 'member',
  allowSuperAdmin = false,
  onApplyClick,
}) => {
  const { login } = useAuth();
  const effectiveInitialPortal =
    !allowSuperAdmin && initialPortal === 'super_admin' ? 'member' : initialPortal;
  const [portalMode, setPortalMode] = useState<'member' | 'admin' | 'super_admin'>(
    effectiveInitialPortal
  );
  const [identifier, setIdentifier] = useState('');
  const [stage, setStage] = useState<'identify' | 'otp'>('identify');
  const [otp, setOtp] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPortalMode(
        !allowSuperAdmin && initialPortal === 'super_admin' ? 'member' : initialPortal
      );
      setStage('identify');
      setIdentifier('');
      setOtp('');
      setError(null);
    }
  }, [isOpen, initialPortal, allowSuperAdmin]);

  if (!isOpen) return null;

  // Chamber initials badge (e.g. AC for Austin Chamber, MD for Metro Dev)
  const chamberInitials = (() => {
    const parts = chamber.name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return chamber.name.slice(0, 2).toUpperCase();
  })();

  const isEmailLike = identifier.includes('@');
  const isSuperAdmin = portalMode === 'super_admin';
  const isAdmin = portalMode === 'admin';

  const handleSendOtp = async (e?: React.FormEvent): Promise<boolean> => {
    if (e) e.preventDefault();
    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) {
      setError('Please enter your email address or mobile number.');
      return false;
    }
    if (trimmedIdentifier.includes('@')) {
      if (!isValidEmail(trimmedIdentifier)) {
        setError('Please enter a valid email address (e.g., name@example.com).');
        return false;
      }
    } else {
      if (!isValidPhoneNumber(trimmedIdentifier)) {
        setError('Please enter a valid USA phone number (+1 (555) 019-2834).');
        return false;
      }
    }
    if (!agreed) {
      setError('Please accept the Terms & Conditions and Privacy Policy to continue.');
      return false;
    }

    setError(null);
    setLoading(true);

    const endpoint = isSuperAdmin
      ? '/api/v1/auth/super-admin/request-otp'
      : isAdmin
        ? '/api/v1/auth/admin/request-otp'
        : '/api/v1/auth/member/request-otp';
    const portalParam = isSuperAdmin ? 'super_admin' : isAdmin ? 'chamber_admin' : 'member';

    try {
      const res = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(isSuperAdmin
            ? {}
            : {
              'X-Chamber-ID': chamber.id,
              'X-Chamber-Slug': chamber.slug,
            }),
        },
        body: JSON.stringify({
          identifier: trimmedIdentifier.includes('@')
            ? trimmedIdentifier
            : normalizePhoneNumber(trimmedIdentifier),
          portal: portalParam,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to send verification code');
      }

      setStage('otp');
      setOtp('');
      return true;
    } catch (err: any) {
      setError(err.message || 'Unable to request verification code');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    const success = await handleSendOtp();
    if (!success) {
      throw new Error('Failed to resend verification code');
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setError('Please enter the code sent to you.');
      return;
    }

    setError(null);
    setLoading(true);

    const endpoint = isSuperAdmin
      ? '/api/v1/auth/super-admin/verify-otp'
      : isAdmin
        ? '/api/v1/auth/admin/verify-otp'
        : '/api/v1/auth/member/verify-otp';
    const portalParam = isSuperAdmin ? 'super_admin' : isAdmin ? 'chamber_admin' : 'member';

    try {
      const res = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(isSuperAdmin
            ? {}
            : {
              'X-Chamber-ID': chamber.id,
              'X-Chamber-Slug': chamber.slug,
            }),
        },
        body: JSON.stringify({
          identifier: identifier.trim(),
          code: cleanOtp,
          portal: portalParam,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Invalid or expired verification code');
      }

      // Persist auth context
      login(
        data.data.token,
        data.data.user,
        data.data.user?.roles || data.data.roles || [],
        data.data.chamber || null
      );

      onClose();
      if (onSuccess) {
        onSuccess(data.data);
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-back fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/25 backdrop-blur-[1px]"
    >
      <div
        className="w-full max-w-[480px] relative animate-in zoom-in-95 duration-150 bg-card text-card-foreground border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-border bg-card">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs bg-header-nav text-white">
                {isSuperAdmin ? '121' : chamberInitials}
              </div>
              <span className="text-card-foreground font-extrabold text-base truncate">
                {isSuperAdmin ? '121 Meet.AI Platform' : chamber.name}
              </span>
            </div>
            <p className="mt-1.5 text-muted-foreground text-xs leading-relaxed">
              {isSuperAdmin
                ? 'Welcome to 121 Meet.AI. Sign in to your Super Admin Control Plane with a one-time code.'
                : isAdmin
                  ? `Welcome to ${chamber.name}. Sign in to your chamber admin portal with a one-time code — no password required.`
                  : `Welcome to ${chamber.name}. Sign in to your member portal with a one-time code — no password required.`}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-card-foreground p-1 shrink-0 rounded-lg hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {stage === 'identify' ? (
            <div>
              {/* Portal Header row */}
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border">
                {isSuperAdmin ? (
                  <>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-red-500/10 text-red-500">
                      <Shield size={21} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-card-foreground">
                        Platform Super Admin
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Root multi-tenant control plane & platform governance
                      </p>
                    </div>
                  </>
                ) : isAdmin ? (
                  <>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                      <UserCog size={21} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-card-foreground">
                        Chamber Admin Portal
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Sign in with a one-time code — no password needed
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-500">
                      <Users size={21} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-card-foreground">
                        Member Portal
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Sign in with a one-time code — no password needed
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Form Fields */}
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold block text-card-foreground mb-1.5">
                    Email or Mobile Number
                  </label>
                  <div className="relative">
                    {isEmailLike ? (
                      <Mail
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"
                      />
                    ) : (
                      <Smartphone
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"
                      />
                    )}
                    <input
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (error) setError(null);
                      }}
                      type="text"
                      inputMode="email"
                      placeholder={`${EMAIL_PLACEHOLDER} or ${PHONE_EXAMPLE}`}
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm outline-none transition bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
                    <XCircle size={13} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <label className="flex items-start gap-2 text-xs cursor-pointer select-none text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => {
                      setAgreed(e.target.checked);
                      if (error) setError(null);
                    }}
                    className="mt-0.5 shrink-0 accent-primary"
                  />
                  <span>
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        alert('Terms & Conditions');
                      }}
                      className="font-semibold underline cursor-pointer text-card-foreground hover:text-primary"
                    >
                      Terms & Conditions
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        alert('Privacy Policy');
                      }}
                      className="font-semibold underline cursor-pointer text-card-foreground hover:text-primary"
                    >
                      Privacy Policy
                    </button>
                    .
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading || !agreed || !identifier.trim()}
                  className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white inline-flex items-center justify-center gap-2 transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer bg-muted-foreground hover:bg-blue-600 shadow-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Sending code…</span>
                    </>
                  ) : (
                    <>
                      <span>Send OTP</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>

                {/* Portal Switch Link */}
                {!isSuperAdmin && (
                  <div className="pt-3 text-center border-t border-border">
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <span className="text-[11px] opacity-75">Portal:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setPortalMode('member');
                          setIdentifier('');
                          setError(null);
                          setStage('identify');
                        }}
                        className={cn(
                          'cursor-pointer transition-colors',
                          portalMode === 'member'
                            ? 'font-bold text-emerald-600 dark:text-emerald-400 underline'
                            : 'hover:text-card-foreground'
                        )}
                      >
                        Member
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => {
                          setPortalMode('admin');
                          setIdentifier('');
                          setError(null);
                          setStage('identify');
                        }}
                        className={cn(
                          'cursor-pointer transition-colors',
                          portalMode === 'admin'
                            ? 'font-bold text-blue-600 dark:text-primary underline'
                            : 'hover:text-card-foreground'
                        )}
                      >
                        Chamber Admin
                      </button>
                    </div>
                  </div>
                )}

                {onApplyClick && portalMode === 'member' && (
                  <div className="pt-2 text-center text-xs text-muted-foreground border-t border-border/50">
                    <span>Not a member yet? </span>
                    <button
                      type="button"
                      id="btn-login-modal-apply"
                      onClick={() => {
                        onClose();
                        onApplyClick();
                      }}
                      className="font-semibold text-emerald-600 dark:text-emerald-400 underline hover:opacity-80 cursor-pointer transition-opacity"
                    >
                      Apply for membership
                    </button>
                  </div>
                )}
              </form>
            </div>
          ) : (
            <div>
              {/* Screen 2: OTP Verification */}
              <button
                type="button"
                onClick={() => {
                  setStage('identify');
                  setError(null);
                }}
                className="flex items-center gap-1.5 text-xs font-semibold mb-4 cursor-pointer text-muted-foreground hover:text-card-foreground transition-colors"
              >
                <ArrowLeft size={14} />
                <span>Change email or mobile number</span>
              </button>

              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border">
                <div
                  className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                    isAdmin ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-500"
                  )}
                >
                  <MailCheck size={21} />
                </div>
                <div>
                  <p className="text-sm font-bold text-card-foreground">
                    Enter the code
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sent to <span className="font-semibold text-card-foreground">{identifier}</span>
                  </p>
                </div>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold block text-card-foreground mb-1.5">
                    Verification Code
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"
                    />
                    <input
                      value={otp}
                      onChange={(e) => {
                        setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                        if (error) setError(null);
                      }}
                      type="text"
                      inputMode="numeric"
                      placeholder="Enter 6-digit code"
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm outline-none tracking-[0.3em] font-semibold bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
                    <XCircle size={13} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-muted-foreground">Didn't get a code?</span>
                  <ResendCountdown
                    initialSeconds={30}
                    onResend={handleResendOtp}
                    isResending={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white inline-flex items-center justify-center gap-2 transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer bg-blue-600 hover:bg-blue-500 shadow-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Verifying…</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Verify & Log In</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* LoginFooter */}
          <div className="mt-5 pt-4 flex flex-col items-center gap-1.5 border-t border-border">
            <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
              <button
                type="button"
                onClick={() => alert('Terms & Conditions')}
                className="hover:underline hover:text-card-foreground cursor-pointer"
              >
                Terms & Conditions
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => alert('Privacy Policy')}
                className="hover:underline hover:text-card-foreground cursor-pointer"
              >
                Privacy Policy
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Powered by <span className="font-semibold text-card-foreground">121 Meet.ai</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
