import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AstroCookies } from 'astro';
import {
  consumePendingFavorite,
  pendingFavoriteSlug,
  PENDING_FAVORITE_ATTRIBUTES,
  PENDING_FAVORITE_COOKIE,
  PENDING_FAVORITE_MAX_AGE,
} from '../../src/server/teammates/pending-favorite';
import { afterLogin } from '../../src/server/auth/after-login';

/*
 * No sign-in wall before booking. A signed-out visitor who presses Book goes straight to the
 * booking page and leaves this cookie behind; the sign-in that checkout asks for before paying
 * is where it is spent. The two things worth proving are that nothing but a real slug ever
 * reaches the database, and that the cookie is spent exactly once, whatever happens next.
 */
const jar = (value?: string) => {
  const deleted: { name: string; path?: string }[] = [];
  const cookies = {
    get: (name: string) =>
      name === PENDING_FAVORITE_COOKIE && value !== undefined
        ? { value }
        : undefined,
    delete: (name: string, options?: { path?: string }) =>
      deleted.push({ name, path: options?.path }),
  } as unknown as AstroCookies;
  return { cookies, deleted };
};

const spy = (answer: { data?: unknown; error?: unknown } = { data: {} }) => {
  const calls: unknown[] = [];
  return {
    calls,
    rpc: (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args });
      return Promise.resolve(answer);
    },
  };
};

afterEach(() => vi.unstubAllEnvs());

describe('the pending favorite cookie', () => {
  it('is short lived, same site and never carries a path', () => {
    expect(PENDING_FAVORITE_MAX_AGE).toBe(7200);
    expect(PENDING_FAVORITE_ATTRIBUTES).toBe(
      'Max-Age=7200; Path=/; SameSite=Lax; Secure',
    );
    /* The page writes it in the browser, so both sides have to agree on the wording. */
    const page = readFileSync('src/pages/teammates/[slug].astro', 'utf8');
    expect(page).toContain(
      `${PENDING_FAVORITE_COOKIE}=\${slug}; ${PENDING_FAVORITE_ATTRIBUTES}`,
    );
  });
  it('only reads back a value that is a valid profile slug', () => {
    expect(pendingFavoriteSlug(jar('nyx').cookies)).toBe('nyx');
    for (const bad of [
      '',
      'ny',
      'Nyx',
      'nyx?x=1',
      '../secrets',
      '/dashboard',
      'https://evil.example',
      'admin',
      'a'.repeat(25),
    ])
      expect(pendingFavoriteSlug(jar(bad).cookies), bad).toBe(null);
  });
});

describe('spending the cookie after sign-in', () => {
  it('saves the teammate for the customer who just signed in, then clears it', async () => {
    vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'true');
    const { cookies, deleted } = jar('nyx');
    const db = spy();
    expect(await consumePendingFavorite(cookies, 'customer', db.rpc)).toBe(
      'saved',
    );
    expect(db.calls).toEqual([
      { fn: 'customer_favorite_add_by_slug', args: { p_slug: 'nyx' } },
    ]);
    expect(deleted).toEqual([{ name: PENDING_FAVORITE_COOKIE, path: '/' }]);
  });
  it('never sends anything but a slug to the database', async () => {
    vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'true');
    for (const bad of ['Nyx', 'nyx?book=1', '../secrets', 'admin']) {
      const { cookies, deleted } = jar(bad);
      const db = spy();
      expect(
        await consumePendingFavorite(cookies, 'customer', db.rpc),
        bad,
      ).toBe('invalid');
      expect(db.calls, bad).toEqual([]);
      /* Still spent, so a junk value cannot be retried on every later sign-in. */
      expect(deleted, bad).toEqual([
        { name: PENDING_FAVORITE_COOKIE, path: '/' },
      ]);
    }
  });
  it('does nothing at all when there is no cookie', async () => {
    const { cookies, deleted } = jar();
    const db = spy();
    expect(await consumePendingFavorite(cookies, 'customer', db.rpc)).toBe(
      'none',
    );
    expect(db.calls).toEqual([]);
    expect(deleted).toEqual([]);
  });
  it('drops it for anyone who has no favorites list, and while the flag is off', async () => {
    vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'true');
    for (const role of ['teammate', 'admin', undefined]) {
      const db = spy();
      expect(
        await consumePendingFavorite(jar('nyx').cookies, role, db.rpc),
      ).toBe('skipped');
      expect(db.calls).toEqual([]);
    }
    vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'false');
    const off = spy();
    expect(
      await consumePendingFavorite(jar('nyx').cookies, 'customer', off.rpc),
    ).toBe('skipped');
    expect(off.calls).toEqual([]);
  });
  it('fails silently when the database refuses or is unavailable', async () => {
    vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'true');
    /* A refusal is reported inside data, an outage as an error, and a thrown client as
       neither. None of the three may reach the visitor. */
    const refusal = spy({
      data: {
        error: { code: 409, message: 'You can have up to 100 favorites.' },
      },
    });
    expect(
      await consumePendingFavorite(jar('nyx').cookies, 'customer', refusal.rpc),
    ).toBe('failed');
    const outage = spy({ data: null, error: { message: 'down' } });
    expect(
      await consumePendingFavorite(jar('nyx').cookies, 'customer', outage.rpc),
    ).toBe('failed');
    const { cookies, deleted } = jar('nyx');
    expect(
      await consumePendingFavorite(cookies, 'customer', () => {
        throw new Error('no client');
      }),
    ).toBe('failed');
    expect(deleted).toEqual([{ name: PENDING_FAVORITE_COOKIE, path: '/' }]);
  });
});

describe('afterLogin', () => {
  it('saves the pending teammate and then answers with the redirect', async () => {
    vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'true');
    const db = spy();
    expect(await afterLogin(jar('nyx').cookies, 'customer', db)).toBe(
      '/dashboard',
    );
    expect(db.calls).toEqual([
      { fn: 'customer_favorite_add_by_slug', args: { p_slug: 'nyx' } },
    ]);
  });
  it('still redirects when there is no client to save with', async () => {
    vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'true');
    expect(await afterLogin(jar('nyx').cookies, 'customer', null)).toBe(
      '/dashboard',
    );
  });
});
