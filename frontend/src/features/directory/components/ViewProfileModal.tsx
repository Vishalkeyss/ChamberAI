import React from 'react';
import {
  X,
  MapPin,
  Building2,
  ExternalLink,
  Phone,
  Mail,
  Send,
  Calendar,
  ShieldCheck,
  Star,
  User,
  UserPlus,
} from 'lucide-react';
import type { DirectoryBusiness } from '../services/directory.api';

interface ViewProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: DirectoryBusiness | null;
  onSendMessage: (business: DirectoryBusiness) => void;
  onBookMeeting: (business: DirectoryBusiness) => void;
  /** Prompt 05.5 quick conversion into the member's private CRM (member mode only). */
  onAddToCrm?: (business: DirectoryBusiness) => void;
}

export const ViewProfileModal: React.FC<ViewProfileModalProps> = ({
  isOpen,
  onClose,
  business,
  onSendMessage,
  onBookMeeting,
  onAddToCrm,
}) => {
  if (!isOpen || !business) return null;

  const contactName = business.primaryContact?.name || business.name;
  const businessName = business.name;
  const initials = contactName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || businessName.slice(0, 2).toUpperCase();

  const locationText = [business.city, business.state].filter(Boolean).join(', ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top navy banner with accent */}
        <div className="h-3 bg-[#0B1E3B]" />

        {/* Modal Header */}
        <div className="p-6 border-b border-border/60 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            aria-label="Close profile modal"
          >
            <X size={18} />
          </button>

          <div className="flex items-start gap-4">
            {/* Avatar circle */}
            <div className="w-16 h-16 rounded-full bg-[#0B1E3B] text-white flex items-center justify-center text-xl font-bold shadow-md shrink-0 overflow-hidden">
              {business.primaryContact?.avatarUrl || business.logoUrl ? (
                <img
                  src={business.primaryContact?.avatarUrl || business.logoUrl || ''}
                  alt={contactName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            {/* Names & Badges */}
            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-foreground truncate">
                  {contactName}
                </h2>
                {business.isVerified && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
                    <ShieldCheck size={12} />
                    Verified Member
                  </span>
                )}
              </div>

              <p className="text-sm font-medium text-muted-foreground mt-0.5">
                {businessName} {business.dbaName ? `(DBA: ${business.dbaName})` : ''}
              </p>

              {business.primaryContact?.jobTitle && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {business.primaryContact.jobTitle}
                </p>
              )}

              {/* Badges row */}
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                {business.planName && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full">
                    <Star size={11} className="fill-slate-500 text-slate-500" />
                    {business.planName}
                  </span>
                )}
                {(business.membershipStatus || 'active').toLowerCase() === 'active' ? (
                  <span className="inline-flex items-center text-[11px] font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-200/50">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center text-[11px] font-medium bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-200/50">
                    {business.membershipStatus || 'Pending Payment'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-muted/40 border border-border/50 text-xs">
            {locationText && (
              <div className="flex items-center gap-2 text-foreground">
                <MapPin size={14} className="text-muted-foreground shrink-0" />
                <span>{locationText}</span>
              </div>
            )}
            {business.industry && (
              <div className="flex items-center gap-2 text-foreground">
                <Building2 size={14} className="text-muted-foreground shrink-0" />
                <span>{business.industry}</span>
              </div>
            )}
            {business.phone && (
              <div className="flex items-center gap-2 text-foreground">
                <Phone size={14} className="text-muted-foreground shrink-0" />
                <a href={`tel:${business.phone}`} className="hover:underline">{business.phone}</a>
              </div>
            )}
            {business.website && (
              <div className="flex items-center gap-2 text-foreground">
                <ExternalLink size={14} className="text-muted-foreground shrink-0" />
                <a
                  href={business.website.startsWith('http') ? business.website : `https://${business.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline truncate"
                >
                  {business.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
          </div>

          {/* Tagline / Bio */}
          {(business.tagline || business.description) && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                About Business
              </h4>
              {business.tagline && (
                <p className="text-sm font-semibold text-foreground mb-1">
                  "{business.tagline}"
                </p>
              )}
              {business.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {business.description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-muted text-foreground transition cursor-pointer"
          >
            Close
          </button>
          {onAddToCrm && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onAddToCrm(business);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-muted text-foreground transition cursor-pointer"
            >
              <UserPlus size={13} />
              <span>Add to CRM</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSendMessage(business);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[#0B1E3B] hover:bg-[#102A43] text-white transition cursor-pointer shadow-sm"
          >
            <Send size={13} />
            <span>Send Message</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onBookMeeting(business);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer shadow-sm"
          >
            <Calendar size={13} />
            <span>Book 1:1</span>
          </button>
        </div>
      </div>
    </div>
  );
};
