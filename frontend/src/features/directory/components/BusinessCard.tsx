import React from 'react';
import {
  MapPin,
  Briefcase,
  Send,
  Star,
} from 'lucide-react';
import type { DirectoryBusiness } from '../services/directory.api';

interface BusinessCardProps {
  business: DirectoryBusiness;
  onSendMessage: (business: DirectoryBusiness) => void;
  onBookMeeting?: (business: DirectoryBusiness) => void;
  onViewProfile?: (business: DirectoryBusiness) => void;
  isMember?: boolean;
}

export const BusinessCard: React.FC<BusinessCardProps> = ({
  business,
  onSendMessage,
  onViewProfile,
}) => {
  const {
    name,
    city,
    industry,
    primaryContact,
    logoUrl,
    planName,
    membershipStatus,
    chamberCity,
  } = business;

  // Resolve display contact name and business name
  const contactName = primaryContact?.name || name;
  const businessName = primaryContact?.name ? name : (business.dbaName || 'Chamber Member Business');

  // Compute 2-letter uppercase initials for avatar badge
  const initials = (contactName || name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || name.slice(0, 2).toUpperCase();

  // Dynamic location: business city or chamber city
  const locationCity = city || chamberCity || null;

  // Dynamic status badge styling
  const status = (membershipStatus || 'active').toLowerCase();
  const isPending = status.includes('pending') || status === 'unpaid';
  const isActive = status === 'active';

  return (
    <div className="flex flex-col p-5 rounded-2xl border border-gray-200/90 dark:border-border/80 bg-white dark:bg-card shadow-xs transition-all duration-200 hover:shadow-md border-t-4 border-t-[#0B1E3B] relative group">
      {/* Top row: Avatar + Names */}
      <div className="flex items-center gap-3.5 mb-3">
        {/* Navy circular avatar with white initials or avatar image */}
        <div className="w-12 h-12 rounded-full bg-[#0B1E3B] text-white flex items-center justify-center font-bold text-sm tracking-wide shrink-0 overflow-hidden shadow-2xs">
          {primaryContact?.avatarUrl || logoUrl ? (
            <img
              src={primaryContact?.avatarUrl || logoUrl || ''}
              alt={contactName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        {/* Person name + Business name */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base text-gray-900 dark:text-white truncate leading-tight group-hover:text-primary transition-colors">
            {contactName}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate mt-0.5">
            {businessName}
          </p>
        </div>
      </div>

      {/* Row 2: Location • Industry (Render only if present, dynamic) */}
      {(locationCity || industry) && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3 flex-wrap">
          {locationCity && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} className="text-gray-400 shrink-0" />
              <span>{locationCity}</span>
            </span>
          )}
          {locationCity && industry && <span>•</span>}
          {industry && (
            <span className="inline-flex items-center gap-1">
              <Briefcase size={12} className="text-gray-400 shrink-0" />
              <span className="line-clamp-1">{industry}</span>
            </span>
          )}
        </div>
      )}

      {/* Row 3: Dynamic Badges */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {/* Dynamic Plan Tier badge with Star if planName exists */}
        {planName && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-0.5 rounded-full">
            <Star size={11} className="fill-slate-500 text-slate-500" />
            {planName}
          </span>
        )}

        {/* Dynamic Membership Status badge */}
        {isActive ? (
          <span className="inline-flex items-center text-[11px] font-medium bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60 px-2.5 py-0.5 rounded-full">
            Active
          </span>
        ) : isPending ? (
          <span className="inline-flex items-center text-[11px] font-medium bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/60 px-2.5 py-0.5 rounded-full">
            Pending Payment
          </span>
        ) : (
          <span className="inline-flex items-center text-[11px] font-medium bg-gray-100 dark:bg-muted text-gray-700 dark:text-gray-300 border border-gray-200/60 px-2.5 py-0.5 rounded-full capitalize">
            {membershipStatus || 'Member'}
          </span>
        )}
      </div>

      {/* Spacer to push actions to bottom */}
      <div className="flex-1" />

      {/* Row 4: Action Buttons (View Profile + Send Message) */}
      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => onViewProfile && onViewProfile(business)}
          className="flex-1 bg-[#0B1E3B] hover:bg-[#102A43] text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition cursor-pointer text-center shadow-xs"
        >
          View Profile
        </button>

        <button
          type="button"
          onClick={() => onSendMessage(business)}
          className="w-10 h-10 rounded-xl border border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted flex items-center justify-center text-gray-700 dark:text-gray-300 transition cursor-pointer shrink-0"
          title="Send Direct Message"
          aria-label="Send message"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
};
