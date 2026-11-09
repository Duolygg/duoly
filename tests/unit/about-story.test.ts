import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { ABOUT_STORY } from '../../src/content/about-story';

const page = readFileSync('src/pages/about.astro', 'utf8');

/**
 * The owner-supplied parts of /about.
 *
 * The founder story, the named founders and the timeline cannot be derived from
 * the code, and a placeholder is worse than nothing here: the whole reason
 * /about exists is that assistants were repeating facts about Duoly that were
 * not true, so a live "coming soon" block would be the same failure in our own
 * voice. These tests hold the page to the rule: an empty list renders nothing,
 * and a filled entry carries its required fields.
 */
describe('the owner-supplied /about content', () => {
  it('renders each block only while its list has entries', () => {
    for (const [list, heading] of [
      ['story', 'story-h'],
      ['founders', 'founders-h'],
      ['milestones', 'timeline-h'],
    ] as const) {
      // The guard and the heading are in the same conditional expression, so a
      // section can only reach the markup with content behind it.
      const guard = new RegExp(
        `\\{${list}\\.length > 0 && \\(\\s*<section aria-labelledby="${heading}"`,
      );
      expect(page, list).toMatch(guard);
      expect(
        page.match(new RegExp(`id="${heading}"`, 'g')),
        heading,
      ).toHaveLength(1);
    }
  });

  it('ships empty, so nothing unverified is on the live page', () => {
    // When the owner fills this in, this expectation is the one to update, in
    // the same commit as the content.
    expect(ABOUT_STORY.story).toEqual([]);
    expect(ABOUT_STORY.founders).toEqual([]);
    expect(ABOUT_STORY.milestones).toEqual([]);
    expect(ABOUT_STORY.foundedOn).toBeUndefined();
  });

  it('documents every field the owner has to supply', () => {
    const source = readFileSync('src/content/about-story.ts', 'utf8');
    for (const field of [
      'story',
      'founders',
      'milestones',
      'foundedOn',
      'photo',
      'profile',
    ])
      expect(source, field).toContain(field);
    expect(source).toMatch(/WHAT THE OWNER HAS TO SUPPLY/);
  });

  it('requires a name, a role and a bio from any founder entry', () => {
    for (const person of ABOUT_STORY.founders) {
      for (const field of ['name', 'role', 'bio'] as const) {
        expect(typeof person[field], field).toBe('string');
        expect(
          person[field].trim().length,
          `${person.name} ${field}`,
        ).toBeGreaterThan(0);
      }
      // A bio is the gaming background, not a job title repeated.
      expect(person.bio.length).toBeGreaterThan(40);
      if (person.photo) expect(person.photo.alt.trim()).not.toBe('');
      if (person.profile) expect(person.profile).toMatch(/^https:\/\//);
    }
  });

  it('dates every milestone and keeps them oldest first', () => {
    const dates = ABOUT_STORY.milestones.map((milestone) => milestone.date);
    for (const date of dates) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dates).toEqual([...dates].sort());
    for (const milestone of ABOUT_STORY.milestones)
      expect(milestone.label.trim()).not.toBe('');
  });

  it('keeps a real founding date out of the markup until it exists', () => {
    if (ABOUT_STORY.foundedOn)
      expect(ABOUT_STORY.foundedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // No founding year may be written into the page by hand: it comes from the
    // constant above or it is absent (src/site/seo.ts, foundingDate).
    expect(page).not.toMatch(/founded in \d{4}|since \d{4}/i);
  });
});
