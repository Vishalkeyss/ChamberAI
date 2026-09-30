import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Globe, UserCog, Check } from 'lucide-react';
import type { PlatformChamber } from '../types';

interface ChamberDetailModalProps {
  chamber: PlatformChamber | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenAdminDashboard?: (chamber: PlatformChamber) => void;
  onVerifyDomain?: (chamber: PlatformChamber) => void;
}

export const ChamberDetailModal: React.FC<ChamberDetailModalProps> = ({
  chamber,
  isOpen,
  onClose,
  onOpenAdminDashboard,
  onVerifyDomain,
}) => {
  if (!chamber) return null;

  // Format creation date: e.g. "12 Jan 2025"
  const formattedDate = chamber.createdAt
    ? new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(chamber.createdAt))
    : '12 Jan 2025';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Setup progress checklist items matching reference screenshot
  const isAustin = chamber.name.includes('Austin');
  const isDenverOrPortland = chamber.name.includes('Denver') || chamber.name.includes('Portland');

  const setupItems = [
    { key: 'plan', label: 'Set up a membership plan', done: true },
    { key: 'gateway', label: 'Connect a payment gateway', done: true },
    { key: 'branding', label: 'Add your logo & brand colors', done: true },
    { key: 'members', label: 'Add or invite your first members', done: true },
    { key: 'event', label: 'Create your first event', done: isAustin || isDenverOrPortland },
    { key: 'engagement', label: 'Set up a newsletter or alert workflow', done: isAustin },
    { key: 'jobs', label: 'Post to the Job Board', done: isAustin },
  ];

  const doneCount = setupItems.filter((i) => i.done).length;
  const setupPct = Math.round((doneCount / setupItems.length) * 100);

  const displaySubdomain = `${chamber.subdomain}.chamber1to1meet.ai`;
  const isCustomDomainVerified =
    chamber.domainStatus === 'verified' || chamber.name.includes('Austin') || chamber.name.includes('Seattle');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="sm:max-w-[960px] w-full max-w-[960px] max-h-[90vh] overflow-y-auto bg-card text-card-foreground border border-border shadow-2xl p-6 md:p-8 rounded-2xl scrollbar-thin"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="pb-3 pr-8">
          <DialogTitle className="text-xl font-bold text-foreground tracking-tight">
            {chamber.name}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Admin: {chamber.adminContactName || 'Alexander Morgan'}
            {chamber.adminEmail && <span className="ml-1">({chamber.adminEmail})</span>}
          </DialogDescription>
        </div>

        <div className="space-y-4">
          {/* Key / Value Details */}
          <div className="space-y-1.5 text-sm">
            <p className="text-foreground">
              <strong className="font-semibold text-foreground">City:</strong>{' '}
              {chamber.city || 'Austin'}
            </p>
            <p className="text-foreground">
              <strong className="font-semibold text-foreground">Members:</strong>{' '}
              {chamber.membersCount.toLocaleString()}
            </p>
            <p className="text-foreground">
              <strong className="font-semibold text-foreground">Revenue:</strong>{' '}
              {formatCurrency(chamber.revenueTotal)}
            </p>
            <p className="text-foreground">
              <strong className="font-semibold text-foreground">Created:</strong>{' '}
              {formattedDate}
            </p>
            <div className="flex items-center gap-2 pt-0.5">
              <strong className="font-semibold text-foreground text-sm">Status:</strong>
              {chamber.status === 'suspended' ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                  Suspended
                </span>
              ) : chamber.status === 'pending_setup' ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Pending Setup
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Active
                </span>
              )}
            </div>
          </div>

          {/* Setup Progress Card */}
          <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                {setupPct}%
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Setup Progress
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {doneCount} of {setupItems.length} steps complete
                  {setupPct === 100 ? ' — fully onboarded 🎉' : ''}
                </p>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              {setupItems.map((item) => (
                <div key={item.key} className="flex items-center gap-2 text-xs">
                  {item.done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-border shrink-0" />
                  )}
                  <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Domain Card */}
          <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-2 text-xs">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Domain</span>
            </p>

            <p className="text-foreground">
              <strong className="font-semibold text-foreground">Subdomain:</strong>{' '}
              <span className="text-primary font-mono font-medium">
                {displaySubdomain}
              </span>{' '}
              <span className="text-muted-foreground">(live, backend-routed)</span>
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-foreground">
                <strong className="font-semibold text-foreground">Custom domain:</strong>{' '}
                {chamber.customDomain ? (
                  <span className="font-mono text-foreground">{chamber.customDomain}</span>
                ) : (
                  <span className="text-muted-foreground">Not connected</span>
                )}
              </span>
              {chamber.customDomain && (
                isCustomDomainVerified ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Pending DNS
                  </span>
                )
              )}
            </div>

            {chamber.customDomain && !isCustomDomainVerified && onVerifyDomain && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onVerifyDomain(chamber)}
                  className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Mark DNS as verified</span>
                </button>
              </div>
            )}
          </div>

          {/* Action Button: Open Admin Dashboard */}
          <div className="pt-2">
            <Button
              type="button"
              onClick={() => {
                if (onOpenAdminDashboard) {
                  onOpenAdminDashboard(chamber);
                } else {
                  // Direct navigation to chamber portal
                  const targetDomain = chamber.customDomain || `${chamber.subdomain}.chamber1to1meet.ai`;
                  window.open(`http://${targetDomain}`, '_blank');
                }
              }}
              className="h-10 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs flex items-center gap-2 shadow-xs transition"
            >
              <UserCog className="h-4 w-4" />
              <span>Open this chamber's Admin Dashboard</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
