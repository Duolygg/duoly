/** Pure helpers for the Discord identity-link flow (no I/O, unit tested). */
export const DISCORD_RETURN = ['profile', 'teammate'] as const;
export type DiscordReturn = (typeof DISCORD_RETURN)[number];
export const discordReturn = (value: unknown): DiscordReturn =>
  value === 'teammate' ? 'teammate' : 'profile';

/** Where Supabase/Discord may send the browser for an identity link. */
export function isDiscordAuthorizeUrl(href: string, supabaseUrl: string) {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.origin === supabaseUrl && url.pathname === '/auth/v1/authorize')
    return true;
  return (
    url.origin === 'https://discord.com' &&
    (url.pathname === '/oauth2/authorize' ||
      url.pathname === '/api/oauth2/authorize')
  );
}

/** Map a Supabase error redirect from a link attempt to the profile notice. */
export function linkErrorResult(params: URLSearchParams) {
  const code =
    `${params.get('error_code') ?? ''} ${params.get('error') ?? ''} ${params.get('error_description') ?? ''}`.toLowerCase();
  if (
    code.includes('identity_already_exists') ||
    code.includes('already linked')
  )
    return 'taken' as const;
  if (code.includes('access_denied')) return 'cancelled' as const;
  return 'failed' as const;
}
