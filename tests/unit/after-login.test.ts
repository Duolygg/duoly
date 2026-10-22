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
});
