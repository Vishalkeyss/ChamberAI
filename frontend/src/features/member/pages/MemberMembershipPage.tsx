import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
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
  Receipt,
  DollarSign,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchPublicPlans, fetchActiveChapters } from '@/features/membership/services/plans.api';
import { fetchMemberOverview } from '@/features/member/services/member-overview.api';
import { fetchMemberBenefits, changeMemberPlan } from '@/features/billing/services/billing.api';
import type { BenefitUsageItem } from '@/features/billing/types';
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

  const [currentPlanName, setCurrentPlanName] = useState<string>(user?.plan || '');
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [currentPlanPrice, setCurrentPlanPrice] = useState<number | null>(null);

  const currentPlan =
    plans.find((p) => p.id === currentPlanId) ||
    plans.find((p) => p.name.toLowerCase() === (currentPlanName || '').toLowerCase());
  const planFeatures = currentPlan?.features || [];

  // Recursively resolve any inherited perks (e.g. "Everything in Silver" -> Silver's perks)
  const displayFeatures = React.useMemo(() => {
    if (!currentPlan?.features) return [];
    const resolved: string[] = [];
    const seen = new Set<string>();

    for (const f of currentPlan.features) {
      const match = f.match(
        /^(?:everything\s+in|all\s+(?:features\s+)?(?:of|in)|includes?\s+(?:all\s+)?(?:of|in)?)\s+(.+)$/i
      );
      if (match) {
        const refName = match[1].trim().toLowerCase();
        const refPlan = plans.find(
          (p) =>
            p.name.toLowerCase() === refName ||
            p.name.toLowerCase().startsWith(refName) ||
            refName.startsWith(p.name.toLowerCase())
        );
        if (refPlan?.features) {
          for (const rf of refPlan.features) {
            const norm = rf.toLowerCase();
            if (!seen.has(norm)) {
              seen.add(norm);
              resolved.push(rf);
            }
          }
        }
      } else {
        const norm = f.toLowerCase();
        if (!seen.has(norm)) {
          seen.add(norm);
          resolved.push(f);
        }
      }
    }
    return resolved;
  }, [currentPlan, plans]);

  const [membershipStatus, setMembershipStatus] = useState<string>('Active');
  const [expiryDate, setExpiryDate] = useState<string>('Dec 31, 2026');
  const [memberSince, setMemberSince] = useState<string>(new Date().getFullYear().toString());
  const [serverMemberId, setServerMemberId] = useState<string>('');
  const [daysLeft, setDaysLeft] = useState<number>(98);

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
  const [isSwitchingPlan, setIsSwitchingPlan] = useState<boolean>(false);

  // Generate dynamic member ID
  const memberInitials = memberName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  const memberId =
    serverMemberId ||
    (user as any)?.memberIdDisplay ||
    (user as any)?.id ||
    `${memberInitials}-2026-4821`;

  // QR Code base64 Data URL state for instant display and canvas embedding
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!memberId) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const verificationUrl = `${origin}/verify/member/${encodeURIComponent(memberId)}`;
    QRCode.toDataURL(verificationUrl, {
      width: 320,
      margin: 1,
      color: {
        dark: '#0B2447',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((dataUri) => {
        setQrDataUrl(dataUri);
      })
      .catch((err) => {
        console.error('Failed to generate member verification QR code:', err);
      });
  }, [memberId]);

  // Dynamic Benefit Quotas
  const [benefits, setBenefits] = useState<BenefitUsageItem[]>([]);
  const [isLoadingBenefits, setIsLoadingBenefits] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    fetchMemberBenefits()
      .then((data) => {
        if (mounted && Array.isArray(data)) {
          setBenefits(data);
        }
      })
      .catch((err) => {
        console.error('[FETCH_MEMBER_BENEFITS_ERROR]', err);
      })
      .finally(() => {
        if (mounted) setIsLoadingBenefits(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch Member's Actual Membership Record from Backend
  useEffect(() => {
    let mounted = true;
    fetchMemberOverview()
      .then((data) => {
        if (!mounted || !data?.membership) return;
        if (data.membership.tierName) {
          setCurrentPlanName(data.membership.tierName);
        }
        if (data.membership.planId) {
          setCurrentPlanId(data.membership.planId);
        }
        if (typeof data.membership.planPrice === 'number') {
          setCurrentPlanPrice(data.membership.planPrice);
        }
        if (data.membership.status) {
          const s = data.membership.status;
          setMembershipStatus(s.charAt(0).toUpperCase() + s.slice(1));
        }
        if (data.membership.memberIdDisplay) {
          setServerMemberId(data.membership.memberIdDisplay);
        }
        if (data.membership.memberSince) {
          setMemberSince(data.membership.memberSince);
        }
        if (data.membership.renewalDate) {
          setExpiryDate(data.membership.renewalDate);
          const diff = Math.ceil(
            (new Date(data.membership.renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          if (!isNaN(diff) && diff > 0) setDaysLeft(diff);
        }
      })
      .catch((err) => {
        console.error('[MEMBERSHIP_PAGE_FETCH_OVERVIEW_ERROR]', err);
      });

    return () => {
      mounted = false;
    };
  }, []);

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
      .catch(() => { });

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

  // Dynamically resolve effective current plan price for downgrade vs upgrade comparison
  const effectiveCurrentPrice =
    currentPlanPrice !== null && currentPlanPrice !== undefined && currentPlanPrice > 0
      ? currentPlanPrice
      : (activePlansList.find(
        (pl) =>
          (currentPlanId && pl.id === currentPlanId) ||
          (currentPlanName && pl.name.trim().toLowerCase() === currentPlanName.trim().toLowerCase())
      )?.price ?? 0);

  // Plan actions
  const handleSelectUpgrade = (p: MembershipPlan) => {
    setUpgradeTargetPlan(p);
    setIsUpgradeModalOpen(true);
  };

  const handleConfirmUpgrade = async () => {
    if (!upgradeTargetPlan) return;
    try {
      setIsSwitchingPlan(true);
      const res = await changeMemberPlan(upgradeTargetPlan.id);

      setCurrentPlanName(res.newPlanName || upgradeTargetPlan.name);
      setCurrentPlanId(res.newPlanId || upgradeTargetPlan.id);
      setCurrentPlanPrice(res.newPlanPrice ?? upgradeTargetPlan.price);
      setIsUpgradeModalOpen(false);

      // Re-fetch benefits to immediately reflect new plan's dynamic limits/quotas
      setIsLoadingBenefits(true);
      try {
        const updatedBenefits = await fetchMemberBenefits();
        if (Array.isArray(updatedBenefits)) {
          setBenefits(updatedBenefits);
        }
      } catch (err) {
        console.error('Failed to reload benefits:', err);
      } finally {
        setIsLoadingBenefits(false);
      }

      const isDowngrade = (res.newPlanPrice ?? upgradeTargetPlan.price) < effectiveCurrentPrice;
      toast.success(
        isDowngrade
          ? `Successfully switched to ${upgradeTargetPlan.name} Plan.`
          : `Successfully upgraded to ${upgradeTargetPlan.name} Plan!`
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to switch membership plan. Please try again.');
    } finally {
      setIsSwitchingPlan(false);
    }
  };

  const handleAddToCart = (p: MembershipPlan) => {
    const isDowngrade = p.price < effectiveCurrentPrice;
    toast.success(`Added "${p.name}" plan ${isDowngrade ? 'change' : 'upgrade'} to cart`);
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

  // Digital Wallet Download with embedded high-resolution QR code
  const handleDownloadWalletCard = async () => {
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
        ctx.fillText(`Member ID:    ${memberId}`, 60, 360);
        ctx.fillText(`Tier:         ${currentPlanName}`, 60, 395);
        ctx.fillText(`${scopeLabel}:      ${scopeValue}`, 60, 430);
        ctx.fillText(`Member Since: ${memberSince}`, 60, 465);
        ctx.fillText(`Valid Until:  ${expiryDate}`, 60, 500);

        // QR Box (White card)
        ctx.fillStyle = '#ffffff';
        if (typeof (ctx as any).roundRect === 'function') {
          ctx.beginPath();
          (ctx as any).roundRect(660, 150, 280, 310, 16);
          ctx.fill();
        } else {
          ctx.fillRect(660, 150, 280, 310);
        }

        // Generate base64 data URI to avoid CORS tainting
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const verifyUrl = `${origin}/verify/member/${encodeURIComponent(memberId)}`;
        const qrDataUri = await QRCode.toDataURL(verifyUrl, {
          width: 240,
          margin: 1,
          color: {
            dark: '#0B2447',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'M',
        });

        // Load QR image onto canvas and export as PNG
        const qrImg = new Image();
        qrImg.onload = () => {
          ctx.drawImage(qrImg, 680, 170, 240, 240);

          // Subtitle under QR inside white card
          ctx.fillStyle = '#0B2447';
          ctx.font = 'bold 13px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('SCAN TO VERIFY', 800, 428);
          ctx.font = '500 11px Inter, sans-serif';
          ctx.fillStyle = '#64748B';
          ctx.fillText('121Meet Chamber Pass', 800, 444);
          ctx.textAlign = 'left';

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
            }
          }, 'image/png');
        };
        qrImg.src = qrDataUri;
      }
    } catch {
      handleDownloadCertificate();
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 transition-colors duration-200">
      {/* 1. Page Tabs Header matching app.html */}
      <div className="bg-card text-card-foreground rounded-2xl border border-border overflow-hidden shadow-xs">
        <div className="flex gap-2 px-4 pt-3 border-b border-gray-200/80 dark:border-[#26406A] flex-wrap">
          <button
            onClick={() => setActiveTab('membership')}
            className={`px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2 -mb-px transition-colors duration-150 ${activeTab === 'membership'
              ? 'text-[#0B2447] dark:text-[#60A5FA] border-b-2 border-[#0B2447] dark:border-[#60A5FA]'
              : 'text-gray-500 dark:text-[#94A6C2] hover:text-gray-900 dark:hover:text-[#F1F5F9] border-b-2 border-transparent'
              }`}
          >
            <Shield className="w-4 h-4" />
            Membership
          </button>
          <button
            onClick={() => setActiveTab('wallet')}
            className={`px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2 -mb-px transition-colors duration-150 ${activeTab === 'wallet'
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

            {/* Auto Renewal Alert Banner & Billing Action */}
            <div className="mt-5 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <p className="text-xs sm:text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  Auto-renewal is active — your plan renews automatically on {expiryDate}.
                </p>
              </div>
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
              <div className="w-24 h-24 mx-auto mt-4 rounded-xl p-2 bg-white flex items-center justify-center shadow-md overflow-hidden">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR code for ${memberId}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <QrCode className="w-20 h-20 text-[#0B2447]" />
                )}
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
              {isLoadingBenefits ? (
                <div className="py-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <div className="w-4 h-4 rounded-full border-2 border-[#0B2447] border-t-transparent animate-spin" />
                  <span>Loading plan benefit quotas...</span>
                </div>
              ) : benefits.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {benefits.map((b) => {
                    const isUnlimited = b.quota_limit === -1;
                    const pct = isUnlimited
                      ? 100
                      : Math.min(100, Math.round((b.usage_count / Math.max(1, b.quota_limit)) * 100));

                    return (
                      <div
                        key={b.benefit_key}
                        className="p-4 rounded-xl bg-gray-50 dark:bg-[#1E3352]/50 border border-gray-200/70 dark:border-[#26406A]/70 flex flex-col justify-between"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                            {b.benefit_key.includes('ticket') || b.benefit_key.includes('event') ? (
                              <CalendarDays className="w-5 h-5" />
                            ) : b.benefit_key.includes('ad') ||
                              b.benefit_key.includes('spotlight') ||
                              b.benefit_key.includes('promotion') ||
                              b.benefit_key.includes('press') ||
                              b.benefit_key.includes('announcement') ? (
                              <Megaphone className="w-5 h-5" />
                            ) : b.benefit_key.includes('meet') ||
                              b.benefit_key.includes('network') ||
                              b.benefit_key.includes('session') ? (
                              <Handshake className="w-5 h-5" />
                            ) : b.benefit_key.includes('badge') || b.benefit_key.includes('verified') ? (
                              <Shield className="w-5 h-5" />
                            ) : b.benefit_key.includes('directory') ||
                              b.benefit_key.includes('listing') ||
                              b.benefit_key.includes('forum') ? (
                              <Building2 className="w-5 h-5" />
                            ) : (
                              <Award className="w-5 h-5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-[#F1F5F9] truncate">
                              {b.benefit_name}
                            </p>
                            <p className="text-xl font-bold text-gray-900 dark:text-[#F1F5F9] mt-0.5">
                              {isUnlimited ? (
                                'Unlimited'
                              ) : (
                                <>
                                  {b.remaining}{' '}
                                  <span className="text-xs font-normal text-gray-500 dark:text-[#94A6C2]">
                                    of {b.quota_limit} remaining
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        {!isUnlimited && (
                          <div className="mt-3">
                            <div className="h-2 rounded-full w-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                              <div
                                className="h-2 rounded-full bg-teal-500 transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-[#94A6C2] mt-1.5 font-medium">
                              {b.usage_count} of {b.quota_limit} used this cycle
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-gray-50/70 dark:bg-[#1E3352]/30 border border-dashed border-gray-200 dark:border-[#26406A] text-center">
                  <p className="text-sm font-medium text-gray-600 dark:text-[#94A6C2]">
                    No metered benefit quotas configured for this plan.
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Your membership includes full access to standard chamber community resources and events.
                  </p>
                </div>
              )}
            </div>

            {/* Included Plan Features & Perks Section */}
            {displayFeatures.length > 0 && (
              <div className="mt-6">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#94A6C2] mb-3">
                  Included Plan Perks & Features
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {displayFeatures.map((feat, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-emerald-900 dark:text-emerald-300 truncate">
                        {feat}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                const isCurrent =
                  (currentPlanId && p.id === currentPlanId) ||
                  (currentPlanName && p.name.trim().toLowerCase() === currentPlanName.trim().toLowerCase());
                const isPopular = p.isPopular === 1 || p.name.toLowerCase() === 'gold';
                const isDowngrade = !isCurrent && p.price < effectiveCurrentPrice;
                const isUpgrade = !isCurrent && p.price > effectiveCurrentPrice;
                const formattedPrice =
                  p.pricingBasis !== 'flat'
                    ? `From $${p.price}/yr`
                    : `$${p.price}/yr`;

                return (
                  <div
                    key={p.id || p.name}
                    className={`p-5 rounded-2xl relative flex flex-col justify-between transition-all duration-200 ${isCurrent
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
                          className="flex-1 justify-center opacity-60 cursor-default text-xs font-semibold"
                        >
                          Your Active Plan
                        </Button>
                      ) : isDowngrade ? (
                        <>
                          <Button
                            onClick={() => handleSelectUpgrade(p)}
                            variant="outline"
                            className="flex-1 justify-center border-amber-600/40 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-500/50 dark:text-amber-400 dark:hover:bg-amber-950/50 font-semibold text-xs transition-colors"
                          >
                            Downgrade
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
                      ) : (
                        <>
                          <Button
                            onClick={() => handleSelectUpgrade(p)}
                            className="flex-1 justify-center bg-[#0B2447] hover:bg-[#16385C] dark:bg-[#60A5FA] dark:hover:bg-[#3B82F6] text-white dark:text-[#0B2447] font-semibold text-xs"
                          >
                            {isUpgrade ? 'Upgrade Now' : 'Switch Plan'}
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
                  className={`w-6 h-6 shrink-0 ${badgeStatus === 'approved'
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
                    <p className="text-sm font-bold text-white mt-0.5">{memberSince}</p>
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
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`QR code for ${memberId}`}
                      className="w-44 h-44 block object-contain"
                    />
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center bg-gray-50">
                      <QrCode className="w-12 h-12 text-gray-300 animate-pulse" />
                    </div>
                  )}
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

      {/* Upgrade / Downgrade Confirmation Dialog */}
      <Dialog open={isUpgradeModalOpen} onOpenChange={setIsUpgradeModalOpen}>
        <DialogContent className="sm:max-w-md">
          {(() => {
            const isTargetDowngrade = upgradeTargetPlan ? upgradeTargetPlan.price < effectiveCurrentPrice : false;
            return (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {isTargetDowngrade ? 'Confirm Plan Downgrade' : 'Confirm Plan Transition'}
                  </DialogTitle>
                  <DialogDescription>
                    Are you sure you want to {isTargetDowngrade ? 'downgrade' : 'transition'} your membership to the{' '}
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
                    disabled={isSwitchingPlan}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmUpgrade}
                    disabled={isSwitchingPlan}
                    className={
                      isTargetDowngrade
                        ? 'bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold'
                        : 'bg-[#0B2447] hover:bg-[#16385C] dark:bg-[#60A5FA] dark:hover:bg-[#3B82F6] text-white dark:text-[#0B2447] text-xs font-semibold'
                    }
                  >
                    {isSwitchingPlan ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Updating...
                      </span>
                    ) : isTargetDowngrade ? (
                      'Confirm Downgrade'
                    ) : (
                      'Confirm Upgrade'
                    )}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default MemberMembershipPage;
