import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Building2,
  User,
  MapPin,
  Calendar,
  Layers,
  ArrowRight,
  Loader2,
  Edit3,
  Send,
} from 'lucide-react';
import { trackApplication, resubmitApplication, type ApplicationTrackingData } from '../services/applications.api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface TrackApplicationPageProps {
  initialCode?: string;
  chamberSlug?: string;
  onNavigateHome?: () => void;
  onNavigateApply?: () => void;
}

export const TrackApplicationPage: React.FC<TrackApplicationPageProps> = ({
  initialCode = '',
  chamberSlug,
  onNavigateHome,
  onNavigateApply,
}) => {
  const [trackingCodeInput, setTrackingCodeInput] = useState<string>(initialCode);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [applicationData, setApplicationData] = useState<ApplicationTrackingData | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Resubmission state for 'changes_requested'
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isResubmitting, setIsResubmitting] = useState<boolean>(false);
  const [editPhone, setEditPhone] = useState<string>('');
  const [editStreet, setEditStreet] = useState<string>('');
  const [editCity, setEditCity] = useState<string>('');
  const [editState, setEditState] = useState<string>('');
  const [editZip, setEditZip] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editWebsite, setEditWebsite] = useState<string>('');

  const handleLookup = async (codeToLookup?: string) => {
    const code = (codeToLookup || trackingCodeInput).trim().toUpperCase();
    if (!code) {
      toast.error('Please enter your application tracking code');
      return;
    }

    setIsLoading(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const data = await trackApplication(code, chamberSlug);
      setApplicationData(data);
      setTrackingCodeInput(data.trackingCode);

      // Populate edit fields in case changes_requested
      setEditPhone(data.businessPhone || '');
      setEditStreet(data.businessDetails?.address?.street || '');
      setEditCity(data.businessDetails?.address?.city || '');
      setEditState(data.businessDetails?.address?.state || '');
      setEditZip(data.businessDetails?.address?.zip || '');
      setEditDescription(data.businessDetails?.description || '');
      setEditWebsite(data.businessDetails?.website || '');

      if (data.status === 'changes_requested') {
        setIsEditing(true);
      } else {
        setIsEditing(false);
      }
    } catch (err: any) {
      setApplicationData(null);
      setSearchError(err.message || 'No application found with this tracking code.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      handleLookup(initialCode);
    }
  }, [initialCode]);

  // Handle Resubmission
  const handleResubmit = async () => {
    if (!applicationData) return;

    setIsResubmitting(true);
    try {
      const payload = {
        businessPhone: editPhone.trim() || undefined,
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
      setIsEditing(false);
      // Refresh details
      await handleLookup(applicationData.trackingCode);
    } catch (err: any) {
      toast.error(err.message || 'Failed to resubmit application updates.');
    } finally {
      setIsResubmitting(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved & Verified
          </span>
        );
      case 'changes_requested':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <AlertTriangle className="w-3.5 h-3.5" />
            Additional Information Requested
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <XCircle className="w-3.5 h-3.5" />
            Application Declined
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" />
            Under Committee Review
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="text-center mb-8">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Chamber Application Portal
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
          Track Your Membership Application
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Enter your unique tracking code (e.g. <code>APP-2026-89412</code>) to check review status, committee feedback, or resubmit requested changes.
        </p>
      </div>

      {/* Lookup Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 shadow-xs max-w-2xl mx-auto mb-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLookup();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={trackingCodeInput}
              onChange={(e) => setTrackingCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. APP-2026-89412"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-transparent bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:bg-white dark:focus:bg-slate-900 focus:border-[#0B2447]"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl bg-[#0B2447] hover:bg-[#16385C] disabled:opacity-50 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>Track</span>
          </button>
        </form>
      </div>

      {/* Error Alert */}
      {searchError && (
        <div className="max-w-2xl mx-auto mb-8 p-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50/70 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{searchError}</span>
          </div>
          {onNavigateApply && (
            <button
              type="button"
              onClick={onNavigateApply}
              className="underline font-bold hover:text-red-900 cursor-pointer"
            >
              Start New Application
            </button>
          )}
        </div>
      )}

      {/* Application Status Details Card */}
      {applicationData && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Header Bar */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/40">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-black font-mono text-[#0B2447] dark:text-blue-400">
                  {applicationData.trackingCode}
                </span>
                {renderStatusBadge(applicationData.status)}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Submitted on {new Date(applicationData.submittedAt).toLocaleDateString('en-US', { dateStyle: 'long' })}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-2xs"
                style={{ backgroundColor: applicationData.planAccentColor || '#0B2447' }}
              >
                {applicationData.planName}
              </span>
              {applicationData.chapterName && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {applicationData.chapterName}
                </span>
              )}
            </div>
          </div>

          {/* Committee Notes / Changes Requested Callout */}
          {applicationData.status === 'changes_requested' && (
            <div className="p-6 bg-blue-50/60 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-900">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0 mt-0.5">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xs font-bold text-blue-900 dark:text-blue-200">
                    Committee Action Required: Additional Details Requested
                  </h3>
                  <div className="mt-1.5 p-3 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 text-xs font-medium text-slate-800 dark:text-slate-200">
                    {applicationData.adminNotes || 'Please review your application details and resubmit.'}
                  </div>
                  <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-2">
                    You can edit the unlocked fields below and click "Resubmit Application" to send your updates directly back to the chamber review board.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Application Profile Grid */}
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Business Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                <Building2 className="w-4 h-4 text-[#0B2447] dark:text-blue-400" />
                <span>Business Information</span>
              </div>
              <div className="text-xs space-y-1.5">
                <div>
                  <span className="text-slate-400 block text-[11px]">Business Name:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {applicationData.businessName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Industry:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {applicationData.businessDetails?.industry || 'General Business'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Team & Scale:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {applicationData.businessDetails?.employeeCount || 1} employees · $
                    {(applicationData.businessDetails?.annualRevenue || 0).toLocaleString('en-US')} revenue
                  </span>
                </div>
              </div>
            </div>

            {/* Primary Contact Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                <User className="w-4 h-4 text-[#0B2447] dark:text-blue-400" />
                <span>Primary Representative</span>
              </div>
              <div className="text-xs space-y-1.5">
                <div>
                  <span className="text-slate-400 block text-[11px]">Applicant Name:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {applicationData.applicantName} {applicationData.businessDetails?.jobTitle ? `(${applicationData.businessDetails.jobTitle})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Email Address:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {applicationData.businessEmail}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Phone:</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="mt-1 px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 w-full"
                    />
                  ) : (
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {applicationData.businessPhone || 'Not provided'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Address & Online Presence */}
            <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 block text-[11px]">Operating Address:</span>
                  {isEditing ? (
                    <div className="space-y-2 mt-1">
                      <input
                        type="text"
                        value={editStreet}
                        onChange={(e) => setEditStreet(e.target.value)}
                        placeholder="Street"
                        className="px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 w-full"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={editCity}
                          onChange={(e) => setEditCity(e.target.value)}
                          placeholder="City"
                          className="px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 w-full"
                        />
                        <input
                          type="text"
                          value={editState}
                          onChange={(e) => setEditState(e.target.value)}
                          placeholder="State"
                          className="px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 w-full"
                        />
                        <input
                          type="text"
                          value={editZip}
                          onChange={(e) => setEditZip(e.target.value)}
                          placeholder="ZIP"
                          className="px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 w-full"
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {applicationData.businessDetails?.address?.street},{' '}
                      {applicationData.businessDetails?.address?.city},{' '}
                      {applicationData.businessDetails?.address?.state}{' '}
                      {applicationData.businessDetails?.address?.zip}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px]">Website:</span>
                  {isEditing ? (
                    <input
                      type="url"
                      value={editWebsite}
                      onChange={(e) => setEditWebsite(e.target.value)}
                      placeholder="https://company.com"
                      className="mt-1 px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 w-full"
                    />
                  ) : applicationData.businessDetails?.website ? (
                    <a
                      href={applicationData.businessDetails.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 underline"
                    >
                      {applicationData.businessDetails.website}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">None specified</span>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="mt-4">
                <span className="text-slate-400 block text-[11px]">Company Bio:</span>
                {isEditing ? (
                  <textarea
                    rows={2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="mt-1 px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 w-full"
                  />
                ) : (
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                    {applicationData.businessDetails?.description || 'No description provided.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Resubmit Action Bar */}
          {applicationData.status === 'changes_requested' && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleResubmit}
                disabled={isResubmitting}
                className="px-6 py-2.5 rounded-xl bg-[#0B2447] hover:bg-[#16385C] disabled:opacity-50 text-white text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
              >
                {isResubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Resubmit Application</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TrackApplicationPage;
