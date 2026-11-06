import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  characterLabel,
  checkRoleAndCharacter,
  isNoPreference,
  rolesFor,
} from '../../src/contracts/roles';
import {
  buildCheckout,
  CheckoutRequestSchema,
} from '../../src/server/payments/checkout';
import { openPost } from '../../src/server/discord/order-posts';

// The customer's role and coaching character (owner decisions 2026-11-06).
describe('role lists', () => {
  it('offers the approved roles, no-preference last', () => {
    expect(rolesFor('lol', 'duo2')).toEqual([
      'Top',
      'Jungle',
      'Mid',
      'ADC',
      'Support',
      'Fill',
    ]);
    expect(rolesFor('ow', 'duo1').at(-1)).toBe('Flex');
    expect(rolesFor('fc', 'clubs').at(-1)).toBe('Any');
    expect(isNoPreference('lol', 'duo2', 'Fill')).toBe(true);
    expect(isNoPreference('lol', 'duo2', 'Mid')).toBe(false);
  });

  it('asks nothing in games and modes without roles', () => {
    for (const [game, service] of [
      ['fn', 'duo1'],
      ['cod', 'duo1'],
      ['rl', 'duo1'],
      ['tft', 'duo1'],
      ['mc', 'duo1'],
      ['arc', 'duo1'],
      ['social', 'chat'],
      ['lol', 'arena'],
      ['lol', 'aram'],
      ['val', 'skirm'],
      ['cs2', 'wing'],
    ] as const)
      expect(rolesFor(game, service), `${game}/${service}`).toEqual([]);
  });

  it('asks for a character only on coaching in games with characters', () => {
    expect(characterLabel('lol', 'training')).toBe('Champion');
    expect(characterLabel('val', 'training')).toBe('Agent');
    expect(characterLabel('lol', 'duo')).toBe('');
    expect(characterLabel('cs2', 'training')).toBe('');
  });

  it('stores nothing for no preference or a blank character, refuses the rest', () => {
    expect(
      checkRoleAndCharacter('lol', 'champ', 'training', 'Fill', '  '),
    ).toEqual({ role: null, character: null });
    expect(
      checkRoleAndCharacter('lol', 'champ', 'training', 'Mid', ' Ahri '),
    ).toEqual({ role: 'Mid', character: 'Ahri' });
    expect(() =>
      checkRoleAndCharacter('lol', 'duo2', 'duo', 'Duelist', undefined),
    ).toThrow('role');
    expect(() =>
      checkRoleAndCharacter('lol', 'duo2', 'duo', undefined, 'Ahri'),
    ).toThrow('character');
  });
});

describe('checkout', () => {
  const request = {
    gameId: 'lol',
    serviceId: 'champ',
    units: 1,
    server: 'EUW',
    ign: 'Tester#1',
    useWallet: false,
  };
  it('puts the role and character on the checkout intent', () => {
    const built = buildCheckout(
      CheckoutRequestSchema.parse({
        ...request,
        role: 'Mid',
        character: 'Ahri',
      }),
      1.08,
    );
    expect(built.row).toMatchObject({ role: 'Mid', character_name: 'Ahri' });
  });
  it('sends no columns without a pick, and refuses a role from another game', () => {
    const built = buildCheckout(CheckoutRequestSchema.parse(request), 1.08);
    expect('role' in built.row || 'character_name' in built.row).toBe(false);
    expect(() =>
      buildCheckout(
        CheckoutRequestSchema.parse({ ...request, role: 'Duelist' }),
        1.08,
      ),
    ).toThrow('role');
  });
});

it('tells Discord the role and character, escaped', () => {
  const post = JSON.stringify(
    openPost(
      {
        reference: 'DL-1',
        game: 'lol',
        title: 'Champion Mastery',
        units: 1,
        unit: 'hour',
        rank: null,
        region: 'EUW',
        voice: false,
        gg: false,
        payoutUsdCents: 900,
        queuedAt: 0,
        cancelsAt: 300000,
        role: 'Mid',
        character: 'Ahri_*',
      },
      'https://duoly.gg/claim/x',
      { site: 'https://duoly.gg' },
    ),
  );
  expect(post).toContain('Plays Mid');
  expect(post).toContain('Coaching on Ahri\\\\_\\\\*');
});

it('keeps the new columns optional in the database', () => {
  const sql = readFileSync(
    'supabase/migrations/20261106190000_team_orders.sql',
    'utf8',
  );
  expect(sql).toMatch(/add column role text check \(role is null or/);
  expect(sql).toMatch(
    /add column character_name text check \(character_name is null or/,
  );
  expect(sql).toMatch(
    /'role', p_order\.role, 'character', p_order\.character_name/,
  );
});
