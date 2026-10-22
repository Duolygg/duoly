import type { AstroCookies } from 'astro';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import {
  ProfileSchema,
  RoleSchema,
  ViewerSchema,
  type Profile,
  type Viewer,
} from '../../contracts/account';
import type { Database } from './database.types';
import { authConfig } from './config';
import { createCsrf } from './security';

export function accountContext(request: Request, cookies: AstroCookies) {
  const config = authConfig();
  const secure = config
    ? config.origin.startsWith('https:')
    : new URL(request.url).protocol === 'https:';
  const prefix = secure ? '__Host-duoly-' : 'duoly-';
  const names = {
    csrf: prefix + 'csrf',
    pending: prefix + 'pending-email',
    session: prefix + 'session',
    cooldown: prefix + 'email-cooldown',
  };
  const headers = new Headers({
    'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
    'Referrer-Policy': 'no-referrer',
  });
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
  };
  const values = new Map(
    parseCookieHeader(request.headers.get('cookie') ?? '')
      .filter(
        (entry): entry is { name: string; value: string } =>
          typeof entry.value === 'string',
      )
      .map((entry) => [entry.name, entry.value]),
  );
  const client = config
    ? createServerClient<Database>(config.url, config.publishableKey, {
        cookieOptions: { name: names.session, ...cookieOptions },
        cookies: {
          getAll: () => [...values].map(([name, value]) => ({ name, value })),
          setAll: (changes, cacheHeaders) => {
            for (const { name, value, options } of changes) {
              cookies.set(name, value, {
                ...options,
                ...cookieOptions,
                domain: undefined,
              });
              if (options.maxAge === 0) values.delete(name);
              else values.set(name, value);
            }
            for (const [name, value] of Object.entries(cacheHeaders))
              headers.set(name, value);
          },
        },
      })
    : null;
  const csrf = () => {
    const existing = cookies.get(names.csrf)?.value;
    if (existing && /^[a-f0-9]{64}$/.test(existing)) return existing;
    const token = createCsrf();
    cookies.set(names.csrf, token, { ...cookieOptions, maxAge: 3600 });
    return token;
  };
  const clear = () => {
    for (const name of values.keys())
      if (name.startsWith(names.session)) cookies.delete(name, cookieOptions);
    for (const name of [names.csrf, names.pending, names.cooldown])
      cookies.delete(name, cookieOptions);
  };
  const redirect = (location: string) => {
    const next = new Headers(headers);
    next.set('Location', location);
    return new Response(null, { status: 303, headers: next });
  };
  const json = (body: unknown, status = 200) => {
    const next = new Headers(headers);
    next.set('Content-Type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(body), { status, headers: next });
  };
  const identity = async (): Promise<{
    viewer: Viewer;
    profile: Profile;
  } | null> => {
    if (
      !client ||
      ![...values.keys()].some((name) => name.startsWith(names.session))
    )
      return null;
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    // Staging restrictions apply to every read, including valid sessions obtained
    // outside this application's login form.
    if (
      config?.testEmail &&
      data.user.email?.toLowerCase() !== config.testEmail
    )
      return null;
    const id = data.user.id;
    const [profileResult, roleResult] = await Promise.all([
      client
        .from('profiles')
        .select('id,name,country,image')
        .eq('id', id)
        .single(),
      client.from('account_roles').select('role').eq('user_id', id).single(),
    ]);
    if (profileResult.error || roleResult.error)
      throw new Error('Your account could not be loaded. Please try again.');
    const profile = ProfileSchema.parse(profileResult.data);
    const role = RoleSchema.parse(roleResult.data.role);
    const provider = data.user.app_metadata.provider;
    const viewer = ViewerSchema.parse({
      id,
      name: profile.name,
      email: data.user.email ?? null,
      image: profile.image || '/assets/avatars/avatar-1.png',
      role,
      provider:
        provider === 'google' || provider === 'discord' ? provider : 'email',
    });
    return { viewer, profile };
  };
  return {
    config,
    client,
    cookies,
    names,
    cookieOptions,
    headers,
    csrf,
    clear,
    redirect,
    json,
    identity,
  };
}
export type AccountContext = ReturnType<typeof accountContext>;
