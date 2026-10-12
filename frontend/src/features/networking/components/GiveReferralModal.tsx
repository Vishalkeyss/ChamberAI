import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Loader2, Pencil, Search, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { MemberAvatar } from './MemberAvatar';
import {
  createReferral,
  searchReferralBusinesses,
  searchReferralMembers,
  type NetworkMember,
  type ReferralBusinessOption,
} from '../services/networking.api';
import { EMAIL_PLACEHOLDER, PHONE_PLACEHOLDER } from '@/lib/placeholders';

/** Prompt 05.3 §15 / OD-065 — mirrors the backend limit. */
const MAX_CONTACTS = 10;

interface DraftContact {
  key: string;
  fullName: string;
  phone: string;
  email: string;
  profession: string;
  /** Set when the person was picked from the chamber directory (OD-064). */
  referredBusinessId?: string;
  memberId?: string;
}

interface GiveReferralModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: (pointsAwarded: number) => void;
  chamberName?: string;
  rewardPoints?: number;
}

const emptyDraft = (): DraftContact => ({ key: crypto.randomUUID(), fullName: '', phone: '', email: '', profession: '' });

function contactError(c: DraftContact): string | null {
  if (c.fullName.trim().length < 2) return 'Each person needs a full name';
  if (c.profession.trim().length < 2) return `Add the profession / service needed for ${c.fullName.trim() || 'each person'}`;
  if (c.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) return `Invalid email for ${c.fullName.trim()}`;
  return null;
}

function buildMessage(contacts: DraftContact[], recipient: ReferralBusinessOption | null): string {
  if (!recipient || contacts.length === 0) return '';
  const people = contacts
    .map((c) => `${c.fullName.trim()}${c.profession.trim() ? ` (${c.profession.trim()})` : ''}`)
    .join(', ');
  const greeting = recipient.contactName ? `Hi ${recipient.contactName.split(' ')[0]}` : `Hi ${recipient.name} team`;
  return `${greeting}, I'd like to introduce ${people}. I think ${recipient.name} would be a great fit — please reach out when you can.`;
}

/**
 * Prompt 05.3 §5.2 — "Give a Referral" as the reference UI's 3-step wizard (OD-064):
 * 1. whom (manual entry or chamber member search) → 2. to which business + intro note → 3. review.
 */
export const GiveReferralModal: React.FC<GiveReferralModalProps> = ({ open, onClose, onSubmitted, chamberName, rewardPoints }) => {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<'manual' | 'search'>('manual');
  const [contacts, setContacts] = useState<DraftContact[]>([]);
  const [draft, setDraft] = useState<DraftContact>(emptyDraft);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<NetworkMember[]>([]);
  const [businessQuery, setBusinessQuery] = useState('');
  const [businessResults, setBusinessResults] = useState<ReferralBusinessOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [recipient, setRecipient] = useState<ReferralBusinessOption | null>(null);
  const [message, setMessage] = useState('');
  const [messageTouched, setMessageTouched] = useState(false);
  const [editingMsg, setEditingMsg] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setMode('manual');
    setContacts([]);
    setDraft(emptyDraft());
    setMemberQuery('');
    setBusinessQuery('');
    setRecipient(null);
    setMessage('');
    setMessageTouched(false);
    setEditingMsg(false);
  }, [open]);

  // Debounced searches (members in step 1 "search" mode, businesses in step 2).
  const activeSearch = step === 1 && mode === 'search' ? 'members' : step === 2 ? 'businesses' : null;
  const activeQuery = activeSearch === 'members' ? memberQuery : businessQuery;
  useEffect(() => {
    if (!open || !activeSearch) return;
    const current = ++seq.current;
    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        if (activeSearch === 'members') {
          const res = await searchReferralMembers(activeQuery.trim());
          if (current === seq.current) setMemberResults(res);
        } else {
          const res = await searchReferralBusinesses(activeQuery.trim());
          if (current === seq.current) setBusinessResults(res);
        }
      } catch (err: any) {
        if (current === seq.current) toast.error(err.message || 'Search failed');
      } finally {
        if (current === seq.current) setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [open, activeSearch, activeQuery]);

  const draftHasContent = !!(draft.fullName.trim() || draft.phone.trim() || draft.email.trim() || draft.profession.trim());
  const atLimit = contacts.length >= MAX_CONTACTS;

  const addDraft = (): boolean => {
    if (!draftHasContent) return true;
    const err = contactError(draft);
    if (err) {
      toast.error(err);
      return false;
    }
    if (atLimit) {
      toast.error(`You can refer up to ${MAX_CONTACTS} people at once`);
      return false;
    }
    setContacts((all) => [...all, draft]);
    setDraft(emptyDraft());
    return true;
  };

  const toggleMember = (m: NetworkMember) => {
    setContacts((all) => {
      if (all.some((c) => c.memberId === m.id)) return all.filter((c) => c.memberId !== m.id);
      if (all.length >= MAX_CONTACTS) {
        toast.error(`You can refer up to ${MAX_CONTACTS} people at once`);
        return all;
      }
      return [
        ...all,
        {
          key: crypto.randomUUID(),
          memberId: m.id,
          fullName: m.name,
          phone: '',
          email: '',
          profession: m.industry || '',
          referredBusinessId: m.businessId || undefined,
        },
      ];
    });
  };

  const updateContact = (key: string, patch: Partial<DraftContact>) =>
    setContacts((all) => all.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  const autoMessage = useMemo(() => buildMessage(contacts, recipient), [contacts, recipient]);
  const finalMessage = messageTouched ? message : autoMessage;

  const next = () => {
    if (step === 1) {
      if (!addDraft()) return;
      // addDraft updates state asynchronously; validate the list including the pending draft.
      const all = draftHasContent ? [...contacts, draft] : contacts;
      if (all.length === 0) return toast.error('Add at least one person to refer');
      const err = all.map(contactError).find(Boolean);
      if (err) return toast.error(err);
      setStep(2);
    } else if (step === 2) {
      if (!recipient) return toast.error('Choose the business that should receive this referral');
      if (finalMessage.trim().length < 5) return toast.error('Introduction note must be at least 5 characters');
      setStep(3);
    }
  };

  const submit = async () => {
    if (!recipient) return;
    setSubmitting(true);
    try {
      const res = await createReferral({
        toBusinessId: recipient.id,
        message: finalMessage.trim(),
        contacts: contacts.map((c) => ({
          fullName: c.fullName.trim(),
          profession: c.profession.trim(),
          ...(c.phone.trim() ? { phone: c.phone.trim() } : {}),
          ...(c.email.trim() ? { email: c.email.trim() } : {}),
          ...(c.referredBusinessId ? { referredBusinessId: c.referredBusinessId } : {}),
        })),
      });
      onSubmitted(res.pointsAwarded);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit referral');
    } finally {
      setSubmitting(false);
    }
  };

  const input = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary';
  const label = 'block text-xs font-semibold text-foreground mb-1';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !submitting && onClose()}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogTitle>Give a Referral</DialogTitle>
        <DialogDescription>
          Sent directly inside {chamberName || 'your chamber'}
          {rewardPoints ? ` · earn +${rewardPoints} points` : ''}.
        </DialogDescription>

        {/* Progress */}
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={cn('h-1 rounded-full transition-all', n <= step ? 'bg-primary' : 'bg-muted', n === step ? 'flex-[2]' : 'flex-1', n < step && 'opacity-40')}
            />
          ))}
        </div>
        <p className="text-[11px] font-semibold text-muted-foreground -mt-2">Step {step} of 3</p>

        {step === 1 && (
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-bold text-foreground">Whom do you want to refer?</h3>
              <p className="text-xs text-muted-foreground">Add the person(s) you want to recommend (up to {MAX_CONTACTS}).</p>
            </div>
            <div className="flex gap-1 p-1 rounded-lg bg-muted">
              {(['manual', 'search'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    'flex-1 py-1.5 rounded-md text-xs font-semibold transition inline-flex items-center justify-center gap-1',
                    mode === m ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'
                  )}
                >
                  {m === 'manual' ? 'Manual Entry' : (<><Sparkles size={11} /> Search Members</>)}
                </button>
              ))}
            </div>

            {contacts.length > 0 && (
              <div className="space-y-2">
                {contacts.map((c, i) => (
                  <div key={c.key} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30">
                    <MemberAvatar name={c.fullName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{c.fullName || `Person ${i + 1}`}</p>
                      <input
                        value={c.profession}
                        onChange={(e) => updateContact(c.key, { profession: e.target.value })}
                        placeholder="Profession / service needed *"
                        className="w-full mt-0.5 text-xs bg-transparent outline-none border-b border-dashed border-border focus:border-primary"
                      />
                    </div>
                    <button
                      type="button"
                      aria-label="Remove person"
                      onClick={() => setContacts((all) => all.filter((x) => x.key !== c.key))}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {mode === 'manual' ? (
              <div className="space-y-2.5">
                <div className="rounded-xl border border-border p-3.5 space-y-2.5">
                  <p className="text-xs font-semibold">Person {contacts.length + 1}</p>
                  <div>
                    <label className={label}>Full Name *</label>
                    <input className={input} value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} placeholder="Enter name" maxLength={100} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className={label}>Mobile Number</label>
                      <input className={input} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder={PHONE_PLACEHOLDER} maxLength={20} />
                    </div>
                    <div>
                      <label className={label}>Email</label>
                      <input className={input} type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder={`${EMAIL_PLACEHOLDER} (optional)`} />
                    </div>
                  </div>
                  <div>
                    <label className={label}>Profession / Service Needed *</label>
                    <input className={input} value={draft.profession} onChange={(e) => setDraft({ ...draft, profession: e.target.value })} placeholder="e.g. Plumber, Real Estate Attorney" maxLength={100} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addDraft}
                  disabled={!draftHasContent || atLimit}
                  className="w-full py-3 rounded-xl text-sm font-semibold border-[1.5px] border-dashed border-primary text-primary disabled:opacity-40"
                >
                  + Add Another Person
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-start gap-2 p-3 rounded-xl text-xs bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200">
                  <Sparkles size={13} className="shrink-0 mt-0.5" />
                  <span>Search and refer members directly from your chamber's own directory — no manual typing needed.</span>
                </div>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input className={cn(input, 'pl-9')} value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="Search by name, company or industry" />
                </div>
                <div className="rounded-xl border border-border max-h-60 overflow-y-auto divide-y divide-border">
                  {searching && memberResults.length === 0 ? (
                    <p className="text-xs text-center py-6 text-muted-foreground">Searching…</p>
                  ) : memberResults.length === 0 ? (
                    <p className="text-xs text-center py-6 text-muted-foreground">No matching members found.</p>
                  ) : (
                    memberResults.map((m) => {
                      const checked = contacts.some((c) => c.memberId === m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleMember(m)}
                          className={cn('w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition', checked ? 'bg-primary/5' : 'hover:bg-muted/50')}
                        >
                          <MemberAvatar name={m.name} avatarUrl={m.avatarUrl} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{m.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{[m.industry, m.companyName].filter(Boolean).join(' · ')}</p>
                          </div>
                          <span className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center', checked ? 'bg-primary border-primary' : 'border-border')}>
                            {checked && <CheckCircle2 size={11} className="text-primary-foreground" />}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-bold text-foreground">To whom?</h3>
              <p className="text-xs text-muted-foreground">Choose which business should receive this referral, then review the intro note.</p>
            </div>
            {recipient ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-primary bg-primary/5">
                <BusinessLogo name={recipient.name} logoUrl={recipient.logoUrl} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{recipient.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{[recipient.industry, recipient.contactName].filter(Boolean).join(' · ')}</p>
                </div>
                <button type="button" onClick={() => setRecipient(null)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" aria-label="Change business">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input className={cn(input, 'pl-9')} value={businessQuery} onChange={(e) => setBusinessQuery(e.target.value)} placeholder="Search chamber businesses…" autoFocus />
                </div>
                <div className="rounded-xl border border-border max-h-56 overflow-y-auto divide-y divide-border">
                  {searching && businessResults.length === 0 ? (
                    <p className="text-xs text-center py-6 text-muted-foreground">Searching…</p>
                  ) : businessResults.length === 0 ? (
                    <p className="text-xs text-center py-6 text-muted-foreground">No matching businesses found.</p>
                  ) : (
                    businessResults.map((b) => (
                      <button key={b.id} type="button" onClick={() => setRecipient(b)} className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-muted/50">
                        <BusinessLogo name={b.name} logoUrl={b.logoUrl} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{b.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{[b.industry, b.contactName].filter(Boolean).join(' · ')}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Introduction Note <span className="font-normal normal-case ml-1">Auto-generated · editable</span>
              </p>
              <textarea
                className={cn(input, 'min-h-[96px]')}
                value={finalMessage}
                maxLength={2000}
                onChange={(e) => {
                  setMessageTouched(true);
                  setMessage(e.target.value);
                }}
                placeholder="Your intro message…"
              />
            </div>
          </div>
        )}

        {step === 3 && recipient && (
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-bold text-foreground">Review & Submit</h3>
              <p className="text-xs text-muted-foreground">Confirm your referral details before sending.</p>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Referring</p>
            <div className="space-y-1.5">
              {contacts.map((c) => (
                <div key={c.key} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-muted/30">
                  <MemberAvatar name={c.fullName} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{c.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">{[c.profession, c.phone, c.email].filter((v) => v.trim()).join(' · ')}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Referred To</p>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-muted/30">
              <BusinessLogo name={recipient.name} logoUrl={recipient.logoUrl} />
              <p className="text-sm font-semibold">{recipient.name}</p>
            </div>
            <div className="p-3 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Message</p>
                <button type="button" onClick={() => setEditingMsg((v) => !v)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border text-muted-foreground">
                  <Pencil size={11} /> {editingMsg ? 'Done' : 'Edit'}
                </button>
              </div>
              {editingMsg ? (
                <textarea
                  className={cn(input, 'min-h-[80px]')}
                  value={finalMessage}
                  maxLength={2000}
                  onChange={(e) => {
                    setMessageTouched(true);
                    setMessage(e.target.value);
                  }}
                />
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{finalMessage}</p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2.5 pt-1">
          {step > 1 && (
            <button type="button" onClick={() => setStep(step - 1)} disabled={submitting} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold flex items-center justify-center gap-1.5">
              <ArrowLeft size={14} /> Back
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              disabled={step === 1 ? contacts.length === 0 && !draftHasContent : !recipient}
              className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              {step === 2 ? 'Review' : 'Next'} <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting || finalMessage.trim().length < 5}
              className="flex-[2] py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Submit Referral
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const BusinessLogo: React.FC<{ name: string; logoUrl: string | null }> = ({ name, logoUrl }) =>
  logoUrl ? (
    <img src={logoUrl} alt={name} className="w-9 h-9 rounded-lg object-cover border border-border shrink-0" />
  ) : (
    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
      <Building2 size={16} />
    </div>
  );
