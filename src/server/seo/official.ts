/**
 * Structured data for the four owned "official" pages: /how-it-works,
 * /trust-and-safety, /pricing and /press.
 *
 * Kept out of src/site/seo.ts on purpose. That file is the site-wide entity
 * layer several branches edit at once, and these helpers are only ever read by
 * the pages below. Every node points at the one Organization published on the
 * homepage, so an assistant reading any of these pages lands on the same
 * company rather than inferring a second one with the same name.
 */

/** A WebPage node that belongs to the site and is published by Duoly. */
export function officialPageSchema(
  path: string,
  name: string,
  description: string,
  dateModified: string,
  site: URL,
  type = 'WebPage',
) {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    url: new URL(path, site).href,
    name,
    description,
    dateModified,
    isPartOf: { '@id': new URL('/#website', site).href },
    publisher: { '@id': new URL('/#organization', site).href },
  };
}

export interface HowToStep {
  readonly name: string;
  readonly text: string;
  /** The fragment on this page the step is written at. */
  readonly anchor: string;
}

/**
 * The HowTo node for /how-it-works.
 *
 * `estimatedCost` is deliberately absent: a Duoly total depends on the game,
 * the service and the customer's own rank, so a single cost on the procedure
 * would be a figure no reader could check. The prices stay in the copy, where
 * each one names its selection.
 */
export function howToSchema(
  path: string,
  name: string,
  description: string,
  steps: readonly HowToStep[],
  site: URL,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    url: new URL(path, site).href,
    publisher: { '@id': new URL('/#organization', site).href },
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      url: `${new URL(path, site).href}#${step.anchor}`,
    })),
  };
}
