import React from 'react';
import { ExternalLink, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { ChatThreadView } from './ChatThreadView';
import type { NetworkMember } from '../services/networking.api';

interface QuickChatDrawerProps {
  open: boolean;
  onClose: () => void;
  partner: NetworkMember | null;
  /** Opens the full inbox on this thread. */
  onOpenInbox?: (partnerId: string) => void;
}

/** Prompt 05.2 §5.2 — slide-over chat opened from "Send Message" anywhere in the portal. */
export const QuickChatDrawer: React.FC<QuickChatDrawerProps> = ({ open, onClose, partner, onOpenInbox }) => (
  <Sheet open={open && !!partner} onOpenChange={(next) => !next && onClose()}>
    <SheetContent side="right" className="p-0 w-full sm:max-w-md flex flex-col gap-0 [&>button]:hidden">
      <SheetTitle className="sr-only">Message {partner?.name}</SheetTitle>
      <SheetDescription className="sr-only">Direct message thread</SheetDescription>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Quick Chat</p>
        <div className="flex items-center gap-1">
          {partner && onOpenInbox && (
            <button
              type="button"
              onClick={() => onOpenInbox(partner.id)}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 px-2 py-1"
            >
              Open in Messages <ExternalLink size={12} />
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">{partner && <ChatThreadView key={partner.id} partnerId={partner.id} partner={partner} compact />}</div>
    </SheetContent>
  </Sheet>
);
