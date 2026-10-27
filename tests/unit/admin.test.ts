import { describe, expect, it } from 'vitest';
import {
  isOwnerEmail,
  ownerEmails,
  syncOwner,
} from '../../src/server/admin/owners';
import {
  ApplicationSchema,
  SetAccessSchema,
  SetRoleSchema,
  WalletAdjustSchema,
  applicationError,
} from '../../src/contracts/admin';
import { rpcResponse } from '../../src/server/admin/handlers';

describe('owners (ADMIN_EMAILS)', () => {
  it('parses a comma separated list, case and space insensitive', () => {
    expect(ownerEmails(' A@x.io, b@Y.com ,,nope ')).toEqual([
      'a@x.io',
      'b@y.com',
    ]);
    expect(ownerEmails('')).toEqual([]);
    expect(ownerEmails(undefined)).toEqual([]);
  });
  it('matches only listed emails', () => {
    const before = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = 'owner@duoly.gg';
    try {
      expect(isOwnerEmail('Owner@Duoly.gg')).toBe(true);
      expect(isOwnerEmail('other@duoly.gg')).toBe(false);
      expect(isOwnerEmail(null)).toBe(false);
    } finally {
      if (before === undefined) delete process.env.ADMIN_EMAILS;
      else process.env.ADMIN_EMAILS = before;
    }
  });
  it('reports sync failures instead of throwing', async () => {
    expect(await syncOwner('u', true, async () => true)).toBe(true);
    expect(await syncOwner('u', true, async () => false)).toBe(false);
    expect(
      await syncOwner('u', true, async () => {
        throw new Error('down');
      }),
    ).toBe(false);
  });
});

describe('admin contracts', () => {
  const id = '6f1d2c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
  it('accepts role and access commands, rejects extras', () => {
    expect(
      SetRoleSchema.safeParse({ csrf: 'x', userId: id, role: 'teammate' })
        .success,
    ).toBe(true);
    expect(
      SetRoleSchema.safeParse({ csrf: 'x', userId: id, role: 'owner' }).success,
    ).toBe(false);
    expect(
      SetAccessSchema.safeParse({
        csrf: 'x',
        userId: id,
        access: { games: ['lol', 'val'], gg: false },
      }).success,
    ).toBe(true);
    expect(
      SetAccessSchema.safeParse({
        csrf: 'x',
        userId: id,
        access: { games: ['wow'], gg: false },
      }).success,
    ).toBe(false);
    expect(
      SetRoleSchema.safeParse({
        csrf: 'x',
        userId: id,
        role: 'admin',
        owner: true,
      }).success,
    ).toBe(false);
  });

  it('accepts bounded wallet adjustments with a reason', () => {
    expect(
      WalletAdjustSchema.safeParse({
        csrf: 'x',
        action: 'adjustWallet',
        userId: id,
        amountCents: -100000,
        reason: 'Remove abuse credit',
      }).success,
    ).toBe(true);
    for (const patch of [
      { amountCents: 0 },
      { amountCents: 100001 },
      { amountCents: 1.5 },
      { reason: ' ' },
      { reason: 'x'.repeat(201) },
    ]) {
      expect(
        WalletAdjustSchema.safeParse({
          csrf: 'x',
          action: 'adjustWallet',
          userId: id,
          amountCents: 500,
          reason: 'Goodwill',
          ...patch,
        }).success,
      ).toBe(false);
    }
  });

  const form = {
    csrf: 'x',
    name: 'Kai Rook',
    email: ' Kai@Example.com ',
    discord: 'kai#1',
    country: 'Austria',
    adult: true,
    game: 'val',
    rank: 'Immortal 1',
    region: 'EU',
    role: '',
    link: '',
    hours: '10–20',
    why: 'I like teaching.',
    svc: { duo: true, coach: false, social: false, gg: false },
  };
  it('accepts the /apply form and normalises the email', () => {
    const parsed = ApplicationSchema.safeParse(form);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe('kai@example.com');
  });
  it('explains the first problem in plain words', () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ adult: false }, 'You need to be 18 or older to apply.'],
      [{ email: 'nope' }, 'That email doesn’t look right.'],
      [
        { svc: { duo: false, coach: false, social: false, gg: false } },
        'Pick at least one service.',
      ],
      [{ name: 'K' }, 'Add your name.'],
    ];
    for (const [patch, message] of cases) {
      const parsed = ApplicationSchema.safeParse({ ...form, ...patch });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(applicationError(parsed.error)).toBe(message);
    }
  });
});

describe('admin RPC envelope', () => {
  const account = {
    json: (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status }),
  } as never;
  it('maps refusals to their HTTP status and message', async () => {
    const response = rpcResponse(
      account,
      { error: { code: 409, message: 'Busy.' } },
      null,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Busy.' });
  });
  it('treats transport errors as unavailable', () => {
    expect(rpcResponse(account, null, new Error('x')).status).toBe(503);
  });
  it('passes payloads through', async () => {
    const response = rpcResponse(account, { accounts: [] }, null);
    expect(response.status).toBe(200);
  });
});
