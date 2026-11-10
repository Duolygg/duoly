import { describe, expect, it } from 'vitest';
import { renderLlmsFull } from '../../src/server/seo/llms-full';
import { renderLlms } from '../../src/server/seo/llms';
import { GET, prerender } from '../../src/pages/llms-full.txt';
import { CATALOG_PRICES_UPDATED_LABEL } from '../../src/site/price-dates';
import { COACHING_PRICE } from '../../src/server/seo/teammate-facts';
import { intentPages, intentPath } from '../../src/content/intent-pages';
import { FINISHED_HUB_SLUGS } from '../../src/content/hub-pages';
import { COACHING_SLUGS, INDEXABLE_PATHS } from '../../src/site/seo';
import { REPORT_CSV_PATH, REPORT_PATH } from '../../src/site/seo';
import {
  HOURLY_COACHING,
  OBSERVATION_COUNT,
} from '../../src/server/seo/price-report';
import { SURVEY_CHECKED } from '../../src/content/price-report-2026';

/**
 * /llms-full.txt is generated, so the test's job is not to restate its prose.
 * It checks the three things that make the file worth serving: it builds, every
 * number in it came from the engine and the registries rather than from a
 * second copy, and it still points at the pages it summarises.
 */
describe('llms-full.txt', () => {
  const text = renderLlmsFull();

  it('builds and dates its prices to the catalog', () => {
    expect(text.startsWith('# Duoly: full text')).toBe(true);
    // The requirement this file exists for: the catalog's own price date, so a
    // reader knows how fresh every figure below it is.
    expect(text).toContain(CATALOG_PRICES_UPDATED_LABEL);
    expect(text).toContain(`Price survey read on ${SURVEY_CHECKED}`);
    expect(text).toContain(COACHING_PRICE);
    expect(text).toContain('## The complete price list');
    expect(text).toContain('## How a booking runs');
    expect(text).toContain('## What a customer pays');
    // Big, because it is the whole corpus; capped, so a loop cannot run away.
    const bytes = new TextEncoder().encode(text).byteLength;
    expect(bytes).toBeGreaterThan(100_000);
    expect(bytes).toBeLessThan(900_000);
  });

  it('opens with the same site guide llms.txt publishes', () => {
    // Everything under the llms.txt title, so a page added to one file reaches
    // the other with no second edit.
    const body = renderLlms().split('\n').slice(3).join('\n');
    expect(text).toContain(body);
    expect(renderLlms()).toContain('https://duoly.gg/llms-full.txt');
  });

  it('carries the price survey findings and the dataset link', () => {
    expect(text).toContain(HOURLY_COACHING.median);
    expect(text).toContain(HOURLY_COACHING.medianEur);
    expect(text).toContain(`${OBSERVATION_COUNT} prices`);
    expect(text).toContain(`https://duoly.gg${REPORT_PATH}`);
    expect(text).toContain(`https://duoly.gg${REPORT_CSV_PATH}`);
  });

  it('writes out every indexable game, coaching and teammate page', () => {
    for (const slug of FINISHED_HUB_SLUGS.filter((entry) =>
      INDEXABLE_PATHS.includes(`/games/${entry}`),
    ))
      expect(text).toContain(`https://duoly.gg/games/${slug}`);
    for (const slug of COACHING_SLUGS.filter((entry) =>
      INDEXABLE_PATHS.includes(`/games/${entry}/coaching`),
    ))
      expect(text).toContain(`https://duoly.gg/games/${slug}/coaching`);
    for (const page of intentPages.filter((entry) =>
      INDEXABLE_PATHS.includes(intentPath(entry)),
    ))
      expect(text).toContain(`https://duoly.gg${intentPath(page)}`);
    // Pages whose prose is composed in the template are named with their URL
    // rather than copied, and the file says so.
    expect(text).toContain('https://duoly.gg/how-it-works');
    expect(text).toContain('https://duoly.gg/trust-and-safety');
    expect(text).toContain('https://duoly.gg/press');
  });

  it('fills every price token and keeps the customer copy rules', () => {
    expect(text).not.toMatch(/\{\{\w+\}\}/);
    expect(text).not.toMatch(/[–—]/);
    expect(text).not.toMatch(/ & /);
  });

  it('prerenders a plain-text response with static cache headers', async () => {
    expect(prerender).toBe(true);
    const response = await GET({} as Parameters<typeof GET>[0]);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(
      'text/plain; charset=utf-8',
    );
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(await response.text()).toBe(text);
  });
});
