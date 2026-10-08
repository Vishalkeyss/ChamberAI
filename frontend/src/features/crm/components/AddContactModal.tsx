import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { CRM_STAGES, CRM_STAGE_LABELS, createCrmContact, type CrmContactInput, type CrmStage } from '../services/crm.api';
import { EMAIL_PLACEHOLDER, PHONE_PLACEHOLDER } from '@/lib/placeholders';

interface AddContactModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
  /** Quick conversion pre-fill (received referral / directory profile, OD-083). */
  prefill?: Partial<CrmContactInput> | null;
  /** Shown under the title, e.g. "From referral by Apex Legal". */
  sourceLabel?: string;
}

const empty = { name: '', company_name: '', email: '', phone: '', stage: 'lead' as CrmStage, deal_value: '', expected_close_date: '', follow_up_date: '', notes: '' };

/** Prompt 05.5 "+ Add Contact" (and the quick-conversion target). */
export const AddContactModal: React.FC<AddContactModalProps> = ({ open, onClose, onCreated, prefill, sourceLabel }) => {
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF({
      ...empty,
      name: prefill?.name || '',
      company_name: prefill?.company_name || '',
      email: prefill?.email || '',
      phone: prefill?.phone || '',
      notes: prefill?.notes || '',
    });
  }, [open, prefill]);

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async () => {
    if (f.name.trim().length < 2) return toast.error('Contact name is required');
    const value = f.deal_value.trim() ? Number(f.deal_value) : 0;
    if (!Number.isFinite(value) || value < 0) return toast.error('Enter a valid deal value');
    setSaving(true);
    try {
      const res = await createCrmContact({
        name: f.name.trim(),
        company_name: f.company_name.trim() || null,
        email: f.email.trim() || null,
        phone: f.phone.trim() || null,
        stage: f.stage,
        deal_value: value,
        expected_close_date: f.expected_close_date || null,
        follow_up_date: f.follow_up_date || null,
        notes: f.notes.trim() || null,
        linked_user_id: prefill?.linked_user_id || null,
      });
      toast.success(`${f.name.trim()} added to your CRM`);
      onCreated?.(res.id);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add contact');
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary';
  const label = 'block text-xs font-semibold text-foreground mb-1';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogTitle>Add Contact</DialogTitle>
        <DialogDescription>{sourceLabel || 'Track a new business development opportunity through your private pipeline.'}</DialogDescription>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={label}>Contact name *</label><input className={input} value={f.name} onChange={set('name')} maxLength={100} /></div>
            <div><label className={label}>Company</label><input className={input} value={f.company_name} onChange={set('company_name')} maxLength={100} /></div>
            <div><label className={label}>Email</label><input placeholder={EMAIL_PLACEHOLDER} className={input} type="email" value={f.email} onChange={set('email')} /></div>
            <div><label className={label}>Phone</label><input placeholder={PHONE_PLACEHOLDER} className={input} value={f.phone} onChange={set('phone')} maxLength={30} /></div>
            <div>
              <label className={label}>Stage</label>
              <select className={input} value={f.stage} onChange={set('stage')}>
                {CRM_STAGES.map((s) => <option key={s} value={s}>{CRM_STAGE_LABELS[s]}</option>)}
              </select>
            </div>
            <div><label className={label}>Deal value</label><input className={input} type="number" min={0} step="0.01" value={f.deal_value} onChange={set('deal_value')} /></div>
            <div><label className={label}>Expected close date</label><input className={input} type="date" value={f.expected_close_date} onChange={set('expected_close_date')} /></div>
            <div><label className={label}>Next follow-up</label><input className={input} type="date" value={f.follow_up_date} onChange={set('follow_up_date')} /></div>
          </div>
          <div><label className={label}>Notes</label><textarea className={`${input} min-h-[80px]`} value={f.notes} onChange={set('notes')} maxLength={2000} /></div>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />} Add Contact
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
