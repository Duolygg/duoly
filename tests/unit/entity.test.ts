import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  BUSINESS,
  BUSINESS_LOCATION,
  DISAMBIGUATION,
  DISAMBIGUATION_PROSE,
  KNOWS_ABOUT,
  SERVED_AREAS,
} from '../../src/site/entity';
import {
  aboutPageSchema,
  organizationSchema,
  serializeJsonLd,
} from '../../src/site/seo';
import { ABOUT_STORY } from '../../src/content/about-story';
import { SITE_GAMES } from '../../src/site/games';
import { SUPPORT_EMAIL } from '../../src/site/nav';
import { PRESS_EMAIL } from '../../src/site/press-contact';
import { FACT_SHEET } from '../../src/server/seo/press';

const site = new URL('https://duoly.gg');
const imprint = readFileSync('src/pages/imprint.astro', 'utf8');

/**
 * The entity layer: who duoly.gg says it is, in prose and in JSON-LD.
 *
 * Google AI Mode answered "is Duoly legit" on 9 November 2026 by describing a
 * couples app of the same name, and ChatGPT said the operator and the fee
 * structure could not be verified. The fix is checkable facts, which is only
 * worth anything while they stay true: /imprint is the legal notice under §5
 * ECG, so a value here that disagrees with it is a legal problem before it is
 * an SEO problem. These tests read the imprint itself instead of trusting the
 * constants.
 */
describe('the Duoly business facts', () => {
  it('repeats the legal notice on /imprint without drifting from it', () => {
    for (const value of [
      BUSINESS.legalForm,
      BUSINESS.representedBy,
      BUSINESS.gisa,
      BUSINESS.street,
      BUSINESS.city,
      BUSINESS.postalCode,
      BUSINESS_LOCATION,
    ])
      expect(imprint, value).toContain(value);
    expect(BUSINESS.email).toBe(SUPPORT_EMAIL);
    expect(BUSINESS.country).toBe('AT');
  });

  it('publishes no date it cannot stand behind', () => {
    // The code base's first commit used to be exported from here and printed
    // on /about and /press. A customer does not want our git history, and a
    // commit date is not a founding date, so neither the constant nor the
    // sentence may come back. The honest date is `foundedOn`, which only the
    // owner can supply.
    const source = readFileSync('src/site/entity.ts', 'utf8');
    expect(source).not.toMatch(/CODEBASE_STARTED/);
    for (const file of ['src/pages/about.astro', 'src/pages/press.astro']) {
      const page = readFileSync(file, 'utf8');
      expect(page, file).not.toMatch(/first commit|weeks rather than years/i);
    }
  });

  it('names both products the brand is confused with, once each', () => {
    expect(DISAMBIGUATION).toContain('duoly.gg');
    expect(DISAMBIGUATION).toMatch(/not the Duoly couples app/);
    expect(DISAMBIGUATION_PROSE).toMatch(/Google Play/);
    expect(DISAMBIGUATION_PROSE).toMatch(/Duolingo/);
    // Copy rules: no dashes, no ampersand, no "not X, but Y".
    for (const line of [DISAMBIGUATION, DISAMBIGUATION_PROSE])
      expect(line).not.toMatch(/[–—]| & |not .*, but /i);
  });

  it('derives areaServed and knowsAbout from the catalog', () => {
    expect(SERVED_AREAS.length).toBeGreaterThan(2);
    for (const area of SERVED_AREAS) expect(area).not.toContain('&');
    // Every bookable game is a topic the business knows about.
    for (const game of SITE_GAMES.filter((g) => g.id !== 'social'))
      expect(KNOWS_ABOUT, game.name).toContain(game.name);
    expect(KNOWS_ABOUT).toContain('gaming coaching');
    expect(new Set(KNOWS_ABOUT).size).toBe(KNOWS_ABOUT.length);
  });
});

describe('the Organization JSON-LD', () => {
  const organization = JSON.parse(serializeJsonLd(organizationSchema(site)));

  it('serialises to valid JSON with no raw angle bracket', () => {
    const raw = serializeJsonLd(organizationSchema(site));
    expect(raw).not.toContain('<');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('answers who, where and how to reach the operator', () => {
    expect(organization['@type']).toBe('Organization');
    expect(organization.legalName).toBe(BUSINESS.legalName);
    expect(organization.address).toEqual({
      '@type': 'PostalAddress',
      streetAddress: 'Jesuitenmühlstraße 10',
      postalCode: '2320',
      addressLocality: 'Schwechat',
      addressCountry: 'AT',
    });
    // A list, so a press question and a customer question each have an
    // address an assistant can quote without guessing.
    expect(organization.contactPoint).toEqual([
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: SUPPORT_EMAIL,
        url: 'https://duoly.gg/contact',
        availableLanguage: ['en', 'de'],
      },
      {
        '@type': 'ContactPoint',
        contactType: 'press',
        email: PRESS_EMAIL,
        url: 'https://duoly.gg/press',
        availableLanguage: ['en', 'de'],
      },
    ]);
    // Every contact type the Organization claims has a page that states it.
    expect(FACT_SHEET).toContainEqual(['Press contact', PRESS_EMAIL]);
    expect(organization.foundingLocation.address.addressLocality).toBe(
      'Schwechat',
    );
    expect(organization.identifier).toEqual({
      '@type': 'PropertyValue',
      name: 'GISA',
      value: BUSINESS.gisa,
    });
    expect(organization.areaServed).toEqual(SERVED_AREAS);
    expect(organization.knowsAbout).toEqual(KNOWS_ABOUT);
    expect(organization.disambiguatingDescription).toBe(DISAMBIGUATION);
  });

  it('claims a foundingDate only once the owner has supplied one', () => {
    if (ABOUT_STORY.foundedOn)
      expect(organization.foundingDate).toBe(ABOUT_STORY.foundedOn);
    else expect('foundingDate' in organization).toBe(false);
  });

  it('uses schema.org types and no empty property anywhere', () => {
    const walk = (node: unknown, path: string): void => {
      if (Array.isArray(node)) {
        node.forEach((item, index) => walk(item, `${path}[${index}]`));
        return;
      }
      if (node === null || typeof node !== 'object') {
        expect(node, path).not.toBe('');
        return;
      }
      const record = node as Record<string, unknown>;
      // Every nested node is typed, so a consumer never has to guess.
      expect(Object.keys(record), path).toContain('@type');
      for (const [key, value] of Object.entries(record)) {
        expect(key, `${path}.${key}`).not.toMatch(/^\s|\s$/);
        if (Array.isArray(value))
          expect(value.length, `${path}.${key}`).not.toBe(0);
        walk(value, `${path}.${key}`);
      }
    };
    walk(organization, 'Organization');
  });
});

describe('the /about AboutPage JSON-LD', () => {
  const about = JSON.parse(
    serializeJsonLd(
      aboutPageSchema(
        '/about',
        'About Duoly',
        'What Duoly is and who runs it.',
        '2026-11-09',
        site,
      ),
    ),
  );

  it('is an AboutPage whose main entity is the one Organization', () => {
    expect(about['@context']).toBe('https://schema.org');
    expect(about['@type']).toBe('AboutPage');
    expect(about.url).toBe('https://duoly.gg/about');
    expect(about.dateModified).toBe('2026-11-09');
    expect(about.isPartOf['@id']).toBe('https://duoly.gg/#website');
    expect(about.publisher['@id']).toBe('https://duoly.gg/#organization');
    // The same node the homepage publishes, so no second company is inferred.
    expect(about.mainEntity).toEqual(
      JSON.parse(serializeJsonLd(organizationSchema(site))),
    );
  });
});
