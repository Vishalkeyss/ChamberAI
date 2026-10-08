import React from 'react';
import { X, Sparkles, ShieldCheck, MessageSquare, Calendar, ArrowRight } from 'lucide-react';
import type { DirectoryBusiness } from '../services/directory.api';

interface GuestJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: DirectoryBusiness | null;
  chamberName?: string;
  onExplorePlans?: () => void;
}

export const GuestJoinModal: React.FC<GuestJoinModalProps> = ({
  isOpen,
  onClose,
  business,
  chamberName = 'the Chamber',
  onExplorePlans,
}) => {
  if (!isOpen || !business) return null;

  const contactName = business.primaryContact?.name || business.name;

  const handleJoinClick = () => {
    onClose();
    if (onExplorePlans) {
      onExplorePlans();
    } else {
      window.location.href = '/apply';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl p-6 overflow-hidden">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        {/* Decorative badge */}
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4">
          <Sparkles size={24} />
        </div>

        {/* Header */}
        <h3 className="text-xl font-bold text-foreground mb-2">
          Join {chamberName}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Join {chamberName} to connect with <span className="font-semibold text-foreground">{contactName}</span> directly and access executive B2B networking.
        </p>

        {/* Benefits list */}
        <div className="my-5 space-y-2.5 bg-muted/40 p-3.5 rounded-xl border border-border/50">
          <div className="flex items-center gap-2.5 text-xs text-foreground">
            <MessageSquare size={14} className="text-primary shrink-0" />
            <span>Direct member messaging and threaded group chats</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-foreground">
            <Calendar size={14} className="text-primary shrink-0" />
            <span>1-on-1 networking appointments and calendar sync</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-foreground">
            <ShieldCheck size={14} className="text-primary shrink-0" />
            <span>Verified business badge and executive directory placement</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={handleJoinClick}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition cursor-pointer shadow-sm"
          >
            <span>Explore Membership</span>
            <ArrowRight size={15} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted transition cursor-pointer"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};
