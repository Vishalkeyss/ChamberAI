import React from 'react';
import { Card } from '@/components/ui/card';
import type { DirectoryBusiness } from '../services/directory.api';

interface PublicBusinessCardProps {
  business: DirectoryBusiness;
  onViewProfile?: (business: DirectoryBusiness) => void;
}

// Curated avatar palette matching Lovable app.html
const AVATAR_COLORS = [
  '#059669', // Emerald
  '#b45309', // Amber / Rust
  '#1e293b', // Navy / Slate
  '#0284c7', // Sky / Cyan
  '#dc2626', // Red
  '#7c3aed', // Purple
  '#4338ca', // Indigo
  '#0f766e', // Teal
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export const PublicBusinessCard: React.FC<PublicBusinessCardProps> = ({
  business,
  onViewProfile,
}) => {
  const {
    name,
    dbaName,
    city,
    industry,
    description,
    tagline,
    phone,
    primaryContact,
    logoUrl,
    chamberCity,
  } = business;

  const businessTitle = name || dbaName || 'Chamber Member Business';
  const displayCity = city || chamberCity || '';
  const displayPhone = phone || primaryContact?.phone || '';
  const displayEmail = primaryContact?.email || '';
  const displayDescription = description || tagline || '';

  // 2-letter uppercase initials
  const initials = businessTitle
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || businessTitle.slice(0, 2).toUpperCase();

  const avatarBg = getAvatarColor(businessTitle);

  return (
    <Card
      onClick={() => onViewProfile && onViewProfile(business)}
      className="p-5 bg-card border border-border/80 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 flex flex-col cursor-pointer group"
    >
      {/* Top: Avatar + Business Name & Category/City */}
      <div className="flex items-center gap-3.5">
        <div
          className="w-11 h-11 rounded-full text-white flex items-center justify-center font-bold text-sm tracking-wide shrink-0 overflow-hidden shadow-2xs"
          style={{ backgroundColor: avatarBg }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={businessTitle}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
            {businessTitle}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {industry || 'Business'}
            {displayCity ? ` • ${displayCity}` : ''}
          </p>
        </div>
      </div>

      {/* Description / Tagline */}
      {displayDescription ? (
        <p className="text-xs text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
          {displayDescription}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground/60 italic mt-3">
          Verified member of the chamber.
        </p>
      )}

      {/* Spacer to align phone/email to the bottom */}
      <div className="flex-1 min-h-2" />

      {/* Contact details footer matching app.html */}
      {(displayPhone || displayEmail) && (
        <div className="mt-4 pt-3 space-y-1 border-t border-border/60 text-xs text-muted-foreground">
          {displayPhone && (
            <p className="truncate hover:text-foreground transition-colors">
              {displayPhone}
            </p>
          )}
          {displayEmail && (
            <p className="truncate hover:text-foreground transition-colors">
              {displayEmail}
            </p>
          )}
        </div>
      )}
    </Card>
  );
};
