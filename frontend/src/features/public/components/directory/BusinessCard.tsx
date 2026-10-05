import React from 'react';
import {
  ShieldCheck,
  MapPin,
  ExternalLink,
  Phone,
  Building2,
  User,
} from 'lucide-react';
import type { DirectoryBusiness } from '../../services/directory.api';
import { cn } from '@/lib/utils';

interface BusinessCardProps {
  business: DirectoryBusiness;
  viewMode: 'grid' | 'list';
}

export const BusinessCard: React.FC<BusinessCardProps> = ({ business, viewMode }) => {
  const {
    name,
    logoUrl,
    tagline,
    industry,
    city,
    state,
    website,
    isVerified,
    chapterName,
    primaryContact,
  } = business;

  const locationText = [city, state].filter(Boolean).join(', ');

  if (viewMode === 'list') {
    return (
      <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card/90 backdrop-blur-xs shadow-xs transition hover:shadow-md hover:border-border/80 group">
        {/* Logo */}
        <div className="shrink-0 w-14 h-14 rounded-lg bg-muted/60 border border-border/50 flex items-center justify-center overflow-hidden">
          {logoUrl ? (
            <img src={logoUrl} alt={name} className="w-full h-full object-cover rounded-lg" />
          ) : (
            <Building2 size={24} className="text-muted-foreground/50" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-semibold text-sm text-card-foreground truncate">{name}</h3>
            {isVerified && (
              <ShieldCheck size={15} className="text-blue-500 shrink-0" />
            )}
          </div>
          {tagline && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{tagline}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {industry && (
              <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/15">
                {industry}
              </span>
            )}
            {chapterName && (
              <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/15">
                {chapterName}
              </span>
            )}
            {locationText && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin size={11} />
                {locationText}
              </span>
            )}
          </div>
        </div>

        {/* Primary Contact */}
        {primaryContact && (
          <div className="hidden sm:flex items-center gap-2 shrink-0 px-3 border-l border-border/50">
            <div className="w-7 h-7 rounded-full bg-muted/80 flex items-center justify-center overflow-hidden border border-border/50">
              {primaryContact.avatarUrl ? (
                <img src={primaryContact.avatarUrl} alt={primaryContact.name || ''} className="w-full h-full object-cover" />
              ) : (
                <User size={14} className="text-muted-foreground/60" />
              )}
            </div>
            <span className="text-xs text-muted-foreground truncate max-w-[100px]">
              {primaryContact.name || 'Contact'}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {website && (
            <a
              href={website.startsWith('http') ? website : `https://${website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-card hover:bg-muted text-card-foreground transition shadow-2xs cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={12} />
              Website
            </a>
          )}
        </div>
      </div>
    );
  }

  // Grid view (default)
  return (
    <div className="flex flex-col p-5 rounded-xl border border-border bg-card/90 backdrop-blur-xs shadow-xs transition hover:shadow-md hover:border-border/80 group h-full">
      {/* Top: Logo + Verification */}
      <div className="flex items-start gap-3 mb-3">
        <div className="shrink-0 w-12 h-12 rounded-lg bg-muted/60 border border-border/50 flex items-center justify-center overflow-hidden">
          {logoUrl ? (
            <img src={logoUrl} alt={name} className="w-full h-full object-cover rounded-lg" />
          ) : (
            <Building2 size={22} className="text-muted-foreground/50" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-semibold text-sm text-card-foreground truncate">{name}</h3>
            {isVerified && (
              <ShieldCheck size={15} className="text-blue-500 shrink-0" />
            )}
          </div>
          {industry && (
            <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full mt-1 bg-primary/10 text-primary border border-primary/15">
              {industry}
            </span>
          )}
        </div>
      </div>

      {/* Tagline */}
      {tagline && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{tagline}</p>
      )}

      {/* Tags row */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {chapterName && (
          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/15">
            {chapterName}
          </span>
        )}
        {locationText && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin size={11} />
            {locationText}
          </span>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Primary Contact */}
      {primaryContact && (
        <div className="flex items-center gap-2 py-2.5 border-t border-border/50 mb-3">
          <div className="w-7 h-7 rounded-full bg-muted/80 flex items-center justify-center overflow-hidden border border-border/50">
            {primaryContact.avatarUrl ? (
              <img src={primaryContact.avatarUrl} alt={primaryContact.name || ''} className="w-full h-full object-cover" />
            ) : (
              <User size={14} className="text-muted-foreground/60" />
            )}
          </div>
          <span className="text-xs text-muted-foreground truncate">
            {primaryContact.name || 'Contact'}
          </span>
        </div>
      )}

      {/* Action CTAs */}
      <div className="flex items-center gap-2 mt-auto">
        {website && (
          <a
            href={website.startsWith('http') ? website : `https://${website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-card hover:bg-muted text-card-foreground transition shadow-2xs cursor-pointer flex-1 justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} />
            Visit Website
          </a>
        )}
      </div>
    </div>
  );
};
