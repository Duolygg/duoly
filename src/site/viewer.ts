import type { AstroGlobal } from 'astro';
import type { Viewer } from '../contracts/account';
import { accountContext } from '../server/auth/context';

/**
 * Resolves the signed-in viewer for public pages so the shared header shows the
 * right account menu. Call it in page frontmatter (cookies must be set before
 * streaming starts). Never throws: a failure renders the signed-out header.
 */
export async function pageViewer(Astro: AstroGlobal): Promise<{
  viewer: Viewer | undefined;
  csrf: string;
  currency?: string | null;
}> {
  const account = accountContext(Astro.request, Astro.cookies);
  if (!account.config) return { viewer: undefined, csrf: '' };
  try {
    const identity = await account.identity();
    const viewer = identity?.viewer;
    for (const [name, value] of account.headers)
      Astro.response.headers.set(name, value);
    // signed out too: the header's sign-in dialog posts its forms with it
    return {
      viewer,
      csrf: account.csrf(),
      currency: identity?.profile.currency,
    };
  } catch {
    return { viewer: undefined, csrf: '' };
  }
}
