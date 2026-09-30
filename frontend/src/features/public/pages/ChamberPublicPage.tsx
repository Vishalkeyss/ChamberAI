import React, { useState } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  ArrowRight,
  Building,
  CalendarDays,
  Star,
  MessageCircle,
} from 'lucide-react';
import { useTheme } from '@/core/context/ThemeContext';
import type { RegisteredChamber } from '../data/chambers';
import LOGO_SRC from '@/assets/logo.png';
import { MemberLoginModal } from '@/features/auth/components/MemberLoginModal';
import { PublicPricingPage } from '@/features/membership/pages/PublicPricingPage';
import { cn } from '@/lib/utils';

export interface ChamberPublicPageProps {
  chamber: RegisteredChamber;
  onJoinClick?: () => void;
  onApplyWithPlan?: (planId: string) => void;
  onLoginClick?: () => void;
  onDashboardClick?: () => void;
  isAuthenticated?: boolean;
  onTrackApplication?: () => void;
  onBackToDirectory?: () => void;
  onLoginSuccess?: (authData: any) => void;
}

const NAV_LINKS = [
  { id: 'home', label: 'Home' },
  { id: 'directory', label: 'Directory' },
  { id: 'about', label: 'About' },
  { id: 'plans', label: 'Membership Plans' },
  { id: 'events', label: 'Events' },
  { id: 'news', label: 'Chamber News' },
  { id: 'blog', label: 'Blog' },
  { id: 'grader', label: 'Website Grader' },
  { id: 'store', label: 'Store' },
  { id: 'careers', label: 'Careers' },
  { id: 'contact', label: 'Contact' },
];

export const ChamberPublicPage: React.FC<ChamberPublicPageProps> = ({
  chamber,
  onJoinClick,
  onApplyWithPlan,
  onLoginClick,
  onDashboardClick,
  isAuthenticated,
  onTrackApplication,
  onBackToDirectory,
  onLoginSuccess,
}) => {
  const [activeTab, setActiveTab] = useState('home');
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [isMemberLoginModalOpen, setIsMemberLoginModalOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  // City display for headline:
  const city = (() => {
    if (chamber.city && chamber.city !== 'Testville' && chamber.city !== 'Metro Area') {
      return chamber.city;
    }
    const cleaned = chamber.name
      .replace(/\s+(Chamber of Commerce|Chamber|Traders Association|Entrepreneurs Circle|Alliance|Council|Network)$/i, '')
      .trim();
    return cleaned || chamber.name;
  })();

  const memberCountFormatted =
    chamber.membersCount && chamber.membersCount > 0
      ? chamber.membersCount.toLocaleString()
      : '0';

  const foundedYear = chamber.estYear || '2025';

  const latestNews = [
    {
      id: 'nr_1',
      company: 'Bluewater Logistics',
      date: '22 Jul 2026',
      headline: `Bluewater Logistics opens new ${city} distribution hub`,
    },
    {
      id: 'nr_2',
      company: 'Ellis Interiors',
      date: '18 Jul 2026',
      headline: `Ellis Interiors completes redesign of the ${city} Public Library annex`,
    },
    {
      id: 'nr_3',
      company: 'Sanders Exports Inc',
      date: '11 Jul 2026',
      headline: 'Sanders Exports signs first distribution deal in the Netherlands',
    },
  ];

  const testimonials = [
    {
      quote: 'Referrals from this chamber directly built a real share of our export orders last year.',
      name: 'Alexander Morgan',
      biz: 'Morgan Steel Traders',
    },
    {
      quote: 'The verified badge gave new clients real confidence in dealing with us.',
      name: 'Samantha Cole',
      biz: 'Cole Textiles Inc',
    },
    {
      quote: 'Best networking events in the region — every meet turns into real business.',
      name: 'Ryan Bennett',
      biz: 'Bennett Auto Parts',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans bg-background text-foreground transition-colors duration-200">
      {/* SiteHeader — Dynamic tokens from src/index.css */}
      <header className="shrink-0 sticky top-0 z-40 bg-header-nav transition-colors duration-200">
        {/* Row 1: Utility bar (central token: --header-utility) */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-6 min-h-[40px] bg-header-utility border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={LOGO_SRC}
              alt="121 Meet"
              className="w-5 h-5 rounded object-contain shrink-0 bg-white"
            />
            <span className="font-semibold text-white truncate" style={{ fontSize: 17 }}>
              {chamber.name}
            </span>
            {onBackToDirectory && (
              <button
                type="button"
                onClick={onBackToDirectory}
                className="hidden sm:inline-flex items-center text-xs text-white/70 hover:text-white transition-colors cursor-pointer ml-2 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20"
                title="Return to Platform Chamber Directory"
              >
                ← All Chambers
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Language Switcher pill toggle */}
            <div className="flex items-center gap-0.5 h-8 px-1 rounded-full shrink-0 bg-white/10 border border-white/20 text-white">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={cn(
                  "px-2.5 h-6 rounded-full text-[11px] font-bold transition whitespace-nowrap cursor-pointer",
                  language === 'en'
                    ? "bg-white text-header-nav"
                    : "text-white/70 hover:text-white"
                )}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('es')}
                className={cn(
                  "px-2.5 h-6 rounded-full text-[11px] font-bold transition whitespace-nowrap cursor-pointer",
                  language === 'es'
                    ? "bg-white text-header-nav"
                    : "text-white/70 hover:text-white"
                )}
              >
                ES
              </button>
            </div>

            {/* ThemeModeToggle */}
            <div
              className="flex items-center gap-0.5 p-0.5 rounded-full shrink-0 bg-white/10 border border-white/20"
              role="group"
              aria-label="Theme mode switcher"
            >
              <button
                type="button"
                onClick={() => setTheme('light')}
                title="Light mode"
                aria-label="Light mode"
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer",
                  theme === 'light'
                    ? "bg-white text-header-nav shadow-xs"
                    : "text-white/70 hover:text-white"
                )}
              >
                <Sun size={14} />
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                title="Dark mode"
                aria-label="Dark mode"
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer",
                  theme === 'dark'
                    ? "bg-white text-header-nav shadow-xs"
                    : "text-white/70 hover:text-white"
                )}
              >
                <Moon size={14} />
              </button>
              <button
                type="button"
                onClick={() => setTheme('system')}
                title="System default mode"
                aria-label="System default mode"
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer",
                  theme === 'system'
                    ? "bg-white text-header-nav shadow-xs"
                    : "text-white/70 hover:text-white"
                )}
              >
                <Monitor size={14} />
              </button>
            </div>

            {/* Track Application link */}
            <button
              type="button"
              onClick={onTrackApplication}
              className="hidden sm:block text-xs font-semibold whitespace-nowrap px-1 cursor-pointer hover:underline text-white/80 hover:text-white"
              style={{ minHeight: 40 }}
            >
              Track Application
            </button>
          </div>
        </div>

        {/* Row 2: Main nav (central token: --header-nav) */}
        <div className="flex items-center gap-2 px-3 sm:px-6 min-h-[56px] bg-header-nav">
          {/* Centered navigation items */}
          <div
            className="flex items-center justify-center py-1"
            style={{ flex: 1, minWidth: 0, marginLeft: 32, marginRight: 4, flexWrap: 'nowrap', overflow: 'hidden' }}
          >
            {NAV_LINKS.map((n) => {
              const active = activeTab === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setActiveTab(n.id)}
                  className={cn(
                    "rounded-md font-medium shrink-0 cursor-pointer px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors",
                    active
                      ? "bg-white/15 dark:bg-white/10 text-white font-semibold"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  )}
                >
                  {n.label}
                </button>
              );
            })}
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={onDashboardClick}
                className="px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition hover:opacity-90 active:scale-[0.98] cursor-pointer bg-card text-card-foreground border border-border hover:bg-muted shadow-2xs"
              >
                Go to Portal
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsMemberLoginModalOpen(true)}
                className="px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition hover:opacity-90 active:scale-[0.98] cursor-pointer bg-card text-card-foreground border border-border hover:bg-muted shadow-2xs"
              >
                Log In
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('plans')}
              className="px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition hover:opacity-90 active:scale-[0.98] cursor-pointer bg-blue-600 hover:bg-blue-500 text-white shadow-xs"
            >
              Join Now
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Content (central token: --hero, --section-news, --section-alt) */}
      <main className="flex-1">
        {activeTab === 'plans' ? (
          <div className="bg-background min-h-[calc(100vh-96px)]">
            <PublicPricingPage
              chamberName={chamber.name}
              chamberSlug={chamber.slug}
              isMember={isAuthenticated}
              onTrackApplication={onTrackApplication}
            />
          </div>
        ) : (
          <>
            {/* GuestHome Hero Section */}
            <div
              className="px-8 py-16 text-center bg-hero border-b border-white/10 transition-colors duration-200"
            >
              {/* EST. Badge */}
              <p className="inline-block text-sm font-bold tracking-wide uppercase mb-3 px-4 py-1.5 rounded-full mx-auto text-white bg-white/15 border border-white/20">
                EST. {foundedYear} · {memberCountFormatted}+ MEMBERS
              </p>

              {/* Headline in max-w-2xl so it wraps exactly into 2 lines */}
              <h1 className="text-4xl font-bold text-white leading-tight max-w-2xl mx-auto">
                Where {city}'s Businesses Connect, Grow & Refer Each Other
              </h1>

              {/* Tagline */}
              <p className="text-white/70 mt-4 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
                Join the region's most active business chamber — networking events, verified referrals, and a marketplace built for local trade.
              </p>

              {/* CTA */}
              <div className="flex items-center gap-3 mt-8 justify-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('plans')}
                  className="px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition hover:opacity-90 active:scale-[0.98] cursor-pointer bg-white text-slate-900 border border-slate-200 shadow-sm hover:bg-slate-50"
                >
                  <span>Become a Member</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>

            {/* Latest News Section (central token: --section-news) */}
            <section className="w-full bg-section-news border-b border-transparent dark:border-white/5 transition-colors duration-200">
              <div className="px-8 pt-10 pb-14 max-w-6xl mx-auto w-full">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Latest News</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Announcements from our member businesses</p>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 border border-border text-foreground bg-card hover:bg-muted cursor-pointer shadow-2xs transition-colors"
                  >
                    See all
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {latestNews.map((n) => (
                    <div
                      key={n.id}
                      className="p-5 rounded-xl border border-border bg-card/90 backdrop-blur-xs shadow-xs transition hover:border-border/80"
                    >
                      <span
                        className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200 border border-transparent"
                      >
                        Announcement
                      </span>
                      <p className="font-semibold text-sm mt-3 text-card-foreground leading-snug">{n.headline}</p>
                      <div className="flex items-center gap-2 text-xs mt-2 text-muted-foreground">
                        <Building size={13} />
                        <span>{n.company}</span>
                        <span>·</span>
                        <CalendarDays size={13} />
                        <span>{n.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* What Our Members Say Section (central token: --section-alt) */}
            <div className="px-8 py-14 bg-section-alt border-t border-border transition-colors">
              <div className="max-w-6xl mx-auto w-full">
                <h2 className="text-xl font-bold text-foreground mb-4">What our members say</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {testimonials.map((m, i) => (
                    <div
                      key={i}
                      className="p-5 rounded-xl border border-border bg-card/90 backdrop-blur-xs shadow-xs"
                    >
                      <div className="flex text-amber-400 mb-3">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={14} className="fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <p className="text-sm italic text-card-foreground">"{m.quote}"</p>
                      <p className="text-xs mt-3 font-semibold text-card-foreground">
                        {m.name} <span className="font-normal text-muted-foreground">· {m.biz}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Ask the Chamber floating trigger button matching app.html */}
      <button
        type="button"
        onClick={() => alert(`Ask the Chamber Assistant (${chamber.name})`)}
        aria-label="Ask the Chamber"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full transition hover:opacity-90 active:scale-95 cursor-pointer bg-header-nav dark:bg-primary text-white shadow-lg dark:shadow-blue-950/60"
        style={{
          width: 56,
          height: 56,
        }}
      >
        <MessageCircle size={24} />
      </button>

      {/* Member Portal Login Modal — Scoped strictly to chamber members & chamber admin */}
      <MemberLoginModal
        isOpen={isMemberLoginModalOpen}
        onClose={() => setIsMemberLoginModalOpen(false)}
        chamber={chamber}
        allowSuperAdmin={false}
        onSuccess={(authData) => {
          setIsMemberLoginModalOpen(false);
          if (onLoginSuccess) {
            onLoginSuccess(authData);
          }
        }}
      />
    </div>
  );
};
