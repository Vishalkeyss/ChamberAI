import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ImagePlus, Loader2, Lock, MapPin, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/core/api/base';
import { fetchChamberCurrency } from '@/features/events/services/events.api';
import {
  createAdminEvent,
  fetchAdminEventForEdit,
  fetchEventFormOptions,
  updateAdminEvent,
  uploadEventPhoto,
  type AdminEventFormPayload,
  type EventFormOptions,
  type EventRecurrenceForm,
} from '../services/admin-events.api';
import { RecurrenceConfigurator } from './RecurrenceConfigurator';
import { TicketTiersBuilder } from './TicketTiersBuilder';
import { SponsorshipTiersBuilder } from './SponsorshipTiersBuilder';
import { PromoCodesBuilder } from './PromoCodesBuilder';

/** Seating layouts (enumeration of how a room is set up; stored as events.table_arrangement). */
const TABLE_ARRANGEMENTS = [
  'Round Tables (Banquet)',
  'Theatre Style',
  'Classroom Style',
  'U-Shape',
  'Boardroom',
  'Cocktail / Standing',
  'Not Applicable',
];
const NO_TABLE_LAYOUTS = new Set(['Cocktail / Standing', 'Not Applicable']);

interface FormState extends Omit<AdminEventFormPayload, 'eventDate' | 'eventEndDate' | 'recurrence' | 'applyToSeries'> {
  date: string; // YYYY-MM-DD (local)
  startTime: string; // HH:mm (local)
  endTime: string; // HH:mm (local)
  recurrence: EventRecurrenceForm | null;
  applyToSeries: boolean;
}

const emptyForm = (city: string | null): FormState => ({
  title: '',
  category: '',
  visibility: 'public',
  date: '',
  startTime: '',
  endTime: '',
  city,
  venue: '',
  chapterId: null,
  groupId: null,
  tableArrangement: null,
  numTables: null,
  maxCapacity: null,
  isPaid: false,
  registrationFee: 0,
  allowNonMemberRegistration: true,
  nonMemberFee: null,
  description: null,
  videoUrl: null,
  photos: [],
  promoteFacebook: false,
  promoteMeetup: false,
  promoteEventbrite: false,
  ticketTypes: [],
  sponsorshipTiers: [],
  promoCodes: [],
  recurrence: null,
  applyToSeries: false,
});

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const toLocalTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface AdminEventWizardModalProps {
  /** Omit to create a new event. */
  eventId?: string | null;
  chamberSlug?: string;
  onClose: () => void;
  onSaved: (eventId: string) => void;
}

/**
 * Prompt 04.6 — Admin Event Creation / Edit wizard (modal, per the reference UI).
 * Every option list comes from the chamber's data via GET /admin/events/form-options.
 */
export const AdminEventWizardModal: React.FC<AdminEventWizardModalProps> = ({ eventId, chamberSlug, onClose, onSaved }) => {
  const isEdit = !!eventId;
  const draftKey = `admin-event-draft:${chamberSlug || 'current'}`;

  const [options, setOptions] = useState<EventFormOptions | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [series, setSeries] = useState<{ total: number; recurrenceLabel: string | null } | null>(null);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load options (+ the event when editing).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [opts, cur] = await Promise.all([fetchEventFormOptions(chamberSlug), fetchChamberCurrency(chamberSlug)]);
        if (cancelled) return;
        setOptions(opts);
        setCurrency(cur);
        if (eventId) {
          const ev = await fetchAdminEventForEdit(eventId, chamberSlug);
          if (cancelled) return;
          setSeries(ev.series);
          setRegisteredCount(ev.registeredCount);
          setForm({
            ...emptyForm(opts.defaultCity),
            ...ev,
            date: toLocalDate(ev.eventDate),
            startTime: toLocalTime(ev.eventDate),
            endTime: ev.eventEndDate ? toLocalTime(ev.eventEndDate) : '',
            recurrence: null,
            applyToSeries: false,
          });
        } else {
          let restored: FormState | null = null;
          try {
            const raw = localStorage.getItem(draftKey);
            restored = raw ? (JSON.parse(raw) as FormState) : null;
          } catch {
            restored = null;
          }
          const base = { ...emptyForm(opts.defaultCity), chapterId: opts.lockedChapterId };
          setForm(restored ? { ...base, ...restored, chapterId: opts.lockedChapterId ?? restored.chapterId } : base);
          setDraftRestored(!!restored);
        }
      } catch (err: any) {
        if (!cancelled) setLoadError(err.message || 'Could not load the event form');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, chamberSlug, draftKey]);

  // §15: auto-save the create form as a local draft.
  useEffect(() => {
    if (isEdit || !form) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(form));
      } catch {
        /* storage unavailable — draft simply isn't kept */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [form, isEdit, draftKey]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => setForm((f) => (f ? { ...f, [key]: val } : f));

  const startDate = useMemo(() => {
    if (!form?.date) return null;
    const d = new Date(`${form.date}T${form.startTime || '00:00'}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [form?.date, form?.startTime]);

  const discardDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    setForm({ ...emptyForm(options?.defaultCity ?? null), chapterId: options?.lockedChapterId ?? null });
    setDraftRestored(false);
  };

  const handlePhotos = async (files: FileList | null) => {
    if (!files?.length || !form) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const res = await uploadEventPhoto(file, chamberSlug);
        urls.push(res.url);
      }
      setForm((f) => (f ? { ...f, photos: [...f.photos, ...urls] } : f));
    } catch (err: any) {
      toast.error(err.message || 'Photo upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!startDate) return toast.error('Please choose a date');
    if (!form.venue.trim()) return toast.error('Venue / location is required');
    let end: Date | null = null;
    if (form.endTime) {
      end = new Date(`${form.date}T${form.endTime}`);
      if (end <= startDate) return toast.error('End time must be after the start time');
    }

    const { date: _d, startTime: _s, endTime: _e, recurrence, applyToSeries, ...rest } = form;
    const payload: AdminEventFormPayload = {
      ...rest,
      eventDate: startDate.toISOString(),
      eventEndDate: end ? end.toISOString() : null,
      registrationFee: form.isPaid ? form.registrationFee : 0,
      nonMemberFee: form.isPaid && form.allowNonMemberRegistration ? form.nonMemberFee : null,
      numTables: form.tableArrangement && !NO_TABLE_LAYOUTS.has(form.tableArrangement) ? form.numTables : null,
      ticketTypes: form.ticketTypes.map((t) => ({ ...t, price: form.isPaid ? t.price : 0 })),
      sponsorshipTiers: form.sponsorshipTiers.map((t) => ({ ...t, benefits: t.benefits.map((b) => b.trim()).filter(Boolean) })),
      promoCodes: form.isPaid ? form.promoCodes : [],
      ...(isEdit
        ? { applyToSeries }
        : { recurrence: recurrence ? { ...recurrence, tzOffsetMinutes: startDate.getTimezoneOffset() } : null }),
    };

    setSaving(true);
    try {
      if (isEdit && eventId) {
        const res = await updateAdminEvent(eventId, payload, chamberSlug);
        toast.success(res.updatedOccurrences > 1 ? `Updated all ${res.updatedOccurrences} events in this series` : 'Event updated');
        onSaved(eventId);
      } else {
        const res = await createAdminEvent(payload, chamberSlug);
        try {
          localStorage.removeItem(draftKey);
        } catch {
          /* ignore */
        }
        toast.success(
          res.occurrenceIds.length > 1
            ? `Event series "${res.title}" created — ${res.occurrenceIds.length} occurrences`
            : `Event "${res.title}" created`
        );
        onSaved(res.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not save the event');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full h-10 px-3 rounded-xl border border-border bg-background text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-60';
  const labelCls = 'block text-xs font-semibold text-foreground mb-1';
  const sectionCls = 'pt-5 mt-5 border-t border-border space-y-3';
  const lockedChapter = options?.lockedChapterId
    ? options.chapters.find((c) => c.id === options.lockedChapterId)?.name || null
    : null;
  const needsTables = !!form?.tableArrangement && !NO_TABLE_LAYOUTS.has(form.tableArrangement);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-wizard-title"
        className="relative w-full max-w-[680px] max-h-[85vh] flex flex-col bg-card rounded-2xl border border-border shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 id="event-wizard-title" className="text-base font-bold text-foreground">
            {isEdit ? `Edit — ${form?.title || 'Event'}` : 'Create Event'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {loadError ? (
          <div className="p-6 text-sm text-red-600">{loadError}</div>
        ) : !form || !options ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
            <div className="overflow-y-auto px-6 py-5">
              {draftRestored && (
                <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  Unsaved draft restored.
                  <button type="button" onClick={discardDraft} className="font-semibold underline cursor-pointer">
                    Discard
                  </button>
                </div>
              )}

              {/* 1. Event details */}
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Event Details</p>
              <div className="space-y-3">
                <div>
                  <label htmlFor="ev-title" className={labelCls}>Event Title *</label>
                  <input id="ev-title" required minLength={3} maxLength={200} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Small Business Funding Workshop" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="ev-category" className={labelCls}>Event Category *</label>
                  <input id="ev-category" required minLength={2} maxLength={50} list="ev-category-options" value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Choose or type a category" className={inputCls} />
                  <datalist id="ev-category-options">
                    {options.categories.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <span className={labelCls}>Visibility</span>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Visibility">
                    {([
                      ['public', 'Public', 'Visible in event lists for members and guests'],
                      ['staff_only', 'Staff Only', 'Visible only to chamber staff & admin users'],
                    ] as const).map(([key, title, sub]) => (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={form.visibility === key}
                        onClick={() => set('visibility', key)}
                        className={`text-left rounded-xl border p-3 cursor-pointer ${form.visibility === key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}
                      >
                        <span className="block text-xs font-semibold text-foreground">{title}</span>
                        <span className="block text-[11px] text-muted-foreground mt-0.5">{sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="ev-date" className={labelCls}><CalendarDays size={12} className="inline mr-1" />Date *</label>
                    <input id="ev-date" type="date" required value={form.date} onChange={(e) => set('date', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="ev-start" className={labelCls}>Start time *</label>
                    <input id="ev-start" type="time" required value={form.startTime} onChange={(e) => set('startTime', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="ev-end" className={labelCls}>End time</label>
                    <input id="ev-end" type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} className={inputCls} />
                  </div>
                </div>
                {/* New events can repeat; an existing series only shows its rule (read-only). */}
                {(!isEdit || series) && (
                  <RecurrenceConfigurator
                    value={form.recurrence}
                    onChange={(v) => set('recurrence', v)}
                    startDate={startDate}
                    seriesLabel={isEdit && series ? series.recurrenceLabel || '' : null}
                  />
                )}
              </div>

              {/* 2. Location & seating */}
              <div className={sectionCls}>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Location & Seating</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ev-city" className={labelCls}><MapPin size={12} className="inline mr-1" />City</label>
                    <input id="ev-city" list="ev-city-options" maxLength={100} value={form.city || ''} onChange={(e) => set('city', e.target.value || null)} className={inputCls} />
                    <datalist id="ev-city-options">
                      {options.cities.map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                  {(options.chapters.length > 0 || lockedChapter) && (
                    <div>
                      <label htmlFor="ev-chapter" className={labelCls}>Chapter</label>
                      {lockedChapter ? (
                        <div className="h-10 px-3 flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                          <Lock size={12} /> Only visible under <span className="font-semibold text-foreground">{lockedChapter}</span>
                        </div>
                      ) : (
                        <select id="ev-chapter" value={form.chapterId || ''} onChange={(e) => set('chapterId', e.target.value || null)} className={inputCls}>
                          <option value="">All chapters (chamber-wide)</option>
                          {options.chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                  {options.groups.length > 0 && (
                    <div className="sm:col-span-2">
                      <label htmlFor="ev-group" className={labelCls}>Assign to Group</label>
                      <select id="ev-group" value={form.groupId || ''} onChange={(e) => set('groupId', e.target.value || null)} className={inputCls}>
                        <option value="">None</option>
                        {options.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Once assigned, this group's admin can manage its attendees & check-in — but can't create new events.
                      </p>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label htmlFor="ev-venue" className={labelCls}>Venue / Location *</label>
                    <input id="ev-venue" required minLength={2} maxLength={200} value={form.venue} onChange={(e) => set('venue', e.target.value)} placeholder="e.g. Chamber Hall, 210 Congress Ave" className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="ev-layout" className={labelCls}>Table Arrangement</label>
                    <select id="ev-layout" value={form.tableArrangement || ''} onChange={(e) => set('tableArrangement', e.target.value || null)} className={inputCls}>
                      <option value="">Not specified</option>
                      {TABLE_ARRANGEMENTS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  {needsTables && (
                    <div>
                      <label htmlFor="ev-tables" className={labelCls}>Number of Tables</label>
                      <input id="ev-tables" type="number" min={1} value={form.numTables ?? ''} onChange={(e) => set('numTables', e.target.value ? Math.max(1, Number(e.target.value)) : null)} className={inputCls} />
                    </div>
                  )}
                  <div>
                    <label htmlFor="ev-capacity" className={labelCls}><Users size={12} className="inline mr-1" />Max Capacity</label>
                    <input id="ev-capacity" type="number" min={Math.max(1, registeredCount)} value={form.maxCapacity ?? ''} placeholder="Unlimited" onChange={(e) => set('maxCapacity', e.target.value ? Math.max(1, Number(e.target.value)) : null)} className={inputCls} />
                    {registeredCount > 0 && <p className="text-[11px] text-muted-foreground mt-1">{registeredCount} already registered</p>}
                  </div>
                </div>
              </div>

              {/* 3. Fee, tickets, sponsorship, promo, description */}
              <div className={sectionCls}>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fee & Description</p>
                <div>
                  <span className={labelCls}>Registration Fee</span>
                  <div className="inline-flex rounded-xl border border-border p-0.5 bg-muted/40" role="radiogroup" aria-label="Registration fee">
                    {([false, true] as const).map((paid) => (
                      <button key={String(paid)} type="button" role="radio" aria-checked={form.isPaid === paid} onClick={() => set('isPaid', paid)} className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${form.isPaid === paid ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground'}`}>
                        {paid ? 'Paid' : 'Free'}
                      </button>
                    ))}
                  </div>
                  {form.isPaid && (
                    <div className="mt-2 flex items-center gap-2">
                      {currency && <span className="text-xs text-muted-foreground">{currency}</span>}
                      <input aria-label="Member registration fee" type="number" min={0} step="0.01" value={form.registrationFee || ''} placeholder="0.00" onChange={(e) => set('registrationFee', Math.max(0, Number(e.target.value) || 0))} className={`${inputCls} max-w-[160px]`} />
                      <span className="text-[11px] text-muted-foreground">Member fee (used when no ticket types are added)</span>
                    </div>
                  )}
                </div>

                {form.isPaid && (
                  <PromoCodesBuilder value={form.promoCodes} onChange={(v) => set('promoCodes', v)} currency={currency} />
                )}
                <TicketTiersBuilder value={form.ticketTypes} onChange={(v) => set('ticketTypes', v)} isPaid={form.isPaid} currency={currency} />
                <SponsorshipTiersBuilder value={form.sponsorshipTiers} onChange={(v) => set('sponsorshipTiers', v)} currency={currency} />

                <div className="rounded-xl border border-border p-3 space-y-2">
                  <label className="flex items-start justify-between gap-3 cursor-pointer">
                    <span>
                      <span className="block text-xs font-semibold text-foreground">Allow Non-Member Registration</span>
                      <span className="block text-[11px] text-muted-foreground">Let the public register from the chamber's guest website.</span>
                    </span>
                    <input type="checkbox" checked={form.allowNonMemberRegistration} onChange={(e) => set('allowNonMemberRegistration', e.target.checked)} className="mt-1" />
                  </label>
                  {form.allowNonMemberRegistration && form.isPaid && (
                    <div className="flex items-center gap-2">
                      {currency && <span className="text-xs text-muted-foreground">{currency}</span>}
                      <input aria-label="Non-member fee" type="number" min={0} step="0.01" value={form.nonMemberFee ?? ''} placeholder="Same as members" onChange={(e) => set('nonMemberFee', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))} className={`${inputCls} max-w-[160px]`} />
                      <span className="text-[11px] text-muted-foreground">Non-member fee (optional)</span>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="ev-desc" className={labelCls}>Description / Agenda</label>
                  <textarea id="ev-desc" rows={5} maxLength={20000} value={form.description || ''} onChange={(e) => set('description', e.target.value || null)} placeholder="Share what attendees can expect, agenda highlights, or special instructions…" className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none" />
                </div>
              </div>

              {/* 4. Media */}
              <div className={sectionCls}>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Photos & Video</p>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => { handlePhotos(e.target.files); e.target.value = ''; }} />
                <div className="flex flex-wrap gap-2">
                  {form.photos.map((url, i) => (
                    <div key={url} className="relative w-24 h-16 rounded-lg overflow-hidden border border-border">
                      <img src={apiUrl(url)} alt={`Event photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button type="button" aria-label="Remove photo" onClick={() => set('photos', form.photos.filter((_, j) => j !== i))} className="absolute top-1 right-1 p-0.5 rounded bg-black/60 cursor-pointer">
                        <X size={11} className="text-white" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-24 h-16 rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground hover:bg-muted/40 cursor-pointer disabled:opacity-50">
                    {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                    Add image
                  </button>
                </div>
                <div>
                  <label htmlFor="ev-video" className={labelCls}>Promo video URL</label>
                  <input id="ev-video" type="url" maxLength={500} value={form.videoUrl || ''} onChange={(e) => set('videoUrl', e.target.value || null)} placeholder="https://" className={inputCls} />
                </div>
              </div>

              {/* 5. Promote */}
              <div className={sectionCls}>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Promote</p>
                <p className="text-[11px] text-muted-foreground">Mark where this event should be promoted.</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['promoteFacebook', 'Facebook'],
                    ['promoteMeetup', 'Meetup'],
                    ['promoteEventbrite', 'Eventbrite'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs cursor-pointer ${form[key] ? 'border-primary bg-primary/5' : 'border-border'}`}>
                      <input type="checkbox" checked={form[key]} onChange={(e) => set(key, e.target.checked)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {isEdit && series && (
                <label className="mt-5 flex items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-900 p-3 cursor-pointer">
                  <input type="checkbox" checked={form.applyToSeries} onChange={(e) => set('applyToSeries', e.target.checked)} className="mt-0.5" />
                  <span>
                    <span className="block text-xs font-semibold text-foreground">Apply these changes to all events in this series</span>
                    <span className="block text-[11px] text-muted-foreground">
                      Each occurrence keeps its own date — everything else updates across all {series.total} events.
                    </span>
                  </span>
                </label>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted cursor-pointer disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={saving || uploading} className="px-5 py-2 rounded-xl bg-[#0A2540] hover:bg-[#102A43] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60">
                {saving && <Loader2 size={13} className="animate-spin" />}
                {isEdit ? 'Save changes' : 'Publish Event'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
