import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  ALT_METHODS,
  CARD_BRANDS,
  CARD_WALLETS,
  CATALOG_GAMES,
  FREE_REROLLS,
  LOCAL_METHODS,
  MAX_TEAMMATES,
  MOODS,
  PAYMENT_PROVIDER,
  PROOF_MAX,
  PROOF_MIN,
  QUANTITY_STEPS,
  REROLL_MINUTES,
  REVIEW_STAGES,
  SERVICE_COUNT,
  TEAMMATE_MIN_RANKS,
} from '../../src/server/seo/booking';
import { ORDER_MOODS } from '../../src/contracts/orders';
import { MAX_SEATS } from '../../src/contracts/seats';
import { QUANTITIES } from '../../src/contracts/pricing';
import { CompletionInputSchema } from '../../src/contracts/completion';
import { SITE_GAMES } from '../../src/site/games';
import { servicesFor } from '../../src/design-reference/lib/catalog.js';

/**
 * /how-it-works and /trust-and-safety describe how a booking runs, so every
 * fact they print has to come out of the code that runs it. This suite is the
 * link: each constant is re-derived from its contract, or matched against the
 * component that implements the step. A flow change fails here rather than
 * leaving a published page describing last month's product.
 */

const read = (path: string) => readFileSync(path, 'utf8');
const APPLY = 'src/design-reference/components/Apply.jsx';
const QUEUE_ROOM = 'src/components/account/queue-room-data.js';
const MATCH_STAGE = 'src/components/account/MatchStage.jsx';
const PAYMENT_STRIP = 'src/components/home/PaymentMethods.jsx';
const CONFIRM_EMAIL = 'src/server/payments/confirm-email.ts';

describe('the selections a booking asks for', () => {
  it('takes the quantity steps, seats and moods from their contracts', () => {
    expect(QUANTITY_STEPS).toEqual([...QUANTITIES]);
    expect(MAX_TEAMMATES).toBe(MAX_SEATS);
    expect(MOODS).toEqual([...ORDER_MOODS]);
  });

  it('counts games and services from the catalog rather than claiming them', () => {
    expect(CATALOG_GAMES).toBe(SITE_GAMES.length);
    const counted = SITE_GAMES.reduce(
      (total, game) =>
        total +
        ((servicesFor(game.id) as { modes?: unknown[] }).modes ?? []).length,
      0,
    );
    expect(SERVICE_COUNT).toBe(counted);
    // A catalog this small would mean the count broke rather than shrank.
    expect(SERVICE_COUNT).toBeGreaterThan(100);
  });
});

describe('the completion proof limits', () => {
  const base = {
    order_id: '00000000-0000-4000-8000-000000000001',
    assignment_id: '00000000-0000-4000-8000-000000000002',
    request_id: '00000000-0000-4000-8000-000000000003',
  };
  const proofs = (count: number) =>
    Array.from(
      { length: count },
      (_, index) =>
        `00000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`,
    );

  it('are the ones the completion contract enforces', () => {
    expect(
      CompletionInputSchema.safeParse({ ...base, proof_ids: proofs(PROOF_MIN) })
        .success,
    ).toBe(true);
    expect(
      CompletionInputSchema.safeParse({ ...base, proof_ids: proofs(PROOF_MAX) })
        .success,
    ).toBe(true);
    // One either side of the published range has to be rejected, which is what
    // makes "1 to 5 screenshots" a derived claim rather than a remembered one.
    expect(
      CompletionInputSchema.safeParse({
        ...base,
        proof_ids: proofs(PROOF_MIN - 1),
      }).success,
    ).toBe(false);
    expect(
      CompletionInputSchema.safeParse({
        ...base,
        proof_ids: proofs(PROOF_MAX + 1),
      }).success,
    ).toBe(false);
  });
});

describe('the re-roll window', () => {
  it('matches the order room that implements it', () => {
    const room = read(QUEUE_ROOM);
    expect(room).toContain(`const MAX_REROLLS = ${FREE_REROLLS}`);
    expect(room).toContain(
      `const REROLL_WINDOW_MS = ${REROLL_MINUTES} * 60 * 1000`,
    );
    // The customer-facing sentence names the same window.
    expect(read(MATCH_STAGE)).toContain(
      `for free in the first ${REROLL_MINUTES} minutes`,
    );
  });
});

describe('the payment methods a page may name', () => {
  const strip = read(PAYMENT_STRIP);
  const labels = read(CONFIRM_EMAIL);

  it('names Stripe as the provider the terms and privacy policy describe', () => {
    expect(PAYMENT_PROVIDER).toBe('Stripe');
  });

  it.each([...CARD_BRANDS, ...CARD_WALLETS, ...ALT_METHODS, ...LOCAL_METHODS])(
    'offers %s on the homepage strip',
    (method) => {
      expect(strip).toContain(`'${method}'`);
    },
  );

  /**
   * Card brands reach a Duoly page through the single `card` method, so the
   * confirmation labels name "Card" rather than Visa. Everything else has to be
   * a method the webhook can label, or the order confirmation would show
   * "Online payment" for something a public page promised by name.
   */
  it.each([...ALT_METHODS, ...LOCAL_METHODS])(
    'is a method the order confirmation can label: %s',
    (method) => {
      expect(labels).toContain(`'${method}'`);
    },
  );

  /**
   * Visa, Apple Pay and Google Pay all arrive as Stripe's `card` method, so the
   * confirmation says "Card". A page may name them as things a customer can
   * tap; it may not imply the receipt will name them back.
   */
  it('keeps the card brands and card wallets behind the one card method', () => {
    expect(labels).toContain("card: 'Card'");
    for (const brand of [...CARD_BRANDS, ...CARD_WALLETS])
      expect(labels).not.toContain(brand);
  });
});

describe('the teammate review a trust page describes', () => {
  const apply = read(APPLY);

  it('names the four stages the apply timeline shows', () => {
    expect(REVIEW_STAGES).toHaveLength(4);
    for (const [label] of REVIEW_STAGES) expect(apply).toContain(label);
    expect(apply).toContain('From application to first payout');
  });

  it('asks for every field the trust page says it asks for', () => {
    // The form's own labels, so the page cannot list a field that was removed.
    for (const label of [
      'Display name',
      'Email',
      'Discord username',
      'Country',
      'Current rank',
      'Server / region',
    ])
      expect(apply, label).toContain(label);
    expect(apply).toContain('I’m 18 or older and I play on my own account');
    // The intro video is required rather than suggested: step 2 cannot pass
    // without a YouTube link the form can parse.
    expect(apply).toContain('const step2ok = f.rank && f.region && videoOk');
  });

  it('publishes the minimum rank each named game really asks for', () => {
    const minimums: Record<string, string> = {
      'League of Legends': "lol: { ranks: [...div('Diamond', [4, 3, 2, 1])",
      Valorant: "val: { ranks: [...div('Ascendant', [1, 2, 3])",
      'Counter-Strike 2': "min: 'Premier 15,000+ or FACEIT Level 8+'",
    };
    expect(TEAMMATE_MIN_RANKS.map(([game]) => game)).toEqual(
      Object.keys(minimums),
    );
    for (const [game, source] of Object.entries(minimums))
      expect(apply, game).toContain(source);
    // The rank picker offers the minimum first, which is what "or higher"
    // means on the page.
    expect(apply).toContain("NEEDS[x.id].ranks[0] + ' or higher'");
    expect(TEAMMATE_MIN_RANKS).toEqual([
      ['League of Legends', 'Diamond 4 or higher'],
      ['Valorant', 'Ascendant 1 or higher'],
      ['Counter-Strike 2', 'Premier 15,000+ or FACEIT Level 8+'],
    ]);
  });
});
