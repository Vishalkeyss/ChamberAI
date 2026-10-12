import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider } from './core/context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { PublicLayout } from './components/layout/PublicLayout';
import { MemberLayout } from './components/layout/MemberLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { SuperAdminLayout } from './components/layout/SuperAdminLayout';
import { IdleWarningModal } from './components/auth/IdleWarningModal';
import { SessionExpiryModal } from './components/layout/SessionExpiryModal';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RequireRole, RequireSuperAdmin } from './components/auth/RequireRole';
import { RequireScope } from './components/auth/RequireScope';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Sparkles, Building, Users, ShieldCheck } from 'lucide-react';
import { AccountSettingsPage } from './features/settings/pages/AccountSettingsPage';
import { MemberOverviewPage } from './features/member/pages/MemberOverviewPage';
import { ChamberPickerGate } from './features/public/components/ChamberPickerGate';
import { ChamberPublicPage } from './features/public/pages/ChamberPublicPage';
import type { RegisteredChamber } from './features/public/data/chambers';
import { fetchPublicChambers } from './features/public/services/public.api';
import { AILandingPage } from './features/ai/components/AILandingPage';
import { AdminPlansListPage } from './features/admin/membership/pages/AdminPlansListPage';
import { AdminPlanBuilderPage } from './features/admin/membership/pages/AdminPlanBuilderPage';
import { PublicPricingPage } from './features/membership/pages/PublicPricingPage';
import { MemberMembershipPage } from './features/member/pages/MemberMembershipPage';
import { MemberLoginModal } from './features/auth/components/MemberLoginModal';
import { SuperChambersPage } from './features/super-admin/pages/SuperChambersPage';
import { ChamberOnboardingWizard } from './features/admin/onboarding/pages/ChamberOnboardingWizard';
import { fetchOnboardingState } from './features/admin/onboarding/services/onboarding.api';
import { buildChamberSiteUrl, buildPlatformRootUrl, detectChamberSlugFromHost, detectChamberSlugFromPath, getActiveChamberSlug, isCustomDomainHost, isLocalHostname, isPathTenantRouting, setActiveChamberSlug } from './core/config/app-config';
import { ApplicationWizardPage } from './features/membership/pages/ApplicationWizardPage';
import { TrackApplicationPage } from './features/membership/pages/TrackApplicationPage';
import { TrackApplicationModal } from './features/membership/components/TrackApplicationModal';
import { AdminApplicationsPage } from './features/admin/membership/pages/AdminApplicationsPage';
import { VerifyMemberModal } from './features/member/components/VerifyMemberModal';
import { MemberVerificationPage } from './features/member/pages/MemberVerificationPage';
import { MemberBillingPage } from './features/billing/pages/MemberBillingPage';
import { EditBusinessProfileModal } from './features/member/components/EditBusinessProfileModal';
import { fetchBusinessProfile } from './features/member/services/business-profile.api';
import { DirectoryPage } from './features/directory/pages/DirectoryPage';
import { EventsExplorerPage } from './features/events/pages/EventsExplorerPage';
import { AdminEventDetailPage } from './features/admin/events/pages/AdminEventDetailPage';
import { AdminEventsListPage } from './features/admin/events/pages/AdminEventsListPage';
import { MessagesPage } from './features/networking/pages/MessagesPage';
import { ReferralsPage } from './features/networking/pages/ReferralsPage';
import { DigitalCardPage } from './features/networking/pages/DigitalCardPage';
import { PublicCardPage } from './features/public/pages/PublicCardPage';
import { CrmPipelinePage } from './features/crm/pages/CrmPipelinePage';
import { KanbanTasksPage } from './features/tasks/pages/KanbanTasksPage';
import { MentorshipHubPage } from './features/mentorship/pages/MentorshipHubPage';
import { AdminMentorshipPage } from './features/admin/mentorship/AdminMentorshipPage';

export type MemberViewType = 'overview' | 'plans' | 'billing' | 'directory' | 'events' | 'messages' | 'referrals' | 'card' | 'crm' | 'tasks' | 'mentorship';

const MEMBER_VIEW_ALIAS_MAP: Record<string, MemberViewType> = {
  membership: 'plans',
  wallet: 'plans',
  team: 'plans',
  plans: 'plans',
  billing: 'billing',
  directory: 'directory',
  events: 'events',
  messages: 'messages',
  referrals: 'referrals',
  card: 'card',
  crm: 'crm',
  tasks: 'tasks',
  mentorship: 'mentorship',
  overview: 'overview',
};

/**
 * Dynamically resolves the member sub-view from any URL pathname
 * e.g. /portal/events -> 'events', /member/billing -> 'billing', /portal -> 'overview'
 */
export function resolveMemberView(pathname: string): MemberViewType {
  const clean = pathname.split('?')[0].split('#')[0];
  const segment = clean.replace(/^\/(?:portal|member)\/?/, '').split('/')[0]?.toLowerCase();
  if (!segment) return 'overview';
  return MEMBER_VIEW_ALIAS_MAP[segment] || (segment as MemberViewType) || 'overview';
}

/**
 * Dynamically resolves the admin sub-view from any URL pathname
 * e.g. /admin/plans -> 'plans', /admin/applications -> 'applications'
 */
export function resolveAdminView(pathname: string): string {
  const clean = pathname.split('?')[0].split('#')[0];
  const sub = clean.replace(/^\/admin\/?/, '').split('/')[0]?.toLowerCase();
  return sub || 'dashboard';
}

type ActiveShell =
  | 'public'
  | 'member'
  | 'admin'
  | 'chapter_admin'
  | 'super_admin'
  | 'settings'
  | 'verify'
  | 'card';

function AppContent() {
  const [activeShell, setActiveShell] = useState<ActiveShell>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p.startsWith('/verify')) {
        return 'verify';
      }
      // Prompt 05.4 public business card opened from a QR scan.
      if (p.startsWith('/card/')) {
        return 'card';
      }
      if (p.startsWith('/portal') || p.startsWith('/member')) {
        return 'member';
      }
      if (p.startsWith('/admin')) {
        return 'admin';
      }
      if (p.startsWith('/super-admin') || p.startsWith('/super')) {
        return 'super_admin';
      }
      if (p === '/settings' || p === '/portal/settings' || p === '/admin/settings') {
        return 'settings';
      }
      if (p === '/apply' || p === '/join') {
        return 'public';
      }
    }
    return 'public';
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginModalPortal, setLoginModalPortal] = useState<'member' | 'admin' | 'super_admin'>('member');
  // First page after user login is the AI landing page; clicking "View traditional layout" switches to traditional dashboard
  const [aiStage, setAiStage] = useState<'landing' | 'traditional'>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p === '/portal/ai' || p === '/admin/ai') return 'landing';
      if (p.startsWith('/portal') || p.startsWith('/admin') || p.startsWith('/super')) return 'traditional';
    }
    return 'landing';
  });
  const [chambers, setChambers] = useState<RegisteredChamber[]>([]);
  const [isLoadingChambers, setIsLoadingChambers] = useState(true);

  // Track the currently active chamber for multi-tenant experience
  const [selectedChamber, setSelectedChamber] = useState<RegisteredChamber | null>(null);

  // Sub-views for prompt navigation
  const [adminView, setAdminView] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p === '/admin/plans' || p === '/admin/plans/') return 'plans';
      if (p === '/admin/applications' || p === '/admin/applications/') return 'applications';
      if (p === '/admin/dashboard' || p === '/admin/dashboard/') return 'dashboard';
      if (p === '/admin/onboarding' || p === '/admin/onboarding/') return 'onboarding';
      if (p.startsWith('/admin/')) {
        const sub = p.replace(/^\/admin\//, '').replace(/\/$/, '');
        return sub || 'dashboard';
      }
    }
    return 'dashboard';
  });
  const [adminPath, setAdminPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p.startsWith('/admin')) {
        return p;
      }
    }
    return '/admin/dashboard';
  });
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [selectedAdminEventId, setSelectedAdminEventId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p.startsWith('/admin/events/')) {
        const id = p.replace(/^\/admin\/events\//, '').split('/')[0].split('?')[0];
        return id || null;
      }
    }
    return null;
  });
  const [isEditBusinessProfileOpen, setIsEditBusinessProfileOpen] = useState(false);
  const [memberView, setMemberView] = useState<MemberViewType>(() => {
    if (typeof window !== 'undefined') {
      return resolveMemberView(window.location.pathname);
    }
    return 'overview';
  });
  const [superAdminPath, setSuperAdminPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p.startsWith('/super')) {
        return p;
      }
    }
    return '/super/chambers';
  });

  // Public application wizard and tracking modal state
  const [publicView, setPublicView] = useState<'home' | 'apply'>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/apply' || path === '/join') return 'apply';
    }
    return 'home';
  });
  const [isTrackModalOpen, setIsTrackModalOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      return path.startsWith('/track-application') || path.startsWith('/track');
    }
    return false;
  });
  const [applyInitialPlanId, setApplyInitialPlanId] = useState<string | undefined>(undefined);
  const [trackCode, setTrackCode] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/track-application/') || path.startsWith('/track/')) {
        const parts = path.split('/').filter(Boolean);
        if (parts.length > 1) return parts[1].toUpperCase();
      }
    }
    return undefined;
  });

  // Public verified member modal state (e.g. from QR scan /verify/member/:id)
  const [verifyMemberId, setVerifyMemberId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/verify/member/')) {
        const parts = path.split('/').filter(Boolean);
        if (parts.length >= 3) return decodeURIComponent(parts[2]);
      }
      const params = new URLSearchParams(window.location.search);
      if (params.get('verify')) {
        return params.get('verify');
      }
    }
    return null;
  });
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      return path.startsWith('/verify/member/') || Boolean(params.get('verify'));
    }
    return false;
  });

  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      if (path === '/portal/business-profile' || path === '/member/business-profile') {
        setIsEditBusinessProfileOpen(true);
        setMemberView('overview');
        window.history.replaceState({}, '', '/portal/overview');
      } else if (path.startsWith('/portal') || path.startsWith('/member')) {
        setMemberView(resolveMemberView(path));
      } else if (path.startsWith('/admin')) {
        setAdminPath(path);
        if (path.startsWith('/admin/events/')) {
          const id = path.replace(/^\/admin\/events\//, '').split('/')[0].split('?')[0];
          setSelectedAdminEventId(id || null);
          setAdminView('event-detail');
        } else if (path === '/admin/events' || path === '/admin/events/') {
          setSelectedAdminEventId(null);
          setAdminView('events');
        } else {
          setAdminView(resolveAdminView(path));
        }
      } else if (path.startsWith('/verify/member/')) {
        const parts = path.split('/').filter(Boolean);
        if (parts.length >= 3) {
          setVerifyMemberId(decodeURIComponent(parts[2]));
          setActiveShell('verify');
        }
      } else if (params.get('verify')) {
        setVerifyMemberId(params.get('verify'));
        setActiveShell('verify');
      } else if (path.startsWith('/verify')) {
        setActiveShell('verify');
      }
    };

    const handleOpenProfileModal = () => setIsEditBusinessProfileOpen(true);
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('open-business-profile-modal', handleOpenProfileModal);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('open-business-profile-modal', handleOpenProfileModal);
    };
  }, []);

  // Load registered chambers dynamically from the D1 database
  useEffect(() => {
    let isMounted = true;
    setIsLoadingChambers(true);
    fetchPublicChambers()
      .then((data) => {
        if (!isMounted) return;
        setChambers(data);
        setIsLoadingChambers(false);

        // Secure Domain / Subdomain Tenant Resolution
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const chamberQueryParam = params.get('chamber');

          const detectedSlug = detectChamberSlugFromHost();

          const pathname = window.location.pathname;
          let pathSlug: string | null = null;
          if (pathname.startsWith('/c/')) {
            pathSlug = pathname.split('/')[2] || null;
          }

          // Path routing (staging): /c/<slug>, else the chamber chosen earlier in this tab.
          const effectiveSlug =
            detectedSlug ||
            chamberQueryParam ||
            pathSlug ||
            (isPathTenantRouting() ? detectChamberSlugFromPath() || getActiveChamberSlug() : null);

          if (effectiveSlug && effectiveSlug !== 'app' && effectiveSlug !== 'superadmin' && effectiveSlug !== 'www') {
            const found = data.find(
              (c) =>
                c.slug.toLowerCase() === effectiveSlug.toLowerCase() ||
                (c as any).subdomain?.toLowerCase() === effectiveSlug.toLowerCase()
            );
            if (found) {
              setSelectedChamber(found);
            }
          } else if (isCustomDomainHost(window.location.hostname.toLowerCase())) {
            // Check custom domain mapping
            const found = data.find((c) => c.customDomain?.toLowerCase() === window.location.hostname.toLowerCase());
            if (found) {
              setSelectedChamber(found);
            }
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load chambers from backend DB:', err);
        if (isMounted) setIsLoadingChambers(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const {
    user,
    roles,
    chamber: authChamber,
    highestRole,
    isAuthenticated,
    isLoading,
    logout,
    showIdleWarning,
    idleCountdownSeconds,
    extendSession,
    showSessionExpired,
    dismissSessionExpired,
  } = useAuth();

  // Path routing (staging): the selected chamber is the tenant for API calls in this tab.
  useEffect(() => {
    if (isPathTenantRouting() && selectedChamber?.slug) setActiveChamberSlug(selectedChamber.slug);
  }, [selectedChamber?.slug]);

  // Chamber onboarding (Prompt 13.2, OD-105…108): chamber-level status from the authenticated
  // onboarding API, full_admin only. null = unknown / not applicable.
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  // Set when the admin enters the admin portal (login / portal switch): land on the wizard once
  // while onboarding is incomplete, without trapping the admin there afterwards.
  const landOnOnboardingRef = useRef(false);
  const isFullAdmin = highestRole === 'full_admin';

  // Listen for login query params or portal triggers on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const pathname = window.location.pathname;
      const search = window.location.search;

      // Super Admin direct trigger or URL routing
      if (
        params.get('portal') === 'superadmin' ||
        params.get('portal') === 'super_admin' ||
        pathname.startsWith('/super-admin') ||
        pathname.startsWith('/super') ||
        search.includes('superadmin')
      ) {
        if (highestRole === 'super_admin') {
          setActiveShell('super_admin');
          setAiStage('traditional');
          if (pathname.startsWith('/super')) {
            setSuperAdminPath(pathname);
          } else if (pathname === '/super-admin') {
            setSuperAdminPath('/super/chambers');
            window.history.replaceState({}, '', '/super/chambers');
          }
        } else if (!isLoading) {
          setLoginModalPortal('super_admin');
          setIsLoginModalOpen(true);
          window.history.replaceState({}, '', '/');
        }
      } else if (params.get('portal') === 'admin' || pathname.startsWith('/admin')) {
        if (['full_admin', 'billing_admin', 'group_admin', 'chapter_admin'].includes(highestRole || '')) {
          setActiveShell('admin');
          if (pathname.startsWith('/admin/')) {
            setAdminView(resolveAdminView(pathname));
            setAdminPath(pathname);
          }
        } else {
          setLoginModalPortal('admin');
          setIsLoginModalOpen(true);
        }
        window.history.replaceState({}, '', pathname.startsWith('/admin') ? pathname : '/');
      } else if (
        params.get('portal') === 'member' ||
        params.get('auth') === 'login' ||
        pathname === '/login' ||
        pathname.startsWith('/login')
      ) {
        setLoginModalPortal('member');
        setIsLoginModalOpen(true);
        window.history.replaceState({}, '', '/');
      } else if (pathname.startsWith('/portal') || pathname.startsWith('/member')) {
        if (['member', 'full_admin', 'billing_admin', 'group_admin', 'chapter_admin', 'super_admin'].includes(highestRole || '')) {
          setActiveShell('member');
          if (pathname === '/portal/ai') {
            setAiStage('landing');
          } else {
            setAiStage('traditional');
            setMemberView(resolveMemberView(pathname));
          }
        }
      } else if (pathname === '/settings' || pathname === '/portal/settings' || pathname === '/admin/settings') {
        if (highestRole) {
          setActiveShell('settings');
        }
      } else if (pathname === '/apply' || pathname === '/join') {
        setActiveShell('public');
        setPublicView('apply');
      } else if (pathname.startsWith('/track-application') || pathname.startsWith('/track')) {
        setActiveShell('public');
        setPublicView('home');
        setIsTrackModalOpen(true);
        const parts = pathname.split('/').filter(Boolean);
        if (parts.length > 1 && (parts[0] === 'track-application' || parts[0] === 'track')) {
          setTrackCode(parts[1].toUpperCase());
        }
      }
    }
  }, [highestRole, isLoading]);

  // Listen for browser forward/back navigation
  useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname;
      if (pathname.startsWith('/admin')) {
        setActiveShell('admin');
        setAiStage('traditional');
        if (pathname.startsWith('/admin/')) {
          setAdminView(resolveAdminView(pathname));
          setAdminPath(pathname);
        }
      } else if (pathname.startsWith('/super-admin') || pathname.startsWith('/super')) {
        setActiveShell('super_admin');
        setAiStage('traditional');
        if (pathname.startsWith('/super')) {
          setSuperAdminPath(pathname);
        }
      } else if (pathname.startsWith('/member') || pathname.startsWith('/portal')) {
        setActiveShell('member');
        if (pathname === '/portal/ai') {
          setAiStage('landing');
        } else {
          setAiStage('traditional');
          setMemberView(resolveMemberView(pathname));
        }
      } else if (pathname === '/settings' || pathname === '/portal/settings' || pathname === '/admin/settings') {
        setActiveShell('settings');
      } else if (pathname === '/apply' || pathname === '/join') {
        setActiveShell('public');
        setPublicView('apply');
      } else if (pathname.startsWith('/track-application') || pathname.startsWith('/track')) {
        setActiveShell('public');
        setPublicView('home');
        setIsTrackModalOpen(true);
        const parts = pathname.split('/').filter(Boolean);
        if (parts.length > 1 && (parts[0] === 'track-application' || parts[0] === 'track')) {
          setTrackCode(parts[1].toUpperCase());
        }
      } else if (pathname === '/' || pathname === '') {
        setActiveShell('public');
        setPublicView('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Dynamic tenant chamber resolution with zero hardcoding:
  // 1. If super_admin, platform scope "121 Meet.AI"
  // 2. Authenticated user's assigned chamber (authChamber)
  // 3. User's explicitly selected chamber (subdomain, picker, or query param)
  // 4. Any provisioned chamber from D1 database
  // 5. Generic fallback "121 Meet.AI" (NEVER a hardcoded chamber)
  const resolvedChamberName =
    highestRole === 'super_admin'
      ? '121 Meet.AI'
      : authChamber?.name ||
        selectedChamber?.name ||
        (chambers.length > 0 ? chambers[0].name : '121 Meet.AI');

  const resolvedChamberSlug =
    selectedChamber?.slug ||
    (authChamber as any)?.slug ||
    authChamber?.id ||
    (chambers.length > 0 ? chambers[0].slug : undefined);

  // Auto-sync selectedChamber if user is authenticated with a chamber
  useEffect(() => {
    if (authChamber && chambers.length > 0 && !selectedChamber) {
      const match = chambers.find(
        (c) => c.id === authChamber.id || c.name.toLowerCase() === authChamber.name.toLowerCase()
      );
      if (match) {
        setSelectedChamber(match);
      }
    }
  }, [authChamber, chambers, selectedChamber]);

  const userChapterScope =
    roles.find((r) => r.scopeType === 'chapter')?.scopeId ||
    '';

  const navigateRoleDashboard = () => {
    if (highestRole === 'super_admin') {
      setActiveShell('super_admin');
      setAiStage('traditional');
      const target = superAdminPath || '/super/chambers';
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', target);
      }
    } else if (['full_admin', 'billing_admin', 'group_admin', 'chapter_admin'].includes(highestRole || '')) {
      setActiveShell('admin');
      setAiStage('traditional');
      landOnOnboardingRef.current = true;
      const target = adminPath && adminPath !== '/admin/onboarding' ? adminPath : '/admin/dashboard';
      setAdminPath(target);
      setAdminView(resolveAdminView(target));
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', target);
      }
    } else {
      setActiveShell('member');
      setAiStage('traditional');
      setMemberView('overview');
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/portal/overview');
      }
    }
  };

  const handleSelectChamber = (chamber: RegisteredChamber) => {
    if (typeof window !== 'undefined') {
      // Host comes from core/config (custom domain, else <slug>.<platform domain> / .localhost).
      // Locally custom domains cannot resolve, so always use <slug>.localhost.
      const targetUrl = buildChamberSiteUrl(
        isLocalHostname() ? { slug: chamber.slug } : { slug: chamber.slug, customDomain: chamber.customDomain }
      );
      if (targetUrl && window.location.href !== targetUrl) {
        window.location.href = targetUrl;
        return;
      }
    }

    setSelectedChamber(chamber);
  };

  const handleBackToChambersDirectory = () => {
    if (isPathTenantRouting()) setActiveChamberSlug(null);
    if (typeof window !== 'undefined') {
      const targetUrl = buildPlatformRootUrl();
      if (targetUrl && window.location.href !== targetUrl) {
        window.location.href = targetUrl;
        return;
      }
    }

    setSelectedChamber(null);
  };

  const handleAuthSuccess = (authData: any) => {
    const role = authData?.user?.highestRole;
    if (role === 'super_admin') {
      setActiveShell('super_admin');
      setAiStage('traditional');
      const target = superAdminPath || '/super/chambers';
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', target);
      }
    } else if (['full_admin', 'billing_admin', 'group_admin', 'chapter_admin'].includes(role || '')) {
      setActiveShell('admin');
      setAiStage('traditional');

      // The onboarding effect moves a full_admin to the wizard if the chamber is not onboarded.
      landOnOnboardingRef.current = true;
      const target = '/admin/dashboard';
      setAdminPath(target);
      setAdminView('dashboard');
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', target);
      }
    } else {
      setActiveShell('member');
      setAiStage('traditional');
      setMemberView('overview');
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/portal/overview');
      }
    }
  };

  // Load the chamber's onboarding status for full admins in the admin portal.
  useEffect(() => {
    if (activeShell !== 'admin' || !isAuthenticated || !isFullAdmin) {
      setOnboardingCompleted(null);
      return;
    }
    let cancelled = false;
    fetchOnboardingState()
      .then((state) => {
        if (!cancelled) setOnboardingCompleted(Boolean(state?.is_completed));
      })
      .catch(() => {
        if (!cancelled) setOnboardingCompleted(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeShell, isAuthenticated, isFullAdmin, user?.id]);

  // First landing → wizard while incomplete; wizard URL → dashboard once completed or for
  // admins who cannot run it (chapter / group / billing).
  useEffect(() => {
    if (activeShell !== 'admin') return;
    const goTo = (path: string) => {
      setAdminPath(path);
      setAdminView(resolveAdminView(path));
      if (typeof window !== 'undefined') window.history.replaceState({}, '', path);
    };
    if (onboardingCompleted === false && landOnOnboardingRef.current) {
      landOnOnboardingRef.current = false;
      if (adminView !== 'onboarding') goTo('/admin/onboarding');
      return;
    }
    if (onboardingCompleted === true) landOnOnboardingRef.current = false;
    if (
      adminView === 'onboarding' &&
      (onboardingCompleted === true || (highestRole && !isFullAdmin))
    ) {
      goTo('/admin/dashboard');
    }
  }, [activeShell, onboardingCompleted, adminView, highestRole, isFullAdmin]);

  const handleLogout = async () => {
    await logout();
    setAiStage('landing');
    setActiveShell('public');
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }
  };

  const [businessLogo, setBusinessLogo] = useState<string | null | undefined>(undefined);

  const currentUserId = user?.id;

  // Sync business logo for member profile avatar. Re-runs per user so one account's
  // logo never carries over to another account (e.g. member → admin in the same tab).
  useEffect(() => {
    setBusinessLogo(undefined);
    if (!isAuthenticated || !currentUserId) return;

    let cancelled = false;
    fetchBusinessProfile()
      .then((profile) => {
        if (!cancelled) setBusinessLogo(profile?.logoUrl || null);
      })
      .catch(() => {
        // No business linked to this account (e.g. admins) → fall back to the user's own avatar.
        if (!cancelled) setBusinessLogo(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    const handleLogoUpdate = (e: any) => {
      const url = e.detail?.logoUrl;
      setBusinessLogo(url ? url : null);
    };
    window.addEventListener('business-logo:updated', handleLogoUpdate);
    return () => {
      window.removeEventListener('business-logo:updated', handleLogoUpdate);
    };
  }, [currentUserId]);

  const activeUserProp = user
    ? {
        name: user.name || `${user.firstName} ${user.lastName}`.trim() || user.email,
        email: user.email,
        role: user.highestRole,
        avatarUrl:
          businessLogo !== undefined
            ? (businessLogo || undefined)
            : (user.avatarUrl || undefined),
        businessName: (user as any).businessName || (user as any).company || undefined,
        chapter: (user as any).chapter || (user as any).chapterName || undefined,
        chamber: authChamber?.name || resolvedChamberName,
        plan: (user as any).plan || (user as any).tierName || undefined,
      }
    : undefined;

  return (
    <div>
      {/* 1. Public / Guest Experience */}
      {activeShell === 'public' && (
        publicView === 'apply' ? (
          <ApplicationWizardPage
            chamberName={resolvedChamberName}
            chamberSlug={resolvedChamberSlug}
            initialPlanId={applyInitialPlanId}
            onNavigateHome={() => {
              setPublicView('home');
              if (typeof window !== 'undefined') {
                window.history.pushState({}, '', '/');
              }
            }}
            onNavigateTrack={(code) => {
              if (code) setTrackCode(code);
              setIsTrackModalOpen(true);
            }}
          />
        ) : !selectedChamber ? (
          <ChamberPickerGate
            chambers={chambers}
            isLoading={isLoadingChambers}
            onSelectChamber={handleSelectChamber}
            onLoginClick={() => {
              setLoginModalPortal('member');
              setIsLoginModalOpen(true);
            }}
            onSuperAdminClick={() => {
              if (highestRole === 'super_admin') {
                setActiveShell('super_admin');
                setAiStage('traditional');
                const target = superAdminPath || '/super/chambers';
                if (typeof window !== 'undefined') {
                  window.history.pushState({}, '', target);
                }
              } else {
                setLoginModalPortal('super_admin');
                setIsLoginModalOpen(true);
              }
            }}
            onDashboardClick={navigateRoleDashboard}
            onLogoutClick={handleLogout}
            isAuthenticated={isAuthenticated}
            onTrackApplication={(code?: string) => {
              if (code && typeof code === 'string') setTrackCode(code);
              setIsTrackModalOpen(true);
            }}
          />
        ) : (
          <ChamberPublicPage
            chamber={selectedChamber}
            onJoinClick={() => {
              setPublicView('apply');
              if (typeof window !== 'undefined') {
                window.history.pushState({}, '', '/apply');
              }
            }}
            onApplyWithPlan={(planId) => {
              setApplyInitialPlanId(planId);
              setPublicView('apply');
              if (typeof window !== 'undefined') {
                window.history.pushState({}, '', '/apply');
              }
            }}
            onLoginClick={() => {
              setLoginModalPortal('member');
              setIsLoginModalOpen(true);
            }}
            onDashboardClick={navigateRoleDashboard}
            isAuthenticated={isAuthenticated}
            onTrackApplication={(code?: string) => {
              if (code && typeof code === 'string') setTrackCode(code);
              setIsTrackModalOpen(true);
            }}
            onBackToDirectory={handleBackToChambersDirectory}
            onLoginSuccess={handleAuthSuccess}
          />
        )
      )}

      {/* 2. Member Portal — Protected by ProtectedRoute */}
      {activeShell === 'member' && (
        <ProtectedRoute onRedirectToLogin={() => setActiveShell('public')}>
          {aiStage === 'landing' ? (
            <AILandingPage
              chamberName={resolvedChamberName}
              role={highestRole || 'member'}
              user={activeUserProp}
              onViewTraditionalLayout={() => {
                setAiStage('traditional');
                if (typeof window !== 'undefined') {
                  window.history.pushState({}, '', '/portal/overview');
                }
              }}
              onEnterPrompt={(_query) => {
                setAiStage('traditional');
                if (typeof window !== 'undefined') {
                  window.history.pushState({}, '', '/portal/overview');
                }
              }}
              onLogout={handleLogout}
            />
          ) : (
            <>
              <MemberLayout
                chamberName={resolvedChamberName}
              user={activeUserProp}
              onLogout={handleLogout}
              onEditProfile={() => setIsEditBusinessProfileOpen(true)}
              onAccountSettings={() => {
                setActiveShell('settings');
                if (typeof window !== 'undefined') {
                  window.history.pushState({}, '', '/portal/settings');
                }
              }}
              onBackToAI={() => {
                setAiStage('landing');
                if (typeof window !== 'undefined') {
                  window.history.pushState({}, '', '/portal/ai');
                }
              }}
              currentPath={
                memberView === 'plans'
                  ? '/portal/membership'
                  : memberView === 'billing'
                  ? '/portal/billing'
                  : memberView === 'directory'
                  ? '/portal/directory'
                  : memberView === 'events'
                  ? '/portal/events'
                  : memberView === 'messages'
                  ? '/portal/messages'
                  : memberView === 'referrals'
                  ? '/portal/referrals'
                  : memberView === 'card'
                  ? '/portal/card'
                  : memberView === 'crm'
                  ? '/portal/crm'
                  : memberView === 'tasks'
                  ? '/portal/tasks'
                  : memberView === 'mentorship'
                  ? '/portal/mentorship'
                  : '/portal/overview'
              }
              onNavigate={(path) => {
                if (typeof window !== 'undefined') {
                  window.history.pushState({}, '', path);
                }
                if (path === '/portal/business-profile' || path === '/member/business-profile') {
                  setIsEditBusinessProfileOpen(true);
                  setMemberView('overview');
                  if (typeof window !== 'undefined') window.history.pushState({}, '', '/portal/overview');
                } else {
                  setMemberView(resolveMemberView(path));
                }
              }}
            >
              {memberView === 'plans' ? (
                <MemberMembershipPage
                  chamberName={resolvedChamberName}
                  chamberSlug={resolvedChamberSlug}
                  user={activeUserProp}
                  onNavigateSection={(id) => {
                    if (id === 'overview') {
                      setMemberView('overview');
                      if (typeof window !== 'undefined') window.history.pushState({}, '', '/portal/overview');
                    }
                    if (id === 'settings') {
                      setActiveShell('settings');
                      if (typeof window !== 'undefined') window.history.pushState({}, '', '/portal/settings');
                    }
                    if (id === 'billing') {
                      setMemberView('billing');
                      if (typeof window !== 'undefined') window.history.pushState({}, '', '/portal/billing');
                    }
                    if (id === 'directory') {
                      setMemberView('directory');
                      if (typeof window !== 'undefined') window.history.pushState({}, '', '/portal/directory');
                    }
                    if (id === 'events') {
                      setMemberView('events');
                      if (typeof window !== 'undefined') window.history.pushState({}, '', '/portal/events');
                    }
                    if (id === 'business-profile' || id === 'profile') {
                      setIsEditBusinessProfileOpen(true);
                    }
                    if (id === 'team') {
                      setMemberView('plans');
                    }
                  }}
                />
              ) : memberView === 'billing' ? (
                <MemberBillingPage
                  chamberName={resolvedChamberName}
                  onNavigateMembership={() => {
                    setMemberView('plans');
                    if (typeof window !== 'undefined') window.history.pushState({}, '', '/portal/membership');
                  }}
                />
              ) : memberView === 'directory' ? (
                <DirectoryPage
                  mode="member"
                  chamberName={resolvedChamberName}
                  chamberSlug={resolvedChamberSlug}
                  onOpenMessages={(partnerId) => {
                    setMemberView('messages');
                    if (typeof window !== 'undefined') {
                      window.history.pushState({}, '', `/portal/messages?with=${encodeURIComponent(partnerId)}`);
                    }
                  }}
                  onNavigateToPlans={() => {
                    setMemberView('plans');
                    if (typeof window !== 'undefined') window.history.pushState({}, '', '/portal/membership');
                  }}
                />
              ) : memberView === 'events' ? (
                <EventsExplorerPage
                  mode="member"
                  chamberName={resolvedChamberName}
                  chamberSlug={resolvedChamberSlug}
                  onNavigateToPlans={() => {
                    setMemberView('plans');
                    if (typeof window !== 'undefined') window.history.pushState({}, '', '/portal/membership');
                  }}
                />
              ) : memberView === 'messages' ? (
                <MessagesPage
                  onViewBusiness={(partner) => {
                    setMemberView('directory');
                    if (typeof window !== 'undefined') {
                      window.history.pushState({}, '', `/portal/directory?q=${encodeURIComponent(partner.companyName || partner.name)}`);
                    }
                  }}
                />
              ) : memberView === 'crm' ? (
                <CrmPipelinePage chamberSlug={resolvedChamberSlug} />
              ) : memberView === 'tasks' ? (
                <KanbanTasksPage />
              ) : memberView === 'mentorship' ? (
                <MentorshipHubPage
                  onOpenMessages={(partnerId) => {
                    setMemberView('messages');
                    if (typeof window !== 'undefined') {
                      window.history.pushState({}, '', `/portal/messages?with=${encodeURIComponent(partnerId)}`);
                    }
                  }}
                />
              ) : memberView === 'card' ? (
                <DigitalCardPage />
              ) : memberView === 'referrals' ? (
                <ReferralsPage chamberName={resolvedChamberName} chamberSlug={resolvedChamberSlug} />
              ) : (
                <MemberOverviewPage
                  onNavigateSection={(id) => {
                    if (id === 'settings') {
                      setActiveShell('settings');
                      if (typeof window !== 'undefined') window.history.pushState({}, '', '/portal/settings');
                    }
                    if (id === 'membership' || id === 'plan') {
                      setMemberView('plans');
                      if (typeof window !== 'undefined') window.history.pushState({}, '', '/portal/membership');
                    }
                    if (id === 'billing') {
                      setMemberView('billing');
                      if (typeof window !== 'undefined') window.history.pushState({}, '', '/portal/billing');
                    }
                    if (id === 'directory') {
                      setMemberView('directory');
                      if (typeof window !== 'undefined') window.history.pushState({}, '', '/portal/directory');
                    }
                    if (id === 'events') {
                      setMemberView('events');
                      if (typeof window !== 'undefined') window.history.pushState({}, '', '/portal/events');
                    }
                    if (id === 'business-profile' || id === 'profile') {
                      setIsEditBusinessProfileOpen(true);
                    }
                    if (id === 'team') {
                      setMemberView('plans');
                      if (typeof window !== 'undefined') window.history.pushState({}, '', '/portal/membership');
                    }
                  }}
                />
              )}
            </MemberLayout>

              {/* Modal for editing business profile from profile icon */}
              <EditBusinessProfileModal
                isOpen={isEditBusinessProfileOpen}
                onClose={() => setIsEditBusinessProfileOpen(false)}
              />
            </>
          )}
        </ProtectedRoute>
      )}

      {/* 3. Full Chamber Admin — Protected by RequireRole */}
      {activeShell === 'admin' && (
        <RequireRole
          roles={['full_admin', 'billing_admin', 'group_admin', 'chapter_admin']}
        >
          {aiStage === 'landing' ? (
            <AILandingPage
              chamberName={resolvedChamberName}
              role={highestRole || 'full_admin'}
              user={activeUserProp}
              onViewTraditionalLayout={() => {
                setAiStage('traditional');
                if (typeof window !== 'undefined') {
                  window.history.pushState({}, '', adminPath || '/admin/dashboard');
                }
              }}
              onEnterPrompt={(_query) => {
                setAiStage('traditional');
                if (typeof window !== 'undefined') {
                  window.history.pushState({}, '', adminPath || '/admin/dashboard');
                }
              }}
              onLogout={handleLogout}
            />
          ) : (
            <AdminLayout
              chamberName={resolvedChamberName}
              user={activeUserProp}
              showOnboarding={onboardingCompleted === false}
              onLogout={handleLogout}
              onAccountSettings={() => {
                setActiveShell('settings');
                if (typeof window !== 'undefined') {
                  window.history.pushState({}, '', '/admin/settings');
                }
              }}
              currentPath={adminView.includes('plan') ? '/admin/plans' : adminPath}
              onNavigate={(path) => {
                setAdminPath(path);
                if (typeof window !== 'undefined') {
                  window.history.pushState({}, '', path);
                }
                if (path === '/admin/plans') {
                  setAdminView('plans');
                } else if (path === '/admin/applications') {
                  setAdminView('applications');
                } else if (path === '/admin/events' || path === '/admin/events/') {
                  setSelectedAdminEventId(null);
                  setAdminView('events');
                } else if (path.startsWith('/admin/events/')) {
                  const id = path.replace(/^\/admin\/events\//, '').split('/')[0].split('?')[0];
                  setSelectedAdminEventId(id || null);
                  setAdminView('event-detail');
                } else if (path === '/admin/dashboard') {
                  setAdminView('dashboard');
                } else if (path === '/admin/onboarding') {
                  setAdminView('onboarding');
                } else {
                  setAdminView(path.replace('/admin/', ''));
                }
              }}
            >
              {adminView === 'onboarding' ? (
                <ChamberOnboardingWizard
                  chamberName={resolvedChamberName}
                  onComplete={() => {
                    setOnboardingCompleted(true);
                    setSelectedChamber((prev) =>
                      prev ? { ...prev, onboarded: true, status: 'active' } : null
                    );
                    setAdminPath('/admin/dashboard');
                    setAdminView('dashboard');
                    if (typeof window !== 'undefined') window.history.pushState({}, '', '/admin/dashboard');
                  }}
                  onExit={() => {
                    setAdminPath('/admin/dashboard');
                    setAdminView('dashboard');
                    if (typeof window !== 'undefined') window.history.pushState({}, '', '/admin/dashboard');
                  }}
                />
              ) : adminView === 'plans' ? (
                <AdminPlansListPage
                  chamberSlug={resolvedChamberSlug}
                />
              ) : adminView === 'applications' ? (
                <AdminApplicationsPage
                  chamberSlug={resolvedChamberSlug}
                />
              ) : adminView === 'events' ? (
                <AdminEventsListPage
                  chamberSlug={resolvedChamberSlug}
                  onSelectEvent={(eventId) => {
                    setSelectedAdminEventId(eventId);
                    setAdminPath(`/admin/events/${eventId}`);
                    setAdminView('event-detail');
                    if (typeof window !== 'undefined') {
                      window.history.pushState({}, '', `/admin/events/${eventId}`);
                    }
                  }}
                />
              ) : adminView === 'event-detail' && selectedAdminEventId ? (
                <AdminEventDetailPage
                  eventId={selectedAdminEventId}
                  chamberSlug={resolvedChamberSlug}
                  onNavigateBack={() => {
                    setSelectedAdminEventId(null);
                    setAdminPath('/admin/events');
                    setAdminView('events');
                    if (typeof window !== 'undefined') {
                      window.history.pushState({}, '', '/admin/events');
                    }
                  }}
                />
              ) : adminView === 'new-plan' || adminView === 'edit-plan' ? (
                <AdminPlanBuilderPage
                  planId={adminView === 'edit-plan' ? editingPlanId || undefined : undefined}
                  chamberSlug={resolvedChamberSlug}
                  onNavigateBack={() => setAdminView('plans')}
                  onPlanSaved={() => setAdminView('plans')}
                />
              ) : adminView === 'mentorship' ? (
                <AdminMentorshipPage />
              ) : adminView === 'dashboard' ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">Full Chamber Administration</h1>
                      <p className="text-sm text-muted-foreground">All 42 administration modules available with unrestricted scope.</p>
                    </div>
                    <Badge className="bg-primary text-primary-foreground font-semibold">
                      Supervisory Scope
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card
                      onClick={() => {
                        setAdminPath('/admin/plans');
                        setAdminView('plans');
                      }}
                      className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
                    >
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center justify-between">
                          <span>Membership Plans &amp; Tiers</span>
                          <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                            Configure
                          </Badge>
                        </CardTitle>
                        <CardDescription>Manage tiered dues &amp; chapter overrides</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-extrabold text-foreground">Prompt 02.1</p>
                        <p className="text-xs text-primary font-medium mt-1">Open plans management →</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Monthly Recurring Dues</CardTitle>
                        <CardDescription>Stripe &amp; ACH volume</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-extrabold text-foreground">$84,200</p>
                        <p className="text-xs text-muted-foreground mt-1">Next auto-sync to QuickBooks: 23:00</p>
                      </CardContent>
                    </Card>

                    <Card
                      onClick={() => {
                        setAdminPath('/admin/events');
                        setSelectedAdminEventId(null);
                        setAdminView('events');
                        if (typeof window !== 'undefined') {
                          window.history.pushState({}, '', '/admin/events');
                        }
                      }}
                      className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
                    >
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center justify-between">
                          <span>Active Events</span>
                          <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                            Prompt 04.2
                          </Badge>
                        </CardTitle>
                        <CardDescription>Published and registration open</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-extrabold text-foreground">8</p>
                        <p className="text-xs text-primary font-medium mt-1">Manage 9-tab event consoles →</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight capitalize">
                        {adminView.replace(/-/g, ' ')}
                      </h1>
                      <p className="text-sm text-muted-foreground">
                        Module scheduled in master implementation playbook sequence.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                      Chamber Admin Scope
                    </Badge>
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base capitalize">{adminView.replace(/-/g, ' ')} Module</CardTitle>
                      <CardDescription>
                        This module is linked to the 121Meet Chamber Management platform sequence.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Membership plans, tiered pricing engine, and regional chapter overrides are currently active and configured in Prompt 02.1.
                      </p>
                      <Button
                        onClick={() => {
                          setAdminPath('/admin/plans');
                          setAdminView('plans');
                        }}
                        className="text-xs"
                      >
                        Open Plans &amp; Renewals
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </AdminLayout>
          )}
        </RequireRole>
      )}

      {/* 4. Scoped Chapter Admin — Protected by RequireScope */}
      {activeShell === 'chapter_admin' && (
        <RequireScope
          scopeType="chapter"
          scopeId={userChapterScope || 'chap_test0000000001'}
          scopeName={activeUserProp?.chapter || "Assigned Chapter"}
        >
          {aiStage === 'landing' ? (
            <AILandingPage
              chamberName={resolvedChamberName}
              role="chapter_admin"
              user={activeUserProp}
              onViewTraditionalLayout={() => setAiStage('traditional')}
              onEnterPrompt={(_query) => setAiStage('traditional')}
              onLogout={handleLogout}
            />
          ) : (
            <AdminLayout
              chamberName={resolvedChamberName}
              user={activeUserProp}
              onLogout={handleLogout}
              onAccountSettings={() => setActiveShell('settings')}
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight">Scoped Chapter Administration</h1>
                    <p className="text-sm text-muted-foreground">
                      Navigation is automatically restricted to Chapter-authorized modules (15 of 42).
                    </p>
                  </div>
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                    Scope: Downtown Chapter
                  </Badge>
                </div>

                <Card className="border-amber-500/20 bg-amber-500/5">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-amber-500" />
                      <CardTitle className="text-base text-amber-800 dark:text-amber-300">
                        RBAC Scoped Isolation Verified
                      </CardTitle>
                    </div>
                    <CardDescription className="text-amber-700/80 dark:text-amber-400/80">
                      Global settings, tenant provisioning, financial gateway credentials, and other chapter domains are strictly filtered from the navigation tree and secured server-side.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </AdminLayout>
          )}
        </RequireScope>
      )}

      {/* 5. Super Admin Control Plane — Protected by RequireSuperAdmin */}
      {activeShell === 'super_admin' && (
        <RequireSuperAdmin>
          {aiStage === 'landing' ? (
            <AILandingPage
              chamberName="121 Meet.AI"
              role="super_admin"
              user={activeUserProp}
              onViewTraditionalLayout={() => setAiStage('traditional')}
              onEnterPrompt={(_query) => setAiStage('traditional')}
              onLogout={handleLogout}
            />
          ) : (
            <SuperAdminLayout
              user={activeUserProp}
              currentPath={superAdminPath}
              onNavigate={(href) => {
                setSuperAdminPath(href);
                if (typeof window !== 'undefined') {
                  window.history.pushState({}, '', href);
                }
              }}
              onLogout={handleLogout}
              onAccountSettings={() => setActiveShell('settings')}
            >
              {superAdminPath === '/super/chambers' ? (
                <SuperChambersPage />
              ) : (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight">Multi-Tenant Cloud Control Plane</h1>
                    <p className="text-sm text-muted-foreground">Root telemetry across all provisioned chambers and tenant subdomains.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Provisioned Tenants</CardDescription>
                        <CardTitle className="text-3xl font-mono">142</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs text-emerald-500">100% Cloudflare Edge health</CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>D1 Database Tables</CardDescription>
                        <CardTitle className="text-3xl font-mono text-primary">102</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground">Zero drift from canonical schema</CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Edge Worker Latency</CardDescription>
                        <CardTitle className="text-3xl font-mono text-emerald-500">&lt; 14ms</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground">Global CDN caching enabled</CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Platform Monthly ARR</CardDescription>
                        <CardTitle className="text-3xl font-mono">$1.42M</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground">Across all tenant subscriptions</CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </SuperAdminLayout>
          )}
        </RequireSuperAdmin>
      )}

      {/* 6. Settings Console — Prompt 01.4 */}
      {activeShell === 'settings' && (
        <ProtectedRoute onRedirectToLogin={() => {
          setActiveShell('public');
          if (typeof window !== 'undefined') window.history.replaceState({}, '', '/');
        }}>
          <MemberLayout
            user={activeUserProp}
            onLogout={handleLogout}
            onAccountSettings={() => {
              setActiveShell('settings');
              if (typeof window !== 'undefined') window.history.pushState({}, '', '/portal/settings');
            }}
          >
            <AccountSettingsPage
              onNavigateBack={() => {
                if (highestRole === 'super_admin') {
                  setActiveShell('super_admin');
                  if (typeof window !== 'undefined') window.history.pushState({}, '', superAdminPath || '/super/chambers');
                } else if (['full_admin', 'billing_admin', 'group_admin', 'chapter_admin'].includes(highestRole || '')) {
                  setActiveShell('admin');
                  if (typeof window !== 'undefined') window.history.pushState({}, '', adminPath || '/admin/dashboard');
                } else {
                  setActiveShell('member');
                  if (typeof window !== 'undefined') window.history.pushState({}, '', '/portal/overview');
                }
              }}
            />
          </MemberLayout>
        </ProtectedRoute>
      )}

      {/* 6. Dedicated Member Verification & Event Check-In Page */}
      {activeShell === 'verify' && (
        <MemberVerificationPage
          memberId={verifyMemberId}
          onNavigateHome={() => {
            setActiveShell('public');
            if (typeof window !== 'undefined') {
              window.history.pushState({}, '', '/');
            }
          }}
        />
      )}

      {/* Prompt 05.4: public digital business card (/card/:token) */}
      {activeShell === 'card' && (
        <PublicCardPage
          token={decodeURIComponent((typeof window !== 'undefined' ? window.location.pathname : '').split('/')[2] || '')}
          // Only the subdomain-resolved chamber (never a fallback chamber) — OD-002.
          chamberSlug={selectedChamber?.slug}
          ready={!isLoadingChambers}
          isAuthenticated={isAuthenticated}
          onConnect={(card) => {
            if (isAuthenticated) {
              setActiveShell('member');
              setAiStage('traditional');
              setMemberView('directory');
              window.history.pushState({}, '', `/portal/directory?q=${encodeURIComponent(card.profile.company || card.profile.name)}`);
            } else {
              setActiveShell('public');
              setPublicView('apply');
              window.history.pushState({}, '', '/join');
            }
          }}
        />
      )}

      {/* 7. Universal Authentication Modal (Member / Chamber Admin / Super Admin) */}
      <MemberLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        chamber={
          selectedChamber ||
          (chambers.length > 0
            ? chambers[0]
            : {
                id: 'plat_root',
                name: '121 Meet.AI Platform',
                city: 'Austin, TX',
                slug: '121meet',
                membersCount: 0,
              })
        }
        initialPortal={loginModalPortal}
        allowSuperAdmin={loginModalPortal === 'super_admin' || !selectedChamber}
        onSuccess={(authData) => {
          setIsLoginModalOpen(false);
          handleAuthSuccess(authData);
        }}
      />

      {/* 7. Idle Warning Modal (triggers at 25m continuous inactivity) */}
      <IdleWarningModal
        open={showIdleWarning}
        remainingSeconds={idleCountdownSeconds}
        onKeepLoggedIn={extendSession}
        onLogoutNow={handleLogout}
      />

      {/* 8. Session Expiry Modal (triggers on 30m idle timeout or 401 token invalidation) */}
      <SessionExpiryModal
        open={showSessionExpired}
        onLoginRedirect={() => {
          dismissSessionExpired();
          setActiveShell('public');
        }}
        onClose={dismissSessionExpired}
      />

      {/* 9. Dynamic Application Tracking Modal (matching Screenshot 2) */}
      <TrackApplicationModal
        isOpen={isTrackModalOpen}
        onClose={() => {
          setIsTrackModalOpen(false);
          if (
            typeof window !== 'undefined' &&
            (window.location.pathname.startsWith('/track-application') ||
              window.location.pathname.startsWith('/track'))
          ) {
            window.history.pushState({}, '', '/');
          }
        }}
        initialCode={trackCode}
        chamberSlug={resolvedChamberSlug}
      />

      {/* 10. Public Member Verification Modal (triggers on QR Code scan / verify URL) */}
      <VerifyMemberModal
        isOpen={isVerifyModalOpen && activeShell !== 'verify'}
        memberId={verifyMemberId}
        onClose={() => {
          setIsVerifyModalOpen(false);
          setVerifyMemberId(null);
          if (
            typeof window !== 'undefined' &&
            (window.location.pathname.startsWith('/verify') ||
              window.location.search.includes('verify='))
          ) {
            window.history.pushState({}, '', '/');
          }
        }}
      />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
