import { EmailSchema, type LoginProviders } from '../../contracts/account';
const envNames = [
  'AUTH_ENABLED',
  'AUTH_ORIGIN',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'AUTH_COOKIE_SECRET',
  'AUTH_ALLOW_SIGNUP',
  'AUTH_TEST_EMAIL',
  'AUTH_GOOGLE_ENABLED',
  'AUTH_DISCORD_ENABLED',
  'AUTH_EMAIL_ENABLED',
] as const;
function serverEnvironment(): Record<string, string | undefined> {
  return Object.fromEntries(
    envNames.map((name) => {
      const value: unknown = process.env[name] ?? import.meta.env[name];
      return [name, typeof value === 'string' ? value : undefined];
    }),
  );
}
export interface AuthConfig {
  origin: string;
  url: string;
  publishableKey: string;
  signingKey: string;
  providers: LoginProviders;
  signup: boolean;
  testEmail?: string;
}
export function authConfig(
  env: Record<string, string | undefined> = serverEnvironment(),
): AuthConfig | null {
  try {
    if (env.AUTH_ENABLED !== 'true') return null;
    const origin = new URL(env.AUTH_ORIGIN ?? '');
    const url = new URL(env.SUPABASE_URL ?? '');
    if (
      origin.username ||
      origin.password ||
      origin.pathname !== '/' ||
      origin.search ||
      origin.hash ||
      !(
        ['https:'].includes(origin.protocol) ||
        (origin.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(origin.hostname))
      )
    )
      return null;
    if (
      url.protocol !== 'https:' ||
      !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) ||
      url.pathname !== '/' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    const key = env.SUPABASE_PUBLISHABLE_KEY ?? '';
    let publicKey = key.startsWith('sb_publishable_');
    if (!publicKey && key.split('.').length === 3) {
      const payload: unknown = JSON.parse(
        Buffer.from(key.split('.')[1] ?? '', 'base64url').toString(),
      );
      publicKey =
        !!payload &&
        typeof payload === 'object' &&
        'role' in payload &&
        payload.role === 'anon';
    }
    if (!publicKey || (env.AUTH_COOKIE_SECRET?.length ?? 0) < 32) return null;
    return {
      origin: origin.origin,
      url: url.origin,
      publishableKey: key,
      signingKey: env.AUTH_COOKIE_SECRET!,
      signup: env.AUTH_ALLOW_SIGNUP === 'true',
      testEmail: env.AUTH_TEST_EMAIL
        ? EmailSchema.parse(env.AUTH_TEST_EMAIL)
        : undefined,
      providers: {
        google: env.AUTH_GOOGLE_ENABLED === 'true',
        discord: env.AUTH_DISCORD_ENABLED === 'true',
        email: env.AUTH_EMAIL_ENABLED === 'true',
      },
    };
  } catch {
    return null;
  }
}
