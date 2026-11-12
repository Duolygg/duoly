import { describe, expect, it } from 'vitest';
import type { AstroCookies } from 'astro';
import {
  afterLoginPath,
  RESUME_COOKIE,
} from '../../src/server/auth/after-login';

const jar = (value?: string) => {
  const deleted: string[] = [];
  const cookies = {
    get: (name: string) =>
      name === RESUME_COOKIE && value !== undefined ? { value } : undefined,
    delete: (name: string) => deleted.push(name),
  } as unknown as AstroCookies;
  return { cookies, deleted };
};

describe('afterLoginPath', () => {
  it('returns to the homepage once when a checkout is waiting', () => {
    const { cookies, deleted } = jar('checkout');
    expect(afterLoginPath(cookies)).toBe('/');
    expect(deleted).toEqual([RESUME_COOKIE]);
  });
  it('goes to the dashboard otherwise and ignores other values', () => {
    expect(afterLoginPath(jar().cookies)).toBe('/dashboard');
    expect(afterLoginPath(jar('https://evil.example').cookies)).toBe(
      '/dashboard',
    );
  });
  it('returns to the teammate profile that sent them to sign in, once', () => {
    const book = jar('profile:nyx');
    expect(afterLoginPath(book.cookies)).toBe('/teammates/nyx?book=1');
    expect(book.deleted).toEqual([RESUME_COOKIE]);
    expect(afterLoginPath(jar('profile-save:nyx').cookies)).toBe(
      '/teammates/nyx?save=1',
    );
  });
  it('only ever builds a profile path, so no value can redirect off the site', () => {
    for (const bad of [
      'profile://evil.example',
      'profile:/dashboard',
      'profile:nyx?x=1',
      'profile:ny',
      'profile:Nyx',
      'profile:admin',
      'profile:',
      'profile-save:../secrets',
    ]) {
      const { cookies, deleted } = jar(bad);
      expect(afterLoginPath(cookies), bad).toBe('/dashboard');
      /* The cookie is still spent, so a junk value cannot survive the next sign-in. */
      expect(deleted).toEqual([RESUME_COOKIE]);
    }
  });
});
