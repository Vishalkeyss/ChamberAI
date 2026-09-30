import React, { useState, useEffect } from 'react';
import {
  Layers,
  User,
  Building2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { ChapterOption, MembershipPlan } from '../types';
import { fetchPublicPlans, fetchActiveChapters, calculateDues } from '../services/plans.api';
import { submitApplication, type ApplicationSubmitPayload } from '../services/applications.api';
import { WizardStepPlan } from '../components/WizardStepPlan';
import { WizardStepContact } from '../components/WizardStepContact';
import { WizardStepBusiness } from '../components/WizardStepBusiness';
import { WizardStepReview } from '../components/WizardStepReview';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface ApplicationWizardPageProps {
  chamberName?: string;
  chamberSlug?: string;
  initialPlanId?: string;
  onNavigateHome?: () => void;
  onNavigateTrack?: (code: string) => void;
}

const STEP_LABELS = [
  'Plan & Chapter',
  'Primary Contact',
  'Business Profile',
  'Review & Submit',
];

export const ApplicationWizardPage: React.FC<ApplicationWizardPageProps> = ({
  chamberName = 'the Chamber of Commerce',
  chamberSlug,
  initialPlanId,
  onNavigateHome,
  onNavigateTrack,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Loaded database data
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);

  // Form Fields
  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialPlanId || '');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [calculatedPrice, setCalculatedPrice] = useState<number>(0);

  // Contact Info
  const [fullName, setFullName] = useState<string>('');
  const [jobTitle, setJobTitle] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [preferredLanguage, setPreferredLanguage] = useState<string>('en');

  // Business Info
  const [businessName, setBusinessName] = useState<string>('');
  const [dbaName, setDbaName] = useState<string>('');
  const [website, setWebsite] = useState<string>('');
  const [industry, setIndustry] = useState<string>('Technology & Software');
  const [street, setStreet] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [zip, setZip] = useState<string>('');
  const [employeeCount, setEmployeeCount] = useState<number>(5);
  const [annualRevenue, setAnnualRevenue] = useState<number>(250000);
  const [description, setDescription] = useState<string>('');

  // Agreement
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(false);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Submission Outcome
  const [submissionResult, setSubmissionResult] = useState<{
    trackingCode: string;
    status: string;
  } | null>(null);

  const draftStorageKey = `app_draft_${chamberSlug || 'chamber'}`;

  // 1. Fetch live plans and chapters dynamically (ZERO static data)
  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      fetchPublicPlans(chamberSlug).catch(() => []),
      fetchActiveChapters(chamberSlug).catch(() => []),
    ])
      .then(([plansData, chaptersData]) => {
        setPlans(plansData || []);
        setChapters(chaptersData || []);

        // Restore draft from sessionStorage if present
        try {
          const saved = sessionStorage.getItem(draftStorageKey);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.fullName) setFullName(parsed.fullName);
            if (parsed.jobTitle) setJobTitle(parsed.jobTitle);
            if (parsed.email) setEmail(parsed.email);
            if (parsed.phone) setPhone(parsed.phone);
            if (parsed.businessName) setBusinessName(parsed.businessName);
            if (parsed.dbaName) setDbaName(parsed.dbaName);
            if (parsed.website) setWebsite(parsed.website);
            if (parsed.industry) setIndustry(parsed.industry);
            if (parsed.street) setStreet(parsed.street);
            if (parsed.city) setCity(parsed.city);
            if (parsed.state) setState(parsed.state);
            if (parsed.zip) setZip(parsed.zip);
            if (parsed.employeeCount) setEmployeeCount(parsed.employeeCount);
            if (parsed.annualRevenue) setAnnualRevenue(parsed.annualRevenue);
            if (parsed.description) setDescription(parsed.description);
            if (parsed.selectedPlanId) setSelectedPlanId(parsed.selectedPlanId);
            if (parsed.selectedChapterId) setSelectedChapterId(parsed.selectedChapterId);
          }
        } catch {}

        // If no plan selected, pick initial or first active plan
        if (!selectedPlanId && plansData && plansData.length > 0) {
          const matched = initialPlanId ? plansData.find((p) => p.id === initialPlanId) : plansData[0];
          setSelectedPlanId(matched ? matched.id : plansData[0].id);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [chamberSlug, initialPlanId]);

  // 2. Persist draft to sessionStorage
  useEffect(() => {
    if (isLoading || submissionResult) return;
    try {
      const draft = {
        selectedPlanId,
        selectedChapterId,
        fullName,
        jobTitle,
        email,
        phone,
        preferredLanguage,
        businessName,
        dbaName,
        website,
        industry,
        street,
        city,
        state,
        zip,
        employeeCount,
        annualRevenue,
        description,
      };
      sessionStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch {}
  }, [
    selectedPlanId,
    selectedChapterId,
    fullName,
    jobTitle,
    email,
    phone,
    preferredLanguage,
    businessName,
    dbaName,
    website,
    industry,
    street,
    city,
    state,
    zip,
    employeeCount,
    annualRevenue,
    description,
    isLoading,
    submissionResult,
  ]);

  // 3. Dynamic dues recalculation
  useEffect(() => {
    const activePlan = plans.find((p) => p.id === selectedPlanId);
    if (!activePlan) {
      setCalculatedPrice(0);
      return;
    }

    if (!activePlan.pricingBasis || activePlan.pricingBasis === 'flat') {
      setCalculatedPrice(activePlan.price);
      return;
    }

    setIsCalculating(true);
    calculateDues(
      {
        planId: activePlan.id,
        employeeCount,
        annualRevenue,
        chapterId: selectedChapterId || undefined,
      },
      chamberSlug
    )
      .then((res) => {
        setCalculatedPrice(res.calculatedPrice);
      })
      .catch(() => {
        setCalculatedPrice(activePlan.price);
      })
      .finally(() => {
        setIsCalculating(false);
      });
  }, [selectedPlanId, selectedChapterId, employeeCount, annualRevenue, plans, chamberSlug]);

  const handleFieldChange = (field: string, val: any) => {
    setErrors((prev) => ({ ...prev, [field]: '' }));
    switch (field) {
      case 'fullName':
        setFullName(val);
        break;
      case 'jobTitle':
        setJobTitle(val);
        break;
      case 'email':
        setEmail(val);
        break;
      case 'phone':
        setPhone(val);
        break;
      case 'preferredLanguage':
        setPreferredLanguage(val);
        break;
      case 'businessName':
        setBusinessName(val);
        break;
      case 'dbaName':
        setDbaName(val);
        break;
      case 'website':
        setWebsite(val);
        break;
      case 'industry':
        setIndustry(val);
        break;
      case 'street':
        setStreet(val);
        break;
      case 'city':
        setCity(val);
        break;
      case 'state':
        setState(val);
        break;
      case 'zip':
        setZip(val);
        break;
      case 'employeeCount':
        setEmployeeCount(val);
        break;
      case 'annualRevenue':
        setAnnualRevenue(val);
        break;
      case 'description':
        setDescription(val);
        break;
    }
  };

  // Step Validation Guard
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!selectedPlanId) {
        newErrors.plan = 'Please select a membership plan';
      }
    } else if (step === 2) {
      if (!fullName.trim()) newErrors.fullName = 'Full Name is required';
      if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) newErrors.email = 'Valid email is required';
      if (!phone.trim()) newErrors.phone = 'Phone number is required';
    } else if (step === 3) {
      if (!businessName.trim()) newErrors.businessName = 'Business name is required';
      if (!industry.trim()) newErrors.industry = 'Industry category is required';
      if (!street.trim()) newErrors.street = 'Street address is required';
      if (!city.trim()) newErrors.city = 'City is required';
      if (!state.trim()) newErrors.state = 'State is required';
      if (!zip.trim()) newErrors.zip = 'ZIP code is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Final Submission
  const handleSubmit = async () => {
    if (!agreedToTerms) {
      toast.error('Please agree to the Chamber Code of Conduct and Terms before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: ApplicationSubmitPayload = {
        applicantName: fullName.trim(),
        businessEmail: email.trim().toLowerCase(),
        businessPhone: phone.trim(),
        businessName: businessName.trim(),
        planId: selectedPlanId,
        chapterId: selectedChapterId || null,
        businessDetails: {
          dbaName: dbaName.trim() || undefined,
          website: website.trim() || undefined,
          industry,
          address: {
            street: street.trim(),
            city: city.trim(),
            state: state.trim(),
            zip: zip.trim(),
          },
          employeeCount,
          annualRevenue,
          description: description.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          preferredLanguage,
        },
      };

      const result = await submitApplication(payload, chamberSlug);
      sessionStorage.removeItem(draftStorageKey);
      setSubmissionResult({
        trackingCode: result.trackingCode,
        status: result.status,
      });
      toast.success('Membership application submitted successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit application. Please check your details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (!submissionResult?.trackingCode) return;
    navigator.clipboard.writeText(submissionResult.trackingCode);
    setCopiedCode(true);
    toast.success('Tracking code copied to clipboard!');
    setTimeout(() => setCopiedCode(false), 2500);
  };

  // Post-Submission Confirmation Screen
  if (submissionResult) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-5 ring-8 ring-emerald-50 dark:ring-emerald-950/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            {submissionResult.status === 'approved' ? 'Application Approved!' : 'Application Under Review'}
          </span>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Thank You, {fullName}!
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
            Your application for <strong>{businessName}</strong> has been logged with {chamberName}.
            A confirmation receipt has been sent to <strong>{email}</strong>.
          </p>

          {/* Highlighted Tracking Code Card */}
          <div className="mt-8 p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 max-w-md mx-auto">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Your Application Tracking Code
            </span>
            <div className="flex items-center justify-center gap-3 mt-2">
              <span className="text-2xl font-mono font-black text-[#0B2447] dark:text-blue-400 tracking-wider">
                {submissionResult.trackingCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 shadow-2xs transition-colors"
                title="Copy Tracking Code"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Save this code. You can use it anytime to check status, review committee feedback, or resubmit updates.
            </p>
          </div>

          {/* CTA Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <button
              type="button"
              onClick={() => {
                if (onNavigateTrack) {
                  onNavigateTrack(submissionResult.trackingCode);
                } else {
                  window.location.href = `/track-application/${submissionResult.trackingCode}`;
                }
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#0B2447] hover:bg-[#16385C] text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <span>Track Application Status</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            {onNavigateHome && (
              <button
                type="button"
                onClick={onNavigateHome}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-xs cursor-pointer transition-colors"
              >
                Return to Directory
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Active Plan & Chapter Objects
  const chosenPlan = plans.find((p) => p.id === selectedPlanId);
  const chosenChapter = chapters.find((c) => c.id === selectedChapterId);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      {/* Wizard Header */}
      <div className="text-center mb-8">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Chamber Membership Application
        </span>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
          Apply to Join {chamberName}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-lg mx-auto">
          Complete our 4-step membership application to connect your business with regional business leaders and exclusive community perks.
        </p>

        {/* 4-Step Progress Indicator */}
        <div className="max-w-xl mx-auto mt-6">
          <div className="grid grid-cols-4 gap-2 mb-2">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={cn(
                  'h-1.5 rounded-full transition-colors duration-200',
                  step <= currentStep
                    ? 'bg-[#0B2447] dark:bg-blue-600'
                    : 'bg-slate-200 dark:bg-slate-800'
                )}
              />
            ))}
          </div>
          <div className="grid grid-cols-4 text-center">
            {STEP_LABELS.map((label, idx) => (
              <span
                key={idx}
                className={cn(
                  'text-[10px] font-semibold tracking-tight transition-colors',
                  idx + 1 === currentStep
                    ? 'text-[#0B2447] dark:text-blue-400 font-bold'
                    : idx + 1 < currentStep
                    ? 'text-slate-700 dark:text-slate-300'
                    : 'text-slate-400 dark:text-slate-600'
                )}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 sm:p-8">
        {isLoading ? (
          <div className="py-16 text-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0B2447] dark:text-blue-400 mb-3" />
            <p className="text-xs font-semibold">Loading membership options...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No Membership Plans Available
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              This chamber does not currently have public membership plans configured. Please check back later or contact the chamber office directly.
            </p>
          </div>
        ) : (
          <div>
            {/* Step 1: Plan & Chapter */}
            {currentStep === 1 && (
              <WizardStepPlan
                plans={plans}
                chapters={chapters}
                selectedPlanId={selectedPlanId}
                selectedChapterId={selectedChapterId}
                calculatedPrice={calculatedPrice}
                isCalculating={isCalculating}
                onSelectPlan={(id) => setSelectedPlanId(id)}
                onSelectChapter={(id) => setSelectedChapterId(id)}
              />
            )}

            {/* Step 2: Contact Info */}
            {currentStep === 2 && (
              <WizardStepContact
                fullName={fullName}
                jobTitle={jobTitle}
                email={email}
                phone={phone}
                preferredLanguage={preferredLanguage}
                errors={errors}
                onChange={handleFieldChange}
              />
            )}

            {/* Step 3: Business Details */}
            {currentStep === 3 && (
              <WizardStepBusiness
                businessName={businessName}
                dbaName={dbaName}
                website={website}
                industry={industry}
                street={street}
                city={city}
                state={state}
                zip={zip}
                employeeCount={employeeCount}
                annualRevenue={annualRevenue}
                description={description}
                errors={errors}
                onChange={handleFieldChange}
              />
            )}

            {/* Step 4: Review & Agreement */}
            {currentStep === 4 && (
              <WizardStepReview
                plan={chosenPlan}
                chapter={chosenChapter}
                calculatedPrice={calculatedPrice}
                fullName={fullName}
                jobTitle={jobTitle}
                email={email}
                phone={phone}
                businessName={businessName}
                dbaName={dbaName}
                website={website}
                industry={industry}
                street={street}
                city={city}
                state={state}
                zip={zip}
                employeeCount={employeeCount}
                annualRevenue={annualRevenue}
                description={description}
                agreedToTerms={agreedToTerms}
                onToggleTerms={setAgreedToTerms}
              />
            )}

            {/* Step Navigation Controls */}
            <div className="flex items-center justify-between pt-8 mt-8 border-t border-slate-100 dark:border-slate-800">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2.5 rounded-xl bg-[#0B2447] hover:bg-[#16385C] text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !agreedToTerms}
                  className="px-6 py-2.5 rounded-xl bg-[#0B2447] hover:bg-[#16385C] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting Application...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Submit Application</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApplicationWizardPage;
