import React, { useState } from 'react';
import { X, Calendar, Clock, User, CheckCircle2, Loader2 } from 'lucide-react';
import type { DirectoryBusiness } from '../services/directory.api';

interface BookMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: DirectoryBusiness | null;
}

export const BookMeetingModal: React.FC<BookMeetingModalProps> = ({
  isOpen,
  onClose,
  business,
}) => {
  const [topic, setTopic] = useState('Networking & Partnership');
  const [meetingDate, setMeetingDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [meetingTime, setMeetingTime] = useState('10:00 AM');
  const [duration, setDuration] = useState('30');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookedSuccess, setBookedSuccess] = useState(false);

  if (!isOpen || !business) return null;

  const contact = business.primaryContact;
  const contactName = contact?.name || business.name;

  const handleSubmit = (e: React.FormEvent) => {
    // No booking API yet (Prompt 05.1) — never report a fake success.
    e.preventDefault();
  };

  const handleClose = () => {
    if (!submitting) {
      setBookedSuccess(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center overflow-hidden shrink-0">
              {contact?.avatarUrl ? (
                <img src={contact.avatarUrl} alt={contactName} className="w-full h-full object-cover" />
              ) : (
                <Calendar size={18} className="text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-foreground truncate">
                Book 1:1 with {contactName}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                Chamber Peer Networking • {business.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            aria-label="Close booking window"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {bookedSuccess ? (
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 animate-in zoom-in-75 duration-200">
              <CheckCircle2 size={24} />
            </div>
            <h4 className="text-base font-semibold text-foreground mb-1">Meeting Request Sent!</h4>
            <p className="text-xs text-muted-foreground max-w-xs">
              A 1:1 meeting invitation has been sent to {contactName} for {meetingDate} at {meetingTime}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto">
            {/* Topic */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Meeting Topic
              </label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="Networking & Partnership">Networking & Strategic Partnership</option>
                <option value="Client Referral Exchange">Client Referral Exchange</option>
                <option value="Vendor / Service Evaluation">Vendor / Service Evaluation</option>
                <option value="Informational Interview">Informational & Peer Consultation</option>
              </select>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Preferred Date
                </label>
                <input
                  type="date"
                  required
                  value={meetingDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Preferred Time
                </label>
                <select
                  value={meetingTime}
                  onChange={(e) => setMeetingTime(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="09:00 AM">09:00 AM</option>
                  <option value="10:00 AM">10:00 AM</option>
                  <option value="11:30 AM">11:30 AM</option>
                  <option value="01:30 PM">01:30 PM</option>
                  <option value="03:00 PM">03:00 PM</option>
                  <option value="04:30 PM">04:30 PM</option>
                </select>
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Duration
              </label>
              <div className="flex gap-2">
                {['15', '30', '45', '60'].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDuration(mins)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer ${
                      duration === mins
                        ? 'bg-primary text-primary-foreground border-primary font-semibold'
                        : 'border-border bg-background hover:bg-muted text-foreground'
                    }`}
                  >
                    {mins} mins
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Note / Agenda (Optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Briefly share what you would like to discuss..."
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-muted-foreground">
                1:1 meeting booking is coming soon
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
                  title="Available once 1:1 networking (Prompt 05.1) is live"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition cursor-pointer shadow-xs"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Scheduling...</span>
                    </>
                  ) : (
                    <>
                      <Calendar size={13} />
                      <span>Request 1:1 Meeting</span>
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
