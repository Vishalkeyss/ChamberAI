import React, { useState } from 'react';
import { X, Send, User, Building2, CheckCircle2, Loader2 } from 'lucide-react';
import type { DirectoryBusiness } from '../services/directory.api';

interface QuickMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: DirectoryBusiness | null;
}

export const QuickMessageModal: React.FC<QuickMessageModalProps> = ({
  isOpen,
  onClose,
  business,
}) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen || !business) return null;

  const contact = business.primaryContact;
  const contactName = contact?.name || business.name;
  const contactTitle = contact?.jobTitle || 'Primary Representative';

  const handleSend = (e: React.FormEvent) => {
    // No messaging API yet (Prompt 05.2) — never report a fake success.
    e.preventDefault();
  };

  const handleClose = () => {
    if (!sending) {
      setSentSuccess(false);
      setSubject('');
      setMessage('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
              {contact?.avatarUrl ? (
                <img src={contact.avatarUrl} alt={contactName} className="w-full h-full object-cover" />
              ) : (
                <User size={18} className="text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-foreground truncate">
                Message {contactName}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                {contactTitle} • {business.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            aria-label="Close message window"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        {sentSuccess ? (
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 animate-in zoom-in-75 duration-200">
              <CheckCircle2 size={24} />
            </div>
            <h4 className="text-base font-semibold text-foreground mb-1">Message Delivered</h4>
            <p className="text-xs text-muted-foreground max-w-xs">
              Your message was sent to {contactName}. You will receive replies in your Chamber Member Inbox.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="p-6 flex flex-col gap-4 overflow-y-auto">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Introduction & potential partnership"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Hi ${contactName.split(' ')[0]}, I saw your profile in the Chamber directory and would love to connect regarding...`}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-muted-foreground">
                Direct messaging is coming soon
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-border hover:bg-muted text-foreground transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled
                  title="Available once direct messaging (Prompt 05.2) is live"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer shadow-xs"
                >
                  {sending ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Send Message</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
