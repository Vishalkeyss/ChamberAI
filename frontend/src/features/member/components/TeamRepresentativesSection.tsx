import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Pencil,
  Eye,
  Shield,
  X,
  Users,
  Loader2,
  CheckCircle2,
  CalendarDays,
  FileText,
  UserCheck,
  Phone,
  Linkedin,
  Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchTeamRepresentatives,
  inviteRepresentative,
  updateRepresentative,
  removeRepresentative,
  setPrimaryContact,
  type TeamRepresentative,
  type InviteRepresentativePayload,
} from '../services/business-profile.api';
import { EMAIL_PLACEHOLDER, PHONE_PLACEHOLDER } from '@/lib/placeholders';

const ACCESS_LEVEL_CARDS: Array<{
  key: TeamRepresentative['accessLevel'];
  title: string;
  desc: string;
}> = [
  {
    key: 'full_access',
    title: 'Full Access',
    desc: 'Everything the company can see — membership, events, billing, referrals',
  },
  {
    key: 'billing_only',
    title: 'Billing Only',
    desc: 'Restricted to invoices & payments — nothing else. For an accounts/finance contact.',
  },
  {
    key: 'events_networking',
    title: 'Events & Networking',
    desc: 'Directory, events, 1:1 meetings, referrals & messages — no billing. For a sales/networking rep who represents the company at chamber events.',
  },
  {
    key: 'business_development',
    title: 'Business Development',
    desc: 'CRM, tasks, marketplace listings & job postings — no billing. For a BD/marketing rep managing leads and listings.',
  },
];

export interface TeamRepresentativesSectionProps {
  businessName?: string;
}

export const TeamRepresentativesSection: React.FC<TeamRepresentativesSectionProps> = ({
  businessName = 'your company',
}) => {
  const [representatives, setRepresentatives] = useState<TeamRepresentative[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Invite Modal State
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [accessLevel, setAccessLevel] =
    useState<InviteRepresentativePayload['accessLevel']>('events_networking');

  // Preview Portal Modal State
  const [previewRep, setPreviewRep] = useState<TeamRepresentative | null>(null);

  // Edit Rep Modal State (matching visual reference)
  const [editRep, setEditRep] = useState<TeamRepresentative | null>(null);
  const [editName, setEditName] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhones, setEditPhones] = useState<string[]>(['']);
  const [editLinkedin, setEditLinkedin] = useState('');
  const [editOtherLink, setEditOtherLink] = useState('');
  const [editAccessLevel, setEditAccessLevel] =
    useState<TeamRepresentative['accessLevel']>('full_access');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Primary Contact Transfer Modal
  const [transferTarget, setTransferTarget] = useState<TeamRepresentative | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<TeamRepresentative | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadTeam = async () => {
    try {
      setIsLoading(true);
      const data = await fetchTeamRepresentatives();
      setRepresentatives(data);
    } catch (err: any) {
      console.error('Failed to load team representatives', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTeam();
  }, []);

  const handleOpenInvite = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setJobTitle('');
    setAccessLevel('events_networking');
    setIsInviteOpen(true);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error('First name, last name, and email are required');
      return;
    }

    try {
      setIsInviting(true);
      await inviteRepresentative({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        jobTitle: jobTitle.trim() || undefined,
        accessLevel,
      });

      toast.success(`${firstName} ${lastName} added to your team — invitation email dispatched!`);
      setIsInviteOpen(false);
      await loadTeam();
    } catch (err: any) {
      toast.error(err.message || 'Failed to invite team representative');
    } finally {
      setIsInviting(false);
    }
  };

  const handleOpenEdit = (rep: TeamRepresentative) => {
    setEditRep(rep);
    setEditName(rep.name || '');
    setEditTitle(rep.jobTitle || (rep.isPrimaryContact ? 'Business Owner' : 'Representative'));
    setEditEmail(rep.email || '');
    setEditPhones(rep.phones && rep.phones.length > 0 ? rep.phones : ['']);
    setEditLinkedin(rep.socials?.linkedin || '');
    setEditOtherLink(rep.socials?.other || '');
    setEditAccessLevel(
      rep.accessLevel || (rep.isPrimaryContact ? 'full_access' : 'events_networking')
    );
  };

  const handleSaveEdit = async () => {
    if (!editRep) return;
    if (!editName.trim()) {
      toast.error('Full Name is required');
      return;
    }

    try {
      setIsSavingEdit(true);
      const cleanPhones = editPhones.map((p) => p.trim()).filter(Boolean);
      await updateRepresentative(editRep.id, {
        name: editName.trim(),
        jobTitle: editTitle.trim() || undefined,
        phones: cleanPhones,
        socials: {
          linkedin: editLinkedin.trim() || undefined,
          other: editOtherLink.trim() || undefined,
        },
        accessLevel: editAccessLevel,
      });

      setRepresentatives((prev) =>
        prev.map((r) =>
          r.id === editRep.id
            ? {
                ...r,
                name: editName.trim(),
                jobTitle: editTitle.trim() || null,
                phones: cleanPhones,
                socials: {
                  linkedin: editLinkedin.trim() || undefined,
                  other: editOtherLink.trim() || undefined,
                },
                accessLevel: editAccessLevel,
              }
            : r
        )
      );

      toast.success(`${editName.trim()}'s details updated`);
      setEditRep(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update representative details');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmTransferPrimary = async () => {
    if (!transferTarget) return;

    try {
      setIsTransferring(true);
      await setPrimaryContact(transferTarget.id);
      toast.success(`${transferTarget.name} is now designated as the Primary Contact`);
      setTransferTarget(null);
      await loadTeam();
    } catch (err: any) {
      toast.error(err.message || 'Failed to transfer primary contact');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      await removeRepresentative(deleteTarget.id);
      toast.success(`${deleteTarget.name} removed from your team`);
      setDeleteTarget(null);
      await loadTeam();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove representative');
    } finally {
      setIsDeleting(false);
    }
  };

  const getAccessLevelLabel = (level: TeamRepresentative['accessLevel']) => {
    switch (level) {
      case 'full_access':
        return 'Full Access';
      case 'billing_only':
        return 'Billing Only';
      case 'events_networking':
      default:
        return 'Events & Networking';
    }
  };

  return (
    <div className="bg-white dark:bg-card text-card-foreground rounded-2xl border border-gray-100 dark:border-border p-6 shadow-xs md:col-span-3">
      {/* Section Header matching Image 2 */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between sm:flex-wrap mb-5 gap-3">
        <div className="min-w-0 sm:flex-1">
          <h3 className="text-xl font-bold text-[#0A0F1C] dark:text-[#F1F5F9] tracking-tight">
            Team & Reps
          </h3>
          <p className="text-sm text-[#4B5563] dark:text-[#94A6C2] mt-1">
            Add teammates from your company so they can log in under {businessName} too
          </p>
        </div>
        <div className="sm:ml-auto shrink-0">
          <Button
            type="button"
            onClick={handleOpenInvite}
            variant="outline"
            size="sm"
            className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#0A0F1C] dark:text-[#F1F5F9] border border-gray-200 dark:border-slate-700 text-sm font-medium flex items-center gap-1.5 h-9 px-4 rounded-lg shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Team Member</span>
          </Button>
        </div>
      </div>

      {/* Roster Body */}
      <div>
        {isLoading ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">Loading team representatives...</p>
          </div>
        ) : representatives.length === 0 ? (
          <div className="p-8 rounded-xl bg-gray-50/70 dark:bg-[#1E3352]/30 border border-dashed border-gray-200 dark:border-[#26406A] text-center">
            <Users className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700 dark:text-[#F1F5F9]">
              Only your login is active for this company.
            </p>
            <p className="text-xs text-gray-500 dark:text-[#94A6C2] mt-1 max-w-md mx-auto">
              Add a teammate to give them their own chamber access for events, directory management, or billing.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenInvite}
              className="mt-4 text-xs font-semibold gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Team Member</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {representatives.map((rep) => {
              const initials = (rep.name || '?')
                .trim()
                .split(' ')
                .filter(Boolean)
                .map((w) => w[0].toUpperCase())
                .slice(0, 2)
                .join('');

              const roleDisplay =
                rep.jobTitle || (rep.isPrimaryContact ? 'Business Owner' : 'Representative');

              return (
                <div
                  key={rep.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border transition"
                  style={{ background: '#F9FAFB', borderColor: '#EEF0F2' }}
                >
                  {/* Left: Avatar + Details */}
                  <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto sm:flex-1">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                      style={{ background: '#0B2447' }}
                    >
                      {rep.avatarUrl ? (
                        <img
                          src={rep.avatarUrl}
                          alt={rep.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        initials || '?'
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold break-words sm:truncate text-[#0A0F1C] dark:text-slate-100">
                        {rep.name}
                        {roleDisplay ? (
                          <span className="font-normal text-[#4B5563] dark:text-slate-400">
                            {' '}— {roleDisplay}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs break-words sm:truncate text-[#4B5563] dark:text-slate-400 mt-0.5">
                        {rep.email} <span className="mx-1">·</span>{' '}
                        {rep.isPrimaryContact ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#92400E] dark:text-amber-400">
                            ★ Primary Contact
                          </span>
                        ) : (
                          <span>{getAccessLevelLabel(rep.accessLevel)}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Right: Status Badge & Action Icons */}
                  <div className="flex items-center justify-end gap-1.5 shrink-0 w-full sm:w-auto pl-0 sm:pl-3">
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={
                        rep.status === 'invited'
                          ? { background: '#FEF3C7', color: '#92400E' }
                          : { background: '#D1FAE5', color: '#047857' }
                      }
                    >
                      {rep.status === 'invited' ? 'Invited' : 'Active'}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(rep)}
                      className="p-1.5 text-[#4B5563] hover:text-[#0A0F1C] dark:text-slate-400 dark:hover:text-slate-200 transition rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-800"
                      title="Edit details"
                      aria-label={`Edit ${rep.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewRep(rep)}
                      className="p-1.5 text-[#4B5563] hover:text-[#0A0F1C] dark:text-slate-400 dark:hover:text-slate-200 transition rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-800"
                      title="Preview their portal"
                      aria-label={`Preview portal for ${rep.name}`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {!rep.isPrimaryContact && (
                      <button
                        type="button"
                        onClick={() => setTransferTarget(rep)}
                        className="p-1.5 text-[#4B5563] hover:text-[#0A0F1C] dark:text-slate-400 dark:hover:text-slate-200 transition rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-800"
                        title="Make Primary Contact"
                        aria-label={`Make ${rep.name} primary contact`}
                      >
                        <Shield className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (rep.isPrimaryContact) {
                          toast.error(
                            'Make someone else Primary Contact first — a company always needs exactly one'
                          );
                          return;
                        }
                        setDeleteTarget(rep);
                      }}
                      className="p-1.5 text-[#991B1B] hover:text-red-700 transition rounded-md hover:bg-red-50 dark:hover:bg-red-950/30"
                      title="Remove"
                      aria-label={`Remove ${rep.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="w-full max-w-[480px] max-h-[88vh] overflow-x-hidden overflow-y-auto p-6 rounded-[14px] sm:rounded-[14px] border-border bg-white dark:bg-card text-card-foreground shadow-[0px_20px_60px_rgba(0,0,0,0.3)]">
          <DialogHeader className="pb-3 border-b border-border/60">
            <DialogTitle className="text-lg font-bold">Add a Team Member</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              They&apos;ll get their own login under {businessName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInviteSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">First Name *</Label>
                <Input
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Priya"
                  className="mt-1 text-sm bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Last Name *</Label>
                <Input
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Raman"
                  className="mt-1 text-sm bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Email Address *</Label>
              <Input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={EMAIL_PLACEHOLDER}
                className="mt-1 text-sm bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Designation / Title</Label>
              <Input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Operations Manager"
                className="mt-1 text-sm bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Portal Access Level</Label>
              <RadioGroup
                value={accessLevel}
                onValueChange={(val) =>
                  setAccessLevel(val as InviteRepresentativePayload['accessLevel'])
                }
                className="mt-2 space-y-2"
              >
                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <RadioGroupItem value="events_networking" id="access_events" className="mt-1" />
                  <div className="text-xs">
                    <Label htmlFor="access_events" className="font-semibold cursor-pointer">
                      Events & Networking
                    </Label>
                    <p className="text-slate-500 mt-0.5">
                      Can register for chamber events and exchange business cards.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <RadioGroupItem value="billing_only" id="access_billing" className="mt-1" />
                  <div className="text-xs">
                    <Label htmlFor="access_billing" className="font-semibold cursor-pointer">
                      Billing & Invoices
                    </Label>
                    <p className="text-slate-500 mt-0.5">
                      Can view chamber invoices and manage payment methods.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <RadioGroupItem value="full_access" id="access_full" className="mt-1" />
                  <div className="text-xs">
                    <Label htmlFor="access_full" className="font-semibold cursor-pointer">
                      Full Access
                    </Label>
                    <p className="text-slate-500 mt-0.5">
                      Full portal privileges matching primary contact.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <DialogFooter className="pt-3 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsInviteOpen(false)}
                disabled={isInviting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isInviting}
                className="bg-[#0B2447] hover:bg-[#1E3A5F] text-white font-semibold"
              >
                {isInviting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    <span>Sending Invite...</span>
                  </>
                ) : (
                  <span>Send Invitation</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Rep Modal */}
      <Dialog open={!!editRep} onOpenChange={(open) => !open && setEditRep(null)}>
        <DialogContent className="w-full max-w-[480px] max-h-[88vh] overflow-x-hidden overflow-y-auto p-6 rounded-[14px] sm:rounded-[14px] border-border bg-white dark:bg-card text-card-foreground shadow-[0px_20px_60px_rgba(0,0,0,0.3)] modal-scrollbar">
          <DialogHeader className="pb-3 border-b border-border/60">
            <DialogTitle className="text-xl font-bold tracking-tight text-gray-900 dark:text-slate-100">
              Edit {editRep?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Update their contact details, phone numbers and social links
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Full Name */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Full Name*
              </Label>
              <Input
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Priya Raman"
                className="mt-1 text-sm bg-white dark:bg-slate-900"
              />
            </div>

            {/* Designation & Email */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Designation / Title
                </Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. Operations Manager"
                  className="mt-1 text-sm bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Email
                </Label>
                <Input placeholder={EMAIL_PLACEHOLDER}
                  type="email"
                  value={editEmail}
                  readOnly
                  disabled
                  title="Email is the sign-in identity and cannot be changed here"
                  className="mt-1 text-sm bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            {/* Phone Numbers (optional) */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Phone Numbers (optional)
              </Label>
              <div className="space-y-2 mt-1.5">
                {editPhones.map((ph, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        value={ph}
                        onChange={(e) => {
                          const updated = [...editPhones];
                          updated[idx] = e.target.value;
                          setEditPhones(updated);
                        }}
                        placeholder={PHONE_PLACEHOLDER}
                        className="pl-9 text-sm bg-white dark:bg-slate-900"
                      />
                    </div>
                    {editPhones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setEditPhones(editPhones.filter((_, i) => i !== idx))}
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 hover:bg-red-50 text-red-500"
                        title="Remove phone"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setEditPhones([...editPhones, ''])}
                className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-primary flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add another phone</span>
              </button>
            </div>

            {/* Social Links (optional) */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Social Links (optional)
              </Label>
              <div className="space-y-2 mt-1.5">
                <div className="relative">
                  <Linkedin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    value={editLinkedin}
                    onChange={(e) => setEditLinkedin(e.target.value)}
                    placeholder="linkedin.com/in/username"
                    className="pl-9 text-sm bg-white dark:bg-slate-900"
                  />
                </div>
                <div className="relative">
                  <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    value={editOtherLink}
                    onChange={(e) => setEditOtherLink(e.target.value)}
                    placeholder="Any other profile link"
                    className="pl-9 text-sm bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Access Level */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Access Level
              </Label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 mb-2 leading-relaxed">
                New team members aren&apos;t the Primary Contact by default — that&apos;s set separately and can only belong to one person at a time.
              </p>
              <div className="space-y-2">
                {ACCESS_LEVEL_CARDS.map((opt) => {
                  const isSelected = editAccessLevel === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setEditAccessLevel(opt.key)}
                      className={`w-full text-left p-3 rounded-xl transition duration-150 ${
                        isSelected
                          ? 'border-[1.5px] border-[#0B2447] dark:border-[#60A5FA] bg-[#F5F8FC] dark:bg-slate-800'
                          : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-300'
                      }`}
                    >
                      <p className="text-sm font-semibold text-[#0A0F1C] dark:text-slate-100">
                        {opt.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {opt.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <Button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="w-full bg-[#0B2447] hover:bg-[#1E3A5F] text-white font-semibold py-2.5 h-10 rounded-lg shadow-sm"
              >
                {isSavingEdit ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Portal Preview Modal */}
      <Dialog open={!!previewRep} onOpenChange={(open) => !open && setPreviewRep(null)}>
        <DialogContent className="w-full max-w-[480px] max-h-[88vh] overflow-x-hidden overflow-y-auto p-6 rounded-[14px] sm:rounded-[14px] border-border bg-white dark:bg-card text-card-foreground shadow-[0px_20px_60px_rgba(0,0,0,0.3)]">
          <DialogHeader className="pb-3 border-b border-border/60">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              {previewRep?.name}&apos;s Portal Access
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              {previewRep?.isPrimaryContact
                ? 'Primary Contact — sees everything, same as your full portal'
                : `${getAccessLevelLabel(previewRep?.accessLevel || 'events_networking')} — here's what they can see`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <CalendarDays className="w-4 h-4 text-emerald-600" />
                <span>Events & Networking</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-auto" />
              </div>
              <p className="text-[11px] text-slate-500 pl-6">
                Can register for chamber breakfasts, networking sessions, and exchange digital business cards.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Billing & Invoices</span>
                {previewRep?.isPrimaryContact || previewRep?.accessLevel === 'full_access' || previewRep?.accessLevel === 'billing_only' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 ml-auto" />
                ) : (
                  <span className="text-[10px] text-slate-400 ml-auto font-medium">Restricted</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 pl-6">
                Can view invoices, payment receipts, and manage vaulted payment methods.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <UserCheck className="w-4 h-4 text-purple-600" />
                <span>Profile & Team Management</span>
                {previewRep?.isPrimaryContact || previewRep?.accessLevel === 'full_access' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 ml-auto" />
                ) : (
                  <span className="text-[10px] text-slate-400 ml-auto font-medium">Restricted</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 pl-6">
                Can edit chamber directory listing, upload logo, and invite new colleagues.
              </p>
            </div>
          </div>
          <DialogFooter className="pt-2 border-t border-border/60">
            <Button type="button" onClick={() => setPreviewRep(null)} className="w-full">
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Primary Contact Transfer Confirmation Dialog */}
      <Dialog open={!!transferTarget} onOpenChange={(open) => !open && setTransferTarget(null)}>
        <DialogContent className="w-full max-w-[480px] rounded-[14px] sm:rounded-[14px] p-6 bg-white dark:bg-card text-card-foreground border-border shadow-[0px_20px_60px_rgba(0,0,0,0.3)]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" />
              Designate as Primary Contact?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Are you sure you want to designate{' '}
              <strong className="text-foreground">{transferTarget?.name}</strong> as the
              primary contact? They will have full administrative authority over this business profile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTransferTarget(null)}
              disabled={isTransferring}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmTransferPrimary}
              disabled={isTransferring}
              className="bg-[#0B2447] hover:bg-[#1E3A5F] text-white"
            >
              {isTransferring ? 'Designating...' : 'Confirm Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="w-full max-w-[480px] rounded-[14px] sm:rounded-[14px] p-6 bg-white dark:bg-card text-card-foreground border-border shadow-[0px_20px_60px_rgba(0,0,0,0.3)]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <X className="w-5 h-5" />
              Remove Representative?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Are you sure you want to remove{' '}
              <strong className="text-foreground">{deleteTarget?.name}</strong> from your
              business? Their access to the member portal under this business will be revoked.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmRemove}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? 'Removing...' : 'Remove Representative'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
