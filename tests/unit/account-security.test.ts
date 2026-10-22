import { describe, expect, it } from 'vitest';
import {
  ProfileUpdateSchema,
  EmailSchema,
  ProviderSchema,
} from '../../src/contracts/account';
import {
  createCsrf,
  verifyCsrf,
  sealPendingEmail,
  readPendingEmail,
  readBoundedBody,
} from '../../src/server/auth/security';

describe('account request security', () => {
  it('allows only existing country and avatar presets and forbids privilege fields', () => {
    expect(
      ProfileUpdateSchema.parse({
        name: '  Player Two  ',
        country: 'at',
        image: '/assets/avatars/avatar-10.png',
      }).name,
    ).toBe('Player Two');
    for (const change of [
      { role: 'admin' },
      { id: 'another-user' },
      { upload: 'data:image/png;base64,unsafe' },
      { country: 'zz' },
      { image: 'https://example.invalid/avatar' },
    ]) {
      expect(
        ProfileUpdateSchema.safeParse({
          name: 'Player',
          country: '',
          image: '',
          ...change,
        }).success,
      ).toBe(false);
    }
  });
  it('normalizes email and accepts only explicitly supported OAuth providers', () => {
    expect(EmailSchema.parse('  TEST@example.com ')).toBe('test@example.com');
    expect(EmailSchema.safeParse('not email').success).toBe(false);
    expect(ProviderSchema.safeParse('google').success).toBe(true);
    expect(ProviderSchema.safeParse('discord').success).toBe(true);
    expect(ProviderSchema.safeParse('https://attacker.invalid').success).toBe(
      false,
    );
  });
  it('requires same-origin POST plus a bound CSRF token', () => {
    const token = createCsrf();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const request = (origin: string, method = 'POST') =>
      new Request('https://duoly.gg/auth/logout', {
        method,
        headers: { Origin: origin },
      });
    expect(
      verifyCsrf(request('https://duoly.gg'), 'https://duoly.gg', token, token),
    ).toBe(true);
    for (const candidate of [undefined, '', 'wrong', token + 'a'])
      expect(
        verifyCsrf(
          request('https://duoly.gg'),
          'https://duoly.gg',
          token,
          candidate,
        ),
      ).toBe(false);
    expect(
      verifyCsrf(
        request('https://evil.invalid'),
        'https://duoly.gg',
        token,
        token,
      ),
    ).toBe(false);
    expect(
      verifyCsrf(
        request('https://duoly.gg', 'GET'),
        'https://duoly.gg',
        token,
        token,
      ),
    ).toBe(false);
    expect(
      verifyCsrf(
        new Request('https://duoly.gg/auth/logout', { method: 'POST' }),
        'https://duoly.gg',
        token,
        token,
      ),
    ).toBe(false);
  });
  it('binds pending email to browser CSRF, rejects tampering and expires it', () => {
    const key = 'a'.repeat(64);
    const csrf = createCsrf();
    const now = 1_800_000_000_000;
    const sealed = sealPendingEmail('owner@example.com', csrf, key, now);
    expect(readPendingEmail(sealed, csrf, key, now)).toBe('owner@example.com');
    expect(readPendingEmail(sealed, createCsrf(), key, now)).toBeUndefined();
    expect(readPendingEmail(sealed + 'x', csrf, key, now)).toBeUndefined();
    expect(readPendingEmail(sealed, csrf, 'b'.repeat(64), now)).toBeUndefined();
    expect(readPendingEmail(sealed, csrf, key, now + 600_000)).toBeUndefined();
    expect(readPendingEmail(undefined, csrf, key, now)).toBeUndefined();
  });
  it('bounds actual body bytes and rejects duplicate form fields and unsupported types', async () => {
    expect(
      await readBoundedBody(
        new Request('https://duoly.gg/auth/email/request', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: 'email=a%40example.com&csrf=token',
        }),
      ),
    ).toEqual({ email: 'a@example.com', csrf: 'token' });
    for (const body of ['csrf=one&csrf=two', 'x=' + 'a'.repeat(4100)]) {
      await expect(
        readBoundedBody(
          new Request('https://duoly.gg', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body,
          }),
        ),
      ).rejects.toThrow();
    }
    await expect(
      readBoundedBody(
        new Request('https://duoly.gg', {
          method: 'POST',
          headers: { 'content-type': 'text/plain' },
          body: 'csrf=x',
        }),
      ),
    ).rejects.toThrow();
  });
});
