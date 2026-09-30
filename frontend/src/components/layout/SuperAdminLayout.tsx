import React, { useState } from 'react';
import { Topbar, type TopbarProps } from './Topbar';
import { Sidebar } from './Sidebar';
import { superAdminNavSections } from '@/core/navigation/super-admin-navigation';
import { Badge } from '@/components/ui/badge';
import { Server } from 'lucide-react';

export interface SuperAdminLayoutProps {
  children?: React.ReactNode;
  user?: TopbarProps['user'];
  currentPath?: string;
  pageTitle?: string;
  onNavigate?: (href: string) => void;
  onLogout?: () => void;
  onAccountSettings?: () => void;
}

export const SuperAdminLayout: React.FC<SuperAdminLayoutProps> = ({
  children,
  user,
  currentPath = '/super/chambers',
  pageTitle,
  onNavigate,
  onLogout,
  onAccountSettings,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const activeSuperUser = user || {
    name: 'Root Administrator',
    email: 'superadmin@121meet.ai',
    role: 'super_admin' as const,
  };

  const sections = superAdminNavSections.map((sec) => ({
    title: sec.title,
    items: sec.items.map((item) => ({
      id: item.id,
      label: item.label,
      href: item.href,
      icon: item.icon,
      badge: item.badge,
    })),
  }));

  return (
    <div className="h-screen w-full flex overflow-hidden bg-background text-foreground">
      {/* Desktop Fixed Full-Length Super Admin Sidebar (Left column from top to bottom) */}
      <div className="hidden lg:flex h-screen shrink-0">
        <Sidebar
          sections={sections}
          currentPath={currentPath}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onItemClick={(_id, href) => onNavigate?.(href)}
          onLogout={onLogout}
          themeVariant="navyDark"
          chamberTier="Control Plane v2.4"
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
              themeVariant="navyDark"
              onToggleCollapse={() => setIsMobileMenuOpen(false)}
              chamberTier="Control Plane v2.4"
            />
          </div>
          <div
            className="flex-1 cursor-pointer"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Right Column: Top Banner + Topbar + Scrollable Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">


        {/* Topbar */}
        <Topbar
          pageTitle={pageTitle || (currentPath === '/super/chambers' ? 'Chambers' : 'Platform Overview')}
          chamberName="121Meet Platform Engine"
          user={activeSuperUser}
          onToggleSidebar={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onLogout={onLogout}
          onAccountSettings={onAccountSettings}
        />

        {/* Main Super Admin Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-muted/40 scrollbar-thin transition-colors duration-200">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
};
