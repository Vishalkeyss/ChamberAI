import React, { useEffect, useState } from 'react';
import { CalendarDays, Link2, Loader2, Mail, MessageSquare, Phone, StickyNote, Trash2, TrendingUp, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import {
  CRM_STAGES,
  CRM_STAGE_LABELS,
  addCrmActivity,
  deleteCrmContact,
  fetchCrmContact,
  updateCrmContact,
  type CrmActivity,
  type CrmContactDetail,
  type CrmStage,
} from '../services/crm.api';
import { EMAIL_PLACEHOLDER, PHONE_PLACEHOLDER } from '@/lib/placeholders';

interface ContactDetailDrawerProps {
  contactId: string | null;
  currency: string | null;
  onClose: () => void;
  onChanged: () => void;
}

const ACTIVITY_ICONS: Record<CrmActivity['type'], React.ElementType> = {
  note: StickyNote,
  call: Phone,
  meeting: Users,
  email: Mail,
  stage: TrendingUp,
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

type Form = {
  name: string;
  company_name: string;
  email: string;
  phone: string;
  stage: CrmStage;
  deal_value: string;
  expected_close_date: string;
  follow_up_date: string;
  notes: string;
};

const toForm = (c: CrmContactDetail): Form => ({
  name: c.name,
  company_name: c.company_name || '',
  email: c.email || '',
  phone: c.phone || '',
  stage: c.stage,
  deal_value: c.deal_value ? String(c.deal_value) : '',
  expected_close_date: c.expected_close_date?.slice(0, 10) || '',
  follow_up_date: c.follow_up_date?.slice(0, 10) || '',
  notes: c.notes || '',
});

/** Prompt 05.5 §5 contact detail drawer: info, deal properties, interaction timeline. */
export const ContactDetailDrawer: React.FC<ContactDetailDrawerProps> = ({ contactId, currency, onClose, onChanged }) => {
  const [contact, setContact] = useState<CrmContactDetail | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [logType, setLogType] = useState<Exclude<CrmActivity['type'], 'stage'>>('note');
  const [logBody, setLogBody] = useState('');
  const [logging, setLogging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setContact(null);
    setForm(null);
    setConfirmDelete(false);
    setLogBody('');
    if (!contactId) return;
    let cancelled = false;
    fetchCrmContact(contactId)
      .then((c) => {
        if (cancelled) return;
        setContact(c);
        setForm(toForm(c));
      })
      .catch((err) => {
        toast.error(err.message || 'Failed to load contact');
        onClose();
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  const save = async () => {
    if (!contact || !form) return;
    if (form.name.trim().length < 2) return toast.error('Contact name is required');
    const value = form.deal_value.trim() ? Number(form.deal_value) : 0;
    if (!Number.isFinite(value) || value < 0) return toast.error('Enter a valid deal value');
    setSaving(true);
    try {
      const updated = await updateCrmContact(contact.id, {
        name: form.name.trim(),
        company_name: form.company_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        stage: form.stage,
        deal_value: value,
        expected_close_date: form.expected_close_date || null,
        follow_up_date: form.follow_up_date || null,
        notes: form.notes.trim() || null,
      });
      setContact(updated);
      setForm(toForm(updated));
      toast.success('Contact saved');
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  const log = async () => {
    if (!contact || !logBody.trim()) return;
    setLogging(true);
    try {
      const entry = await addCrmActivity(contact.id, logType, logBody.trim());
      setContact((c) => (c ? { ...c, activities: [entry, ...c.activities], last_interaction_at: entry.created_at } : c));
      setLogBody('');
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to log activity');
    } finally {
      setLogging(false);
    }
  };

  const remove = async () => {
    if (!contact) return;
    setSaving(true);
    try {
      await deleteCrmContact(contact.id);
      toast.success('Contact deleted');
      onChanged();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete contact');
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary';
  const label = 'block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1';

  return (
    <Sheet open={!!contactId} onOpenChange={(v) => !v && !saving && onClose()}>
      <SheetContent side="right" className="p-0 w-full sm:max-w-lg flex flex-col gap-0 [&>button]:hidden">
        <SheetTitle className="sr-only">{contact?.name || 'Contact'}</SheetTitle>
        <SheetDescription className="sr-only">CRM contact details</SheetDescription>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <p className="text-base font-bold text-foreground truncate">{contact?.name || 'Loading…'}</p>
            {contact && <p className="text-xs text-muted-foreground">Added {new Date(contact.created_at).toLocaleDateString()}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>

        {!contact || !form ? (
          <div className="p-5 space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <section className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className={label}>Name</label><input className={input} value={form.name} onChange={set('name')} maxLength={100} /></div>
                <div><label className={label}>Company</label><input className={input} value={form.company_name} onChange={set('company_name')} maxLength={100} /></div>
                <div><label className={label}>Phone</label><input placeholder={PHONE_PLACEHOLDER} className={input} value={form.phone} onChange={set('phone')} maxLength={30} /></div>
                <div className="col-span-2"><label className={label}>Email</label><input placeholder={EMAIL_PLACEHOLDER} className={input} type="email" value={form.email} onChange={set('email')} /></div>
              </div>
              {contact.linked_user && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Link2 size={12} /> Linked chamber member: <span className="font-semibold text-foreground">{contact.linked_user.name}</span></p>
              )}
            </section>

            <section className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground">Deal</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Stage</label>
                  <select className={input} value={form.stage} onChange={set('stage')}>
                    {CRM_STAGES.map((s) => <option key={s} value={s}>{CRM_STAGE_LABELS[s]}</option>)}
                  </select>
                </div>
                <div><label className={label}>Deal value{currency ? ` (${currency})` : ''}</label><input className={input} type="number" min={0} step="0.01" value={form.deal_value} onChange={set('deal_value')} /></div>
                <div><label className={label}>Expected close</label><input className={input} type="date" value={form.expected_close_date} onChange={set('expected_close_date')} /></div>
                <div><label className={label}>Next follow-up</label><input className={input} type="date" value={form.follow_up_date} onChange={set('follow_up_date')} /></div>
                <div className="col-span-2"><label className={label}>Notes</label><textarea className={`${input} min-h-[70px]`} value={form.notes} onChange={set('notes')} maxLength={2000} /></div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50">
                  {saving && <Loader2 size={14} className="animate-spin" />} Save changes
                </button>
                {confirmDelete ? (
                  <>
                    <button type="button" onClick={remove} disabled={saving} className="ml-auto px-3 py-2 rounded-lg bg-destructive text-white text-xs font-semibold">Confirm delete</button>
                    <button type="button" onClick={() => setConfirmDelete(false)} className="px-3 py-2 rounded-lg border border-border text-xs font-semibold">Cancel</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(true)} className="ml-auto px-3 py-2 rounded-lg text-destructive hover:bg-destructive/10 text-xs font-semibold flex items-center gap-1">
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground">Interaction Log</p>
              <div className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex gap-1 flex-wrap">
                  {(['note', 'call', 'meeting', 'email'] as const).map((t) => {
                    const Icon = ACTIVITY_ICONS[t];
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setLogType(t)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize flex items-center gap-1 ${logType === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                      >
                        <Icon size={12} /> {t}
                      </button>
                    );
                  })}
                </div>
                <textarea className={`${input} min-h-[60px]`} value={logBody} onChange={(e) => setLogBody(e.target.value)} maxLength={2000} placeholder={`Log a ${logType}…`} />
                <button type="button" onClick={log} disabled={logging || !logBody.trim()} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40">
                  {logging ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />} Add to timeline
                </button>
              </div>
              {contact.activities.length === 0 ? (
                <p className="text-xs text-muted-foreground">No interactions logged yet.</p>
              ) : (
                <ol className="space-y-3 border-l border-border ml-2">
                  {contact.activities.map((a) => {
                    const Icon = ACTIVITY_ICONS[a.type] || StickyNote;
                    return (
                      <li key={a.id} className="pl-4 relative">
                        <span className="absolute -left-[9px] top-0.5 w-[18px] h-[18px] rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground"><Icon size={10} /></span>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 capitalize"><CalendarDays size={10} /> {a.type} · {formatDateTime(a.created_at)}</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words">{a.body}</p>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
