import React, { useEffect, useState } from 'react';
import { Loader2, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { fetchMentorProfile, saveMentorProfile, type MentorProfile } from '../services/mentorship.api';

interface MentorProfileEditorProps {
  /** Existing tags across the chamber, offered as suggestions (OD-101, dynamic). */
  suggestions: string[];
  onSaved: () => void;
}

const MAX_TAGS = 10;

/** §5 Tab 4 — mentor status, expertise tags, bio, capacity. Instant, no review (OD-102). */
export const MentorProfileEditor: React.FC<MentorProfileEditorProps> = ({ suggestions, onSaved }) => {
  const [profile, setProfile] = useState<MentorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMentor, setIsMentor] = useState(false);
  const [available, setAvailable] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [years, setYears] = useState('0');
  const [bio, setBio] = useState('');
  const [maxMentees, setMaxMentees] = useState('3');
  const [saving, setSaving] = useState(false);

  const apply = (p: MentorProfile) => {
    setProfile(p);
    setIsMentor(p.is_mentor);
    // Not a mentor → nothing is being accepted; switching mentorship on turns it back on.
    setAvailable(p.is_mentor && p.is_available);
    setTags(p.expertise_areas);
    setYears(String(p.years_of_experience));
    setBio(p.bio || '');
    setMaxMentees(String(p.max_mentees));
  };

  useEffect(() => {
    fetchMentorProfile().then(apply).catch((err) => setError(err.message || 'Failed to load your profile'));
  }, []);

  const addTag = (raw: string) => {
    const t = raw.trim().replace(/,+$/, '').trim();
    if (!t) return;
    if (t.length < 2) return toast.error('Each expertise tag needs at least 2 characters');
    if (tags.some((x) => x.toLowerCase() === t.toLowerCase())) return setTagInput('');
    if (tags.length >= MAX_TAGS) return toast.error(`Maximum ${MAX_TAGS} expertise tags`);
    setTags((all) => [...all, t.slice(0, 50)]);
    setTagInput('');
  };

  /** Saves the form; toggles pass their new value so they persist immediately (no separate Save click). */
  const save = async (overrides: { isMentor?: boolean; available?: boolean } = {}): Promise<boolean> => {
    const nextMentor = overrides.isMentor ?? isMentor;
    const nextAvailable = overrides.available ?? available;
    const y = Number(years);
    const m = Number(maxMentees);
    if (!Number.isInteger(y) || y < 0 || y > 70) {
      toast.error('Years of experience must be between 0 and 70');
      return false;
    }
    if (!Number.isInteger(m) || m < 1 || m > 20) {
      toast.error('Max mentees must be between 1 and 20');
      return false;
    }
    const pending = tagInput.trim();
    const allTags = pending && !tags.some((x) => x.toLowerCase() === pending.toLowerCase()) && pending.length >= 2 ? [...tags, pending] : tags;
    if (nextMentor && allTags.length === 0) {
      toast.error('Add at least one expertise area');
      return false;
    }
    setSaving(true);
    try {
      const saved = await saveMentorProfile({
        is_mentor: nextMentor,
        expertise_areas: allTags.slice(0, MAX_TAGS),
        years_of_experience: y,
        bio: bio.trim() || null,
        max_mentees: m,
        is_available: nextAvailable,
      });
      apply(saved);
      setTagInput('');
      toast.success(
        !nextMentor ? 'You are no longer listed as a mentor' : overrides.available === false ? 'Paused — not accepting new mentees' : 'Mentor profile saved'
      );
      onSaved();
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleMentor = async (next: boolean) => {
    const prevAvailable = available;
    setIsMentor(next);
    setAvailable(next);
    // First-time mentors still need expertise etc. — they finish the form and press Save.
    if (next && !profile?.is_mentor && tags.length === 0 && !tagInput.trim()) {
      toast.info('Add your expertise areas, then press Save profile');
      return;
    }
    if (!(await save({ isMentor: next, available: next }))) {
      setIsMentor(!next);
      setAvailable(prevAvailable);
    }
  };

  const toggleAvailable = async (next: boolean) => {
    setAvailable(next);
    if (!profile?.is_mentor) return;
    if (!(await save({ available: next }))) setAvailable(!next);
  };

  if (error) return <div className="rounded-xl border border-border bg-card p-6 text-sm text-red-600">{error}</div>;
  if (!profile) return <div className="rounded-xl border border-border bg-card p-6 h-64 animate-pulse" />;

  const unusedSuggestions = suggestions.filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase())).slice(0, 12);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-sm">Offer mentorship</p>
          <p className="text-xs text-muted-foreground">List yourself in the chamber's mentor directory.</p>
        </div>
        <Switch checked={isMentor} disabled={saving} onCheckedChange={toggleMentor} aria-label="Offer mentorship" />
      </div>

      {profile.is_mentor && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground p-3 rounded-lg bg-muted/40">
          <span>Active mentees: <b className="text-foreground">{profile.active_mentees_count}/{profile.max_mentees}</b></span>
          <span className="flex items-center gap-1">
            <Star size={12} className="fill-amber-500 text-amber-500" />
            {profile.rating !== null ? `${profile.rating.toFixed(1)} (${profile.rating_count})` : 'No ratings yet'}
          </span>
        </div>
      )}

      <div className={isMentor ? 'space-y-5' : 'space-y-5 opacity-50 pointer-events-none'} aria-disabled={!isMentor}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-sm">Accepting new mentees</p>
            <p className="text-xs text-muted-foreground">Turn off to pause new requests without leaving the program.</p>
          </div>
          <Switch checked={available} disabled={saving} onCheckedChange={toggleAvailable} aria-label="Accepting new mentees" />
        </div>

        <div>
          <label htmlFor="mentor-tags" className="text-xs font-medium text-muted-foreground mb-1.5 block">Areas of expertise * ({tags.length}/{MAX_TAGS})</label>
          <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-border bg-background min-h-[42px]">
            {tags.map((t) => (
              <span key={t} className="pl-2.5 pr-1 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary flex items-center gap-1">
                {t}
                <button type="button" aria-label={`Remove ${t}`} onClick={() => setTags((all) => all.filter((x) => x !== t))} className="rounded-full hover:bg-primary/20 p-0.5">
                  <X size={11} />
                </button>
              </span>
            ))}
            <input
              id="mentor-tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag(tagInput);
                } else if (e.key === 'Backspace' && !tagInput && tags.length) {
                  setTags((all) => all.slice(0, -1));
                }
              }}
              onBlur={() => tagInput.trim() && addTag(tagInput)}
              placeholder={tags.length ? '' : 'Type an area and press Enter'}
              className="flex-1 min-w-[140px] bg-transparent text-sm outline-none px-1"
            />
          </div>
          {unusedSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {unusedSuggestions.map((s) => (
                <button key={s} type="button" onClick={() => addTag(s)} className="px-2 py-0.5 rounded-full text-[11px] border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary">
                  + {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="mentor-years" className="text-xs font-medium text-muted-foreground mb-1.5 block">Years of experience *</label>
            <input id="mentor-years" type="number" min={0} max={70} value={years} onChange={(e) => setYears(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label htmlFor="mentor-max" className="text-xs font-medium text-muted-foreground mb-1.5 block">Max concurrent mentees *</label>
            <input id="mentor-max" type="number" min={1} max={20} value={maxMentees} onChange={(e) => setMaxMentees(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary" />
          </div>
        </div>

        <div>
          <label htmlFor="mentor-bio" className="text-xs font-medium text-muted-foreground mb-1.5 block">Short bio</label>
          <textarea id="mentor-bio" value={bio} onChange={(e) => setBio(e.target.value.slice(0, 2000))} rows={4} placeholder="What can you help other members with?" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary resize-y" />
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={() => save()} disabled={saving} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
          {saving && <Loader2 size={14} className="animate-spin" />} Save profile
        </button>
      </div>
    </div>
  );
};
