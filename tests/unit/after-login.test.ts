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
  it('returns to the teammate profile the Save heart sent them from, once', () => {
    const save = jar('profile-save:nyx');
    expect(afterLoginPath(save.cookies)).toBe('/teammates/nyx?save=1');
    expect(save.deleted).toEqual([RESUME_COOKIE]);
  });
  it('no longer answers the booking detour, which booking does not take', () => {
    /* Booking never goes through sign-in now, so the old "profile:" value and the ?book=1
       path it came back on are gone: anything left over simply lands on the dashboard. */
    expect(afterLoginPath(jar('profile:nyx').cookies)).toBe('/dashboard');
  });
  it('only ever builds a profile path, so no value can redirect off the site', () => {
    for (const bad of [
      'profile-save://evil.example',
      'profile-save:/dashboard',
      'profile-save:nyx?x=1',
      'profile-save:ny',
      'profile-save:Nyx',
      'profile-save:admin',
      'profile-save:',
      'profile-save:../secrets',
    ]) {
      const { cookies, deleted } = jar(bad);
      expect(afterLoginPath(cookies), bad).toBe('/dashboard');
      /* The cookie is still spent, so a junk value cannot survive the next sign-in. */
      expect(deleted).toEqual([RESUME_COOKIE]);
    }
  });
});
