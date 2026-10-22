/** Single source for site structure: header, footer, sitemap and admin sections. */
export const DISCORD_INVITE = 'https://discord.gg/xkKGf9bKz';
export const SUPPORT_EMAIL = 'hello@duoly.gg';

export const MAIN_NAV = [
  { href: '/#games', label: 'Games' },
  { href: '/#how', label: 'How it works' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/blog', label: 'Blog' },
] as const;

export const FOOTER_COLUMNS = [
  {
    title: 'Duoly',
    links: [
      { href: '/games', label: 'Games' },
      { href: '/#how', label: 'How it works' },
      { href: '/#faq', label: 'FAQ' },
      { href: '/blog', label: 'Blog' },
    ],
  },
  {
    title: 'Join',
    links: [
      { href: '/apply', label: 'Become a teammate' },
      { href: '/creators', label: 'Creator program' },
    ],
  },
  {
    title: 'Help',
    links: [
      { href: '/contact', label: 'Contact' },
      { href: '/rules', label: 'Rules' },
      { href: DISCORD_INVITE, label: 'Discord' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Terms' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/imprint', label: 'Imprint' },
    ],
  },
] as const;

export type Role = 'customer' | 'teammate' | 'admin';
export const ROLE_HOME: Record<Role, { href: string; label: string }> = {
  customer: { href: '/dashboard', label: 'My orders' },
  teammate: { href: '/teammate', label: 'Teammate desk' },
  admin: { href: '/admin', label: 'Admin' },
};

/** Admin sections, each at its own URL so links can be shared. */
export const ADMIN_SECTIONS = [
  {
    slug: '',
    label: 'Overview',
    note: 'Today at a glance: orders, revenue, teammates online.',
  },
  {
    slug: 'live',
    label: 'Live desk',
    note: 'Orders waiting and in progress, with handover links.',
  },
  {
    slug: 'orders',
    label: 'Orders',
    note: 'Search, cancel and refund orders.',
  },
  {
    slug: 'teammates',
    label: 'Teammates',
    note: 'Game access, trust levels and status.',
  },
  {
    slug: 'customers',
    label: 'Customers',
    note: 'Accounts, balances and blocks.',
  },
  {
    slug: 'users',
    label: 'Users',
    note: 'Roles and sign-in methods for every account.',
  },
  {
    slug: 'applications',
    label: 'Applications',
    note: 'Review teammate applications.',
  },
  { slug: 'priority', label: 'Priority', note: 'Who sees new orders first.' },
  { slug: 'payouts', label: 'Payouts', note: 'Weekly teammate payouts.' },
  { slug: 'safety', label: 'Safety', note: 'Reports and flagged chats.' },
  { slug: 'support', label: 'Support', note: 'Contact form conversations.' },
  {
    slug: 'audit',
    label: 'Audit log',
    note: 'Every admin action, who and when.',
  },
  {
    slug: 'settings',
    label: 'Settings',
    note: 'Prices, games and site switches.',
  },
] as const;

/** Public, indexable routes once the site launches (sitemap.xml). */
export const PUBLIC_ROUTES = [
  '/',
  '/games',
  '/blog',
  '/apply',
  '/creators',
  '/rules',
  '/contact',
  '/terms',
  '/privacy',
  '/imprint',
] as const;
