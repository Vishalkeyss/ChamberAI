import React, { useEffect } from 'react';
import {
  X,
  LogIn,
  UserPlus,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import type { MembershipPlan } from '../types';
import { cn } from '@/lib/utils';

export interface MembershipAuthChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: MembershipPlan | null;
  chamberName: string;
  onSignIn: () => void;
  onSignUp: () => void;
}

export const MembershipAuthChoiceModal: React.FC<MembershipAuthChoiceModalProps> = ({
  isOpen,
  onClose,
  plan,
  chamberName,
  onSignIn,
  onSignUp,
}) => {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !plan) return null;

  const isTiered = plan.pricingBasis && plan.pricingBasis !== 'flat';
  const lowestPrice =
    isTiered && plan.pricingTiers && plan.pricingTiers.length > 0
      ? Math.min(...plan.pricingTiers.map((t) => t.price))
      : plan.price;

  const displayPrice = isTiered
    ? `From $${lowestPrice}/yr`
    : plan.price === 0
      ? '$0/yr'
      : `$${plan.price}/yr`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="relative w-full max-w-lg bg-card text-card-foreground rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Gradient Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-emerald-500 to-indigo-600" />

        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-border">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <Sparkles size={12} />
                {plan.name} · {displayPrice}
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Welcome to {chamberName}
            </h2>
            <p className="text-xs text-muted-foreground">
              Select how you would like to proceed with your membership
            </p>
          </div>
          <button
            type="button"
            id="close-auth-choice-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Options Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm font-medium text-foreground">
            Are you already a registered member of {chamberName}?
          </p>

          {/* Option 1: Existing Member (Sign In) */}
          <div
            id="choice-existing-member"
            onClick={onSignIn}
            className={cn(
              'group relative flex items-start gap-4 p-4.5 rounded-xl border border-border bg-card/60 hover:bg-muted/60 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md hover:border-blue-500/50'
            )}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform duration-200">
              <LogIn size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Existing Member
                </span>
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-1 font-medium">
                  Sign In <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground mt-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                I already have an account
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Sign in with your email or phone to access your member portal, manage renewals, or upgrade to this plan.
              </p>
            </div>
          </div>

          {/* Option 2: New Member (Sign Up / Apply) */}
          <div
            id="choice-new-member"
            onClick={onSignUp}
            className={cn(
              'group relative flex items-start gap-4 p-4.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md hover:border-emerald-500/60 ring-1 ring-emerald-500/10'
            )}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform duration-200">
              <UserPlus size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  New Member
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 transition-colors flex items-center gap-1 font-semibold">
                  Sign Up & Apply <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground mt-0.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                I'm new — Apply for {plan.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Submit an application to join {chamberName}. Fast digital onboarding, business directory listing, and member benefits.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-muted/30 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Secure passwordless verification</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hover:text-foreground font-medium transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
