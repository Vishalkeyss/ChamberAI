import React from 'react';
import { cn } from '@/lib/utils';
import LOGO_SRC from '@/assets/logo.png';
import {
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Shield,
  Award,
  Users,
  Video,
  QrCode,
  Handshake,
  Briefcase,
  CalendarDays,
  Store,
  FolderOpen,
  Image,
  ImageIcon,
  BarChart3,
  UserPlus,
  MessageCircle,
  GraduationCap,
  Megaphone,
  ClipboardList,
  ShoppingBag,
  Building,
  CreditCard,
  LifeBuoy,
  Settings,
  LogOut,
  CheckSquare,
  Building2,
  Calendar,
  FolderGit2,
  Sparkles,
  TrendingUp,
  Layers,
  HeartPulse,
  Compass,
  Vote,
  Receipt,
  FileSpreadsheet,
  Newspaper,
  PenTool,
  FileText,
  ShieldCheck,
  Landmark,
  BookOpen,
  Inbox,
  Lightbulb,
  Workflow,
  Palette,
  Bot,
  Users2,
  Headphones,
  ShieldAlert,
  Cog,
  Link2,
  Repeat,
  AlertTriangle,
  DollarSign,
  Wand2,
  FileEdit,
  Tag,
  UploadCloud,
  Key,
  Flag,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Custom BriefcasePlus icon matching prototype (app.html line 888)
const BriefcasePlus: LucideIcon = (({ size = 18, width, height, className, ...props }: any) => (
  <svg
    width={width ?? size}
    height={height ?? size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <rect x="2" y="7" width="20" height="13" rx="2" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    <path d="M12 11v6M9 14h6" />
  </svg>
)) as any;

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Shield,
  Award,
  Users,
  Video,
  QrCode,
  Handshake,
  Briefcase,
  CalendarDays,
  Store,
  FolderOpen,
  Image,
  BarChart3,
  UserPlus,
  MessageCircle,
  GraduationCap,
  Megaphone,
  ClipboardList,
  ShoppingBag,
  Building,
  CreditCard,
  LifeBuoy,
  Settings,
  LogOut,
  CheckSquare,
  Building2,
  Calendar,
  FolderGit2,
  Sparkles,
  TrendingUp,
  Layers,
  HeartPulse,
  Compass,
  Vote,
  Receipt,
  FileSpreadsheet,
  Newspaper,
  PenTool,
  FileText,
  ShieldCheck,
  Landmark,
  BookOpen,
  Inbox,
  Lightbulb,
  Workflow,
  Palette,
  Bot,
  Users2,
  Headphones,
  ShieldAlert,
  Cog,
  BriefcasePlus,
  Link2,
  Repeat,
  AlertTriangle,
  DollarSign,
  Wand2,
  FileEdit,
  Tag,
  ImageIcon,
  UploadCloud,
  Key,
  Flag,
  HelpCircle,
};

export interface SidebarSection {
  title?: string;
  items: {
    id: string;
    label: string;
    href: string;
    icon: string;
    badge?: string;
  }[];
}

export interface SidebarProps {
  sections: SidebarSection[];
  currentPath?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  chamberTier?: string;
  onItemClick?: (id: string, href: string) => void;
  onLogout?: () => void;
  themeVariant?: 'navy' | 'navyDark';
}

export const Sidebar: React.FC<SidebarProps> = ({
  sections,
  currentPath = window.location.pathname,
  isCollapsed = false,
  onToggleCollapse,
  onItemClick,
  onLogout,
  themeVariant = 'navy',
}) => {
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'relative flex flex-col h-full select-none transition-all duration-300 ease-in-out shrink-0 bg-sidebar text-sidebar-foreground',
          isCollapsed ? 'w-[72px]' : 'w-[240px]'
        )}
      >
        {/* Top Header / Branding Bar */}
        <div
          className={cn(
            'flex items-center px-3 h-16 border-b border-white/10 shrink-0 gap-2',
            isCollapsed ? 'justify-center' : 'justify-between'
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {/* 121 Meet Brand Logo Mark */}
            <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-white shadow-sm overflow-hidden p-0.5">
              <img
                src={LOGO_SRC}
                alt="121 Meet"
                className="w-full h-full object-contain"
              />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 leading-tight">
                <p className="text-white font-semibold text-sm truncate tracking-tight">121 Meet.AI</p>
                <p className="text-[10px] text-white/60 truncate">Chamber Management</p>
              </div>
            )}
          </div>

          {/* Collapse Toggle Button (Top Right Header) */}
          {!isCollapsed && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="hidden lg:flex items-center justify-center w-7 h-7 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>

        {/* Expand Button when collapsed */}
        {isCollapsed && onToggleCollapse && (
          <div className="flex justify-center pt-2">
            <button
              onClick={onToggleCollapse}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              className="flex items-center justify-center w-7 h-7 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition"
            >
              <PanelLeftOpen size={16} />
            </button>
          </div>
        )}

        {/* Navigation Item Scrollable Area */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-0.5">
              {/* Section Header */}
              {section.title && (
                <>
                  {!isCollapsed ? (
                    <p className="px-3 pt-3.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                      {section.title}
                    </p>
                  ) : (
                    <div className="h-2" />
                  )}
                </>
              )}

              {/* Items in Section */}
              {section.items.map((item) => {
                const Icon = iconMap[item.icon] || LayoutDashboard;
                const isActive =
                  currentPath === item.href ||
                  (item.href !== '/portal/overview' &&
                    item.href !== '/admin/dashboard' &&
                    currentPath.startsWith(`${item.href}`));

                const handleClick = (e: React.MouseEvent) => {
                  if (onItemClick) {
                    e.preventDefault();
                    onItemClick(item.id, item.href);
                  }
                };

                const linkContent = (
                  <a
                    href={item.href}
                    onClick={handleClick}
                    className={cn(
                      'group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition min-w-0',
                      isActive
                        ? 'bg-white/[0.12] text-white border-l-[3px] border-[#38BDF8] font-semibold'
                        : 'text-white/70 hover:bg-white/[0.08] hover:text-white border-l-[3px] border-transparent',
                      isCollapsed && 'justify-center px-0'
                    )}
                  >
                    <Icon
                      size={18}
                      className={cn(
                        'shrink-0 transition-transform group-hover:scale-105',
                        isActive ? 'text-white' : 'text-white/70 group-hover:text-white'
                      )}
                    />
                    {!isCollapsed && (
                      <span className="truncate flex-1 text-left">{item.label}</span>
                    )}
                    {!isCollapsed && item.badge && (
                      <span className="ml-auto rounded-full bg-[#38BDF8]/20 px-2 py-0.5 text-[10px] font-semibold text-[#38BDF8]">
                        {item.badge}
                      </span>
                    )}
                  </a>
                );

                if (isCollapsed) {
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right" className="bg-sidebar text-sidebar-foreground border-border font-medium text-xs">
                        {item.label}
                        {item.badge ? ` (${item.badge})` : ''}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return <div key={item.id}>{linkContent}</div>;
              })}
            </div>
          ))}
        </div>

        {/* Footer Area: Dedicated Log out Action */}
        <div className="border-t border-white/10 p-2.5 shrink-0">
          <button
            onClick={onLogout}
            title={isCollapsed ? 'Log out' : undefined}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition bg-white/[0.04] text-[#FCA5A5] border border-white/10 hover:bg-[#EF444422] hover:text-[#FEE2E2]',
              isCollapsed && 'justify-center px-0'
            )}
          >
            <LogOut size={16} className="shrink-0" />
            {!isCollapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
};
