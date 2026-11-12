import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  bookingMode,
  nameChars,
} from '../../src/server/teammates/profile-page';
import {
  RESUME_COOKIE,
  RESUME_PROFILE_SAVE,
} from '../../src/server/auth/after-login';
import { PENDING_FAVORITE_COOKIE } from '../../src/server/teammates/pending-favorite';

/*
 * Booking with a named teammate (plan option 1): the profile page saves the teammate to the
 * customer's favorites and then opens the booking page that already exists. Checkout, pricing
 * and the homepage are untouched, so the guard here is that the page keeps its side of it: every
 * booking button stays a real link, nothing stands between a visitor and booking, and each
 * cookie it leaves behind is one the server reads back.
 */
const page = readFileSync('src/pages/teammates/[slug].astro', 'utf8');

describe('who a booking button saves for', () => {
  it('saves for a customer, signs a visitor in and leaves other roles alone', () => {
    expect(bookingMode(undefined)).toBe('signin');
    expect(bookingMode('customer')).toBe('customer');
    for (const role of ['teammate', 'admin', 'streamer'])
      expect(bookingMode(role)).toBe('none');
  });
});

describe('the profile page wiring', () => {
  it('marks every booking button, and names the two that carry the sign-in detour', () => {
    /* Three primaries: the hero, the closing band and the sticky mobile bar. */
    expect(page.match(/data-profile-book="primary"/g)).toHaveLength(3);
    /* Coaching and each game card book that game directly. */
    expect(page.match(/data-profile-book="game"/g)).toHaveLength(2);
    /* Every button is still an anchor with a real href, so no JavaScript is required. */
    expect(page).not.toMatch(/<button[^>]*data-profile-book/);
    expect(page).toMatch(/href=\{view\.book\}[\s\n]*data-profile-book/);
  });
  it('sends nobody to sign in before they can book', () => {
    /* The Save heart is the only thing left that takes a visitor to sign-in: booking is a
       plain link for everyone, and the slug rides along in the pending favorite cookie. */
    expect(page).toContain(`resume('${RESUME_PROFILE_SAVE}')`);
    expect(page).not.toContain("location.href = '/login'");
    expect(page).not.toContain("resume('profile:')");
    expect(page).toContain("if (mode === 'signin') remember()");
    expect(page).toContain(`${RESUME_COOKIE}=`);
    expect(page).toContain(`${PENDING_FAVORITE_COOKIE}=`);
    /* Session cookies with a short life, never readable cross site. */
    expect(page).toContain('Max-Age=1800; Path=/; SameSite=Lax; Secure');
    expect(page).toContain('Max-Age=7200; Path=/; SameSite=Lax; Secure');
  });
  it('posts the slug to the one endpoint that takes it, with the CSRF token', () => {
    expect(page).toContain("fetch('/api/favorites/by-slug'");
    expect(page).toContain("method: 'POST'");
    expect(page).toContain('JSON.stringify({ csrf, slug })');
    /* The token only reaches the page when there is somebody to save for. */
    expect(page).toContain(
      "data-csrf={saveMode === 'customer' ? csrf : undefined}",
    );
  });
  it('never lets a slow or failing save hold up the booking', () => {
    expect(page).toContain('setTimeout(go, 1200)');
    expect(page).toContain('save().then(go, go)');
  });
  it('keeps the promise on the page to what the queue actually does', () => {
    /* A favorite loses the priority delay. It is not promised the order outright, and
       nothing on the page claims a wait time nobody has measured yet. */
    const source = readFileSync('src/server/teammates/profile-page.ts', 'utf8');
    expect(source).toContain('sees your order with no queue delay');
    expect(source).not.toContain('You get ${p.name} first');
    expect(source + page).not.toMatch(/within \d+ minutes/);
    expect(page).toContain("'Online now, ready to play'");
  });
  it('closes the booking block with one line, inside the block', () => {
    /* The button, the price, the availability and the explainer are one unit: the line is
       the last row of the CTA grid rather than a paragraph that follows it. */
    expect(page).toMatch(/<p class="tp-note">\{bookingNote\}<\/p>\s*<\/div>/);
    expect(
      readFileSync('src/components/teammates/profiles.css', 'utf8'),
    ).toContain('.tp-cta .tp-note');
  });
});

describe('the hero after the last review round', () => {
  const css = readFileSync('src/components/teammates/profiles.css', 'utf8');
  it('prints the name once, with no outlined repeat left behind', () => {
    expect(css).not.toContain('tp-ghostname');
    expect(page).not.toContain('tp-ghostname');
    /* The pool of light stays, and still reaches zero inside its own box. */
    expect(css).toContain('.tp-sky');
    expect(css).toContain('transparent 100%');
  });
  it('names the game with its own icon, not a coloured crest', () => {
    expect(page).toContain('class="tp-rankline-icon"');
    expect(page).toContain('src={view.game.img}');
    /* The crest survives only on the game cards. */
    expect(page.match(/rankEmblem\(/g)).toHaveLength(2);
    expect(page).toContain('aria-label="Rank verified by Duoly"');
  });
  it('steps the headline down rather than breaking inside a word', () => {
    /* "Crafty" came out as "Craft" and a lone "y" beside the mascot at 390. */
    expect(nameChars('Crafty')).toBe(6);
    expect(nameChars('Mary Jane')).toBe(4);
    expect(nameChars('  Nyx  ')).toBe(3);
    expect(nameChars('')).toBe(1);
    expect(page).toContain('--name-chars:${nameChars(p.name)}');
    expect(css).toContain('var(--name-chars, 4)');
  });
  it('drops the button glow where the hero clips it, and lifts the chips', () => {
    const narrow = css.slice(css.indexOf('@media (max-width: 760px)'));
    expect(narrow).toMatch(/\.tp-cta \.tp-button \{\s*box-shadow: none;/);
    expect(css).toContain('@media (max-width: 600px)');
    expect(css).toContain('flex-direction: column-reverse');
    expect(css).toContain(
      'border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
    );
  });
});
