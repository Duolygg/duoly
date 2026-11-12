import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReviewForm } from '../../src/components/account/MatchStage.jsx';

/*
 * Public profiles can carry a rating and the words of a review, never the name of who wrote
 * them (plan section 9). The customer is told before they press send, and only once profiles
 * are actually live: 20261112130000 sets the review text cutoff to its own apply time, so
 * everything written before this notice existed stays private.
 */
const h = React.createElement;
const rv = {
  rating: 5,
  hover: 0,
  tags: [],
  text: '',
  tip: 0,
  custom: '',
  err: '',
};
const form = (profiles: boolean) =>
  renderToStaticMarkup(
    h(ReviewForm, {
      name: 'Mia',
      sym: '€',
      rv,
      busy: false,
      tips: true,
      profiles,
      onEdit: () => {},
      onSend: () => {},
    }),
  );

describe('the review form notice', () => {
  it('names the teammate and promises the reviewer stays anonymous', () => {
    expect(form(true)).toContain(
      'Your rating and review may appear on Mia’s public profile, without your name.',
    );
  });
  it('stays off until public profiles are live, and off by default', () => {
    expect(form(false)).not.toContain('public profile');
    expect(
      renderToStaticMarkup(
        h(ReviewForm, {
          name: 'Mia',
          sym: '€',
          rv,
          busy: false,
          tips: true,
          onEdit: () => {},
          onSend: () => {},
        }),
      ),
    ).not.toContain('public profile');
  });
  it('only appears once the customer has picked a rating', () => {
    /* The whole block under the stars is hidden until then, so an unrated form says nothing
       about profiles either. */
    expect(form(true)).toContain('public profile');
    expect(
      renderToStaticMarkup(
        h(ReviewForm, {
          name: 'Mia',
          sym: '€',
          rv: { ...rv, rating: 0 },
          busy: false,
          tips: true,
          profiles: true,
          onEdit: () => {},
          onSend: () => {},
        }),
      ),
    ).not.toContain('public profile');
  });
  it('is switched on by the same launch flag the profile pages use', () => {
    const page = readFileSync('src/pages/queue/[id].astro', 'utf8');
    expect(page).toContain('const profilesEnabled = publicProfilesEnabled();');
    expect(page).toContain('profilesEnabled={profilesEnabled}');
    expect(
      readFileSync('src/components/account/QueueRoom.jsx', 'utf8'),
    ).toContain('profiles={this.props.profilesEnabled}');
    /* The homepage demo is a demo: it never claims a real teammate has a profile. */
    expect(
      readFileSync('src/components/home/QueuePreview.jsx', 'utf8'),
    ).not.toContain('profiles=');
  });
});
