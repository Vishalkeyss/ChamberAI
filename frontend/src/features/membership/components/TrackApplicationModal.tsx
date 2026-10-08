import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  X,
  Loader2,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Send,
  ArrowLeft,
  FileText,
} from 'lucide-react';
import {
  trackApplication,
  resubmitApplication,
  type ApplicationTrackingData,
} from '../services/applications.api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { isValidPhoneNumber, normalizePhoneNumber } from '@/lib/validation';
import { EMAIL_PLACEHOLDER, PHONE_PLACEHOLDER } from '@/lib/placeholders';

export interface TrackApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
  initialEmail?: string;
  chamberSlug?: string;
}

export const TrackApplicationModal: React.FC<TrackApplicationModalProps> = ({
  isOpen,
  onClose,
  initialCode = '',
  initialEmail = '',
  chamberSlug,
}) => {
  const [referenceId, setReferenceId] = useState<string>(initialCode);
  const [email, setEmail] = useState<string>(initialEmail);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [applicationData, setApplicationData] = useState<ApplicationTrackingData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Editable fields when changes are requested
  const [editPhone, setEditPhone] = useState<string>('');
  const [editStreet, setEditStreet] = useState<string>('');
  const [editCity, setEditCity] = useState<string>('');
  const [editState, setEditState] = useState<string>('');
  const [editZip, setEditZip] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editWebsite, setEditWebsite] = useState<string>('');
  const [isResubmitting, setIsResubmitting] = useState<boolean>(false);

  // Sync initial props when opened
  useEffect(() => {
    if (isOpen) {
      if (initialCode) {
        setReferenceId(initialCode);
        if (initialEmail) {
          setEmail(initialEmail);
          handleLookup(initialCode, initialEmail);
        }
      }
    } else {
      // Reset search error on close
      setErrorMessage(null);
    }
  }, [isOpen, initialCode, initialEmail]);

  if (!isOpen) return null;

  // Normalize tracking code: convert unicode dashes/hyphens (en-dash, em-dash, etc.) to standard ASCII hyphen
  const normalizeTrackingCode = (val: string) =>
    (val || '')
      .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
      .trim()
      .toUpperCase();

  const handleLookup = async (codeToLookup?: string, emailToMatch?: string) => {
    const code = normalizeTrackingCode(codeToLookup || referenceId);
    const mail = (emailToMatch !== undefined ? emailToMatch : email).trim().toLowerCase();

    if (!code) {
      toast.error('Please enter your Reference ID');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await trackApplication(code, chamberSlug);

      // Verify email if provided
      if (mail && data.businessEmail) {
        if (data.businessEmail.trim().toLowerCase() !== mail) {
          setApplicationData(null);
          setErrorMessage(
            'The email address provided does not match the application records for this reference ID.'
          );
          return;
        }
      }

      setApplicationData(data);
      setReferenceId(data.trackingCode);

      // Populate edit fields
      setEditPhone(data.businessPhone || '');
      setEditStreet(data.businessDetails?.address?.street || '');
      setEditCity(data.businessDetails?.address?.city || '');
      setEditState(data.businessDetails?.address?.state || '');
      setEditZip(data.businessDetails?.address?.zip || '');
      setEditDescription(data.businessDetails?.description || '');
      setEditWebsite(data.businessDetails?.website || '');
    } catch (err: any) {
      setApplicationData(null);
      setErrorMessage(
        err.message || 'No application found with this reference ID. Please check and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicationData) return;

    if (editPhone.trim() && !isValidPhoneNumber(editPhone.trim())) {
      toast.error('Please enter a valid USA phone number (+1 (555) 019-2834)');
      return;
    }

    setIsResubmitting(true);
    try {
      const payload = {
        businessPhone: editPhone.trim() ? normalizePhoneNumber(editPhone.trim()) : undefined,
        businessDetails: {
          website: editWebsite.trim() || undefined,
          description: editDescription.trim() || undefined,
          address: {
            street: editStreet.trim(),
            city: editCity.trim(),
            state: editState.trim(),
            zip: editZip.trim(),
          },
        },
      };

      const res = await resubmitApplication(applicationData.trackingCode, payload, chamberSlug);
      toast.success(res.message || 'Application resubmitted successfully!');

      // Refresh application data
      await handleLookup(applicationData.trackingCode, email);
    } catch (err: any) {
      toast.error(err.message || 'Failed to resubmit application updates.');
    } finally {
      setIsResubmitting(false);
    }
  };

  const handleBackToSearch = () => {
    setApplicationData(null);
    setErrorMessage(null);
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Approved & Verified
          </span>
        );
      case 'changes_requested':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Additional Information Requested
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-destructive/15 text-destructive border border-destructive/20">
            <XCircle className="w-3.5 h-3.5" />
            Application Declined
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Under Committee Review
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden text-foreground animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 sm:p-6 border-b border-border shrink-0">
          <div>
            <h3 className="text-lg font-bold text-foreground">
              {applicationData ? 'Application Status' : 'Track Your Application'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {applicationData
                ? `Reference: ${applicationData.trackingCode}`
                : 'Check your status or make changes an admin requested'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {!applicationData ? (
            /* Lookup Form (Screenshot 2) */
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLookup();
              }}
              className="space-y-4"
            >
              <p className="text-xs text-muted-foreground leading-relaxed">
                Enter the Reference ID from your confirmation and the email you applied with.
              </p>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Reference ID*
                </label>
                <input
                  type="text"
                  required
                  value={referenceId}
                  onChange={(e) => setReferenceId(normalizeTrackingCode(e.target.value))}
                  placeholder="e.g. APP-482913"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-xs md:text-sm font-mono uppercase placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Email*
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim())}
                  placeholder={EMAIL_PLACEHOLDER}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-xs md:text-sm placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !referenceId.trim() || !email.trim()}
                className="w-full py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Search size={15} />
                )}
                <span>Find My Application</span>
              </button>
            </form>
          ) : (
            /* Results View */
            <div className="space-y-4">
              {/* Back to search button */}
              <button
                type="button"
                onClick={handleBackToSearch}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <ArrowLeft size={13} />
                <span>Track another application</span>
              </button>

              {/* Status Header Card */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-semibold text-muted-foreground">
                    {applicationData.trackingCode}
                  </span>
                  {renderStatusBadge(applicationData.status)}
                </div>
                <div className="text-sm font-bold text-foreground">
                  {applicationData.businessName}
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                  <span>{applicationData.applicantName}</span>
                  <span>·</span>
                  <span>{applicationData.businessEmail}</span>
                  <span>·</span>
                  <span className="font-semibold text-foreground">{applicationData.planName}</span>
                </div>
              </div>

              {/* Status Specific Messages */}
              {applicationData.status === 'pending' && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                  Your application is currently under committee review. Once the chamber administrative team verifies your details, you will receive a notification.
                </div>
              )}

              {applicationData.status === 'approved' && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
                  Congratulations! Your application has been approved and verified. Your member account is active.
                </div>
              )}

              {applicationData.status === 'rejected' && (
                <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive leading-relaxed">
                  <strong className="block font-semibold mb-0.5">Application Declined</strong>
                  {applicationData.adminNotes || 'This application was declined by the committee.'}
                </div>
              )}

              {/* Changes Requested Section with Inline Form */}
              {applicationData.status === 'changes_requested' && (
                <div className="space-y-4">
                  {/* Admin feedback note */}
                  <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 space-y-1">
                    <span className="text-xs font-bold block">Reviewer Notes / Requested Changes:</span>
                    <p className="text-xs whitespace-pre-wrap leading-relaxed">
                      {applicationData.adminNotes || 'Please update your details as requested.'}
                    </p>
                  </div>

                  {/* Resubmission form */}
                  <form onSubmit={handleResubmit} className="space-y-3 pt-1">
                    <p className="text-xs font-semibold text-foreground">Update & Resubmit</p>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        Business Phone Number
                      </label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder={PHONE_PLACEHOLDER}
                        className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        Website URL
                      </label>
                      <input
                        type="url"
                        value={editWebsite}
                        onChange={(e) => setEditWebsite(e.target.value)}
                        placeholder="https://yourbusiness.com"
                        className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        Street Address
                      </label>
                      <input
                        type="text"
                        value={editStreet}
                        onChange={(e) => setEditStreet(e.target.value)}
                        placeholder="123 Main St, Suite 400"
                        className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                          City
                        </label>
                        <input
                          type="text"
                          value={editCity}
                          onChange={(e) => setEditCity(e.target.value)}
                          placeholder="City"
                          className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                          State
                        </label>
                        <input
                          type="text"
                          value={editState}
                          onChange={(e) => setEditState(e.target.value)}
                          placeholder="State"
                          className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                          Zip
                        </label>
                        <input
                          type="text"
                          value={editZip}
                          onChange={(e) => setEditZip(e.target.value)}
                          placeholder="Zip"
                          className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        Business Description
                      </label>
                      <textarea
                        rows={2}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Brief overview of operations..."
                        className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/40 resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isResubmitting}
                      className="w-full mt-2 py-2.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                    >
                      {isResubmitting ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      <span>Resubmit Application</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrackApplicationModal;
