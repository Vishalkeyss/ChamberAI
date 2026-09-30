export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  badge?: string;
}

export const publicNavigation: NavigationItem[] = [
  { id: 'events', label: 'Events & Calendar', href: '/events' },
  { id: 'directory', label: 'Member Directory', href: '/directory' },
  { id: 'news', label: 'News & Releases', href: '/news' },
  { id: 'blog', label: 'Chamber Blog', href: '/blog' },
  { id: 'jobs', label: 'Job Board', href: '/jobs' },
  { id: 'store', label: 'Store & Merchandise', href: '/store' },
  { id: 'about', label: 'About Us', href: '/about' },
  { id: 'contact', label: 'Contact', href: '/contact' },
];
