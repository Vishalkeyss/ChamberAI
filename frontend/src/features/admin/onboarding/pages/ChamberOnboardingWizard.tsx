import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  Upload,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  fetchOnboardingState,
  submitFinishOnboarding,
  type OnboardingFinishPayload,
} from '../services/onboarding.api';

interface ChamberOnboardingWizardProps {
  chamberName?: string;
  onComplete: () => void;
  onExit?: () => void;
}

interface PlanItem {
  id?: string;
  name: string;
  price: string;
  billing_frequency: 'annual' | 'monthly';
  pricing_basis: 'flat' | 'by_employee_count' | 'by_annual_revenue';
  features: string[];
  selected: boolean;
  accent_color: string;
}

const STEP_TITLES = [
  'Chamber Profile',
  'Branding',
  'Payment Gateway',
  'Membership Plans',
  'Invite First Members',
];

const THEME_PRESETS = [
  { id: 'navy', name: 'Navy Executive', primary: '#0B2447', text: '#FFFFFF', bg: '#F5F7FA' },
  { id: 'emerald', name: 'Emerald Growth', primary: '#064E3B', text: '#FFFFFF', bg: '#F0FDF4' },
  { id: 'indigo', name: 'Royal Indigo', primary: '#312E81', text: '#FFFFFF', bg: '#EEF2FF' },
  { id: 'slate', name: 'Modern Slate', primary: '#0F172A', text: '#FFFFFF', bg: '#F8FAFC' },
  { id: 'crimson', name: 'Crimson Crest', primary: '#881337', text: '#FFFFFF', bg: '#FFF1F2' },
  { id: 'cyan', name: 'Ocean Cyan', primary: '#0E7490', text: '#FFFFFF', bg: '#ECFEFF' },
];

export const ChamberOnboardingWizard: React.FC<ChamberOnboardingWizardProps> = ({
  chamberName = 'Austin Chamber of Commerce',
  onComplete,
  onExit,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean>(false);

  // Step 1: Chamber Profile
  const [chamberNameInput, setChamberNameInput] = useState<string>(chamberName);
  const [city, setCity] = useState<string>('');

  // Step 2: Branding & Theme
  const [primaryColor, setPrimaryColor] = useState<string>('#0B2447');
  const [primaryTextColor, setPrimaryTextColor] = useState<string>('#FFFFFF');
  const [backgroundColor, setBackgroundColor] = useState<string>('#F5F7FA');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [heroHeadline, setHeroHeadline] = useState<string>('Where Local Businesses Connect, Grow & Prosper');
  const [heroTagline, setHeroTagline] = useState<string>('Join our community of business pioneers, civic leaders, and local trade partners.');

  // Step 3: Payment Gateway
  const [gatewayProvider, setGatewayProvider] = useState<'stripe' | 'razorpay' | 'paypal'>('stripe');
  const [publishableKey, setPublishableKey] = useState<string>('');
  const [secretKey, setSecretKey] = useState<string>('');
  const [gatewayConnected, setGatewayConnected] = useState<boolean>(true);

  // Step 4: Membership Plans
  const [offerPlans, setOfferPlans] = useState<boolean>(true);
  const [initialDbPlansCount, setInitialDbPlansCount] = useState<number>(0);
  const [plans, setPlans] = useState<PlanItem[]>([]);

  // Step 5: Invite Members
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvRowCount, setCsvRowCount] = useState<number>(0);

  // Load real tenant onboarding state from backend API (ZERO static data)
  useEffect(() => {
    setIsLoading(true);
    fetchOnboardingState()
      .then((data) => {
        if (data) {
          if (data.is_completed) {
            setIsOnboardingCompleted(true);
          }

          if (data.profile?.org_name) {
            setChamberNameInput(data.profile.org_name);
          } else if (chamberName) {
            setChamberNameInput(chamberName);
          }

          if (data.profile?.city) {
            setCity(data.profile.city);
          }

          if (data.branding?.primary_color) {
            setPrimaryColor(data.branding.primary_color);
          }
          if (data.branding?.text_color) {
            setPrimaryTextColor(data.branding.text_color);
          }
          if (data.branding?.background_color) {
            setBackgroundColor(data.branding.background_color);
          }
          if (data.branding?.logo_url) {
            setLogoUrl(data.branding.logo_url);
          }
          if (data.branding?.hero_headline) {
            setHeroHeadline(data.branding.hero_headline);
          }
          if (data.branding?.hero_tagline) {
            setHeroTagline(data.branding.hero_tagline);
          }

          if (data.payment_gateway) {
            if (data.payment_gateway.provider && data.payment_gateway.provider !== 'none') {
              setGatewayProvider(data.payment_gateway.provider as 'stripe' | 'razorpay' | 'paypal');
            }
            if (data.payment_gateway.publishable_key) {
              setPublishableKey(data.payment_gateway.publishable_key);
            }
            if (data.payment_gateway.secret_key) {
              setSecretKey(data.payment_gateway.secret_key);
            }
            setGatewayConnected(data.payment_gateway.status === 'connected');
          }

          if (Array.isArray(data.plans) && data.plans.length > 0) {
            setInitialDbPlansCount(data.plans.length);
            setPlans(
              data.plans.map((p) => ({
                id: p.id,
                name: p.name,
                price: typeof p.price === 'number' ? `$${p.price}/yr` : String(p.price || '$0/yr'),
                billing_frequency: p.billing_frequency || 'annual',
                pricing_basis: p.pricing_basis || 'flat',
                features: Array.isArray(p.features) ? p.features : [],
                selected: p.is_active !== false,
                accent_color: p.accent_color || '#0B2447',
              }))
            );
          } else {
            // Chamber has no plans yet in DB
            setInitialDbPlansCount(0);
            setPlans([
              {
                name: 'Free',
                price: '$0/yr',
                billing_frequency: 'annual',
                pricing_basis: 'flat',
                features: ['Basic directory listing'],
                selected: true,
                accent_color: '#0B2447',
              },
            ]);
          }
        }
      })
      .catch((err) => {
        console.warn('Could not load dynamic onboarding state:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [chamberName]);

  // Dynamic Initials generator from chamber name
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (name.slice(0, 2) || 'AC').toUpperCase();
  };

  // Plan Handlers
  const handleTogglePlanSelected = (index: number, selected: boolean) => {
    setPlans((prev) =>
      prev.map((p, i) => (i === index ? { ...p, selected } : p))
    );
  };

  const handleUpdatePlanName = (index: number, name: string) => {
    setPlans((prev) =>
      prev.map((p, i) => (i === index ? { ...p, name } : p))
    );
  };

  const handleUpdatePlanPrice = (index: number, price: string) => {
    setPlans((prev) =>
      prev.map((p, i) => (i === index ? { ...p, price } : p))
    );
  };

  const handleAddPlan = () => {
    setPlans((prev) => [
      ...prev,
      {
        name: `Plan ${prev.length + 1}`,
        price: '$100/yr',
        billing_frequency: 'annual',
        pricing_basis: 'flat',
        features: ['Directory listing', 'Event discounts'],
        selected: true,
        accent_color: '#0B2447',
      },
    ]);
  };

  const handleRemovePlan = (index: number) => {
    setPlans((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddFeature = (planIndex: number) => {
    setPlans((prev) =>
      prev.map((p, i) => {
        if (i !== planIndex) return p;
        return {
          ...p,
          features: [...p.features, 'New benefit / feature'],
        };
      })
    );
  };

  const handleUpdateFeature = (planIndex: number, featureIndex: number, val: string) => {
    setPlans((prev) =>
      prev.map((p, i) => {
        if (i !== planIndex) return p;
        const newFeats = [...p.features];
        newFeats[featureIndex] = val;
        return { ...p, features: newFeats };
      })
    );
  };

  const handleRemoveFeature = (planIndex: number, featureIndex: number) => {
    setPlans((prev) =>
      prev.map((p, i) => {
        if (i !== planIndex) return p;
        return {
          ...p,
          features: p.features.filter((_, fIdx) => fIdx !== featureIndex),
        };
      })
    );
  };

  // Step 2: Handle logo file upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setLogoUrl(event.target.result as string);
          toast.success('Chamber logo loaded');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Step 5: Handle CSV file selection
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = (event.target?.result as string) || '';
        const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
        const count = Math.max(0, lines.length - 1);
        setCsvRowCount(count);
        toast.success(`Loaded ${file.name} with ${count} member rows`);
      };
      reader.readAsText(file);
    }
  };

  // Step 5: Real CSV sample download
  const handleDownloadSampleCsv = () => {
    const headers = [
      'Full Name',
      'Business / Company',
      'Email',
      'City',
      'Industry',
      'Skills & Interests',
      'Membership Plan',
      'Group / Chapter',
    ];
    const sampleRows = [
      [
        'Sarah Jenkins',
        'Apex Tech Solutions',
        'sarah@apextech.io',
        city || 'Austin',
        'Technology',
        'AI & Cloud Computing',
        plans[0]?.name || 'Standard Member',
        'Downtown Chapter',
      ],
      [
        'Michael Chang',
        'Green Horizon Architecture',
        'mchang@greenhorizon.com',
        city || 'Austin',
        'Architecture & Design',
        'Sustainable Design',
        plans[1]?.name || plans[0]?.name || 'Executive Member',
        'Metro Chapter',
      ],
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...sampleRows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${(chamberNameInput || 'chamber').toLowerCase().replace(/\s+/g, '_')}_member_sample.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Finish setup handler
  const handleFinishSetup = async () => {
    if (!chamberNameInput.trim()) {
      toast.error('Chamber Name is required');
      setCurrentStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      const activePlans = offerPlans
        ? plans
          .filter((p) => p.selected)
          .map((p) => {
            const numericPrice = parseFloat(p.price.replace(/[^0-9.]/g, '')) || 0;
            return {
              id: p.id,
              name: p.name,
              price: numericPrice,
              billing_frequency: p.billing_frequency,
              pricing_basis: p.pricing_basis,
              features: p.features,
              accent_color: p.accent_color,
              is_popular: false,
            };
          })
        : [];

      const payload: OnboardingFinishPayload = {
        profile: {
          org_name: chamberNameInput.trim(),
          city: city.trim(),
          default_currency: 'USD',
          timezone: 'America/Chicago',
        },
        branding: {
          primary_color: primaryColor,
          text_color: primaryTextColor,
          background_color: backgroundColor,
          logo_url: logoUrl,
          hero_headline: heroHeadline.trim() || 'Empowering Local Businesses to Connect, Grow & Prosper',
          hero_tagline: heroTagline.trim() || 'Join our community of business pioneers, civic leaders, and local trade partners.',
        },
        payment_gateway: gatewayConnected
          ? {
            provider: gatewayProvider,
            publishable_key: publishableKey,
            secret_key: secretKey,
          }
          : undefined,
        plans: activePlans,
      };

      await submitFinishOnboarding(payload);
      toast.success('Chamber onboarding completed successfully!');
      setIsOnboardingCompleted(true);
      onComplete();
    } catch (err: any) {
      toast.error(err.message || 'Failed to finalize setup');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentChamberName = chamberNameInput.trim() || chamberName;

  if (isLoading) {
    return (
      <div className="w-full py-16 flex justify-center items-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-medium">Checking onboarding status...</p>
        </div>
      </div>
    );
  }

  if (isOnboardingCompleted) {
    return (
      <div className="w-full py-6 flex justify-center items-start">
        <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xs p-8 max-w-3xl w-full mx-auto space-y-6">
          {/* Header Badge */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/20 shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Onboarding Completed &amp; Active</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-card-foreground">
                Chamber Onboarding Completed
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Initial chamber setup is finished. The chamber profile, branding, payments, and membership plans are activated.
              </p>
            </div>
          </div>

          {/* Locked Notice */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-100">Onboarding Wizard is Locked</p>
              <p className="mt-0.5 text-amber-800/90 dark:text-amber-300/90">
                You cannot re-run the initial onboarding wizard once completed. To modify your chamber name, brand colors, payment integrations, or plans, navigate to the dedicated admin sections below.
              </p>
            </div>
          </div>

          {/* Configuration Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Chamber</p>
              <p className="text-sm font-bold text-foreground mt-1 truncate">{currentChamberName}</p>
              <p className="text-xs text-muted-foreground">{city || 'Primary Region'}</p>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Brand Palette</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className="w-5 h-5 rounded-full border border-black/10 shadow-xs shrink-0"
                  style={{ backgroundColor: primaryColor }}
                />
                <span className="text-xs font-mono font-medium text-foreground">{primaryColor}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Theme applied</p>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Plans Configured</p>
              <p className="text-sm font-bold text-foreground mt-1">
                {plans.filter((p) => p.selected).length} Active {plans.filter((p) => p.selected).length === 1 ? 'Tier' : 'Tiers'}
              </p>
              <p className="text-xs text-muted-foreground">Live for public signups</p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onComplete}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Go to Admin Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border bg-card text-foreground font-semibold text-sm hover:bg-muted transition-colors cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-6 flex justify-center items-start">
      {/* Main Card Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-8 max-w-4xl w-full mx-auto">
        {/* Header */}
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Chamber Onboarding Wizard
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Step {currentStep} of 5 — {STEP_TITLES[currentStep - 1]} · {currentChamberName}
        </p>

        {/* 5-Segment Horizontal Progress Bar */}
        <div className="grid grid-cols-5 gap-2 my-5">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={cn(
                'h-1.5 rounded-full transition-colors duration-200',
                s <= currentStep
                  ? 'bg-[#0B2447] dark:bg-blue-600'
                  : 'bg-slate-200 dark:bg-slate-700'
              )}
            />
          ))}
        </div>

        {/* STEP 1: Chamber Profile */}
        {currentStep === 1 && (
          <div className="mt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Chamber Name*
              </label>
              <input
                type="text"
                value={chamberNameInput}
                onChange={(e) => setChamberNameInput(e.target.value)}
                placeholder="e.g. Austin Chamber of Commerce"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
              />
            </div>

            <div className="mt-5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Registered City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Austin"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
              />
            </div>

            <div className="mt-8">
              <button
                type="button"
                onClick={() => {
                  if (!chamberNameInput.trim()) {
                    toast.error('Chamber Name is required');
                    return;
                  }
                  setCurrentStep(2);
                }}
                className="px-5 py-2 rounded-lg bg-[#0B2447] hover:bg-[#16385C] text-white text-xs font-semibold shadow-xs transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Branding & Theme Selection */}
        {currentStep === 2 && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Theme Presets & Color Controls */}
            <div className="lg:col-span-7 space-y-6">
              {/* Curated Theme Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Curated Chamber Theme Presets
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                  Select a pre-designed palette or customize each color individually below.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {THEME_PRESETS.map((preset) => {
                    const isSelected =
                      primaryColor.toLowerCase() === preset.primary.toLowerCase() &&
                      primaryTextColor.toLowerCase() === preset.text.toLowerCase() &&
                      backgroundColor.toLowerCase() === preset.bg.toLowerCase();
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setPrimaryColor(preset.primary);
                          setPrimaryTextColor(preset.text);
                          setBackgroundColor(preset.bg);
                        }}
                        className={cn(
                          "flex flex-col p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                          isSelected
                            ? "border-primary ring-2 ring-primary/30 bg-primary/5 shadow-xs"
                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800"
                        )}
                      >
                        <div className="flex items-center gap-1.5 mb-2">
                          <div
                            className="w-4 h-4 rounded-full border border-black/10 shadow-2xs"
                            style={{ backgroundColor: preset.primary }}
                          />
                          <div
                            className="w-4 h-4 rounded-full border border-black/10 shadow-2xs"
                            style={{ backgroundColor: preset.bg }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {preset.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {preset.primary}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Color Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                {/* Primary Color */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <label
                      className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs relative overflow-hidden flex-shrink-0"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </label>
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono uppercase text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Headers, hero banner & buttons
                  </p>
                </div>

                {/* Primary Text Color */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Text on Primary
                  </label>
                  <div className="flex items-center gap-2">
                    <label
                      className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs relative overflow-hidden flex-shrink-0"
                      style={{ backgroundColor: primaryTextColor }}
                    >
                      <input
                        type="color"
                        value={primaryTextColor}
                        onChange={(e) => setPrimaryTextColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </label>
                    <input
                      type="text"
                      value={primaryTextColor}
                      onChange={(e) => setPrimaryTextColor(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono uppercase text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Text on headers & buttons
                  </p>
                </div>

                {/* Background Color */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Background Color
                  </label>
                  <div className="flex items-center gap-2">
                    <label
                      className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs relative overflow-hidden flex-shrink-0"
                      style={{ backgroundColor: backgroundColor }}
                    >
                      <input
                        type="color"
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </label>
                    <input
                      type="text"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono uppercase text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Portal page background
                  </p>
                </div>
              </div>

              {/* Chamber Logo Upload */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Chamber Logo
                </label>
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base shadow-xs overflow-hidden"
                    style={{ backgroundColor: primaryColor, color: primaryTextColor }}
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      getInitials(currentChamberName)
                    )}
                  </div>
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </label>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl(null)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Headline & Tagline Customization */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Public Hero Headline
                  </label>
                  <input
                    type="text"
                    value={heroHeadline}
                    onChange={(e) => setHeroHeadline(e.target.value)}
                    placeholder="Where Local Businesses Connect, Grow & Prosper"
                    className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Prominently displayed on your chamber's public homepage.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Public Hero Tagline
                  </label>
                  <textarea
                    rows={2}
                    value={heroTagline}
                    onChange={(e) => setHeroTagline(e.target.value)}
                    placeholder="Join our community of business pioneers, civic leaders, and local trade partners."
                    className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-3 mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-5 py-2 rounded-lg bg-[#0B2447] hover:bg-[#16385C] text-white text-xs font-semibold shadow-xs"
                >
                  Next
                </button>
              </div>
            </div>

            {/* Right Column: LIVE PREVIEW */}
            <div className="lg:col-span-5 sticky top-24">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                DYNAMIC LIVE PREVIEW
              </div>
              <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-md bg-white dark:bg-slate-900">
                {/* Header bar */}
                <div
                  className="px-4 py-3 flex items-center justify-between gap-2.5 transition-colors"
                  style={{ backgroundColor: primaryColor, color: primaryTextColor }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        getInitials(currentChamberName)
                      )}
                    </div>
                    <div className="text-xs font-bold truncate">
                      {currentChamberName}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="opacity-80">Directory</span>
                    <span className="opacity-80">Plans</span>
                    <span
                      className="px-2 py-0.5 rounded-full font-semibold shadow-2xs"
                      style={{ backgroundColor: primaryTextColor, color: primaryColor }}
                    >
                      Join
                    </span>
                  </div>
                </div>

                {/* Hero preview banner */}
                <div
                  className="px-5 py-6 text-center transition-colors border-b border-white/10"
                  style={{ backgroundColor: primaryColor, color: primaryTextColor }}
                >
                  <span className="inline-block text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 mb-2">
                    EST. 2025 · ACTIVE NETWORK
                  </span>
                  <div className="text-sm font-bold leading-snug max-w-xs mx-auto">
                    {heroHeadline || currentChamberName}
                  </div>
                  <p className="text-[11px] mt-1.5 opacity-80 max-w-xs mx-auto line-clamp-2 leading-relaxed">
                    {heroTagline}
                  </p>
                </div>

                {/* Body with page background */}
                <div
                  className="p-5 transition-colors"
                  style={{ backgroundColor: backgroundColor }}
                >
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Membership Opportunities
                  </div>
                  <div className="mt-2.5 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Business Pioneer Tier
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Networking, directory & exclusive events
                    </div>
                    <button
                      type="button"
                      style={{ backgroundColor: primaryColor, color: primaryTextColor }}
                      className="w-full py-1.5 rounded-lg text-xs font-semibold mt-3 shadow-xs"
                    >
                      Join Chamber
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 text-center sm:text-left">
                This exact theme, colors, headline, and logo will be automatically rendered on your public chamber page.
              </p>
            </div>
          </div>
        )}

        {/* STEP 3: Payment Gateway */}
        {currentStep === 3 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-3">
              Which payment gateway would you like to configure to collect membership fees & event payments?
            </p>

            {/* 3 Gateway Buttons */}
            <div className="grid grid-cols-3 gap-3 max-w-lg">
              {(['stripe', 'razorpay', 'paypal'] as const).map((provider) => {
                const label =
                  provider === 'stripe'
                    ? 'Stripe'
                    : provider === 'razorpay'
                      ? 'Razorpay'
                      : 'PayPal';
                const isSelected = gatewayProvider === provider;
                return (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => setGatewayProvider(provider)}
                    className={cn(
                      'py-2.5 px-4 rounded-lg border text-xs font-semibold text-center transition-all',
                      isSelected
                        ? 'border-slate-800 dark:border-slate-300 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-slate-50'
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Publishable Key */}
            <div className="mt-5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Publishable Key
              </label>
              <input
                type="text"
                value={publishableKey}
                onChange={(e) => setPublishableKey(e.target.value)}
                placeholder="pk_live_51Hh9sK••••••••••••Rt2Q"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
              />
            </div>

            {/* Secret Key */}
            <div className="mt-5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Secret Key
              </label>
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="sk_live_51Hh9sK••••••••••••Xa9L"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
              />
            </div>

            {/* Connected status pill */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setGatewayConnected(!gatewayConnected)}
                className={cn(
                  'px-4 py-2 rounded-lg text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition-colors',
                  gatewayConnected ? 'bg-[#0B2447] hover:bg-[#16385C]' : 'bg-slate-600 hover:bg-slate-700'
                )}
              >
                {gatewayConnected ? 'Connected ✓' : 'Connect Gateway'}
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
              You can skip this step and connect a gateway later from Settings, but no online payments will be collected until you do.
            </p>

            {/* Navigation */}
            <div className="flex items-center gap-3 mt-8">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="px-5 py-2 rounded-lg bg-[#0B2447] hover:bg-[#16385C] text-white text-xs font-semibold shadow-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Membership Plans */}
        {currentStep === 4 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-3">
              Do you want to offer membership plans to your members?
            </p>

            {/* Notice Callout (if chamber already has configured plans in DB) */}
            {initialDbPlansCount > 0 && (
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/70 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300 text-xs mb-4">
                This chamber already has {initialDbPlansCount} plans configured — they're pre-loaded below. Uncheck a plan (or choose &quot;No, skip plans&quot;) only if you really want to remove it.
              </div>
            )}

            {/* Yes / No Toggle buttons */}
            <div className="flex items-center gap-3 mb-6">
              <button
                type="button"
                onClick={() => setOfferPlans(true)}
                className={cn(
                  'px-4 py-2 rounded-lg text-xs font-semibold transition-all',
                  offerPlans
                    ? 'bg-[#0B2447] text-white shadow-xs'
                    : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50'
                )}
              >
                Yes, offer plans
              </button>
              <button
                type="button"
                onClick={() => setOfferPlans(false)}
                className={cn(
                  'px-4 py-2 rounded-lg text-xs font-semibold transition-all',
                  !offerPlans
                    ? 'bg-[#0B2447] text-white shadow-xs'
                    : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50'
                )}
              >
                No, skip plans
              </button>
            </div>

            {offerPlans && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Select which plans you'd like to launch with, and fill in the price & features for each:
                  </span>
                  <button
                    type="button"
                    onClick={handleAddPlan}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Plan</span>
                  </button>
                </div>

                {plans.length === 0 ? (
                  <div className="border border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center text-xs text-slate-500">
                    No plans configured yet. Click "+ Add Plan" to create your first membership plan.
                  </div>
                ) : (
                  plans.map((plan, idx) => (
                    <div
                      key={idx}
                      className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-4 bg-white dark:bg-slate-900/40"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={plan.selected}
                            onChange={(e) => handleTogglePlanSelected(idx, e.target.checked)}
                            className="w-4 h-4 rounded text-[#0B2447] border-slate-300 focus:ring-[#0B2447]"
                          />
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: plan.accent_color || '#0B2447' }}
                          />
                          <input
                            type="text"
                            value={plan.name}
                            onChange={(e) => handleUpdatePlanName(idx, e.target.value)}
                            className="font-bold text-xs text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#0B2447] focus:outline-hidden px-1"
                          />
                        </div>
                        {plans.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePlan(idx)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="mt-3">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Price
                        </label>
                        <input
                          type="text"
                          value={plan.price}
                          onChange={(e) => handleUpdatePlanPrice(idx, e.target.value)}
                          className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
                        />
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Features
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddFeature(idx)}
                            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#0B2447] inline-flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add feature</span>
                          </button>
                        </div>
                        <div className="space-y-2">
                          {plan.features.map((feature, fIdx) => (
                            <div key={fIdx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={feature}
                                onChange={(e) => handleUpdateFeature(idx, fIdx, e.target.value)}
                                className="flex-1 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveFeature(idx, fIdx)}
                                className="text-red-500 hover:text-red-700 p-1.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center gap-3 mt-8">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="px-5 py-2 rounded-lg bg-[#0B2447] hover:bg-[#16385C] text-white text-xs font-semibold shadow-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Invite First Members */}
        {currentStep === 5 && (
          <div className="mt-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Add your first few members now — upload a CSV to bulk-import, or skip and invite them later from Members → Add Member.
            </p>

            {/* Large Dashed Box */}
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center bg-slate-50/50 dark:bg-slate-900/30">
              <UploadCloud className="w-8 h-8 text-slate-700 dark:text-slate-300 mx-auto" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-2">
                Upload a CSV file
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Any column layout works — you'll match your columns to fields next.
              </p>

              <div className="mt-4">
                <label className="cursor-pointer inline-block px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 transition-colors">
                  Choose File
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleCsvUpload}
                  />
                </label>
                {csvFileName && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2">
                    ✓ Loaded {csvFileName} ({csvRowCount} rows)
                  </p>
                )}
              </div>

              {/* Badges for CSV columns */}
              <div className="text-[10px] tracking-wider uppercase font-semibold text-slate-500 mt-6 mb-3">
                COLUMNS YOUR CSV SHOULD HAVE
              </div>

              <div className="flex flex-wrap justify-center gap-2 max-w-xl mx-auto">
                <span className="border border-red-200 bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-medium">
                  Full Name *
                </span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-medium">
                  Business / Company
                </span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-medium">
                  Email
                </span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-medium">
                  City
                </span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-medium">
                  Industry
                </span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-medium">
                  Skills & Interests
                </span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-medium">
                  Membership Plan
                </span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-medium">
                  Group / Chapter
                </span>
              </div>

              <p className="text-[11px] text-slate-500 mt-4">
                * required — everything else is optional. Column order/names don't need to match exactly, you'll pair them up next.
              </p>

              <button
                type="button"
                onClick={handleDownloadSampleCsv}
                className="underline text-xs font-semibold text-slate-700 dark:white hover:text-slate-900 mt-2 block mx-auto cursor-pointer"
              >
                Download a sample CSV to see it formatted correctly.
              </button>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-3 mt-8">
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="px-5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinishSetup}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-[#0B2447] hover:bg-[#16385C] text-white text-xs font-semibold shadow-xs inline-flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Finish Setup</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
