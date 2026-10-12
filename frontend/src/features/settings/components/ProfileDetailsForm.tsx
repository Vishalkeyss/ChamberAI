import React, { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Camera, CheckCircle2, Mail, Phone, Briefcase, User as UserIcon } from 'lucide-react';
import type { UserAccountSettingsProfile } from '../types';
import { EMAIL_PLACEHOLDER, PHONE_PLACEHOLDER } from '@/lib/placeholders';

export interface ProfileDetailsFormProps {
  profile: UserAccountSettingsProfile;
  onChange: (updated: Partial<UserAccountSettingsProfile>) => void;
}

export const ProfileDetailsForm: React.FC<ProfileDetailsFormProps> = ({
  profile,
  onChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
      onChange({ avatar_url: previewUrl });
    }
  };

  const initials = profile.name
    ? profile.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <div className="space-y-6">
      {/* Avatar & Summary Card */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6 rounded-2xl bg-card border border-border/80 shadow-xs">
        <div className="relative group">
          <Avatar className="h-24 w-24 border-2 border-border shadow-xs">
            {avatarPreview && <AvatarImage src={avatarPreview} alt={profile.name} />}
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-2xl">
              {initials}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-transform active:scale-95"
            title="Upload photo"
            aria-label="Upload photo"
          >
            <Camera className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        <div className="flex-1 text-center sm:text-left space-y-1">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h2 className="text-xl font-bold tracking-tight">{profile.name || 'Member Profile'}</h2>
            <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 gap-1">
              <CheckCircle2 className="h-3 w-3" /> Verified Member
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{profile.title || 'No job title specified'}</p>
          <p className="text-xs text-muted-foreground pt-1">
            Allowed formats: JPG, PNG, WEBP (Max 5MB). Photo is scaled to square for chamber directory.
          </p>
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl bg-card border border-border/80 shadow-xs">
        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="profile-name" className="text-sm font-semibold flex items-center gap-1.5">
            <UserIcon className="h-4 w-4 text-muted-foreground" /> Full Name
          </Label>
          <Input
            id="profile-name"
            value={profile.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Sarah Miller"
            className="rounded-lg"
          />
        </div>

        {/* Job Title */}
        <div className="space-y-2">
          <Label htmlFor="profile-title" className="text-sm font-semibold flex items-center gap-1.5">
            <Briefcase className="h-4 w-4 text-muted-foreground" /> Job Title / Designation
          </Label>
          <Input
            id="profile-title"
            value={profile.title || ''}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g. Chief Executive Officer"
            className="rounded-lg"
          />
        </div>

        {/* Email Address (Immutable / Re-verification) */}
        <div className="space-y-2">
          <Label htmlFor="profile-email" className="text-sm font-semibold flex items-center gap-1.5">
            <Mail className="h-4 w-4 text-muted-foreground" /> Account Email Address
          </Label>
          <div className="relative">
            <Input placeholder={EMAIL_PLACEHOLDER}
              id="profile-email"
              value={profile.email}
              disabled
              className="bg-muted/50 text-muted-foreground cursor-not-allowed rounded-lg"
            />
            <Badge
              variant="outline"
              className="absolute right-2.5 top-2.5 text-[10px] font-mono text-muted-foreground"
            >
              Primary Login
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Contact your chamber administrator or request an OTP verification to transfer primary email.
          </p>
        </div>

        {/* Phone Number */}
        <div className="space-y-2">
          <Label htmlFor="profile-phone" className="text-sm font-semibold flex items-center gap-1.5">
            <Phone className="h-4 w-4 text-muted-foreground" /> Direct Phone Number
          </Label>
          <Input
            id="profile-phone"
            value={profile.phone || ''}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder={PHONE_PLACEHOLDER}
            className="rounded-lg"
          />
          <p className="text-[11px] text-muted-foreground">
            Used for urgent SMS notifications and 2-step OTP access.
          </p>
        </div>
      </div>
    </div>
  );
};
