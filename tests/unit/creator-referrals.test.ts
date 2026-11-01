import type { APIContext, APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CREATOR } from '../../src/design-reference/lib/creators.js';
import {
  AdminCreatorCommandSchema,
  CREATOR_RULES,
  REF_COOKIE_DAYS,
  normalizeRefCode,
} from '../../src/contracts/creators';
import {
  captureReferral,
  checkoutRefCode,
  refCookieName,
} from '../../src/server/referrals';
import { accountContext } from '../../src/server/auth/context';
import { mutation } from '../../src/server/auth/handlers';
import { creatorRow, referralOrder } from '../../src/components/admin/Creators';

// Admin permissions (migration 20261105130000): these tests act as an owner.
vi.mock('../../src/server/admin/access', async (original) => ({
  ...(await original<typeof import('../../src/server/admin/access')>()),
  adminAccess: vi.fn(async () => ({ owner: true, sections: [] })),
}));

vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
vi.mock('../../src/server/auth/handlers', () => ({ mutation: vi.fn() }));
vi.mock('../../src/server/fx', () => ({
  eurToUsd: async () => ({ rate: 1.1, source: 'ecb' }),
  customerUsdRate: (r: number) => Math.round(r * 1.01 * 10000) / 10000,
  FALLBACK_EUR_TO_USD: 1.08,
}));

const { creators, settings, settingsSnapshot } =
  await import('../../src/server/admin/handlers');

const migration = readFileSync(
  'supabase/migrations/20261025110000_creator_referrals.sql',
  'utf8',
);
const csrf = 'csrf-token';
const id = '6f1d2c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';

describe('creator program rules (original lib/creators.js)', () => {
  it('keeps the original tiers, window, minimum and discount', () => {
    expect(CREATOR_RULES.tiers).toEqual([
      { id: 'rising', name: 'Rising', from: 0, commission: 8 },
      { id: 'partner', name: 'Partner', from: 25, commission: 10 },
      { id: 'elite', name: 'Elite', from: 100, commission: 12 },
    ]);
    expect(CREATOR_RULES.attributionMonths).toBe(CREATOR.attributionMonths);
    expect(CREATOR_RULES.attributionMonths).toBe(12);
    expect(CREATOR_RULES.payoutMinEur).toBe(50);
    expect(CREATOR_RULES.viewerDiscountPercent).toBe(10);
  });
  it('the migration uses the same numbers as the contract', () => {
    for (const t of CREATOR_RULES.tiers) {
      expect(migration).toContain(
        `'id', '${t.id}', 'name', '${t.name}', 'from', ${t.from}, 'commission', ${t.commission}`,
      );
      if (t.from)
        expect(migration).toContain(
          `when p_orders >= ${t.from} then pg_catalog.jsonb_build_object('id', '${t.id}', 'name', '${t.name}', 'commission', ${t.commission})`,
        );
    }
    expect(migration).toContain("'months', 12, 'payoutMinCents', 5000");
    expect(migration).toContain("interval '12 months'");
  });
  it('replaces no existing function and grants the tables to nobody but the service role', () => {
    expect(migration).not.toMatch(/create or replace/i);
    expect(migration).not.toMatch(
      /grant [^;]* on table [^;]* to authenticated/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.admin_creators\(\), public\.admin_create_creator\(text,text,text\),\s+public\.admin_set_creator_active\(uuid,boolean\) to authenticated;/,
    );
  });
  it('never applies a discount or moves money', () => {
    expect(migration).not.toMatch(/update public\.(orders|order_payments)/i);
    expect(migration).not.toMatch(
      /insert into public\.(refund_credits|order_payments)/i,
    );
  });
});

describe('creator codes', () => {
  it('normalises to upper case and enforces 3 to 20 letters or numbers', () => {
    expect(normalizeRefCode(' yourname10 ')).toBe('YOURNAME10');
    for (const bad of ['', 'ab', 'a'.repeat(21), 'bad code', 'x-y', 'ÄBC', 42])
      expect(normalizeRefCode(bad), String(bad)).toBeNull();
  });
  it('accepts exactly the two admin commands', () => {
    expect(
      AdminCreatorCommandSchema.safeParse({
        csrf,
        action: 'create',
        code: 'ALPHA',
        name: 'Alpha',
      }).success,
    ).toBe(true);
    expect(
      AdminCreatorCommandSchema.safeParse({
        csrf,
        action: 'setActive',
        creatorId: id,
        active: false,
      }).success,
    ).toBe(true);
    for (const body of [
      { action: 'create', code: 'AL', name: 'Alpha' },
      { action: 'create', code: 'ALPHA', name: 'A' },
      { action: 'create', code: 'ALPHA', name: 'Alpha', commission: 50 },
      { action: 'setActive', creatorId: 'x', active: true },
      { action: 'setActive', creatorId: id, active: 'yes' },
      { action: 'delete', creatorId: id },
    ])
      expect(
        AdminCreatorCommandSchema.safeParse({ csrf, ...body }).success,
        JSON.stringify(body),
      ).toBe(false);
  });
});

// Visitors in these tests accepted all cookies in the banner unless a test says otherwise.
function jar(
  initial: Record<string, string> = {},
  consent: string | null = 'all',
) {
  const values = new Map(Object.entries(initial));
  const set = vi.fn((name: string, value: string) => values.set(name, value));
  const remove = vi.fn((name: string) => values.delete(name));
  const read = (name: string) =>
    name === 'duoly-consent'
      ? consent === null
        ? undefined
        : { value: consent }
      : values.has(name)
        ? { value: values.get(name)! }
        : undefined;
  return {
    set,
    remove,
    values,
    cookies: {
      get: read,
      set,
      delete: remove,
    } as unknown as Parameters<typeof captureReferral>[2],
  };
}

describe('referral v2 purposes', () => {
  it.each([
    [null, false],
    ['garbage', false],
    ['necessary', false],
    ['all', true],
    ['v2.a0.m0.r0', false],
    ['v2.a1.m0.r0', false],
    ['v2.a0.m0.r1', true],
    ['v2.a1.m1.r1', true],
  ] as const)('gates capture and checkout with %s', (consent, allowed) => {
    const fresh = jar({}, consent);
    expect(
      captureReferral(
        new URL('https://duoly.gg/?ref=ALPHA'),
        'GET',
        fresh.cookies,
        true,
      ),
    ).toBe(allowed ? 'ALPHA' : null);
    expect(fresh.set).toHaveBeenCalledTimes(allowed ? 1 : 0);
    const existing = jar({ '__Host-duoly-ref': 'ALPHA' }, consent);
    expect(checkoutRefCode(existing.cookies!, true, true)).toBe(
      allowed ? 'ALPHA' : null,
    );
    captureReferral(
      new URL('https://duoly.gg/'),
      'GET',
      existing.cookies,
      true,
    );
    if (consent === 'necessary' || consent?.endsWith('r0'))
      expect(existing.remove).toHaveBeenCalledWith('__Host-duoly-ref', {
        path: '/',
        secure: true,
      });
  });
});

describe('referral cookie capture', () => {
  const url = (path: string) => new URL('https://duoly.gg' + path);
  it('does nothing while referrals are switched off', () => {
    const j = jar();
    expect(captureReferral(url('/?ref=ALPHA'), 'GET', j.cookies, false)).toBe(
      null,
    );
    expect(j.set).not.toHaveBeenCalled();
  });
  it('sets an httpOnly lax cookie with the normalised code on a page visit', () => {
    const j = jar();
    expect(captureReferral(url('/?ref=alpha10'), 'GET', j.cookies, true)).toBe(
      'ALPHA10',
    );
    expect(j.set).toHaveBeenCalledWith('__Host-duoly-ref', 'ALPHA10', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: REF_COOKIE_DAYS * 86400,
    });
  });
  it('keeps the first code: a later link never replaces it', () => {
    const j = jar({ '__Host-duoly-ref': 'FIRST' });
    expect(captureReferral(url('/?ref=SECOND'), 'GET', j.cookies, true)).toBe(
      null,
    );
    expect(j.values.get('__Host-duoly-ref')).toBe('FIRST');
  });
  it('ignores invalid codes, API and auth paths and non-GET requests', () => {
    const j = jar();
    captureReferral(url('/?ref=no'), 'GET', j.cookies, true);
    captureReferral(url('/?ref=bad%20code'), 'GET', j.cookies, true);
    captureReferral(url('/api/checkout?ref=ALPHA'), 'GET', j.cookies, true);
    captureReferral(url('/auth/callback?ref=ALPHA'), 'GET', j.cookies, true);
    captureReferral(url('/?ref=ALPHA'), 'POST', j.cookies, true);
    captureReferral(undefined, 'GET', j.cookies, true);
    captureReferral(url('/?ref=ALPHA'), 'GET', undefined, true);
    expect(j.set).not.toHaveBeenCalled();
  });
  it('uses the plain cookie name on http (local dev)', () => {
    const j = jar();
    captureReferral(
      new URL('http://localhost:4321/creators?ref=ALPHA'),
      'GET',
      j.cookies,
      true,
    );
    expect(j.values.get('duoly-ref')).toBe('ALPHA');
    expect(refCookieName(false)).toBe('duoly-ref');
  });
  it('checkout reads the code only from the server cookie and only when on', () => {
    const j = jar({ '__Host-duoly-ref': 'ALPHA', 'duoly-ref': 'beta' });
    expect(
      checkoutRefCode(j.cookies as NonNullable<typeof j.cookies>, true, true),
    ).toBe('ALPHA');
    expect(
      checkoutRefCode(j.cookies as NonNullable<typeof j.cookies>, false, true),
    ).toBe('BETA');
    expect(
      checkoutRefCode(j.cookies as NonNullable<typeof j.cookies>, true, false),
    ).toBeNull();
    const tampered = jar({ '__Host-duoly-ref': 'x;y' });
    expect(
      checkoutRefCode(
        tampered.cookies as NonNullable<typeof tampered.cookies>,
        true,
        true,
      ),
    ).toBeNull();
  });
});

describe('admin creators and settings endpoints', () => {
  const rpc = vi.fn();
  let role = 'admin';
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });
  const account = () => ({
    json,
    client: { rpc },
    identity: async () => ({ viewer: { role } }),
  });
  const context = (method: string) =>
    ({
      request: new Request('http://localhost/api/admin/creators', { method }),
      cookies: {},
    }) as unknown as APIContext;
  const run = async (handler: APIRoute, method: string) =>
    (await handler(context(method))) as Response;
  const post = (body: Record<string, unknown>) =>
    vi.mocked(mutation).mockResolvedValue({
      account: account(),
      body: { csrf, ...body },
      failure: null,
    } as never);

  beforeEach(() => {
    vi.resetAllMocks();
    role = 'admin';
    vi.mocked(accountContext).mockImplementation(() => account() as never);
    rpc.mockResolvedValue({ data: { creators: [], orders: [] }, error: null });
  });

  it('hides creators and settings from non-admins (404) and never calls the database', async () => {
    role = 'customer';
    expect((await run(creators, 'GET')).status).toBe(404);
    expect((await run(settings, 'GET')).status).toBe(404);
    post({ action: 'create', code: 'ALPHA', name: 'Alpha' });
    expect((await run(creators, 'POST')).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('reads admin_creators for admins', async () => {
    const res = await run(creators, 'GET');
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('admin_creators');
  });
  it('maps create and setActive to their audited RPCs', async () => {
    rpc.mockResolvedValue({ data: { creator: { id } }, error: null });
    post({ action: 'create', code: 'ALPHA', name: 'Alpha' });
    expect((await run(creators, 'POST')).status).toBe(200);
    expect(rpc).toHaveBeenLastCalledWith('admin_create_creator', {
      p_code: 'ALPHA',
      p_name: 'Alpha',
      p_channel: '',
    });
    post({ action: 'setActive', creatorId: id, active: false });
    await run(creators, 'POST');
    expect(rpc).toHaveBeenLastCalledWith('admin_set_creator_active', {
      p_id: id,
      p_active: false,
    });
  });
  it('passes database refusals through with their status', async () => {
    rpc.mockResolvedValue({
      data: { error: { code: 409, message: 'That code is taken.' } },
      error: null,
    });
    post({ action: 'create', code: 'ALPHA', name: 'Alpha' });
    const res = await run(creators, 'POST');
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'That code is taken.' });
  });
  it('refuses unknown bodies, including client-supplied money', async () => {
    post({ action: 'create', code: 'ALPHA', name: 'Alpha', owedCents: 999 });
    expect((await run(creators, 'POST')).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('settings returns live values without env names or values', async () => {
    const res = await run(settings, 'GET');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      fx: {
        rate: 1.1,
        customerRate: 1.111,
        markup: 0.01,
        source: 'ecb',
        date: null,
        ageMs: null,
        live: true,
        fallback: false,
      },
      ownersConfigured: expect.any(Boolean),
      referralsEnabled: expect.any(Boolean),
    });
    expect(JSON.stringify(body)).not.toMatch(
      /ADMIN_EMAILS|REFERRALS_ENABLED|@/,
    );
    const fallback = await settingsSnapshot(async () => ({
      rate: 1.08,
      source: 'fallback' as const,
    }));
    expect(fallback.fx.live).toBe(false);
  });
});

describe('admin Creators screen mapping', () => {
  it('converts cents to euros and times to ms', () => {
    const c = creatorRow({
      id,
      code: 'ALPHA',
      owedCents: 351,
      createdAt: '2026-10-25T10:00:00Z',
      months: [
        {
          month: '2026-10',
          orders: 2,
          baseCents: 4387,
          tier: 'rising',
          commission: 8,
          commissionCents: 351,
        },
      ],
    });
    expect(c.owed).toBe(3.51);
    expect(c.createdAt).toBe(Date.parse('2026-10-25T10:00:00Z'));
    expect(c.months[0]).toMatchObject({ base: 43.87, commissionEur: 3.51 });
  });
  it('says whether an attributed order counts', () => {
    const base = { amountCents: 1000, refundCents: 0, at: null };
    expect(
      referralOrder({ ...base, status: 'completed', payment: 'captured' })
        .counts,
    ).toBe('Yes');
    expect(
      referralOrder({ ...base, status: 'completed', payment: 'refunded' })
        .counts,
    ).toBe('No');
    expect(
      referralOrder({ ...base, status: 'queued', payment: 'authorized' })
        .counts,
    ).toBe('When completed');
    expect(
      referralOrder({ ...base, status: 'cancelled', payment: 'voided' }).counts,
    ).toBe('No');
  });
});

describe('referral cookie consent (cookie banner, owner decision 2026-10-27)', () => {
  const url = (path: string) => new URL('https://duoly.gg' + path);
  it('sets nothing before the visitor chose in the banner', () => {
    const j = jar({}, null);
    expect(
      captureReferral(url('/?ref=ALPHA'), 'GET', j.cookies, true),
    ).toBeNull();
    expect(j.set).not.toHaveBeenCalled();
  });
  it('"Only necessary" sets nothing and removes an existing referral cookie', () => {
    const j = jar({ '__Host-duoly-ref': 'ALPHA' }, 'necessary');
    expect(
      captureReferral(url('/?ref=BETA'), 'GET', j.cookies, true),
    ).toBeNull();
    expect(j.set).not.toHaveBeenCalled();
    expect(j.remove).toHaveBeenCalledWith('__Host-duoly-ref', {
      path: '/',
      secure: true,
    });
  });
  it('checkout ignores the code without "Accept all"', () => {
    for (const consent of [null, 'necessary', 'other']) {
      const j = jar({ '__Host-duoly-ref': 'ALPHA' }, consent);
      expect(
        checkoutRefCode(j.cookies as NonNullable<typeof j.cookies>, true, true),
      ).toBeNull();
    }
  });
});
