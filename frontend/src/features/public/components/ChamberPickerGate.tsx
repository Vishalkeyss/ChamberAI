import { buildChamberHost } from '@/core/config/app-config';
import React from 'react';
import { Landmark, Globe, Users, ArrowRight, Loader2, ShieldCheck, Sun, Moon, Monitor } from 'lucide-react';
import type { RegisteredChamber } from '../data/chambers';
import { Button } from '@/components/ui/button';
import LOGO_SRC from '@/assets/logo.png';
import { useTheme } from '@/core/context/ThemeContext';
import { cn } from '@/lib/utils';

export interface ChamberPickerGateProps {
  chambers: RegisteredChamber[];
  isLoading?: boolean;
  onSelectChamber: (chamber: RegisteredChamber) => void;
  onLoginClick?: () => void;
  onSuperAdminClick?: () => void;
  onDashboardClick?: () => void;
  onLogoutClick?: () => void;
  isAuthenticated?: boolean;
  onTrackApplication?: () => void;
}

export const ChamberPickerGate: React.FC<ChamberPickerGateProps> = ({
  chambers,
  isLoading = false,
  onSelectChamber,
  onLoginClick,
  onSuperAdminClick,
  onDashboardClick,
  onLogoutClick,
  isAuthenticated,
  onTrackApplication,
}) => {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="min-h-screen flex flex-col text-white bg-gradient-to-b from-primary to-header-nav dark:from-hero dark:to-header-nav transition-colors duration-200"
    >
      {/* Platform Topbar */}
      <header className="w-full flex bg-header-nav items-center justify-between px-4 py-4 border-b border-white/10 dark:border-slate-800/80 transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-white shrink-0 flex items-center justify-center border border-white/20 overflow-hidden p-1 shadow-xs">
            <img
              src={LOGO_SRC}
              alt="121 Meet"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-bold text-base tracking-tight text-white">
            121 Meet.AI Chamber Management
          </span>
        </div>

        <div className="flex items-center gap-2.5 text-sm">
          <button
            type="button"
            onClick={onSuperAdminClick}
            className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white font-medium transition-colors cursor-pointer px-2.5 py-1.5 rounded-lg border border-white/20 hover:bg-white/10"
            title="Platform Super Admin Control Plane"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
            <span>Super Admin</span>
          </button>
          <button
            type="button"
            onClick={onTrackApplication}
            className="text-white/80 hover:text-white transition-colors cursor-pointer text-xs sm:text-sm mr-1"
          >
            Track Application
          </button>

          {/* ThemeModeToggle */}
          <div
            className="flex items-center gap-0.5 p-0.5 rounded-full shrink-0 bg-white/10 border border-white/20 mr-1"
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
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={onDashboardClick}
                className="bg-white text-slate-900 hover:bg-white/90 font-semibold px-3.5 h-8 rounded-lg shadow-sm text-xs"
              >
                Go to Portal
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onLogoutClick}
                className="text-white/80 hover:text-white hover:bg-white/10 h-8 rounded-lg text-xs"
              >
                Log Out
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={onLoginClick}
              className="bg-white text-slate-900 hover:bg-white/90 font-semibold px-4 h-8 rounded-lg shadow-sm"
            >
              Log In
            </Button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-12 pb-16">
        <div className="text-center space-y-4 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 shadow-xs">
            <Landmark className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold tracking-wide text-white/95">
              121 Meet.AI Chamber Management Network
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Every Chamber Has Its Own Address
          </h1>

          <p className="text-white/70 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            Chambers on this network are reached directly at their own domain — no search required.
            If you know your chamber's website, go there directly; otherwise find it in the directory below.
          </p>
        </div>

        {/* Chamber Directory List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold tracking-wider uppercase text-white/60">
              Active Chambers in Network ({chambers.length})
            </p>
            {isLoading && (
              <span className="flex items-center gap-1.5 text-xs text-white/60">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Loading chambers from database...</span>
              </span>
            )}
          </div>

          <div className="rounded-2xl overflow-hidden shadow-2xl bg-card text-card-foreground divide-y divide-border border border-border">
            {isLoading && chambers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm">Connecting to database...</p>
              </div>
            ) : chambers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p className="text-sm font-medium">No chambers currently registered in the database.</p>
              </div>
            ) : (
              chambers.map((chamber) => {
                const displayDomain = buildChamberHost(chamber) || chamber.slug;

                return (
                  <button
                    key={chamber.id}
                    type="button"
                    onClick={() => onSelectChamber(chamber)}
                    className="w-full flex items-center justify-between gap-4 px-6 py-4.5 text-left hover:bg-muted/60 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl border border-border flex items-center justify-center shrink-0 overflow-hidden text-xs font-bold shadow-2xs group-hover:scale-105 transition-transform"
                        style={{
                          backgroundColor: chamber.primaryColor || '#0B2447',
                          color: chamber.textColor || '#FFFFFF',
                        }}
                      >
                        {chamber.logoUrl ? (
                          <img
                            src={chamber.logoUrl}
                            alt={chamber.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Landmark className="h-5 w-5" style={{ color: chamber.textColor || '#FFFFFF' }} />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm sm:text-base font-semibold text-card-foreground group-hover:text-primary transition-colors truncate">
                          {chamber.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1 font-mono">
                            <Globe className="h-3 w-3 opacity-60" />
                            <span>{displayDomain}</span>
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3 opacity-60" />
                            <span>{chamber.membersCount.toLocaleString()} members</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                  </button>
                );
              })
            )}
          </div>

          {/* Footer CTA & Super Admin link */}
          <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/60">
            <p>
              Represent a chamber that isn't listed yet?{' '}
              <button
                type="button"
                onClick={() => alert('Chamber onboarding inquiry registered.')}
                className="font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer ml-1"
              >
                Register interest with us →
              </button>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
