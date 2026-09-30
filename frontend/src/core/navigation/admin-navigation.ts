export interface AdminNavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: string;
  allowedRoles: ('full_admin' | 'chapter_admin' | 'group_admin' | 'billing_admin')[];
}

export interface AdminNavSection {
  title?: string;
  items: AdminNavItem[];
}

/**
 * Authoritative Admin Navigation Hierarchy
 * Directly synchronized with canonical reference UI (Chamber AI/public/app.html lines 9656-9715)
 */
export const adminNavigation: AdminNavSection[] = [
  {
    // Top-level core items without a section header
    items: [
      {
        id: 'overview',
        label: 'Dashboard',
        href: '/admin/dashboard',
        icon: 'BarChart3',
        allowedRoles: ['full_admin', 'chapter_admin', 'group_admin', 'billing_admin'],
      },
      {
        id: 'onboarding',
        label: 'Admin Onboarding',
        href: '/admin/onboarding',
        icon: 'ClipboardList',
        allowedRoles: ['full_admin'],
      },
    ],
  },
  {
    title: 'Membership',
    items: [
      {
        id: 'applications',
        label: 'Applications',
        href: '/admin/applications',
        icon: 'FileText',
        allowedRoles: ['full_admin', 'chapter_admin'],
      },
      {
        id: 'admin-business-leads',
        label: 'Business Leads',
        href: '/admin/business-leads',
        icon: 'BriefcasePlus',
        allowedRoles: ['full_admin'],
      },
      {
        id: 'news-releases',
        label: 'News Releases',
        href: '/admin/news-releases',
        icon: 'Newspaper',
        allowedRoles: ['full_admin'],
      },
      {
        id: 'members',
        label: 'Members',
        href: '/admin/members',
        icon: 'Users',
        allowedRoles: ['full_admin', 'chapter_admin', 'billing_admin'],
      },
      {
        id: 'related-orgs',
        label: 'Related Organizations',
        href: '/admin/related-orgs',
        icon: 'Link2',
        allowedRoles: ['full_admin'],
      },
      {
        id: 'plans',
        label: 'Plans & Renewals',
        href: '/admin/plans',
        icon: 'Repeat',
        allowedRoles: ['full_admin', 'billing_admin', 'chapter_admin'],
      },
      {
        id: 'retention',
        label: 'Member Retention',
        href: '/admin/retention',
        icon: 'AlertTriangle',
        allowedRoles: ['full_admin'],
      },
    ],
  },
  {
    title: 'Chapters',
    items: [
      {
        id: 'chapters',
        label: 'Chapters',
        href: '/admin/chapters',
        icon: 'Layers',
        allowedRoles: ['full_admin', 'chapter_admin'],
      },
    ],
  },
  {
    title: 'Governance',
    items: [
      {
        id: 'governance',
        label: 'Governance',
        href: '/admin/governance',
        icon: 'Shield',
        allowedRoles: ['full_admin'],
      },
    ],
  },
  {
    title: 'Community Groups',
    items: [
      {
        id: 'groups',
        label: 'Groups',
        href: '/admin/groups',
        icon: 'UserPlus',
        allowedRoles: ['full_admin', 'group_admin'],
      },
    ],
  },
  {
    title: 'Events & Finance',
    items: [
      {
        id: 'events',
        label: 'Events',
        href: '/admin/events',
        icon: 'CalendarDays',
        allowedRoles: ['full_admin', 'chapter_admin'],
      },
      {
        id: 'payments',
        label: 'Payments & Billing',
        href: '/admin/payments',
        icon: 'CreditCard',
        allowedRoles: ['full_admin', 'billing_admin'],
      },
      {
        id: 'sponsorship',
        label: 'Sponsorship & Revenue',
        href: '/admin/sponsorship',
        icon: 'Award',
        allowedRoles: ['full_admin', 'billing_admin'],
      },
      {
        id: 'financial-export',
        label: 'Financial Export',
        href: '/admin/financial-export',
        icon: 'DollarSign',
        allowedRoles: ['full_admin', 'billing_admin'],
      },
    ],
  },
  {
    title: 'Communication',
    items: [
      {
        id: 'announcements',
        label: 'Announcements',
        href: '/admin/announcements',
        icon: 'Megaphone',
        allowedRoles: ['full_admin', 'chapter_admin'],
      },
      {
        id: 'contact-requests',
        label: 'Contact Requests',
        href: '/admin/contact-requests',
        icon: 'Inbox',
        allowedRoles: ['full_admin'],
      },
      {
        id: 'automation',
        label: 'Engagement (Newsletter & Alerts)',
        href: '/admin/automation',
        icon: 'Repeat',
        allowedRoles: ['full_admin'],
      },
    ],
  },
  {
    title: 'Public Site',
    items: [
      {
        id: 'site-designer',
        label: 'AI Site Designer',
        href: '/admin/site-designer',
        icon: 'Wand2',
        allowedRoles: ['full_admin'],
      },
      {
        id: 'website-analytics',
        label: 'Website Analytics',
        href: '/admin/website-analytics',
        icon: 'BarChart3',
        allowedRoles: ['full_admin'],
      },
      {
        id: 'blog',
        label: 'Blog',
        href: '/admin/blog',
        icon: 'Newspaper',
        allowedRoles: ['full_admin'],
      },
      {
        id: 'landing-pages',
        label: 'Landing Pages',
        href: '/admin/landing-pages',
        icon: 'LayoutDashboard',
        allowedRoles: ['full_admin'],
      },
    ],
  },
  {
    title: 'Engagement',
    items: [
      {
        id: 'form-builder',
        label: 'Form Builder',
        href: '/admin/form-builder',
        icon: 'FileEdit',
        allowedRoles: ['full_admin'],
      },
    ],
  },
  {
    title: 'Job Board',
    items: [
      {
        id: 'jobs',
        label: 'Jobs (Chamber)',
        href: '/admin/jobs',
        icon: 'Building',
        allowedRoles: ['full_admin'],
      },
      {
        id: 'job-analytics',
        label: 'Job Board Analytics',
        href: '/admin/job-analytics',
        icon: 'BarChart3',
        allowedRoles: ['full_admin'],
      },
    ],
  },
  {
    title: 'Marketplace',
    items: [
      {
        id: 'hot-deals',
        label: 'Hot Deals',
        href: '/admin/hot-deals',
        icon: 'Tag',
        allowedRoles: ['full_admin'],
      },
      {
        id: 'store',
        label: 'eCommerce Store',
        href: '/admin/store',
        icon: 'Store',
        allowedRoles: ['full_admin', 'billing_admin'],
      },
    ],
  },
  {
    title: 'Resources',
    items: [
      {
        id: 'resources',
        label: 'Resources Library',
        href: '/admin/resources',
        icon: 'FolderOpen',
        allowedRoles: ['full_admin'],
      },
      {
        id: 'gallery',
        label: 'Photo Gallery',
        href: '/admin/gallery',
        icon: 'ImageIcon',
        allowedRoles: ['full_admin'],
      },
      {
        id: 'polls',
        label: 'Polls',
        href: '/admin/polls',
        icon: 'BarChart3',
        allowedRoles: ['full_admin'],
      },
    ],
  },
  {
    title: 'Learning & CEU',
    items: [
      {
        id: 'course-management',
        label: 'Course Management',
        href: '/admin/course-management',
        icon: 'GraduationCap',
        allowedRoles: ['full_admin'],
      },
      {
        id: 'ceu-settings',
        label: 'CEU Requirements',
        href: '/admin/ceu-settings',
        icon: 'Settings',
        allowedRoles: ['full_admin'],
      },
      {
        id: 'ceu-report',
        label: 'Members CEU Report',
        href: '/admin/ceu-report',
        icon: 'Award',
        allowedRoles: ['full_admin'],
      },
    ],
  },
  {
    title: 'Data',
    items: [
      {
        id: 'migration',
        label: 'Migration / Import Data',
        href: '/admin/migration',
        icon: 'UploadCloud',
        allowedRoles: ['full_admin'],
      },
    ],
  },
  {
    title: 'AI & Reports',
    items: [
      {
        id: 'ai-reports',
        label: 'AI Reports',
        href: '/admin/ai-reports',
        icon: 'FileText',
        allowedRoles: ['full_admin'],
      },
      {
        id: 'ai-agents',
        label: 'AI Agents',
        href: '/admin/ai-agents',
        icon: 'Sparkles',
        allowedRoles: ['full_admin'],
      },
      {
        id: 'member-ai-usage',
        label: 'Member AI Usage',
        href: '/admin/member-ai-usage',
        icon: 'Key',
        allowedRoles: ['full_admin'],
      },
      {
        id: 'moderation',
        label: 'Reported Content',
        href: '/admin/moderation',
        icon: 'Flag',
        allowedRoles: ['full_admin'],
      },
    ],
  },
  {
    title: 'Support',
    items: [
      {
        id: 'support',
        label: 'Support Tickets',
        href: '/admin/support',
        icon: 'LifeBuoy',
        allowedRoles: ['full_admin', 'billing_admin'],
      },
      {
        id: 'contact',
        label: 'Help & Support',
        href: '/admin/contact',
        icon: 'HelpCircle',
        allowedRoles: ['full_admin'],
      },
      {
        id: 'settings',
        label: 'Settings',
        href: '/admin/settings',
        icon: 'Settings',
        allowedRoles: ['full_admin', 'chapter_admin', 'group_admin', 'billing_admin'],
      },
    ],
  },
];

export function filterAdminNav(
  sections: AdminNavSection[],
  role: 'full_admin' | 'chapter_admin' | 'group_admin' | 'billing_admin'
): AdminNavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.allowedRoles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);
}
