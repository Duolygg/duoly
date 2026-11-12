import type { APIRoute } from 'astro';
import { accountContext } from '../../../server/auth/context';
import { readBoundedBody, verifyCsrf } from '../../../server/auth/security';
import { publicProfilesEnabled } from '../../../server/teammates/public-profiles';
import { decodeHeader, storeHeader, removeHeader } from '../../../server/teammates/profile-header';

export const ALL: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  const method = context.request.method;
  try {
    if (!publicProfilesEnabled()) return account.json({error: 'Not found.'},404);
    if (method !== 'POST' && method !== 'DELETE') {
      const response = account.json({error: 'Method not allowed.'},405);
      response.headers.set('Allow','POST, DELETE');
      return response;
    }
    let body: Record<string,unknown>;
    try { body = await readBoundedBody(context.request, 410_000); }
    catch { return account.json({error: 'Invalid or oversized request.'},400); }
    // verifyCsrf intentionally only accepts POST. Adapt the already-allowlisted DELETE method
    // locally; preserve the exact request URL and Origin and the same cookie/token comparison.
    const check = new Request(context.request.url, {method: 'POST', headers: context.request.headers});
    if (!verifyCsrf(check, account.config?.origin ?? context.url.origin, context.cookies.get(account.names.csrf)?.value, body.csrf)) return account.json({error: 'Request could not be verified. Reload and try again.'},403);
    const identity = await account.identity();
    if (!identity) return account.json({error: 'Authentication required.'},401);
    if (identity.viewer.role !== 'teammate') return account.json({error: 'Teammate role required.'},403);
    const allowed = method === 'POST' ? ['csrf','image'] : ['csrf'];
    if (context.url.search || Object.keys(body).some(key => !allowed.includes(key))) return account.json({error: 'Invalid header request.'},400);
    if (method === 'DELETE') {
      if (!await removeHeader(identity.viewer.id)) return account.json({error: 'Header could not be removed.'},503);
      return account.json({ok: true});
    }
    const decoded = decodeHeader(body.image);
    if (!decoded) return account.json({error: 'Choose a WebP image up to 300 KB.'},400);
    const url = await storeHeader(identity.viewer.id, decoded);
    return url ? account.json({url}) : account.json({error: 'Header could not be saved.'},503);
  } catch {
    return account.json({error: 'Header images are unavailable right now.'},503);
  }
};
