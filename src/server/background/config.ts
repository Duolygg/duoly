/**
 * Environment for the event-driven background work (docs/product/background-work.md).
 * Server only: these are the two secrets the worker shares with the app plus the worker's base
 * URL. Nothing here has a default, so a half-configured deployment does nothing instead of
 * running unauthenticated.
 */
import { MIN_SECRET_LENGTH } from '../../contracts/background';

type Env = Record<string, string | undefined>;

const read = (env: Env | undefined, name: string): string | undefined => {
  const value: unknown =
    env?.[name] ?? process.env[name] ?? import.meta.env?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const secret = (env: Env | undefined, name: string): string | undefined => {
  const value = read(env, name);
  return value && value.length >= MIN_SECRET_LENGTH ? value : undefined;
};

/** Signs the worker's fire request to /api/internal/timer. */
export const fireSecret = (env?: Env): string | undefined =>
  secret(env, 'BACKGROUND_FIRE_SECRET');

/** Bearer that public.background_fix() sends to /api/internal/reconcile. */
export const reconcileSecret = (env?: Env): string | undefined =>
  secret(env, 'BACKGROUND_RECONCILE_SECRET');

/**
 * Worker base URL, same shape the SQL trigger insists on: lowercase https, no trailing slash.
 * A typo registers nothing instead of posting a signed body somewhere unintended.
 */
const TIMERS_URL = /^https:\/\/[a-z0-9]([a-z0-9.-]{1,126}[a-z0-9])?$/;

export interface RegisterTarget {
  /** Full URL of POST /timers. */
  url: string;
  secret: string;
}

/** Null whenever either half is missing, so the caller skips in silence. */
export function registerTarget(env?: Env): RegisterTarget | null {
  const base = read(env, 'BACKGROUND_TIMERS_URL')?.replace(/\/+$/, '');
  const key = secret(env, 'BACKGROUND_REGISTER_SECRET');
  if (!base || !TIMERS_URL.test(base) || !key) return null;
  return { url: `${base}/timers`, secret: key };
}
