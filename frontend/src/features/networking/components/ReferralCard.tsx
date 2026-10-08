import React, { useState } from 'react';
import { ArrowRight, Building2, ChevronDown, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatMoney } from '@/features/events/services/events.api';
import { AddContactModal } from '@/features/crm/components/AddContactModal';
import type { CrmContactInput } from '@/features/crm/services/crm.api';
import {
  REFERRAL_STATUS_LABELS,
  updateReferralStatus,
  type Referral,
  type ReferralBusinessRef,
  type ReferralStatus,
} from '../services/networking.api';

/** §5.1 status pill colours: Pending amber, Contacted blue, Won green, Declined gray. */
const STATUS_STYLES: Record<ReferralStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  contacted: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  converted: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  declined: 'bg-muted text-muted-foreground',
};

interface ReferralCardProps {
  referral: Referral;
  direction: 'received' | 'given';
  currency: string | null;
  onChanged: () => void;
}

const BusinessChip: React.FC<{ business: ReferralBusinessRef; label: string }> = ({ business, label }) => (
  <div className="flex items-center gap-2 min-w-0">
    {business.logoUrl ? (
      <img src={business.logoUrl} alt={business.name} className="w-9 h-9 rounded-lg object-cover border border-border shrink-0" />
    ) : (
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
        <Building2 size={16} />
      </div>
    )}
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground truncate">{business.name}</p>
    </div>
  </div>
);

/** Prompt 05.3 §5.1 referral card with contacts table and (recipient-only) status updater. */
export const ReferralCard: React.FC<ReferralCardProps> = ({ referral, direction, currency, onChanged }) => {
  const [saving, setSaving] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [dealValue, setDealValue] = useState('');
  // Prompt 05.5 quick conversion: received referral contact → private CRM (OD-083).
  const [crmPrefill, setCrmPrefill] = useState<Partial<CrmContactInput> | null>(null);

  const apply = async (status: Exclude<ReferralStatus, 'pending'>, value?: number) => {
    setSaving(true);
    try {
      await updateReferralStatus(referral.id, status, value);
      toast.success(`Referral marked as ${REFERRAL_STATUS_LABELS[status]}`);
      setConvertOpen(false);
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update referral');
    } finally {
      setSaving(false);
    }
  };

  const confirmConverted = () => {
    const raw = dealValue.trim();
    if (!raw) return apply('converted');
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return toast.error('Enter a valid deal value');
    apply('converted', value);
  };

  const created = new Date(referral.createdAt);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <BusinessChip business={referral.fromBusiness} label="From" />
          <ArrowRight size={16} className="text-muted-foreground shrink-0" />
          <BusinessChip business={referral.toBusiness} label="To" />
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', STATUS_STYLES[referral.status])}>
            {REFERRAL_STATUS_LABELS[referral.status]}
          </span>
          {direction === 'received' && referral.canUpdateStatus && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold flex items-center gap-1 hover:bg-muted disabled:opacity-50"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : null} Update status <ChevronDown size={12} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {referral.allowedNextStatuses.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onSelect={() => (s === 'converted' ? setConvertOpen(true) : apply(s as Exclude<ReferralStatus, 'pending'>))}
                  >
                    Mark as {REFERRAL_STATUS_LABELS[s]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {referral.message && <p className="text-sm text-foreground bg-muted/40 border border-border rounded-lg p-3 whitespace-pre-wrap">{referral.message}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
              <th className="py-2 pr-3 font-semibold">Name</th>
              <th className="py-2 pr-3 font-semibold">Phone</th>
              <th className="py-2 pr-3 font-semibold">Email</th>
              <th className="py-2 font-semibold">Role / Profession</th>
              {direction === 'received' && <th className="py-2" />}
            </tr>
          </thead>
          <tbody>
            {referral.contacts.map((c) => (
              <tr key={c.id || c.fullName} className="border-b border-border/60 last:border-0">
                <td className="py-2 pr-3 font-medium">{c.fullName}</td>
                <td className="py-2 pr-3 text-muted-foreground">{c.phone || '—'}</td>
                <td className="py-2 pr-3 text-muted-foreground">{c.email || '—'}</td>
                <td className="py-2 text-muted-foreground">{c.profession || '—'}</td>
                {direction === 'received' && (
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setCrmPrefill({
                          name: c.fullName,
                          email: c.email || null,
                          phone: c.phone || null,
                          notes: [c.profession && `Needs: ${c.profession}`, referral.message].filter(Boolean).join('\n'),
                        })
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline whitespace-nowrap"
                    >
                      <UserPlus size={12} /> Add to CRM
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {direction === 'given' ? 'Sent' : 'Received'} {Number.isNaN(created.getTime()) ? '' : created.toLocaleDateString()}
          {referral.createdBy ? ` · by ${referral.createdBy.name}` : ''}
        </span>
        {referral.status === 'converted' && referral.convertedValue !== null && (
          <span className="font-semibold text-green-700 dark:text-green-400">Deal value: {formatMoney(referral.convertedValue, currency)}</span>
        )}
      </div>

      <AddContactModal
        open={!!crmPrefill}
        prefill={crmPrefill}
        sourceLabel={`From a referral by ${referral.fromBusiness.name}`}
        onClose={() => setCrmPrefill(null)}
      />

      <Dialog open={convertOpen} onOpenChange={(v) => !saving && setConvertOpen(v)}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>Mark as Won / Converted</DialogTitle>
          <DialogDescription>Optionally record the estimated deal value{currency ? ` (${currency})` : ''}.</DialogDescription>
          <input
            type="number"
            min={0}
            step="0.01"
            value={dealValue}
            onChange={(e) => setDealValue(e.target.value)}
            placeholder="Estimated deal value (optional)"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setConvertOpen(false)} disabled={saving} className="flex-1 py-2 rounded-lg border border-border text-sm font-semibold">
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmConverted}
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />} Confirm
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
