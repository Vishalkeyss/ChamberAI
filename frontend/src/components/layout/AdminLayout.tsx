import React, { useState } from 'react';
import { Topbar, type TopbarProps } from './Topbar';
import { Sidebar } from './Sidebar';
import { adminNavigation, type AdminNavSection } from '@/core/navigation/admin-navigation';

export interface AdminLayoutProps {
  children?: React.ReactNode;
  chamberName?: string;
  chamberLogoUrl?: string;
  user?: TopbarProps['user'];
  currentPath?: string;
  onLogout?: () => void;
  onAccountSettings?: () => void;
  /** Defaults to Account Settings (its Profile tab holds the admin profile form). */
  onEditProfile?: () => void;
  onNavigate?: (path: string) => void;
}

function filterAdminNav(
  sections: AdminNavSection[],
  role: 'full_admin' | 'chapter_admin' | 'group_admin' | 'billing_admin'
): AdminNavSection[] {
  return sections
    .map((sec) => ({
      title: sec.title,
      items: sec.items.filter((item) => item.allowedRoles.includes(role)),
    }))
    .filter((sec) => sec.items.length > 0);
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  chamberName,
  chamberLogoUrl,
  user = {
    name: 'Alexander Morgan',
    email: 'alexander.morgan@chamber.org',
    role: 'full_admin',
  },
  currentPath = '/admin/dashboard',
  onLogout,
  onAccountSettings,
  onEditProfile,
  onNavigate,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const adminRole =
    user?.role === 'chapter_admin' ||
    user?.role === 'group_admin' ||
    user?.role === 'billing_admin'
      ? user.role
      : 'full_admin';

  const visibleSections = filterAdminNav(adminNavigation, adminRole);

  const handleItemClick = (_id: string, href: string) => {
    setIsMobileMenuOpen(false);
    if (onNavigate) {
      onNavigate(href);
    }
  };

  return (
    <div className="h-screen w-full flex overflow-hidden bg-background text-foreground">
      {/* Desktop Fixed Full-Length Admin Sidebar */}
      <div className="hidden lg:flex h-screen shrink-0">
        <Sidebar
          sections={visibleSections}
          currentPath={currentPath}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onLogout={onLogout}
          onItemClick={handleItemClick}
          chamberTier="Administrative Portal"
        />
      </div>

      {/* Mobile Slide-over Sidebar Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-black/60 backdrop-blur-xs">
          <div className="relative flex w-[240px] h-full flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <Sidebar
              sections={visibleSections}
              currentPath={currentPath}
              isCollapsed={false}
              onLogout={onLogout}
              onItemClick={handleItemClick}
              onToggleCollapse={() => setIsMobileMenuOpen(false)}
              chamberTier="Administrative Portal"
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
        <Topbar
          chamberName={chamberName}
          chamberLogoUrl={chamberLogoUrl}
          pageTitle={
            visibleSections
              .flatMap((sec) => sec.items)
              .find(
                (item) =>
                  item.href === currentPath ||
                  (item.href !== '/admin/dashboard' && currentPath.startsWith(item.href))
              )?.label || 'Plans & Renewals'
          }
          user={user}
          onToggleSidebar={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onLogout={onLogout}
          onAccountSettings={onAccountSettings}
          onEditProfile={onEditProfile ?? onAccountSettings}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#F6F7F9] dark:bg-[#0E182B] scrollbar-thin transition-colors duration-200">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
};
