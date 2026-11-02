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
      { href: DISCORD_INVITE, label: 'Discord' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Terms' },
      { href: '/privacy', label: 'Privacy' },
      { href: '#cookie-settings', label: 'Cookie settings' },
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

/** Public, indexable routes once the site launches (sitemap.xml). */
export const PUBLIC_ROUTES = [
  '/',
  '/games',
  '/blog',
  '/apply',
  '/creators',
  // '/rules' stays out on purpose: the teammate rules are for teammates, not visitors.
  '/contact',
  '/terms',
  '/privacy',
  // '/imprint' stays out on purpose: it carries the operator's home address.
] as const;
