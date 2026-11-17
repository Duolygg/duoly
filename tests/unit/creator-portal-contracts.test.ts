import { describe, expect, it } from 'vitest';
import {
  CREATOR_APPLY_COOLDOWN_DAYS,
  CREATOR_AUDIENCES,
  CREATOR_HOLD_DAYS,
  CREATOR_PAYOUT_METHODS,
  CREATOR_PLATFORMS,
  CREATOR_RANGES,
  CreatorApplySchema,
  CreatorCodeCheckSchema,
  CreatorPayoutDetailsSchema,
  CreatorPortalRangeSchema,
  creatorPayoutProgress,
  creatorRefLink,
  creatorShortLink,
  creatorTierFor,
  nextCreatorPayoutDate,
  nextCreatorTier,
} from '../../src/contracts/creator-portal';
import { CREATOR_RULES } from '../../src/contracts/creators';
import {
  CREATOR_TERMS,
  CREATOR_TERMS_VERSION,
  CREATOR_RULE_LINES,
} from '../../src/content/creator-terms';
import { streamKit } from '../../src/content/creator-kit';

const csrf = 'csrf-token';
const application = {
  csrf,
  name: 'Alex Rivera',
  email: 'alex@example.com',
  platform: 'Twitch',
  channel: 'twitch.tv/alexrivera',
  audience: '1K to 10K',
  game: 'lol',
  country: 'Austria',
  code: 'ALEX10',
  message: 'I stream ranked every evening.',
  adult: true,
  terms: CREATOR_TERMS_VERSION,
  website: '',
};

describe('creator application contract', () => {
  it('accepts a complete application and normalises the code', () => {
    const parsed = CreatorApplySchema.safeParse({
      ...application,
      code: ' alex10 ',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.code).toBe('ALEX10');
  });
  it('requires the age confirmation, the current terms and a usable code', () => {
    for (const bad of [
      { adult: false },
      { adult: 'yes' },
      { terms: '1999-01-01' },
      { terms: '' },
      { code: 'AB' },
      { code: 'A'.repeat(21) },
      { code: 'bad code' },
      { code: 'ALEX-10' },
      { email: 'not-an-email' },
      { channel: '' },
      { country: 'A' },
      { platform: 'MySpace' },
      { audience: 'lots' },
      { game: 'chess' },
      { name: 'A' },
      { message: 'x'.repeat(1201) },
      { extra: true },
    ] as Record<string, unknown>[])
      expect(
        CreatorApplySchema.safeParse({ ...application, ...bad }).success,
        JSON.stringify(bad),
      ).toBe(false);
  });
  it('keeps the message and the honeypot optional', () => {
    const { message, website, ...rest } = application;
    void message;
    void website;
    expect(CreatorApplySchema.safeParse(rest).success).toBe(true);
  });
  it('checks one code at a time', () => {
    expect(
      CreatorCodeCheckSchema.safeParse({ csrf, code: 'alex10' }).success,
    ).toBe(true);
    for (const bad of [{ code: 'no' }, { code: 'x y' }, {}])
      expect(CreatorCodeCheckSchema.safeParse({ csrf, ...bad }).success).toBe(
        false,
      );
  });
  it('offers the platforms, audiences and ranges the form shows', () => {
    expect(CREATOR_PLATFORMS).toEqual([
      'Twitch',
      'YouTube',
      'TikTok',
      'Kick',
      'Instagram',
      'Other',
    ]);
    expect(CREATOR_AUDIENCES).toEqual([
      'Under 1K',
      '1K to 10K',
      '10K to 100K',
      '100K+',
    ]);
    expect(CREATOR_RANGES).toEqual(['7d', '30d', 'all']);
    expect(CreatorPortalRangeSchema.safeParse('30d').success).toBe(true);
    expect(CreatorPortalRangeSchema.safeParse('90d').success).toBe(false);
  });
});

describe('creator payout details contract', () => {
  const details = {
    csrf,
    legalName: 'Alex Rivera',
    address: 'Hauptstrasse 1, 1010 Vienna',
    country: 'Austria',
    method: 'wise' as const,
    account: 'alex@example.com',
    business: false,
    vatId: '',
    selfBilling: true,
  };
  it('accepts the same rails as the teammate payout rail', () => {
    expect(CREATOR_PAYOUT_METHODS).toEqual([
      'bank',
      'wise',
      'paypal',
      'payoneer',
    ]);
    expect(CreatorPayoutDetailsSchema.safeParse(details).success).toBe(true);
    expect(
      CreatorPayoutDetailsSchema.safeParse({
        ...details,
        business: true,
        vatId: 'ATU12345678',
      }).success,
    ).toBe(true);
  });
  it('needs the self billing agreement and refuses unknown rails', () => {
    for (const bad of [
      { selfBilling: false },
      { method: 'crypto' },
      { account: 'ab' },
      { legalName: 'A' },
      { address: 'x' },
      { country: '' },
      { vatId: 'x'.repeat(21) },
      { iban: 'AT00' },
    ] as Record<string, unknown>[])
      expect(
        CreatorPayoutDetailsSchema.safeParse({ ...details, ...bad }).success,
        JSON.stringify(bad),
      ).toBe(false);
  });
});

describe('creator portal numbers match the published rules', () => {
  it('reads tiers from the one rules module', () => {
    expect(creatorTierFor(0)).toMatchObject({ id: 'rising', commission: 8 });
    expect(creatorTierFor(24)).toMatchObject({ id: 'rising', commission: 8 });
    expect(creatorTierFor(25)).toMatchObject({ id: 'partner', commission: 10 });
    expect(creatorTierFor(99)).toMatchObject({ id: 'partner', commission: 10 });
    expect(creatorTierFor(100)).toMatchObject({ id: 'elite', commission: 12 });
    expect(creatorTierFor(5000)).toMatchObject({ id: 'elite', commission: 12 });
  });
  it('shows the way to the next tier, and nothing above Elite', () => {
    expect(nextCreatorTier(0)).toEqual({
      name: 'Partner',
      at: 25,
      remaining: 25,
      percent: 0,
    });
    expect(nextCreatorTier(20)).toEqual({
      name: 'Partner',
      at: 25,
      remaining: 5,
      percent: 80,
    });
    expect(nextCreatorTier(50)).toEqual({
      name: 'Elite',
      at: 100,
      remaining: 50,
      percent: 33,
    });
    expect(nextCreatorTier(100)).toBeNull();
  });
  it('tracks the way to the EUR 50 payout threshold', () => {
    expect(creatorPayoutProgress(0)).toEqual({
      percent: 0,
      remainingCents: 5000,
      reached: false,
    });
    expect(creatorPayoutProgress(2500)).toEqual({
      percent: 50,
      remainingCents: 2500,
      reached: false,
    });
    expect(creatorPayoutProgress(5000)).toEqual({
      percent: 100,
      remainingCents: 0,
      reached: true,
    });
    expect(creatorPayoutProgress(9900)).toEqual({
      percent: 100,
      remainingCents: 0,
      reached: true,
    });
    expect(CREATOR_RULES.payoutMinEur).toBe(50);
  });
  it('names the first of the next month as the next payout date', () => {
    expect(nextCreatorPayoutDate(Date.parse('2026-11-17T10:00:00Z'))).toBe(
      '2026-12-01',
    );
    expect(nextCreatorPayoutDate(Date.parse('2026-12-31T23:30:00Z'))).toBe(
      '2027-01-01',
    );
    expect(nextCreatorPayoutDate(Date.parse('2026-12-01T00:00:00Z'))).toBe(
      '2027-01-01',
    );
  });
  it('builds both links from one code', () => {
    expect(creatorShortLink('ALEX10')).toBe('https://duoly.gg/alex10');
    expect(creatorShortLink('ALEX10', 'http://localhost:4321')).toBe(
      'http://localhost:4321/alex10',
    );
    expect(creatorRefLink('ALEX10')).toBe('https://duoly.gg/?ref=ALEX10');
  });
  it('holds completed orders for 30 days', () => {
    expect(CREATOR_HOLD_DAYS).toBe(30);
    expect(CREATOR_APPLY_COOLDOWN_DAYS).toBe(30);
  });
});

describe('published terms and the rules box', () => {
  it('has a dated version and plain sections', () => {
    expect(CREATOR_TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(CREATOR_TERMS.length).toBeGreaterThan(5);
    for (const section of CREATOR_TERMS) {
      expect(section.title.length).toBeGreaterThan(2);
      expect(section.text.length).toBeGreaterThan(20);
    }
  });
  it('states every number the dashboard promises', () => {
    const all = CREATOR_RULE_LINES.join(' ');
    for (const fact of [
      '10%',
      '8%',
      '10%',
      '12%',
      '12 months',
      '30 days',
      '50',
    ])
      expect(all, fact).toContain(fact);
    for (const banned of ['self-referral', 'coupon', 'paid search', 'spam'])
      expect(all.toLowerCase(), banned).toContain(banned);
  });
});

describe('stream kit', () => {
  const kit = streamKit('ALEX10');
  it('builds chat commands with the creator code and short link', () => {
    expect(kit.nightbot).toBe(
      '!commands add !duoly Ad: 10% off your first Duoly order with code ALEX10: https://duoly.gg/alex10',
    );
    expect(kit.streamElements).toBe(
      '!command add !duoly Ad: 10% off your first Duoly order with code ALEX10: https://duoly.gg/alex10',
    );
    expect(kit.panel).toContain('ALEX10');
    expect(kit.panel).toContain('duoly.gg/alex10');
    expect(kit.linkInBio).toContain('duoly.gg/alex10');
  });
  it('carries both disclosure templates', () => {
    expect(kit.disclosures.map((entry) => entry.language)).toEqual([
      'English',
      'Deutsch',
    ]);
    expect(kit.disclosures[1]!.text).toBe(
      'Werbung für Duoly. Mit meinem Code erhältst du 10% auf deine erste Bestellung; ich erhalte eine Provision.',
    );
    expect(kit.disclosures[0]!.text).toContain('commission');
  });
  it('points at brand files that exist', () => {
    expect(kit.assets.length).toBeGreaterThan(1);
    for (const asset of kit.assets)
      expect(asset.href).toMatch(/^\/assets\/brand\/[\w-]+\.webp$/);
  });
  it('writes copy without dashes or ampersands', () => {
    const copy = [
      kit.nightbot,
      kit.streamElements,
      kit.panel,
      kit.linkInBio,
      ...kit.disclosures.map((entry) => entry.text),
      ...CREATOR_RULE_LINES,
      ...CREATOR_TERMS.flatMap((section) => [section.title, section.text]),
    ].join(' ');
    expect(copy).not.toMatch(/[–—&]/);
  });
});
