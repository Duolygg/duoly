import { describe, expect, it } from 'vitest';
import { plainLegal, plainLegalText } from '../../src/site/legal-copy';
import { TERMS } from '../../src/design-reference/lib/legal';
import { LIVE_PRIVACY } from '../../src/site/privacy';

/** Every string in a document, so a rule can be checked over the whole page. */
function strings(value: unknown, into: string[] = []): string[] {
  if (typeof value === 'string') into.push(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, into);
  else if (value && typeof value === 'object')
    for (const item of Object.values(value)) strings(item, into);
  return into;
}

describe('legal copy rules', () => {
  it('writes "and" instead of an ampersand, and a hyphen instead of a dash', () => {
    expect(plainLegalText('Prices & payment')).toBe('Prices and payment');
    expect(plainLegalText('the EU–US Data Privacy Framework')).toBe(
      'the EU-US Data Privacy Framework',
    );
    /* An ampersand without spaces is a query string, not prose. */
    expect(plainLegalText('/contact?topic=privacy&order=1')).toBe(
      '/contact?topic=privacy&order=1',
    );
  });

  it('leaves the terms and privacy documents with no ampersand and no dash', () => {
    for (const [name, doc] of [
      ['terms', TERMS],
      ['privacy', LIVE_PRIVACY],
    ] as const) {
      /* The protected source is what the rule exists for: if these stop
         carrying violations, the pass is a no-op and can go. */
      expect(
        strings(doc).some((text) => / & /.test(text) || /[–—]/.test(text)),
        `${name} source`,
      ).toBe(true);
      for (const text of strings(plainLegal(doc))) {
        expect(text, `${name}: ${text}`).not.toMatch(/ & /);
        expect(text, `${name}: ${text}`).not.toMatch(/[–—]/);
      }
    }
  });

  it('keeps every section id, so the links into the documents still land', () => {
    for (const doc of [TERMS, LIVE_PRIVACY]) {
      const ids = (s: typeof doc) =>
        (s.sections as { id: string }[]).map((section) => section.id);
      expect(ids(plainLegal(doc))).toEqual(ids(doc));
    }
  });

  it('changes punctuation only, so no clause is added or dropped', () => {
    for (const doc of [TERMS, LIVE_PRIVACY]) {
      const before = strings(doc);
      const after = strings(plainLegal(doc));
      expect(after).toHaveLength(before.length);
      /* Same text once the two punctuation rules are applied to both sides. */
      expect(after).toEqual(before.map(plainLegalText));
    }
  });
});
