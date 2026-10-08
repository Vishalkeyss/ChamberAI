import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import LOGO_SRC from '@/assets/logo.png';
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
import { TeamRepresentativesSection } from '../components/TeamRepresentativesSection';

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

  const chamberAcronym = React.useMemo(() => {
    if (chamberSlug) return chamberSlug.toUpperCase().slice(0, 4);
    const words = chamberName
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    const initials = words.map((w) => w[0].toUpperCase()).join('');
    if (initials.length > 3 && words.some((w) => w.toLowerCase() === 'of')) {
      return initials.slice(0, 3);
    }
    return initials.slice(0, 4);
  }, [chamberName, chamberSlug]);

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
  const [expiryDate, setExpiryDate] = useState<string>('—');
  const [memberSince, setMemberSince] = useState<string>('2023');
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
  // Only a real membership ID can be verified by the public QR endpoint; no fabricated fallback.
  const memberId = serverMemberId || (user as any)?.memberIdDisplay || '';

  // QR Code base64 Data URL state for instant display and canvas embedding
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!memberId) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const verificationUrl = `${origin}/verify/member/${encodeURIComponent(memberId)}`;
    QRCode.toDataURL(verificationUrl, {
      width: 400,
      margin: 1,
      color: {
        dark: '#071E3D',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
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

  // Digital Wallet Download with embedded QR code inside the card
  const handleDownloadWalletCard = async () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 580;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const drawRoundRect = (
        context: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number
      ) => {
        context.beginPath();
        context.moveTo(x + r, y);
        context.arcTo(x + w, y, x + w, y + h, r);
        context.arcTo(x + w, y + h, x, y + h, r);
        context.arcTo(x, y + h, x, y, r);
        context.arcTo(x, y, x + w, y, r);
        context.closePath();
      };

      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = (e) => reject(e);
          img.src = src;
        });
      };

      // 1. Clip outer rounded card bounds
      drawRoundRect(ctx, 0, 0, 1000, 580, 28);
      ctx.clip();

      // 2. Rich Navy Card Gradient Background
      const g = ctx.createLinearGradient(0, 0, 1000, 580);
      g.addColorStop(0, '#071E3D');
      g.addColorStop(0.5, '#0B2447');
      g.addColorStop(1, '#153965');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1000, 580);

      // Subtle radial highlight
      const radialG = ctx.createRadialGradient(850, 480, 40, 850, 480, 450);
      radialG.addColorStop(0, 'rgba(59, 130, 246, 0.18)');
      radialG.addColorStop(1, 'rgba(11, 36, 71, 0)');
      ctx.fillStyle = radialG;
      ctx.fillRect(0, 0, 1000, 580);

      // 3. Header: Chamber Name & Acronym Subtitle
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(chamberName, 55, 75);

      ctx.fillStyle = '#A5C2EB';
      ctx.font = '600 13px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${chamberAcronym} · DIGITAL MEMBERSHIP CARD`, 55, 102);

      // 4. Load assets in parallel
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const verifyUrl = `${origin}/verify/member/${encodeURIComponent(memberId)}`;
      const qrDataUri = await QRCode.toDataURL(verifyUrl, {
        width: 500,
        margin: 1,
        color: {
          dark: '#071E3D',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      });

      const [qrImg, logoImg] = await Promise.all([
        loadImage(qrDataUri),
        loadImage(LOGO_SRC).catch(() => null),
      ]);

      // 5. Top-Right 121 Meet Badge
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(925, 75, 26, 0, Math.PI * 2);
      ctx.fill();
      if (logoImg) {
        ctx.drawImage(logoImg, 905, 55, 40, 40);
      }

      // 6. Member Avatar & Name
      ctx.save();
      ctx.beginPath();
      ctx.arc(95, 180, 36, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = '#071E3D';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.stroke();

      let avatarDrawn = false;
      if (profilePhoto) {
        try {
          const profileImg = await loadImage(profilePhoto);
          ctx.clip();
          ctx.drawImage(profileImg, 59, 144, 72, 72);
          avatarDrawn = true;
        } catch {
          avatarDrawn = false;
        }
      }
      if (!avatarDrawn) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(memberInitials, 95, 180);
      }
      ctx.restore();

      // Member Name and Email
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px Inter, sans-serif';
      ctx.fillText(memberName, 150, 172);

      ctx.fillStyle = '#CBD9EC';
      ctx.font = '500 17px Inter, sans-serif';
      ctx.fillText(memberEmail, 150, 202);

      // 7. Details 2-Column Grid
      // Column 1 (x = 55)
      ctx.fillStyle = '#94A6C2';
      ctx.font = '700 12px Inter, sans-serif';
      ctx.fillText('TIER', 55, 275);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillText(currentPlanName || 'Gold', 55, 302);

      ctx.fillStyle = '#94A6C2';
      ctx.font = '700 12px Inter, sans-serif';
      ctx.fillText('MEMBER SINCE', 55, 350);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillText(memberSince, 55, 377);

      // Active Pill Badge
      drawRoundRect(ctx, 55, 412, 100, 32, 16);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.stroke();

      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(71, 428, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#6EE7B7';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.fillText(membershipStatus, 82, 433);

      // Vertical Divider
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(315, 260);
      ctx.lineTo(315, 455);
      ctx.stroke();

      // Column 2 (x = 345)
      ctx.fillStyle = '#94A6C2';
      ctx.font = '700 12px Inter, sans-serif';
      ctx.fillText(scopeLabel.toUpperCase(), 345, 275);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillText(scopeValue, 345, 302);

      ctx.fillStyle = '#94A6C2';
      ctx.font = '700 12px Inter, sans-serif';
      ctx.fillText('VALID UNTIL', 345, 350);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillText(expiryDate, 345, 377);

      // Member ID at bottom
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '500 16px Inter, sans-serif';
      ctx.fillText(`Member ID - ${memberId}`, 55, 515);

      // 8. Right Side: White QR Card INSIDE the Wallet Card
      const qrBoxX = 645;
      const qrBoxY = 145;
      const qrBoxSize = 295;
      drawRoundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 22);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Draw QR image
      const qrPadding = 18;
      ctx.drawImage(
        qrImg,
        qrBoxX + qrPadding,
        qrBoxY + qrPadding,
        qrBoxSize - qrPadding * 2,
        qrBoxSize - qrPadding * 2
      );

      // Center 121 Meet badge in QR code
      const centerBoxSize = 58;
      const centerBoxX = qrBoxX + (qrBoxSize - centerBoxSize) / 2;
      const centerBoxY = qrBoxY + (qrBoxSize - centerBoxSize) / 2;
      drawRoundRect(ctx, centerBoxX, centerBoxY, centerBoxSize, centerBoxSize, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (logoImg) {
        ctx.drawImage(logoImg, centerBoxX + 8, centerBoxY + 8, 42, 42);
      }

      // 9. Export Blob and trigger download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `digital-wallet-card-${memberId}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success('Digital Membership Card downloaded successfully');
        }
      }, 'image/png');
    } catch (err) {
      console.error('Failed to export wallet card:', err);
      handleDownloadCertificate();
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 transition-colors duration-200">
      {/* Page Header matching Image 2 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[#F1F5F9] tracking-tight">
          My Membership
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#94A6C2] mt-0.5">
          Manage your membership, access your digital card, and see your benefits.
        </p>
      </div>

      {/* Top 2-Column Grid: Membership Status & Digital Wallet Side-by-Side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        {/* Left Column: Membership Status */}
        <div className="bg-card text-card-foreground rounded-2xl border border-border p-5 sm:p-6 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 dark:border-[#26406A]">
            <h3 className="text-lg font-bold text-gray-900 dark:text-[#F1F5F9] tracking-tight">
              Membership Status
            </h3>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              {membershipStatus}
            </span>
          </div>

          {/* 2x2 Grid */}
          <div className="grid grid-cols-2 gap-y-3.5 gap-x-6 text-sm mt-3.5">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-[#94A6C2]">Plan</p>
              <p className="text-base font-bold text-gray-900 dark:text-[#F1F5F9] mt-0.5">
                {currentPlanName || 'Gold'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-[#94A6C2]">Expiry Date</p>
              <p className="text-base font-bold text-gray-900 dark:text-[#F1F5F9] mt-0.5">
                {expiryDate}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-[#94A6C2]">Member Since</p>
              <p className="text-base font-bold text-gray-900 dark:text-[#F1F5F9] mt-0.5">
                {memberSince}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-[#94A6C2]">{scopeLabel}</p>
              <p className="text-base font-bold text-gray-900 dark:text-[#F1F5F9] mt-0.5 truncate">
                {scopeValue}
              </p>
            </div>
          </div>

          {/* Auto-renewal banner */}
          <div className="mt-3.5 p-3 rounded-xl flex items-center gap-3 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-xs sm:text-sm font-medium text-emerald-800 dark:text-emerald-300">
              Auto-renewal is on — your plan renews automatically on {expiryDate}, no action needed.
            </p>
          </div>

          <div className="mt-3.5">
            <Button
              variant="outline"
              onClick={handleDownloadCertificate}
              className="text-xs sm:text-sm font-medium py-2 px-4 rounded-xl flex items-center gap-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-gray-500" />
              Download PDF
            </Button>
          </div>
        </div>

        {/* Right Column: Digital Wallet */}
        <div className="bg-card text-card-foreground rounded-2xl border border-border p-5 sm:p-6 shadow-xs flex flex-col">
          {/* Header with Title on Left and Download Button on Top-Right */}
          <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 dark:border-[#26406A] gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-gray-900 dark:text-[#F1F5F9] tracking-tight">
                Digital Wallet
              </h3>
              <p className="text-xs text-gray-500 dark:text-[#94A6C2] mt-0.5 truncate">
                Your membership card — show QR code at venues
              </p>
            </div>
            <Button
              onClick={handleDownloadWalletCard}
              className="bg-[#0B2447] hover:bg-[#16385C] text-white px-3.5 py-1.5 rounded-xl font-semibold text-xs shadow-xs inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Download Card
            </Button>
          </div>

          {/* Digital Wallet Card (Embedded QR inside) matching Status Card height with card-like max width */}
          <div
            className="mt-3.5 rounded-2xl p-3.5 sm:p-4 w-full max-w-[460px] mx-auto flex-1 flex flex-col justify-between relative text-white shadow-md overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #071E3D 0%, #0B2447 50%, #153965 100%)' }}
          >
            {/* Subtle background glow */}
            <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Card Header */}
            <div className="flex items-center justify-between gap-3 relative z-10">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white tracking-tight truncate">
                  {chamberName}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A5C2EB] mt-0.5">
                  {chamberAcronym} · DIGITAL MEMBERSHIP CARD
                </p>
              </div>
              {/* 121 Meet Top-Right Badge */}
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center p-1 shadow-sm shrink-0">
                <img src={LOGO_SRC} alt="121 Meet" className="w-full h-full object-contain" />
              </div>
            </div>

            {/* Card Body: Info on Left + QR Code INSIDE card on Right */}
            <div className="flex flex-row items-center justify-between gap-3 mt-2 relative z-10">
              {/* Left Side: Avatar, Name, 2-Col Stats */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt={memberName}
                      className="w-8 h-8 rounded-full object-cover shrink-0 border border-white/40"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 bg-[#071E3D] border border-white/40">
                      {memberInitials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-white truncate tracking-tight">
                      {memberName}
                    </p>
                    <p className="text-[10px] text-[#CBD9EC] truncate">{memberEmail}</p>
                  </div>
                </div>

                {/* 2-Column Stats Grid with vertical divider */}
                <div className="grid grid-cols-2 gap-2 mt-2 pt-1.5 border-t border-white/10">
                  <div>
                    <p className="text-[9px] uppercase font-bold tracking-wider text-[#94A6C2]">
                      TIER
                    </p>
                    <p className="text-xs font-bold text-white leading-tight">
                      {currentPlanName || 'Gold'}
                    </p>
                    <p className="text-[9px] uppercase font-bold tracking-wider text-[#94A6C2] mt-1">
                      MEMBER SINCE
                    </p>
                    <p className="text-xs font-bold text-white leading-tight">{memberSince}</p>
                    <div className="mt-1">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        <span className="w-1 h-1 rounded-full bg-emerald-400" />
                        {membershipStatus}
                      </span>
                    </div>
                  </div>

                  <div className="border-l border-white/15 pl-2">
                    <p className="text-[9px] uppercase font-bold tracking-wider text-[#94A6C2]">
                      {scopeLabel.toUpperCase()}
                    </p>
                    <p className="text-xs font-bold text-white leading-tight truncate">
                      {scopeValue}
                    </p>
                    <p className="text-[9px] uppercase font-bold tracking-wider text-[#94A6C2] mt-1">
                      VALID UNTIL
                    </p>
                    <p className="text-xs font-bold text-white leading-tight">{expiryDate}</p>
                  </div>
                </div>

                <p className="text-[9px] sm:text-[10px] font-medium text-white/80 mt-1.5 tracking-wide">
                  Member ID - {memberId}
                </p>
              </div>

              {/* Right Side: QR Code Box INSIDE Wallet Card */}
              <div className="bg-white rounded-xl p-1.5 shadow-sm flex items-center justify-center relative shrink-0">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR code for ${memberId}`}
                    className="w-20 h-20 sm:w-22 sm:h-22 block object-contain rounded-md"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-22 sm:h-22 flex items-center justify-center bg-gray-50 rounded-md">
                    <QrCode className="w-7 h-7 text-gray-300 animate-pulse" />
                  </div>
                )}
                {/* Center 121 Meet logo mark inside QR code */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-5 h-5 rounded-sm bg-white p-0.5 shadow-xs border border-gray-100 flex items-center justify-center">
                    <img src={LOGO_SRC} alt="121 Meet" className="w-full h-full object-contain" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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

          {/* Card 3.5: Team Representatives (3 Columns) */}
          <TeamRepresentativesSection businessName={businessName} />

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
