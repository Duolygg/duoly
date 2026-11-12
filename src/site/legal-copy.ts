/**
 * Copy-rule pass over the legal documents.
 *
 * /terms and /privacy render from the protected design reference
 * (src/design-reference/lib/legal.js), which writes six section titles with an
 * ampersand ("Prices & payment", "Cancellations & refunds"), one more in the
 * privacy rights table, and an en dash in "EU–US Data Privacy Framework". The
 * customer copy rules allow neither, and the page quality audit of 12 November
 * 2026 found them as the only copy-rule violations left on the site outside the
 * homepage.
 *
 * The reference file cannot be edited, so the pages normalise what they render,
 * the same way src/site/privacy.ts already overrides statements that went out of
 * date. This pass changes punctuation and nothing else: no clause is added,
 * removed or reworded, so the legal meaning is untouched.
 *
 * Section ids are never rewritten, so every /terms#payment style link in the
 * copy, the on-this-page list and the footer keeps working.
 */

/** " & " -> " and ", and an en or em dash inside a name -> a hyphen. */
export function plainLegalText(text: string): string {
  return text.replace(/ & /g, ' and ').replace(/[–—]/g, '-');
}

/**
 * The same pass over every string in a legal document, at any depth: section
 * titles, paragraph blocks, summary cards, list items and table cells. Keys are
 * left alone, so `id`, `slug` and `icon` values that happen to be strings are
 * rewritten only in the sense that none of them contains " & " or a dash.
 */
export function plainLegal<T>(value: T): T {
  if (typeof value === 'string') return plainLegalText(value) as T;
  if (Array.isArray(value)) return value.map((item) => plainLegal(item)) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        // An id is a link target, never prose: /terms#payment has to keep
        // pointing at the section the copy and the footer link to.
        key === 'id' || key === 'slug' ? item : plainLegal(item),
      ]),
    ) as T;
  return value;
}
