import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  BOILERPLATE_PARAGRAPH,
  BOILERPLATE_SENTENCE,
  FACT_SHEET,
  HAS_LAUNCH_DATE,
  LAUNCH_DATE,
  LOGO_ASSETS,
  LOGO_FILES,
  SOCIAL_IMAGE,
} from '../../src/server/seo/press';
import { ABOUT_STORY } from '../../src/content/about-story';
import { BUSINESS, BUSINESS_LOCATION } from '../../src/site/entity';
import { OFFICIAL_CHANNELS } from '../../src/site/seo';
import { SUPPORT_EMAIL } from '../../src/site/nav';
import { PRESS_EMAIL } from '../../src/site/press-contact';
import { SERVICE_COUNT } from '../../src/server/seo/booking';
import {
  COACHABLE_GAMES,
  COACHING_PRICE,
  PLAYABLE_GAMES,
  SHORT_GAME_PRICE,
} from '../../src/server/seo/teammate-facts';

/**
 * /press is written to be copied, so a wrong figure here ends up in somebody
 * else's article. These tests hold it to three rules: every number is derived,
 * every logo file really exists, and nothing Duoly cannot document appears at
 * all.
 */

const page = readFileSync('src/pages/press.astro', 'utf8');

describe('the Duoly boilerplate', () => {
  it('carries the facts an article needs, all derived', () => {
    for (const text of [BOILERPLATE_SENTENCE, BOILERPLATE_PARAGRAPH]) {
      expect(text).toContain('duoly.gg');
      expect(text).toContain('Austria');
    }
    expect(BOILERPLATE_SENTENCE).toContain(`${PLAYABLE_GAMES} games`);
    expect(BOILERPLATE_PARAGRAPH).toContain(`${PLAYABLE_GAMES} games`);
    expect(BOILERPLATE_PARAGRAPH).toContain('Austria and Switzerland');
    expect(BOILERPLATE_PARAGRAPH).toContain('own accounts');
    // Rates and operator details belong in the fact sheet, not in every description.
    expect(BOILERPLATE_PARAGRAPH).not.toContain('€');
  });

  it('is one sentence and one paragraph, with separate player accounts', () => {
    // One sentence: a terminal full stop and no sentence break inside it.
    // "duoly.gg" carries a dot of its own, so the test looks for a break
    // rather than for the character.
    expect(BOILERPLATE_SENTENCE.trim().endsWith('.')).toBe(true);
    expect(BOILERPLATE_SENTENCE.slice(0, -1)).not.toMatch(/[.!?]\s/);
    expect(BOILERPLATE_PARAGRAPH).toContain('Both play on their own accounts');
    expect(BOILERPLATE_PARAGRAPH).not.toContain('\n');
  });

  it('follows the customer copy rules', () => {
    for (const text of [BOILERPLATE_SENTENCE, BOILERPLATE_PARAGRAPH])
      expect(text).not.toMatch(/[–—]| & |not .*, but /i);
  });
});

describe('the Duoly fact sheet', () => {
  const values = new Map(FACT_SHEET);

  it('takes the operator rows from the published legal notice', () => {
    expect(values.get('Business name')).toBe(BUSINESS.legalName);
    expect(values.get('Legal form')).toBe(BUSINESS.legalForm);
    expect(values.get('Business location')).toBe(BUSINESS_LOCATION);
    expect(values.get('Legally represented by')).toBe(BUSINESS.representedBy);
    expect(values.get('Trade register')).toBe(`GISA ${BUSINESS.gisa}`);
    expect(values.get('Press contact')).toBe(PRESS_EMAIL);
  });

  it('takes the catalog rows from the catalog and the pricing engine', () => {
    expect(values.get('Games in the catalog')).toContain(
      String(PLAYABLE_GAMES),
    );
    expect(values.get('Bookable services')).toBe(String(SERVICE_COUNT));
    expect(values.get('Games with coaching')).toBe(String(COACHABLE_GAMES));
    expect(values.get('Lowest listed price')).toContain(SHORT_GAME_PRICE);
    expect(values.get('Coaching rate')).toContain(COACHING_PRICE);
  });

  it('has a unique label per row and no empty value', () => {
    expect(values.size).toBe(FACT_SHEET.length);
    for (const [label, value] of FACT_SHEET) {
      expect(label.length, label).toBeGreaterThan(2);
      expect(value.trim().length, label).toBeGreaterThan(0);
    }
  });

  it('names every official account Duoly really owns', () => {
    const row = values.get('Official channels');
    expect(row).toBeTruthy();
    for (const channel of OFFICIAL_CHANNELS)
      expect(row, channel.href).toContain(channel.label);
    expect(OFFICIAL_CHANNELS.map((channel) => channel.href)).toContain(
      'https://www.youtube.com/@duolygg',
    );
    expect(OFFICIAL_CHANNELS.map((channel) => channel.href)).toContain(
      'https://www.tiktok.com/@duolygg',
    );
    // The press page renders the same constant, so the list cannot drift.
    const page = readFileSync('src/pages/press.astro', 'utf8');
    expect(page).toContain('OFFICIAL_CHANNELS');
  });

  it('states no metric Duoly has not published', () => {
    // A counted claim, not the words themselves: "18 for customers and
    // teammates" is a rule, while "4,000 customers" is a metric nobody has
    // verified for publication.
    const counted =
      /\d[\d,.]*\s*(?:\+|k|m|million)?\s*(?:users|customers|players|sessions|orders|bookings|downloads|reviews|stars|ratings)\b/i;
    const forbidden =
      /\b(?:revenue|turnover|funding|raised|valuation|average rating|star rating)\b/i;
    for (const [label, value] of FACT_SHEET) {
      for (const text of [label, value]) {
        expect(text, label).not.toMatch(counted);
        expect(text, label).not.toMatch(forbidden);
      }
    }
  });
});

describe('the press address', () => {
  /**
   * Both addresses are the same inbox: every address at duoly.gg forwards to
   * the team (owner, 2026-11-09). So the rule these tests hold is about which
   * label the page offers to whom, not about a second mailbox existing.
   */
  it('is a duoly.gg address of its own, distinct from support', () => {
    expect(PRESS_EMAIL).toBe('press@duoly.gg');
    expect(PRESS_EMAIL.endsWith('@duoly.gg')).toBe(true);
    expect(PRESS_EMAIL).not.toBe(SUPPORT_EMAIL);
  });

  it('is the address every press enquiry on /press mails', () => {
    const mailtos = [...page.matchAll(/mailto:\$\{(\w+)\}/g)].map((m) => m[1]!);
    // Three press enquiry links: the hero call to action, the logo question and
    // the contact section. None of them may point at the support inbox.
    expect(mailtos.filter((name) => name === 'PRESS_EMAIL')).toHaveLength(3);
    expect(mailtos.filter((name) => name === 'SUPPORT_EMAIL')).toHaveLength(1);
    // No hand-typed address anywhere on the page, so changing either constant
    // changes every link and every visible line at once.
    expect(page).not.toMatch(/mailto:[a-z]/);
    expect(page).not.toContain('@duoly.gg');
  });

  it('names the support address too, so a customer is not misrouted', () => {
    expect(page).toContain('SUPPORT_EMAIL');
    expect(page).toMatch(/For help with a booking/);
  });

  it('promises no press office it does not have', () => {
    // Whitespace-tolerant: this reads the page source, where Prettier owns the
    // line breaks inside a paragraph, so a rewrap must not read as a promise
    // the page stopped making.
    expect(page).not.toMatch(/our press office|our agency/i);
  });
});

describe('the launch date', () => {
  /**
   * The owner has not published one, so the FAQ says so and points at the
   * trade licence. When `foundedOn` is filled in, this test is the one to
   * update in the same commit as the content.
   */
  it('is absent while the owner has not supplied one', () => {
    expect(ABOUT_STORY.foundedOn).toBeUndefined();
    expect(HAS_LAUNCH_DATE).toBe(false);
    expect(LAUNCH_DATE).toBeUndefined();
    expect(page).toMatch(/has not published a launch date/);
  });

  it('tells a journalist nothing about the code base', () => {
    // A commit date is not a founding date, and a customer-facing page has no
    // business discussing our git history.
    expect(page).not.toMatch(/first commit|code base|weeks rather than years/i);
  });

  it('is never guessed in the page copy', () => {
    // No "founded in", "launched in" or "since" with a year the site cannot
    // document. The only date the page states is the first commit.
    expect(page).not.toMatch(
      /(?:founded|launched|live since|since)\s+(?:in\s+)?20\d\d/i,
    );
  });
});

describe('the logo downloads', () => {
  it('offers files that exist in public/ and are not empty', () => {
    expect(LOGO_FILES.length).toBeGreaterThan(4);
    for (const href of [...LOGO_FILES, SOCIAL_IMAGE.href]) {
      expect(href.startsWith('/'), href).toBe(true);
      const file = `public${href}`;
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size, file).toBeGreaterThan(1000);
    }
  });

  it('labels each file with its real pixel size', () => {
    for (const asset of LOGO_ASSETS) {
      expect(asset.files.length, asset.name).toBeGreaterThan(0);
      // The preview is one of the downloads, so nothing is shown that cannot
      // be downloaded.
      expect(
        asset.files.map((file) => file.href),
        asset.name,
      ).toContain(asset.preview.href);
      for (const file of asset.files) {
        expect(file.pixels, file.href).toMatch(/^\d{2,4}x\d{2,4}$/);
        // A file named "WebP 560px" has to be 560 wide.
        const declared = file.label.match(/(\d{2,4})px/)?.[1];
        expect(declared, file.label).toBeTruthy();
        expect(file.pixels.split('x')[0], file.label).toBe(declared);
        expect(file.href.endsWith('.webp') || file.href.endsWith('.png')).toBe(
          true,
        );
      }
    }
  });

  it('offers no game art or publisher logo', () => {
    for (const href of LOGO_FILES) expect(href).not.toContain('/games/');
    expect(page).toMatch(/Game art and publisher logos\s+are not included/);
  });
});
