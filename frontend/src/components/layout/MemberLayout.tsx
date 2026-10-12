import React, { useMemo, useState } from 'react';
import { Topbar, type TopbarProps } from './Topbar';
import { Sidebar } from './Sidebar';
import { memberNavigation } from '@/core/navigation/member-navigation';
import { useUnreadMessages } from '@/features/networking/hooks/useUnreadMessages';

export interface MemberLayoutProps {
  children?: React.ReactNode;
  chamberName?: string;
  chamberLogoUrl?: string;
  user?: TopbarProps['user'];
  currentPath?: string;
  onLogout?: () => void;
  onEditProfile?: () => void;
  onAccountSettings?: () => void;
  onBackToAI?: () => void;
  onNavigate?: (path: string) => void;
}

export const MemberLayout: React.FC<MemberLayoutProps> = ({
  children,
  chamberName,
  chamberLogoUrl,
  user = {
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@acmehealth.com',
    role: 'member',
  },
  currentPath = '/portal/overview',
  onLogout,
  onEditProfile,
  onAccountSettings,
  onBackToAI,
  onNavigate,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const unreadMessages = useUnreadMessages(!!user);
  // Sidebar badge on the Messages item (Prompt 05.2 §7.3).
  const sections = useMemo(
    () =>
      memberNavigation.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.id === 'messages' && unreadMessages ? { ...item, badge: String(unreadMessages) } : item
        ),
      })),
    [unreadMessages]
  );

  const handleItemClick = (_id: string, href: string) => {
    setIsMobileMenuOpen(false);
    if (onNavigate) {
      onNavigate(href);
    }
  };

  return (
    <div className="h-screen w-full flex overflow-hidden bg-[#F5F6F8] dark:bg-[#0E182B] text-foreground transition-colors duration-200">
      {/* Desktop Fixed Full-Length Member Sidebar (Left column from top to bottom) */}
      <div className="hidden lg:flex h-screen shrink-0">
        <Sidebar
          sections={sections}
          currentPath={currentPath}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onLogout={onLogout}
          onItemClick={handleItemClick}
          chamberTier="Tier 3 Executive Member"
        />
      </div>

      {/* Mobile Slide-over Sidebar Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-black/60 backdrop-blur-xs">
          <div className="relative flex w-[240px] h-full flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <Sidebar
              sections={sections}
              currentPath={currentPath}
              isCollapsed={false}
              onLogout={onLogout}
              onItemClick={handleItemClick}
              onToggleCollapse={() => setIsMobileMenuOpen(false)}
              chamberTier="Tier 3 Executive Member"
            />
          </div>
          <div
            className="flex-1 cursor-pointer"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Right Column: Topbar on top, scrollable viewport underneath */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Universal Topbar */}
        <Topbar
          chamberName={chamberName}
          chamberLogoUrl={chamberLogoUrl}
          user={user}
          onToggleSidebar={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onLogout={onLogout}
          onEditProfile={onEditProfile}
          onAccountSettings={onAccountSettings}
          onBackToAI={onBackToAI}
          unreadMessages={unreadMessages}
          onOpenMessages={onNavigate ? () => onNavigate('/portal/messages') : undefined}
        />

        {/* Scrollable Main Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#F6F7F9] dark:bg-[#0E182B] scrollbar-thin transition-colors duration-200">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
};
