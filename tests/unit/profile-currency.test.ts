import type { APIContext, APIRoute } from 'astro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import { saveCurrency, saveProfile } from '../../src/server/auth/handlers';
import {
  PROFILE_LANGUAGES,
  ProfileSchema,
  normalizeBio,
  normalizeLanguages,
} from '../../src/contracts/account';

vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
const identity = vi.fn();
const update = vi.fn();
const token = 'a'.repeat(64);
const id = '00000000-0000-4000-8000-000000000001';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const context = (path: string, body: unknown) => {
  const request = new Request('http://localhost' + path, {
    method: 'POST',
    headers: { origin: 'http://localhost', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    request,
    url: new URL(request.url),
    params: {},
    cookies: { get: () => ({ value: token }) },
  } as unknown as APIContext;
};
const run = async (handler: APIRoute, ctx: APIContext) =>
  (await handler(ctx)) as Response;
let saved: Record<string, unknown> = {};
beforeEach(() => {
  vi.resetAllMocks();
  saved = {
    id,
    name: 'Mika',
    country: 'de',
    image: '',
    bio: '',
    languages: [],
  };
  identity.mockResolvedValue({ viewer: { id, role: 'teammate' } });
  update.mockImplementation((patch: Record<string, unknown>) => {
    saved = { ...saved, ...patch };
    const result = { data: saved, error: null };
    return {
      eq: () =>
        Object.assign(Promise.resolve({ error: null }), {
          select: () => ({ single: async () => result }),
        }),
    };
  });
  vi.mocked(accountContext).mockReturnValue({
    client: { from: () => ({ update }) },
    identity,
    json,
    config: { origin: 'http://localhost' },
    names: { csrf: 'csrf' },
  } as unknown as ReturnType<typeof accountContext>);
});

describe('original saveProfile rules for bio and languages', () => {
  it('drops control characters except line breaks, trims and caps at 160', () => {
    expect(normalizeBio('  Calm\u0007 comms\nI explain\tcalls  ')).toBe(
      'Calm comms\nI explaincalls',
    );
    expect(normalizeBio('x'.repeat(200))).toHaveLength(160);
    expect(normalizeBio(null)).toBe('');
    // A cut never ends on a space and never splits an emoji.
    expect(normalizeBio('a'.repeat(159) + ' b')).toBe('a'.repeat(159));
    expect(Array.from(normalizeBio('🎮'.repeat(170)))).toHaveLength(160);
  });
  it('keeps known languages only, without duplicates, up to six', () => {
    expect(normalizeLanguages(['German', 'Klingon', 'German', 3])).toEqual([
      'German',
    ]);
    expect(normalizeLanguages([...PROFILE_LANGUAGES])).toEqual(
      PROFILE_LANGUAGES.slice(0, 6),
    );
    expect(normalizeLanguages('English')).toEqual([]);
  });
  it('reads profiles from before the migration with empty defaults', () => {
    expect(
      ProfileSchema.parse({ id, name: 'Mika', country: '', image: '' }),
    ).toMatchObject({ bio: '', languages: [], currency: null });
  });
});

describe('POST /api/me/profile', () => {
  const body = {
    csrf: token,
    name: 'Mika',
    country: 'de',
    image: '',
    bio: '  Calm comms ',
    languages: ['English', 'English', 'Klingon'],
  };
  it('saves a teammate bio and languages, normalized', async () => {
    const res = await run(saveProfile, context('/api/me/profile', body));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledExactlyOnceWith({
      name: 'Mika',
      country: 'de',
      image: '',
      bio: 'Calm comms',
      languages: ['English'],
    });
    expect((await res.json()).profile).toEqual({
      name: 'Mika',
      country: 'de',
      image: '',
      bio: 'Calm comms',
      languages: ['English'],
    });
  });
  it.each(['customer', 'admin'])(
    'ignores bio and languages from a %s',
    async (role) => {
      identity.mockResolvedValue({ viewer: { id, role } });
      const res = await run(saveProfile, context('/api/me/profile', body));
      expect(res.status).toBe(200);
      expect(update).toHaveBeenCalledExactlyOnceWith({
        name: 'Mika',
        country: 'de',
        image: '',
      });
    },
  );
});

describe('POST /api/me/currency', () => {
  it.each(['EUR', 'USD'])('saves %s on the account', async (currency) => {
    const res = await run(
      saveCurrency,
      context('/api/me/currency', { csrf: token, currency }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ currency });
    expect(update).toHaveBeenCalledExactlyOnceWith({ currency });
  });
  it.each([
    [{ csrf: token, currency: 'GBP' }, 400],
    [{ csrf: token, currency: 'usd' }, 400],
    [{ csrf: token }, 400],
    [{ csrf: 'wrong', currency: 'USD' }, 403],
  ])('rejects %j with %i', async (payload, status) => {
    const res = await run(saveCurrency, context('/api/me/currency', payload));
    expect(res.status).toBe(status);
    expect(update).not.toHaveBeenCalled();
  });
  it('needs a signed-in account', async () => {
    identity.mockResolvedValue(null);
    const res = await run(
      saveCurrency,
      context('/api/me/currency', { csrf: token, currency: 'USD' }),
    );
    expect(res.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });
});
