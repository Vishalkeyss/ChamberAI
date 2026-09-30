import React from 'react';
import {
  CheckCircle2,
  CircleDashed,
  Sparkles,
  UserCircle,
  QrCode,
  Handshake,
  UserPlus,
  PartyPopper,
} from 'lucide-react';

export interface OnboardingSteps {
  profile: boolean;
  card: boolean;
  network: boolean;
  team: boolean;
}

export interface OnboardingChecklistCardProps {
  steps: OnboardingSteps;
  completionPct: number;
  isComplete: boolean;
  onCompleteStep: (stepKey: keyof OnboardingSteps) => void;
  isSubmitting?: boolean;
}

const STEP_CONFIG: {
  key: keyof OnboardingSteps;
  label: string;
  description: string;
  icon: React.ElementType;
  cta: string;
}[] = [
  {
    key: 'profile',
    label: 'Complete Business Directory Profile & Logo',
    description: 'Stand out in the member directory with your brand',
    icon: UserCircle,
    cta: 'Edit Profile',
  },
  {
    key: 'card',
    label: 'Set Up Digital Business Card & QR Code',
    description: 'Share your contact info instantly at events',
    icon: QrCode,
    cta: 'Create Card',
  },
  {
    key: 'network',
    label: 'Submit Your First B2B Referral or Join a Group',
    description: 'Start building your networking impact',
    icon: Handshake,
    cta: 'Browse Groups',
  },
  {
    key: 'team',
    label: 'Invite a Colleague or Billing Contact',
    description: 'Add team members to share chamber access',
    icon: UserPlus,
    cta: 'Invite Member',
  },
];

export const OnboardingChecklistCard: React.FC<OnboardingChecklistCardProps> = ({
  steps,
  completionPct,
  isComplete,
  onCompleteStep,
  isSubmitting,
}) => {
  const doneCount = Object.values(steps).filter(Boolean).length;
  const totalSteps = STEP_CONFIG.length;
  const remaining = totalSteps - doneCount;

  // Celebration state — all 4 tasks complete
  if (isComplete) {
    return (
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-teal-500/10 dark:from-emerald-900/30 dark:via-emerald-950/20 dark:to-teal-950/30 rounded-2xl border border-emerald-500/20 dark:border-emerald-800/40 p-6 shadow-xs">
        <div className="absolute -right-6 -top-6 opacity-10">
          <Sparkles className="w-32 h-32 text-emerald-600" />
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 flex items-center justify-center ring-4 ring-emerald-500/10">
            <PartyPopper className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
              🎉 Onboarding Completed!
            </h3>
            <p className="text-sm text-emerald-700/80 dark:text-emerald-400/70 mt-0.5">
              +100 Loyalty Points Credited — You're all set to make the most of your membership.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card text-card-foreground rounded-2xl border border-border p-6 shadow-xs transition-all duration-200">
      {/* Progress Header */}
      <div className="flex items-center gap-4 mb-5">
        {/* Circular Progress Ring */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 shadow-2xs"
          style={{
            background: `conic-gradient(hsl(var(--primary)) ${completionPct}%, hsl(var(--muted)) ${completionPct}%)`,
          }}
        >
          <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center text-sm font-bold text-card-foreground transition-colors">
            {completionPct}%
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-card-foreground">
              Member Onboarding
            </h3>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              {remaining} task{remaining !== 1 ? 's' : ''} remaining
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Complete your profile to unlock full chamber benefits
          </p>
          {/* Linear Progress Bar */}
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4 Step Checklist */}
      <div className="space-y-1">
        {STEP_CONFIG.map((step) => {
          const isDone = steps[step.key];
          const Icon = step.icon;

          return (
            <div
              key={step.key}
              className={`flex items-center gap-3.5 p-3 rounded-xl transition-all duration-200 group ${
                isDone
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/30 dark:border-emerald-800/20'
                  : 'hover:bg-muted/50 border border-transparent'
              }`}
            >
              {/* Status Icon */}
              <div className="shrink-0">
                {isDone ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <CircleDashed className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                )}
              </div>

              {/* Step Icon */}
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isDone
                    ? 'bg-emerald-100/80 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    isDone
                      ? 'text-emerald-800 dark:text-emerald-300 line-through decoration-emerald-500/30'
                      : 'text-card-foreground'
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {step.description}
                </p>
              </div>

              {/* CTA Button */}
              {!isDone && (
                <button
                  type="button"
                  onClick={() => onCompleteStep(step.key)}
                  disabled={isSubmitting}
                  className="shrink-0 text-xs font-semibold text-primary dark:text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
                >
                  {step.cta}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
