/** Single source for site structure: header, footer, sitemap and admin sections. */
export const DISCORD_INVITE = 'https://discord.gg/KuVyByUyV4';
/** The order chat's one-time system message (supabase/migrations/20261105180000_chat_discord_invite.sql). */
export const DISCORD_INVITE_MESSAGE =
  'Join our Discord for voice comms with your teammate: ' + DISCORD_INVITE;
/** A system message carrying our invite shows as a Discord card. Never for user messages. */
export const isDiscordInvite = (text: string): boolean =>
  text.includes(DISCORD_INVITE);
export const SUPPORT_EMAIL = 'hello@duoly.gg';
/**
 * Where press enquiries go. Every address at duoly.gg reaches the same team
 * through catch-all forwarding (confirmed by the owner), so this is a label on
 * one inbox rather than a second one: a journalist writes to the address a
 * press kit publishes, and support keeps `SUPPORT_EMAIL` for customers.
 */
export const PRESS_EMAIL = 'press@duoly.gg';

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
