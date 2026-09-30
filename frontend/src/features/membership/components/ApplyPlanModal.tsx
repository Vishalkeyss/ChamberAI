import React, { useState, useEffect } from 'react';
import {
  X,
  Award,
  CheckCircle2,
  Clock,
  MapPin,
  Plus,
  Loader2,
  Copy,
  Check,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
  Phone,
  Mail,
  User,
  ExternalLink,
} from 'lucide-react';
import type { ChapterOption, MembershipPlan } from '../types';
import { calculateDues } from '../services/plans.api';
import { submitApplication } from '../services/applications.api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface ApplyPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: MembershipPlan | null;
  chamberName: string;
  chamberSlug?: string;
  chapters?: ChapterOption[];
  onTrackApplication?: (code: string) => void;
}

interface StaffMember {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
}

export const ApplyPlanModal: React.FC<ApplyPlanModalProps> = ({
  isOpen,
  onClose,
  plan,
  chamberName,
  chamberSlug,
  chapters = [],
  onTrackApplication,
}) => {
  // Form fields
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');
  const [revenue, setRevenue] = useState('');
  const [website, setWebsite] = useState('');
  const [landingPage, setLandingPage] = useState('');

  // Socials
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [twitter, setTwitter] = useState('');
  const [youtube, setYoutube] = useState('');

  // Staff members
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [staffDraft, setStaffDraft] = useState<StaffMember>({
    name: '',
    title: '',
    email: '',
    phone: '',
  });

  // Chapter
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');

  // Submission & Dues state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);
  const [submittedData, setSubmittedData] = useState<{
    trackingCode: string;
    submittedAt: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Initialize chapter selection
  useEffect(() => {
    if (chapters.length > 0 && !selectedChapterId) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [chapters, selectedChapterId]);

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen && plan) {
      setCalculatedPrice(plan.price);
      setSubmittedData(null);
      setCopiedCode(false);
    }
  }, [isOpen, plan]);

  // Recalculate dynamic dues when employee count, revenue, or chapter changes
  useEffect(() => {
    if (!plan || plan.pricingBasis === 'flat') {
      if (plan) setCalculatedPrice(plan.price);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCalculating(true);
      try {
        const emp = employeeCount ? parseInt(employeeCount, 10) : undefined;
        const rev = revenue ? parseFloat(revenue) : undefined;
        const result = await calculateDues(
          {
            planId: plan.id,
            employeeCount: emp,
            annualRevenue: rev,
            chapterId: selectedChapterId || undefined,
          },
          chamberSlug
        );
        setCalculatedPrice(result.calculatedPrice);
      } catch (err) {
        console.error('Error recalculating live dues:', err);
      } finally {
        setIsCalculating(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [plan, employeeCount, revenue, selectedChapterId, chamberSlug]);

  if (!isOpen || !plan) return null;

  const isTiered = plan.pricingBasis && plan.pricingBasis !== 'flat';
  const lowestPrice =
    isTiered && plan.pricingTiers && plan.pricingTiers.length > 0
      ? Math.min(...plan.pricingTiers.map((t) => t.price))
      : plan.price;

  const displayPrice = isTiered
    ? `From $${lowestPrice}/yr`
    : plan.price === 0
    ? '$0/yr'
    : `$${plan.price}/yr`;

  const livePriceDisplay =
    calculatedPrice !== null && calculatedPrice !== undefined
      ? `$${calculatedPrice}/yr`
      : displayPrice;

  const handleAddStaff = () => {
    if (!staffDraft.name.trim()) {
      toast.error('Staff member name is required');
      return;
    }
    setStaffList([...staffList, { ...staffDraft, name: staffDraft.name.trim() }]);
    setStaffDraft({ name: '', title: '', email: '', phone: '' });
    setIsAddingStaff(false);
  };

  const handleRemoveStaff = (index: number) => {
    setStaffList(staffList.filter((_, idx) => idx !== index));
  };

  const handleCopyTrackingCode = () => {
    if (!submittedData?.trackingCode) return;
    navigator.clipboard.writeText(submittedData.trackingCode);
    setCopiedCode(true);
    toast.success('Tracking code copied to clipboard');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !businessName.trim() || !email.trim() || !phone.trim()) {
      toast.error('Please fill in all required fields (Full Name, Business Name, Email, Phone)');
      return;
    }

    if (plan.pricingBasis === 'by_employee_count' && !employeeCount) {
      toast.error('Please enter your number of employees for this tiered plan');
      return;
    }

    if (plan.pricingBasis === 'by_annual_revenue' && !revenue) {
      toast.error('Please enter your annual gross revenue for this tiered plan');
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedEmp = employeeCount ? parseInt(employeeCount, 10) : undefined;
      const parsedRev = revenue ? parseFloat(revenue) : undefined;

      const payload = {
        planId: plan.id,
        chapterId: selectedChapterId || undefined,
        applicantName: fullName.trim(),
        businessName: businessName.trim(),
        businessEmail: email.trim().toLowerCase(),
        businessPhone: phone.trim(),
        businessDetails: {
          website: website.trim() || undefined,
          landingPage: landingPage.trim() || undefined,
          employeeCount: parsedEmp,
          annualRevenue: parsedRev,
          socials: {
            facebook: facebook.trim() || undefined,
            instagram: instagram.trim() || undefined,
            linkedin: linkedin.trim() || undefined,
            twitter: twitter.trim() || undefined,
            other: youtube.trim() || undefined,
          },
          staff: staffList,
        },
      };

      const response = await submitApplication(payload, chamberSlug);

      if (response && response.trackingCode) {
        setSubmittedData({
          trackingCode: response.trackingCode,
          submittedAt: new Date().toISOString(),
        });
        toast.success(`Application submitted! Tracking Code: ${response.trackingCode}`);
      } else {
        toast.error('Failed to submit application. Please try again.');
      }
    } catch (err: any) {
      console.error('Submit application error:', err);
      toast.error(err?.message || 'Failed to submit application. Please verify your details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Apply for {plan.name} Membership
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {displayPrice} · Application Form
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-4">
          
          {submittedData ? (
            /* Post-Submission Success State */
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 size={34} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Application Submitted
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 max-w-md mx-auto leading-relaxed">
                  Thanks, <strong className="text-slate-900 dark:text-white">{fullName}</strong>. Your{' '}
                  <strong className="text-slate-900 dark:text-white">{plan.name}</strong> membership application to{' '}
                  <strong className="text-slate-900 dark:text-white">{chamberName}</strong> has been received.
                </p>
              </div>

              {/* Status Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                <Clock size={13} />
                <span>Pending Admin Review</span>
              </div>

              {/* Reference ID Card */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 max-w-sm mx-auto">
                <div className="text-left">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block uppercase tracking-wider">
                    Reference ID
                  </span>
                  <span className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                    {submittedData.trackingCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyTrackingCode}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 transition cursor-pointer shadow-2xs"
                >
                  {copiedCode ? (
                    <>
                      <Check size={13} className="text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Steps Card */}
              <div className="text-left bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-2">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  What happens next:
                </p>
                <div className="space-y-2 text-slate-600 dark:text-slate-400">
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                    <span>Application enters {chamberName}'s review queue — no other chamber sees it.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                    <span>Admin approves / requests changes / rejects.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                    <span>On approval, invoice is auto-generated for the plan fee.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">4</span>
                    <span>After payment, you get member access + digital certificate.</span>
                  </div>
                </div>
              </div>

              {/* Confirmation Email Alert */}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                A confirmation has been recorded for <strong>{email}</strong>. We'll update the tracking status once an admin reviews your application.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                {onTrackApplication && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onTrackApplication(submittedData.trackingCode);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-xs inline-flex items-center justify-center gap-1.5 bg-[#0B2447] hover:bg-[#16385C] text-white transition cursor-pointer"
                  >
                    <span>Track Application</span>
                    <ExternalLink size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-xs inline-flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* Active Form State */
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Selected Plan Highlight Banner */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Award size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                      Selected plan: {plan.name} — {livePriceDisplay}
                    </span>
                    {isTiered && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {isCalculating ? 'Updating dues calculation...' : 'Exact price dynamically calculated'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Full Name* */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Full Name*
                </label>
                <input
                  required
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alexander Morgan"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Business Name* */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Business Name*
                </label>
                <input
                  required
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Morgan Steel Traders"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Email* & Phone* in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Email*
                  </label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@business.com"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Phone*
                  </label>
                  <input
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98xxxxxxxx0"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Number of Employees (optional) */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Number of Employees {plan.pricingBasis === 'by_employee_count' ? '*' : '(optional)'}
                </label>
                <input
                  required={plan.pricingBasis === 'by_employee_count'}
                  type="number"
                  min="1"
                  value={employeeCount}
                  onChange={(e) => setEmployeeCount(e.target.value)}
                  placeholder="e.g. 12"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                {plan.pricingBasis === 'by_employee_count' && (
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                    This plan is priced by employee count — live dues recalculate dynamically.
                  </p>
                )}
              </div>

              {/* Annual Revenue in USD (optional) */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Annual Revenue in USD {plan.pricingBasis === 'by_annual_revenue' ? '*' : '(optional)'}
                </label>
                <input
                  required={plan.pricingBasis === 'by_annual_revenue'}
                  type="number"
                  min="0"
                  value={revenue}
                  onChange={(e) => setRevenue(e.target.value)}
                  placeholder="e.g. 500000"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                {plan.pricingBasis === 'by_annual_revenue' && (
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                    This plan is priced by annual revenue — live dues recalculate dynamically.
                  </p>
                )}
              </div>

              {/* Website (optional) */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Website (optional)
                </label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="e.g. yourbusiness.com"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Landing Page / Custom Link (optional) */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Landing Page / Custom Link (optional)
                </label>
                <input
                  type="text"
                  value={landingPage}
                  onChange={(e) => setLandingPage(e.target.value)}
                  placeholder="e.g. yourbusiness.com/book-a-call"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Social Media (optional) */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Social Media (optional)
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                  Shown as icon links on your Directory profile. You can add these now or later.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <Facebook size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={facebook}
                      onChange={(e) => setFacebook(e.target.value)}
                      placeholder="facebook.com/yourbusiness"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="relative">
                    <Instagram size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      placeholder="instagram.com/yourbusiness"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="relative">
                    <Linkedin size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      placeholder="linkedin.com/company/yourbusiness"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="relative">
                    <Twitter size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={twitter}
                      onChange={(e) => setTwitter(e.target.value)}
                      placeholder="x.com/yourbusiness"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="relative sm:col-span-2">
                    <Youtube size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={youtube}
                      onChange={(e) => setYoutube(e.target.value)}
                      placeholder="youtube.com/@yourbusiness"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Team / Staff Members (optional) */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Team / Staff Members (optional)
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                  Add colleagues who should be listed under your business. You can also add them later from your profile.
                </p>

                {/* Added staff list */}
                {staffList.length > 0 && (
                  <div className="space-y-2 mb-2.5">
                    {staffList.map((st, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {st.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {[st.title, st.email, st.phone].filter(Boolean).join(' · ') || 'Staff member'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStaff(idx)}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add staff draft editor or button */}
                {isAddingStaff ? (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-2.5">
                    <input
                      type="text"
                      value={staffDraft.name}
                      onChange={(e) => setStaffDraft({ ...staffDraft, name: e.target.value })}
                      placeholder="Full Name* (e.g. Priya Raman)"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={staffDraft.title || ''}
                        onChange={(e) => setStaffDraft({ ...staffDraft, title: e.target.value })}
                        placeholder="Title (e.g. Operations Mgr)"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                      <input
                        type="email"
                        value={staffDraft.email || ''}
                        onChange={(e) => setStaffDraft({ ...staffDraft, email: e.target.value })}
                        placeholder="Email (name@company.com)"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <input
                      type="tel"
                      value={staffDraft.phone || ''}
                      onChange={(e) => setStaffDraft({ ...staffDraft, phone: e.target.value })}
                      placeholder="Phone (e.g. (512) 555-0134)"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleAddStaff}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0B2447] text-white hover:bg-[#16385C] cursor-pointer"
                      >
                        Add to list
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingStaff(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingStaff(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Add Staff Member</span>
                  </button>
                )}
              </div>

              {/* Chapter* Selector */}
              {chapters.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Chapter*
                  </label>
                  <div className="relative">
                    <MapPin size={15} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                    <select
                      value={selectedChapterId}
                      onChange={(e) => setSelectedChapterId(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                    >
                      {chapters.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.name} {ch.city_region ? `(${ch.city_region})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {chamberName} has {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'} — pick the one closest to you.
                  </p>
                </div>
              )}

              {/* What happens next Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  What happens next:
                </p>
                <div className="space-y-2 text-slate-600 dark:text-slate-300 text-[11px]">
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                    <span>Application enters {chamberName}'s review queue — no other chamber sees it.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                    <span>Admin approves / requests changes / rejects.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                    <span>On approval, invoice is auto-generated for the plan fee.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">4</span>
                    <span>After payment, you get member access + digital certificate.</span>
                  </div>
                </div>
              </div>

              {/* Full Width Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white bg-[#0B2447] hover:bg-[#16385C] active:scale-[0.99] transition duration-150 shadow-sm disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <span>Submit Application</span>
                )}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
