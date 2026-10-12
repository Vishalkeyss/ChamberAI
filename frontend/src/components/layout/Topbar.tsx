import React, { useState } from 'react';
import { useTheme } from '@/core/context/ThemeContext';
import {
  Sun,
  Moon,
  Monitor,
  Bell,
  Search,
  Menu,
  ChevronDown,
  ShieldAlert,
  Sparkles,
  MessageCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserMenu } from './UserMenu';
import { cn } from '@/lib/utils';

export interface TopbarProps {
  chamberName?: string;
  chamberLogoUrl?: string;
  pageTitle?: string;
  user?: {
    name: string;
    email: string;
    role: 'guest' | 'member' | 'chapter_admin' | 'group_admin' | 'billing_admin' | 'full_admin' | 'super_admin';
    scopeName?: string;
    avatarUrl?: string;
    businessName?: string;
  } | null;
  activeRole?: 'guest' | 'member' | 'admin' | 'super_admin';
  onSwitchRole?: (role: 'guest' | 'member' | 'admin' | 'super_admin') => void;
  onToggleSidebar?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenNotifications?: () => void;
  onLogout?: () => void;
  onEditProfile?: () => void;
  onAccountSettings?: () => void;
  onSearch?: (query: string, scope: string) => void;
  onBackToAI?: () => void;
  /** Prompt 05.2 §7.3: unread direct messages; the Messages button shows only when defined. */
  unreadMessages?: number | null;
  onOpenMessages?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  user,
  pageTitle,
  onToggleSidebar,
  onOpenCommandPalette,
  onOpenNotifications,
  onLogout,
  onEditProfile,
  onAccountSettings,
  onSearch,
  onBackToAI,
  unreadMessages,
  onOpenMessages,
}) => {
  const { theme, setTheme, language, setLanguage } = useTheme();
  const [searchScope, setSearchScope] = useState<'members' | 'businesses' | 'events' | 'store'>('members');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const scopeLabels = {
    members: 'Members',
    businesses: 'Businesses',
    events: 'Events',
    store: 'Store',
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery, searchScope);
    } else if (onOpenCommandPalette) {
      onOpenCommandPalette();
    }
  };

  const isScopedAdmin =
    user?.role === 'chapter_admin' ||
    user?.role === 'group_admin' ||
    user?.role === 'billing_admin';

  const formatScopedRoleLabel = () => {
    if (!user) return '';
    const scope = user.scopeName ? ` · ${user.scopeName}` : '';
    switch (user.role) {
      case 'chapter_admin':
        return `Chapter Admin${scope}`;
      case 'group_admin':
        return `Group Admin${scope}`;
      case 'billing_admin':
        return `Billing Admin${scope}`;
      default:
        return '';
    }
  };

  const userInitials = user?.name
    ? user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    : 'AM';

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-card text-card-foreground px-4 md:px-6 shrink-0 shadow-2xs transition-colors duration-200">
      {/* Left section: Mobile Toggle & Page Title or Search Widget */}
      <div className="flex items-center gap-3 min-w-0 flex-1 max-w-xl">
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="lg:hidden text-foreground hover:bg-muted"
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        {pageTitle ? (
          <h1 className="font-bold text-lg text-foreground truncate tracking-tight">
            {pageTitle}
          </h1>
        ) : (
          /* Global Search Bar with Scope Dropdown matching Image 1 */
          <form
            onSubmit={handleSearchSubmit}
            className={cn(
              'flex items-center w-full max-w-md rounded-xl border bg-muted/40 transition-all duration-150',
              isSearchFocused
                ? 'border-primary ring-2 ring-primary/10 bg-card'
                : 'border-border hover:border-muted-foreground/40'
            )}
          >
            {/* Scope Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 pl-3 pr-2 py-1.5 text-xs font-semibold text-foreground hover:text-primary border-r border-border shrink-0 outline-none"
                >
                  <span>{scopeLabels[searchScope]}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.2} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-36 text-xs bg-popover border border-border text-popover-foreground">
                <DropdownMenuItem onClick={() => setSearchScope('members')} className="cursor-pointer hover:bg-muted">
                  Members
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSearchScope('businesses')} className="cursor-pointer hover:bg-muted">
                  Businesses
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSearchScope('events')} className="cursor-pointer hover:bg-muted">
                  Events
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSearchScope('store')} className="cursor-pointer hover:bg-muted">
                  Chamber Store
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Search Input */}
            <div className="relative flex items-center flex-1 min-w-0">
              <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" strokeWidth={2.0} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                placeholder="Search members or businesses"
                className="w-full pl-9 pr-3 py-1.5 text-xs md:text-sm bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground font-normal"
              />
            </div>
          </form>
        )}
      </div>

      {/* Right Controls: Language Pill, Theme 3-Pill, Notification Bell, User Avatar */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Scoped Role Reminder Badge (if applicable) */}
        {isScopedAdmin && (
          <Badge
            variant="outline"
            className="hidden xl:inline-flex items-center gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium px-2.5 py-1 text-xs"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>{formatScopedRoleLabel()}</span>
          </Badge>
        )}

        {/* Back to AI Button */}
        {onBackToAI && (
          <button
            type="button"
            onClick={onBackToAI}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-border bg-muted/50 text-foreground hover:bg-muted transition shadow-2xs cursor-pointer"
            title="Return to AI experience"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Back to AI</span>
          </button>
        )}

        {/* Segmented Language Switcher Pill: EN | ES matching reference */}
        <div className="flex items-center gap-0.5 h-8 rounded-full p-1 border border-border bg-muted/50">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={cn(
              'px-3 py-1 rounded-full transition-all text-xs font-bold',
              language === 'en'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage('es')}
            className={cn(
              'px-3 py-1 rounded-full transition-all text-xs font-bold',
              language === 'es'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            ES
          </button>
        </div>

        {/* 3-Icon Theme Mode Toggle Pill: Sun | Moon | Monitor matching reference */}
        <div className="flex items-center gap-0.5 h-8 rounded-full p-1 border border-border bg-muted/50">
          <button
            type="button"
            onClick={() => setTheme('light')}
            title="Light Theme"
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center transition-all',
              theme === 'light'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Sun className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            title="Dark Theme"
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center transition-all',
              theme === 'dark'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Moon className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            onClick={() => setTheme('system')}
            title="System Theme"
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center transition-all',
              theme === 'system'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Monitor className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        {onOpenMessages && (
          <button
            type="button"
            onClick={onOpenMessages}
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition border border-border"
            aria-label={unreadMessages ? `Messages, ${unreadMessages} unread` : "Messages"}
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2.2} />
            {!!unreadMessages && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
                {unreadMessages > 99 ? "99+" : unreadMessages}
              </span>
            )}
          </button>
        )}

        {/* Notification Bell with solid red dot matching reference */}
        <button
          type="button"
          onClick={onOpenNotifications}
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition border border-border"
          aria-label="View notifications"
        >
          <Bell className="h-4 w-4" strokeWidth={2.2} />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-destructive shadow-xs" />
        </button>

        {/* User Profile Avatar with Navy Circle & Initials matching reference */}
        {user ? (
          <UserMenu
            user={user}
            onLogout={onLogout}
            onEditProfile={onEditProfile}
            onAccountSettings={onAccountSettings || (() => (window.location.href = '/portal/settings'))}
          />
        ) : (
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground font-bold text-xs shadow-xs border border-border">
            {userInitials}
          </div>
        )}
      </div>
    </header>
  );
};
