import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LanguagePicker from '../../src/components/account/LanguagePicker';
import {
  LANGUAGES_SUGGESTED,
  PROFILE_LANGUAGE_DETAIL,
} from '../../src/contracts/profile-languages';
import { LANGUAGES_MAX, PROFILE_LANGUAGES } from '../../src/contracts/account';

const render = (value: string[]) =>
  renderToStaticMarkup(
    createElement(LanguagePicker, {
      value,
      allowed: PROFILE_LANGUAGES,
      onChange: () => {},
    }),
  );

describe('the languages catalog', () => {
  /* The id on the wire does not change: it is the English name the endpoint already accepts. */
  it('describes exactly the languages the endpoint accepts', () => {
    expect(PROFILE_LANGUAGE_DETAIL.map((l) => l.id).sort()).toEqual(
      [...PROFILE_LANGUAGES].sort(),
    );
  });
  it('comes in suggested order, English first, with no two sharing a place', () => {
    const order = PROFILE_LANGUAGE_DETAIL.map((l) => l.suggested);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(order.length);
    expect(PROFILE_LANGUAGE_DETAIL[0]!.id).toBe('English');
    expect(
      PROFILE_LANGUAGE_DETAIL.slice(0, LANGUAGES_SUGGESTED).map((l) => l.id),
    ).toEqual([
      'English',
      'German',
      'French',
      'Dutch',
      'Polish',
      'Spanish',
      'Italian',
      'Swedish',
      'Danish',
      'Norwegian',
    ]);
  });
  it('carries an endonym and a two letter code for each, and no flag', () => {
    for (const language of PROFILE_LANGUAGE_DETAIL) {
      expect(language.endonym.length, language.id).toBeGreaterThan(0);
      expect(language.code, language.id).toMatch(/^[A-Z]{2}$/);
    }
    expect(JSON.stringify(PROFILE_LANGUAGE_DETAIL)).not.toMatch(/flag/i);
    /* A language code is not a country code: cs is not cz, el is not gr, ja is not jp. */
    expect(PROFILE_LANGUAGE_DETAIL.find((l) => l.id === 'Czech')!.code).toBe(
      'CS',
    );
    expect(PROFILE_LANGUAGE_DETAIL.find((l) => l.id === 'Greek')!.code).toBe(
      'EL',
    );
    expect(PROFILE_LANGUAGE_DETAIL.find((l) => l.id === 'Japanese')!.code).toBe(
      'JA',
    );
  });
});

describe('the languages field', () => {
  it('invites a teammate with none, and never calls it a main language', () => {
    const html = render([]);
    expect(html).toContain('Choose your languages');
    expect(html).toContain(
      'The first three show on your card in the directory.',
    );
    expect(html).not.toMatch(/native|main language|primary/i);
  });
  /* Order is stored and the directory card shows the first three, so "Shown first" is a fact
     about the card rather than a claim about the teammate. */
  it('marks the first chip Shown first and offers the move to the rest', () => {
    const html = render(['German', 'English', 'Polish']);
    expect(html.indexOf('Shown first')).toBeGreaterThan(-1);
    expect(html.match(/Shown first/g)).toHaveLength(1);
    expect(html.match(/Show first<\/button>/g)).toHaveLength(2);
    expect(html.indexOf('German')).toBeLessThan(html.indexOf('English'));
    expect(html).toContain('data-first="true"');
    expect(html.match(/data-first="true"/g)).toHaveLength(1);
  });
  it('shows the code beside the name and names every remove button', () => {
    const html = render(['German', 'Japanese']);
    expect(html).toContain('>DE<');
    expect(html).toContain('>JA<');
    expect(html).toContain('Remove German');
    expect(html).toContain('Remove Japanese');
  });
  it('says what to do at the cap instead of leaving a dead Add button', () => {
    const six = PROFILE_LANGUAGES.slice(
      0,
      LANGUAGES_MAX,
    ) as unknown as string[];
    const html = render(six);
    expect(html).toContain('That is all six. Remove one to add another.');
    const five = render(six.slice(0, 5));
    expect(five).toContain('Add a language');
    expect(five).not.toContain('Remove one to add another.');
  });
  it('keeps the copy free of em dashes, en dashes and ampersands', () => {
    for (const html of [render([]), render(['German', 'English'])])
      expect(html.replace(/&#x27;|&quot;|&amp;|&#x2F;/g, '')).not.toMatch(
        /[–—&]/,
      );
  });
});
