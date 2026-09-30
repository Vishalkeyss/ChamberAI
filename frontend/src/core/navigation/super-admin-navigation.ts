export interface SuperAdminNavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: string;
}

export interface SuperAdminNavSection {
  title?: string;
  items: SuperAdminNavItem[];
}

export const superAdminNavSections: SuperAdminNavSection[] = [
  {
    items: [
      { id: 'super-overview', label: 'Platform Overview', href: '/super/overview', icon: 'Compass' },
      { id: 'super-chambers', label: 'Chambers', href: '/super/chambers', icon: 'Building2' },
      { id: 'super-users', label: 'Users (All Tenants)', href: '/super/users', icon: 'Users' },
    ],
  },
  {
    title: 'REVENUE & SUPPORT',
    items: [
      { id: 'super-billing', label: 'Tenant Billing', href: '/super/billing', icon: 'CreditCard' },
      { id: 'super-export', label: 'Financial Export', href: '/super/export', icon: 'DollarSign' },
      { id: 'super-retention', label: 'Chamber Retention', href: '/super/retention', icon: 'AlertTriangle' },
      { id: 'super-support', label: 'Support Tickets', href: '/super/support', icon: 'LifeBuoy' },
      { id: 'super-requests', label: 'Chamber Admin Requests', href: '/super/requests', icon: 'MessageCircle' },
    ],
  },
  {
    title: 'PLATFORM CONTROLS',
    items: [
      { id: 'super-roles', label: 'Roles & RBAC', href: '/super/roles', icon: 'Key' },
      { id: 'super-integrations', label: 'Integrations Hub', href: '/super/integrations', icon: 'TrendingUp' },
    ],
  },
];

export const superAdminNavigation: SuperAdminNavItem[] = superAdminNavSections.flatMap((s) => s.items);
