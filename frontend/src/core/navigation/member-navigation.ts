/**
 * Canonical Member Navigation Manifest
 * Strictly aligns with NAV.member from Chamber AI reference prototype (app.html)
 */

export interface MemberNavigationSection {
  title?: string;
  items: {
    id: string;
    label: string;
    href: string;
    icon: string;
    badge?: string;
  }[];
}

export const memberNavigation: MemberNavigationSection[] = [
  {
    items: [
      { id: 'overview', label: 'Overview', href: '/portal/overview', icon: 'LayoutDashboard' },
      { id: 'membership', label: 'My Membership', href: '/portal/membership', icon: 'Shield' },
      { id: 'points', label: 'Points & Rewards', href: '/portal/points', icon: 'Award' },
    ],
  },
  {
    title: 'Directory & Events',
    items: [
      { id: 'directory', label: 'Directory', href: '/portal/directory', icon: 'Users' },
      { id: 'meetings', label: '1:1 Meetings', href: '/portal/meetings', icon: 'Video' },
      { id: 'card', label: 'Business Card Exchange', href: '/portal/card', icon: 'QrCode' },
      { id: 'referrals', label: 'Referrals', href: '/portal/referrals', icon: 'Handshake' },
      { id: 'business-leads', label: 'Business Leads', href: '/portal/business-leads', icon: 'Briefcase' },
      { id: 'events', label: 'Events', href: '/portal/events', icon: 'CalendarDays' },
      { id: 'store', label: 'Chamber Store', href: '/portal/store', icon: 'Store' },
    ],
  },
  {
    title: 'Resources',
    items: [
      { id: 'resources', label: 'Resources', href: '/portal/resources', icon: 'FolderOpen' },
      { id: 'gallery', label: 'Gallery', href: '/portal/gallery', icon: 'Image' },
      { id: 'polls', label: 'Polls', href: '/portal/polls', icon: 'BarChart3' },
    ],
  },
  {
    title: 'Community',
    items: [
      { id: 'groups', label: 'Community Groups', href: '/portal/groups', icon: 'UserPlus' },
      { id: 'messages', label: 'Messages', href: '/portal/messages', icon: 'MessageCircle' },
      { id: 'mentorship', label: 'Mentorship', href: '/portal/mentorship', icon: 'Award' },
      { id: 'governance', label: 'Governance', href: '/portal/governance', icon: 'Shield' },
    ],
  },
  {
    title: 'Growth',
    items: [
      { id: 'courses', label: 'Learn', href: '/portal/courses', icon: 'GraduationCap' },
      { id: 'ceu', label: 'My CEU Ledger', href: '/portal/ceu', icon: 'Award' },
    ],
  },
  {
    title: 'Communication',
    items: [
      { id: 'news', label: 'News & Updates', href: '/portal/news', icon: 'Megaphone' },
    ],
  },
  {
    title: 'Business Tools',
    items: [
      { id: 'crm', label: 'CRM', href: '/portal/crm', icon: 'Briefcase' },
      { id: 'tasks', label: 'Tasks', href: '/portal/tasks', icon: 'ClipboardList' },
      { id: 'marketplace', label: 'Marketplace', href: '/portal/marketplace', icon: 'ShoppingBag' },
      { id: 'jobs', label: 'Job Board', href: '/portal/jobs', icon: 'Building' },
    ],
  },
  {
    title: 'Billing',
    items: [
      { id: 'payments', label: 'Billing', href: '/portal/billing', icon: 'CreditCard' },
    ],
  },
  {
    title: 'Support',
    items: [
      { id: 'support', label: 'Support & Feedback', href: '/portal/support', icon: 'LifeBuoy' },
      { id: 'settings', label: 'Settings', href: '/portal/settings', icon: 'Settings' },
    ],
  },
];
