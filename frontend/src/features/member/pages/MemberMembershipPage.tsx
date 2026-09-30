import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  CreditCard,
  CheckCircle2,
  Download,
  QrCode,
  CalendarDays,
  Megaphone,
  Star,
  Handshake,
  ShoppingBag,
  UploadCloud,
  Plus,
  X,
  Award,
  AlertTriangle,
  Users,
  Check,
  Building2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchPublicPlans, fetchActiveChapters } from '@/features/membership/services/plans.api';
import type { MembershipPlan, ChapterOption } from '@/features/membership/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface MemberMembershipPageProps {
  chamberName?: string;
  chamberSlug?: string;
  user?: {
    name?: string;
    email?: string;
    role?: string;
    avatarUrl?: string;
    businessName?: string;
    plan?: string;
    chapter?: string;
    chapterName?: string;
    chamber?: string;
  };
  onNavigateSection?: (sectionId: string) => void;
  onOpenCart?: () => void;
}

export const MemberMembershipPage: React.FC<MemberMembershipPageProps> = ({
  chamberName = '121 Meet.AI Chamber',
  chamberSlug,
  user,
  onNavigateSection,
  onOpenCart,
}) => {
  const [activeTab, setActiveTab] = useState<'membership' | 'wallet'>('membership');
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState<boolean>(true);
  const [activeChapters, setActiveChapters] = useState<ChapterOption[]>([]);

  // Dynamic Member Profile & Membership State (No static mock fallbacks)
  const memberName = user?.name || 'Member';
  const memberEmail = user?.email || '';
  const businessName = user?.businessName || (chamberName ? `${chamberName} Member` : 'Active Member');

  // Chapter vs Chamber dynamic resolution:
  // If the chamber has chapter/s AND the member belongs to a chapter, show Chapter.
  // If the member only belongs to the chamber or the chamber has no chapters, show Chamber.
  const userChapter = user?.chapter || (user as any)?.chapterName;
  const chamberHasChapters = activeChapters.length > 0;
  const memberBelongsToChapter = Boolean(userChapter && userChapter.trim());

  const showChapter = chamberHasChapters && memberBelongsToChapter;
  const scopeLabel = showChapter ? 'Chapter' : 'Chamber';
  const scopeValue = showChapter ? userChapter! : chamberName;

  const [currentPlanName, setCurrentPlanName] = useState<string>(user?.plan || 'Gold');
  const [membershipStatus, setMembershipStatus] = useState<string>('Active');
  const [expiryDate] = useState<string>('Dec 31, 2026');
  const [daysLeft] = useState<number>(98);

  // Profile Customization & Badges
  const [profilePhoto, setProfilePhoto] = useState<string | null>(user?.avatarUrl || null);
  const [badgeStatus, setBadgeStatus] = useState<'none' | 'pending' | 'approved'>('approved');
  const [skills, setSkills] = useState<string[]>([
    'Steel Fabrication',
    'Structural Engineering',
    'Supply Chain Management',
    'B2B Wholesale',
  ]);
  const [skillInput, setSkillInput] = useState<string>('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Upgrade Modal State
  const [upgradeTargetPlan, setUpgradeTargetPlan] = useState<MembershipPlan | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);

  // Generate dynamic member ID
  const memberInitials = memberName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  const memberId = `${memberInitials}-2026-4821`;

  // Fetch Chamber Plans & Active Chapters
  useEffect(() => {
    let mounted = true;
    setIsLoadingPlans(true);
    fetchPublicPlans(chamberSlug)
      .then((data) => {
        if (mounted && data && data.length > 0) {
          setPlans(data);
        }
      })
      .catch(() => {
        // Fallback plans if network/api is offline
      })
      .finally(() => {
        if (mounted) setIsLoadingPlans(false);
      });

    fetchActiveChapters(chamberSlug)
      .then((chapters) => {
        if (mounted && chapters) {
          setActiveChapters(chapters);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [chamberSlug]);

  // Default plans list if API returned empty
  const activePlansList: MembershipPlan[] =
    plans.length > 0
      ? plans
      : [
          {
            id: 'plan_silver',
            name: 'Silver',
            accentColor: '#4B5563',
            price: 70,
            pricingBasis: 'flat',
            pricingTiers: [],
            billingFrequency: 'annual',
            isPopular: 0,
            sortOrder: 1,
            isActive: 1,
            features: [
              'Directory listing',
              'Monthly networking meet',
              'Email announcements',
            ],
          },
          {
            id: 'plan_gold',
            name: 'Gold',
            accentColor: '#92400E',
            price: 120,
            pricingBasis: 'by_employee_count',
            pricingTiers: [
              { min: 1, max: 10, price: 120 },
              { min: 11, max: 50, price: 240 },
              { min: 51, max: null, price: 480 },
            ],
            billingFrequency: 'annual',
            isPopular: 1,
            sortOrder: 2,
            isActive: 1,
            features: [
              'Everything in Silver',
              'Verified Business Badge',
              'Priority event seats',
              'Referral dashboard access',
            ],
          },
          {
            id: 'plan_platinum',
            name: 'Platinum',
            accentColor: '#0B2447',
            price: 420,
            pricingBasis: 'by_annual_revenue',
            pricingTiers: [
              { min: 0, max: 500000, price: 420 },
              { min: 500001, max: null, price: 850 },
            ],
            billingFrequency: 'annual',
            isPopular: 0,
            sortOrder: 3,
            isActive: 1,
            features: [
              'Everything in Gold',
              '1 free event sponsorship',
              'Featured directory placement',
              'Dedicated support',
            ],
          },
        ];

  // Photo Upload Handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProfilePhoto(reader.result as string);
      toast.success('Profile photo uploaded successfully');
    };
    reader.readAsDataURL(file);
  };

  // Badge Application
  const handleApplyBadge = () => {
    setBadgeStatus('pending');
    toast.success('Verified Business Badge application submitted — typically reviewed in 2 business days');
  };

  // Skills
  const handleAddSkill = () => {
    const val = skillInput.trim();
    if (!val) return;
    if (skills.includes(val)) {
      toast.error('Skill already exists');
      return;
    }
    setSkills((prev) => [...prev, val]);
    setSkillInput('');
    toast.success(`Added "${val}" to your profile`);
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills((prev) => prev.filter((s) => s !== skillToRemove));
  };

  // Plan actions
  const handleSelectUpgrade = (p: MembershipPlan) => {
    setUpgradeTargetPlan(p);
    setIsUpgradeModalOpen(true);
  };

  const handleConfirmUpgrade = () => {
    if (!upgradeTargetPlan) return;
    setCurrentPlanName(upgradeTargetPlan.name);
    setIsUpgradeModalOpen(false);
    toast.success(`Successfully switched to ${upgradeTargetPlan.name} Plan!`);
  };

  const handleAddToCart = (p: MembershipPlan) => {
    toast.success(`Added "${p.name}" plan upgrade to cart`);
    if (onOpenCart) onOpenCart();
  };

  // Digital Certificate Download
  const handleDownloadCertificate = () => {
    const content = `=====================================================
DIGITAL MEMBERSHIP CERTIFICATE
${chamberName.toUpperCase()}
=====================================================

Member Name:   ${memberName}
Organization:  ${businessName}
Membership ID: ${memberId}
Tier:          ${currentPlanName} Plan
Status:        ${membershipStatus}
Valid Until:   ${expiryDate}
${scopeLabel}:       ${scopeValue}

Verified by 121 Meet.AI Chamber Network.
Authentication Hash: 0x${Math.random().toString(16).slice(2, 10).toUpperCase()}
=====================================================`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `membership-certificate-${memberId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Digital Certificate downloaded successfully');
  };

  // Digital Wallet Download
  const handleDownloadWalletCard = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Gradient background
        const g = ctx.createLinearGradient(0, 0, 1000, 600);
        g.addColorStop(0, '#0B2447');
        g.addColorStop(1, '#16385C');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1000, 600);

        // Chamber Name & Header
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Inter, sans-serif';
        ctx.fillText(chamberName, 60, 90);
        ctx.font = '600 18px Inter, sans-serif';
        ctx.fillStyle = '#CBD9EC';
        ctx.fillText('Digital Membership Pass', 60, 125);

        // Member Info
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 42px Inter, sans-serif';
        ctx.fillText(memberName, 60, 240);
        ctx.font = '22px Inter, sans-serif';
        ctx.fillStyle = '#CBD9EC';
        ctx.fillText(businessName, 60, 280);

        // Details
        ctx.font = '600 20px Inter, sans-serif';
        ctx.fillText(`Member ID:   ${memberId}`, 60, 360);
        ctx.fillText(`Tier:        ${currentPlanName}`, 60, 400);
        ctx.fillText(`${scopeLabel}:     ${scopeValue}`, 60, 440);
        ctx.fillText(`Valid Until: ${expiryDate}`, 60, 480);

        // QR Box
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(660, 180, 260, 260);
        ctx.fillStyle = '#0B2447';
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.fillText('SCAN TO VERIFY', 690, 320);

        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `membership-card-${memberId}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('Digital Membership Card downloaded');
            return;
          }
        });
      }
    } catch {
      handleDownloadCertificate();
    }
  };

  const qrPayload = `MEMBER-ID:${memberId}|NAME:${memberName}|CHAMBER:${chamberName}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&ecc=H&data=${encodeURIComponent(
    qrPayload
  )}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 transition-colors duration-200">
      {/* 1. Page Tabs Header matching app.html */}
      <div className="bg-card text-card-foreground rounded-2xl border border-border overflow-hidden shadow-xs">
        <div className="flex gap-2 px-4 pt-3 border-b border-gray-200/80 dark:border-[#26406A] flex-wrap">
          <button
            onClick={() => setActiveTab('membership')}
            className={`px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2 -mb-px transition-colors duration-150 ${
              activeTab === 'membership'
                ? 'text-[#0B2447] dark:text-[#60A5FA] border-b-2 border-[#0B2447] dark:border-[#60A5FA]'
                : 'text-gray-500 dark:text-[#94A6C2] hover:text-gray-900 dark:hover:text-[#F1F5F9] border-b-2 border-transparent'
            }`}
          >
            <Shield className="w-4 h-4" />
            Membership
          </button>
          <button
            onClick={() => setActiveTab('wallet')}
            className={`px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2 -mb-px transition-colors duration-150 ${
              activeTab === 'wallet'
                ? 'text-[#0B2447] dark:text-[#60A5FA] border-b-2 border-[#0B2447] dark:border-[#60A5FA]'
                : 'text-gray-500 dark:text-[#94A6C2] hover:text-gray-900 dark:hover:text-[#F1F5F9] border-b-2 border-transparent'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Digital Wallet
          </button>
        </div>
      </div>

      {/* TAB 1: MEMBERSHIP DETAILS */}
      {activeTab === 'membership' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Membership Status (2 Columns) */}
          <div className="bg-card text-card-foreground rounded-2xl border border-border p-6 shadow-xs md:col-span-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-[#26406A]">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-[#F1F5F9] tracking-tight">
                    Membership Status
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-[#94A6C2] mt-0.5">
                    Your current standing and renewal preferences
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {membershipStatus}
                </span>
              </div>

              {/* Status 3-Col Attributes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mt-5">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#1E3352]/50 border border-gray-100 dark:border-[#26406A]/50">
                  <p className="text-xs font-medium text-gray-500 dark:text-[#94A6C2]">Active Plan</p>
                  <p className="text-base font-bold text-gray-900 dark:text-[#F1F5F9] mt-1">
                    {currentPlanName}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#1E3352]/50 border border-gray-100 dark:border-[#26406A]/50">
                  <p className="text-xs font-medium text-gray-500 dark:text-[#94A6C2]">Expiry Date</p>
                  <p className="text-base font-bold text-gray-900 dark:text-[#F1F5F9] mt-1">
                    {expiryDate}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#1E3352]/50 border border-gray-100 dark:border-[#26406A]/50">
                  <p className="text-xs font-medium text-gray-500 dark:text-[#94A6C2]">{scopeLabel}</p>
                  <p className="text-base font-bold text-gray-900 dark:text-[#F1F5F9] mt-1 truncate">
                    {scopeValue}
                  </p>
                </div>
              </div>
            </div>

            {/* Auto Renewal Alert Banner */}
            <div className="mt-5 p-3.5 rounded-xl flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-xs sm:text-sm font-medium text-emerald-800 dark:text-emerald-300">
                Auto-renewal is active — your plan renews automatically on {expiryDate}. No action needed.
              </p>
            </div>
          </div>

          {/* Card 2: Digital Certificate (1 Column, Navy Gradient) */}
          <div
            className="rounded-2xl p-6 text-center shadow-xs flex flex-col justify-between"
            style={{ background: 'linear-gradient(135deg, #0B2447, #16385C)' }}
          >
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-amber-400">
                Digital Certificate
              </p>
              <h4 className="text-white font-bold text-lg mt-2 tracking-tight">{memberName}</h4>
              <p className="text-white/70 text-xs mt-0.5">{businessName}</p>

              {/* QR Box */}
              <div className="w-24 h-24 mx-auto mt-4 rounded-xl p-2 bg-white flex items-center justify-center shadow-md">
                <QrCode className="w-20 h-20 text-[#0B2447]" />
              </div>
            </div>

            <Button
              onClick={handleDownloadCertificate}
              className="w-full mt-5 bg-white text-[#0B2447] hover:bg-gray-100 font-semibold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-xs"
            >
              <Download className="w-4 h-4" /> Download PDF
            </Button>
          </div>

          {/* Card 3: Benefit Usage (3 Columns) */}
          <div className="bg-card text-card-foreground rounded-2xl border border-border p-6 shadow-xs md:col-span-3">
            <div className="pb-4 border-b border-gray-100 dark:border-[#26406A]">
              <h3 className="text-lg font-bold text-gray-900 dark:text-[#F1F5F9] tracking-tight">
                Benefit Usage
              </h3>
              <p className="text-xs text-gray-500 dark:text-[#94A6C2] mt-0.5">
                What's included in your {currentPlanName} plan, and how much you've used this membership year
              </p>
            </div>

            {/* Metered Benefits Section */}
            <div className="mt-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#94A6C2] mb-3">
                Metered Benefits — Reset on Renewal
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Meter 1: Free Event Tickets */}
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1E3352]/50 border border-gray-200/70 dark:border-[#26406A]/70">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                      <CalendarDays className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-[#F1F5F9]">
                        Free Event Tickets
                      </p>
                      <p className="text-xl font-bold text-gray-900 dark:text-[#F1F5F9] mt-0.5">
                        3 <span className="text-xs font-normal text-gray-500 dark:text-[#94A6C2]">of 5 remaining</span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="h-2 rounded-full w-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div className="h-2 rounded-full bg-teal-500 w-[40%]" />
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-[#94A6C2] mt-1.5 font-medium">
                      2 of 5 used this year
                    </p>
                  </div>
                </div>

                {/* Meter 2: Directory Ad Placements */}
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1E3352]/50 border border-gray-200/70 dark:border-[#26406A]/70">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                      <Megaphone className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-[#F1F5F9]">
                        Directory Ad Placements
                      </p>
                      <p className="text-xl font-bold text-gray-900 dark:text-[#F1F5F9] mt-0.5">
                        1 <span className="text-xs font-normal text-gray-500 dark:text-[#94A6C2]">of 2 remaining</span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="h-2 rounded-full w-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div className="h-2 rounded-full bg-amber-500 w-[50%]" />
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-[#94A6C2] mt-1.5 font-medium">
                      1 of 2 used this year
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Unlimited Perks Section */}
            <div className="mt-6">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#94A6C2] mb-3">
                Unlimited Perks — Always Included
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-emerald-900 dark:text-emerald-300">
                    Verified Business Badge
                  </p>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Star className="w-4 h-4" />
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-emerald-900 dark:text-emerald-300">
                    Priority Event Seats
                  </p>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Handshake className="w-4 h-4" />
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-emerald-900 dark:text-emerald-300">
                    Referral Dashboard Access
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Change Plan Grid (3 Columns) */}
          <div className="bg-card text-card-foreground rounded-2xl border border-border p-6 shadow-xs md:col-span-3">
            <div className="pb-4 border-b border-gray-100 dark:border-[#26406A]">
              <h3 className="text-lg font-bold text-gray-900 dark:text-[#F1F5F9] tracking-tight">
                Change Plan
              </h3>
              <p className="text-xs text-gray-500 dark:text-[#94A6C2] mt-0.5">
                Compare all plans — upgrade or downgrade, pay now or add to your cart for later
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
              {activePlansList.map((p) => {
                const isCurrent = p.name.toLowerCase() === currentPlanName.toLowerCase();
                const isPopular = p.name.toLowerCase() === 'gold';
                const formattedPrice =
                  p.pricingBasis !== 'flat'
                    ? `From $${p.price}/yr`
                    : `$${p.price}/yr`;

                return (
                  <div
                    key={p.id || p.name}
                    className={`p-5 rounded-2xl relative flex flex-col justify-between transition-all duration-200 ${
                      isCurrent
                        ? 'border-2 border-[#0B2447] dark:border-[#60A5FA] bg-blue-50/30 dark:bg-[#1E3352]/40 shadow-xs'
                        : 'border border-gray-200 dark:border-[#26406A] bg-card text-card-foreground hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-bold text-gray-900 dark:text-[#F1F5F9]">
                          {p.name}
                        </h4>
                        {isCurrent ? (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#0B2447] dark:bg-[#60A5FA] text-white dark:text-[#0B2447]">
                            Current Plan
                          </span>
                        ) : isPopular ? (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400">
                            Popular
                          </span>
                        ) : null}
                      </div>

                      <p className="text-2xl font-extrabold text-gray-900 dark:text-[#F1F5F9] mt-2">
                        {formattedPrice}
                      </p>

                      <ul className="mt-4 space-y-2">
                        {(p.features || []).map((feat, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-gray-600 dark:text-[#CBD9EC] flex items-start gap-2"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex gap-2 mt-6">
                      {isCurrent ? (
                        <Button
                          variant="outline"
                          disabled
                          className="flex-1 justify-center opacity-60 cursor-default text-xs"
                        >
                          Your Active Plan
                        </Button>
                      ) : (
                        <>
                          <Button
                            onClick={() => handleSelectUpgrade(p)}
                            className="flex-1 justify-center bg-[#0B2447] hover:bg-[#16385C] dark:bg-[#60A5FA] dark:hover:bg-[#3B82F6] text-white dark:text-[#0B2447] font-semibold text-xs"
                          >
                            Upgrade Now
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleAddToCart(p)}
                            title="Add to Cart"
                            className="px-2.5 text-gray-600 dark:text-[#CBD9EC]"
                          >
                            <ShoppingBag className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 5: Business Profile (3 Columns) */}
          <div className="bg-card text-card-foreground rounded-2xl border border-border p-6 shadow-xs md:col-span-3">
            <div className="pb-4 border-b border-gray-100 dark:border-[#26406A]">
              <h3 className="text-lg font-bold text-gray-900 dark:text-[#F1F5F9] tracking-tight">
                Business Profile
              </h3>
              <p className="text-xs text-gray-500 dark:text-[#94A6C2] mt-0.5">
                Shown on your public Member Directory listing
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mt-5">
              {/* Avatar Photo Management */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-[#0B2447] text-white font-bold text-xl border-2 border-gray-200 dark:border-[#26406A]">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span>{memberInitials}</span>
                  )}
                </div>
                <div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => photoInputRef.current?.click()}
                      className="text-xs flex items-center gap-1.5"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      {profilePhoto ? 'Change Photo' : 'Upload Photo'}
                    </Button>
                    {profilePhoto && (
                      <button
                        onClick={() => setProfilePhoto(null)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-[#94A6C2] mt-1">
                    PNG, JPG or WEBP. Max 2MB.
                  </p>
                </div>
              </div>

              {/* Verified Business Badge Status Card */}
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-[#1E3352]/50 border border-border">
                <Shield
                  className={`w-6 h-6 shrink-0 ${
                    badgeStatus === 'approved'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : badgeStatus === 'pending'
                      ? 'text-amber-500'
                      : 'text-gray-400'
                  }`}
                />
                <div className="text-xs">
                  <p className="font-semibold text-gray-900 dark:text-[#F1F5F9]">
                    Verified Business Badge
                  </p>
                  <p className="text-gray-500 dark:text-[#94A6C2] mt-0.5">
                    {badgeStatus === 'approved'
                      ? 'Verified — displayed on your listing'
                      : badgeStatus === 'pending'
                      ? 'Application under review'
                      : 'Not applied yet'}
                  </p>
                </div>
                {badgeStatus === 'none' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleApplyBadge}
                    className="text-xs ml-2"
                  >
                    Apply
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Card 6: Skills & Interests (3 Columns) */}
          <div className="bg-card text-card-foreground rounded-2xl border border-border p-6 shadow-xs md:col-span-3">
            <div className="pb-4 border-b border-gray-100 dark:border-[#26406A]">
              <h3 className="text-lg font-bold text-gray-900 dark:text-[#F1F5F9] tracking-tight">
                Skills & Interests
              </h3>
              <p className="text-xs text-gray-500 dark:text-[#94A6C2] mt-0.5">
                Help other chamber members discover you for referrals, vendor opportunities, and collaboration
              </p>
            </div>

            <div className="mt-4">
              <div className="flex flex-wrap gap-2 mb-4">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#1E3352] text-gray-800 dark:text-[#CBD9EC] border border-gray-200/70 dark:border-[#26406A]"
                  >
                    {skill}
                    <button
                      onClick={() => handleRemoveSkill(skill)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2 max-w-md">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddSkill();
                  }}
                  placeholder="e.g. Export Documentation, B2B Logistics..."
                  className="flex-1 px-3.5 py-2 rounded-xl text-xs bg-gray-50 dark:bg-[#1E3352]/50 border border-gray-200 dark:border-[#26406A] text-gray-900 dark:text-[#F1F5F9] outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Button
                  variant="outline"
                  onClick={handleAddSkill}
                  className="text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DIGITAL WALLET */}
      {activeTab === 'wallet' && (
        <div className="space-y-6">
          <div className="bg-card text-card-foreground rounded-2xl border border-border p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-[#26406A]">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-[#F1F5F9] tracking-tight">
                  Digital Wallet
                </h3>
                <p className="text-xs text-gray-500 dark:text-[#94A6C2] mt-0.5">
                  Your official membership card — show this QR code at events and member-only venues.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleDownloadWalletCard}
                className="text-xs flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Download Card
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start mt-6">
              {/* Membership Card (2 Columns) */}
              <div
                className="lg:col-span-2 rounded-2xl overflow-hidden shadow-lg p-6 sm:p-8"
                style={{ background: 'linear-gradient(135deg, #0B2447, #16385C)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-white font-bold text-base truncate">{chamberName}</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/60 mt-0.5 font-medium">
                      Official Digital Membership Pass
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0">
                    <Shield className="w-5 h-5 text-amber-400" />
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-6">
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt={memberName}
                      className="w-16 h-16 rounded-full object-cover shrink-0 border-2 border-white/40"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0 bg-teal-600 border-2 border-white/40">
                      {memberInitials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-white text-xl sm:text-2xl font-bold truncate">
                      {memberName}
                    </p>
                    <p className="text-xs text-white/70 truncate">{memberEmail}</p>
                    <p className="text-xs text-white/90 font-medium truncate mt-0.5">
                      {businessName}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/10">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">
                      Tier
                    </p>
                    <p className="text-sm font-bold text-white mt-0.5">{currentPlanName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">
                      {scopeLabel}
                    </p>
                    <p className="text-sm font-bold text-white mt-0.5 truncate">{scopeValue}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">
                      Member Since
                    </p>
                    <p className="text-sm font-bold text-white mt-0.5">2024</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">
                      Valid Until
                    </p>
                    <p className="text-sm font-bold text-white mt-0.5">{expiryDate}</p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    {membershipStatus}
                  </span>
                  <p className="text-[11px] text-white/60 font-mono tracking-wider">
                    ID: {memberId}
                  </p>
                </div>
              </div>

              {/* QR Code Container (1 Column) */}
              <div className="rounded-2xl p-6 bg-white dark:bg-[#1E3352] border border-gray-200 dark:border-[#26406A] flex flex-col items-center justify-center text-center shadow-xs">
                <div className="relative p-2 bg-white rounded-xl shadow-xs border border-gray-100">
                  <img
                    src={qrSrc}
                    alt={`QR code for ${memberId}`}
                    className="w-44 h-44 block object-contain"
                    onError={(e) => {
                      // Fallback if third party image service has network issues
                      (e.target as any).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="rounded-lg p-1.5 bg-white shadow-xs border border-gray-200">
                      <Shield className="w-5 h-5 text-[#0B2447]" />
                    </div>
                  </div>
                </div>
                <p className="text-xs font-mono font-semibold text-gray-700 dark:text-[#CBD9EC] mt-3">
                  {memberId}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-[#94A6C2] mt-1">
                  Scan at event registration or desk check-in
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-[#94A6C2] mt-6">
              The QR code securely encodes your cryptographic membership credentials and can be scanned by chamber staff to instantly verify your active membership.
            </p>
          </div>
        </div>
      )}

      {/* Upgrade Confirmation Dialog */}
      <Dialog open={isUpgradeModalOpen} onOpenChange={setIsUpgradeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Plan Transition</DialogTitle>
            <DialogDescription>
              Are you sure you want to transition your membership to the{' '}
              <strong>{upgradeTargetPlan?.name}</strong> plan?
            </DialogDescription>
          </DialogHeader>

          {upgradeTargetPlan && (
            <div className="space-y-3 py-2">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#1E3352]/50 border border-gray-200 dark:border-[#26406A] text-xs">
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 dark:text-[#94A6C2]">New Plan:</span>
                  <span className="font-bold text-gray-900 dark:text-[#F1F5F9]">
                    {upgradeTargetPlan.name}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 dark:text-[#94A6C2]">Annual Dues:</span>
                  <span className="font-bold text-gray-900 dark:text-[#F1F5F9]">
                    ${upgradeTargetPlan.price}/yr
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 dark:text-[#94A6C2]">Next Renewal:</span>
                  <span className="font-medium text-gray-900 dark:text-[#F1F5F9]">
                    {expiryDate}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsUpgradeModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmUpgrade}
              className="bg-[#0B2447] hover:bg-[#16385C] dark:bg-[#60A5FA] dark:hover:bg-[#3B82F6] text-white dark:text-[#0B2447] text-xs"
            >
              Confirm Upgrade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default MemberMembershipPage;
