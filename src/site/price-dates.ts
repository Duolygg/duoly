/**
 * The one day every page dates its prices to.
 *
 * Every price the site shows is rendered from the pricing engine
 * (calculateQuote, seoOffers and the price tokens built on them), so no page
 * knows anything about its figures that the catalog does not. The day beside
 * them therefore belongs to the catalog too, declared once here.
 *
 * It used to be per page, and #194 is what that cost: raising Duo Plus, Duo Pro
 * and Duo Apex moved the figure on about twenty pages while their hand-typed
 * "prices as of" day stayed on 2026-11-08, so each one showed today's price
 * under yesterday's date. A page may be vaguer than the catalog and never more
 * confident than it, and a date nobody has to remember to bump is the only
 * version of that rule which survives the next price change.
 *
 * So: change a catalog price, set this date in the same commit.
 * tests/unit/price-dates.test.ts proves the figures beside it really are the
 * engine's, which is the whole reason one date can speak for every page.
 */
export const CATALOG_PRICES_UPDATED = '2026-11-09';

/**
 * "9 November 2026": the prose form the SEO pages write dates in, derived so a
 * label can never disagree with the day it labels. UTC, because the catalog
 * changed on a calendar day rather than at a time of day.
 */
export const priceDateLabel = (date: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));

export const CATALOG_PRICES_UPDATED_LABEL = priceDateLabel(
  CATALOG_PRICES_UPDATED,
);
