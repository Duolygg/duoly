import { describe, expect, it } from 'vitest';
import { GAME_PICKS } from '../../src/contracts/game-picks';
import {
  ROLE_COLOR,
  roleColor,
  roleShape,
} from '../../src/components/account/role-accents';
import { PROFILE_ACCENTS } from '../../src/contracts/teammate-profile';

/*
 * Accessibility is part of the design, so the role palette is checked rather than eyeballed.
 * Every role colour has to clear WCAG AA as normal text everywhere profile-pickers.css prints it:
 * on the three surfaces, and on a wash of itself, which is what a chip, a tile monogram, an order
 * badge and a filter tab are.
 */
const NIGHT = '#090414';
const PANEL = '#120b22';
const RAISE = '#1b1033';
/** The strongest wash any of those rules puts behind a label in its own colour. */
const WASH = 0.2;

const channels = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** color-mix(in srgb, a p%, b), which is what the stylesheet uses. */
const mix = (a: string, b: string, p: number) =>
  '#' +
  channels(a)
    .map((v, i) => Math.round(v * p + channels(b)[i]! * (1 - p)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
const luminance = (hex: string) =>
  channels(hex)
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + [0.2126, 0.7152, 0.0722][i]! * v, 0);
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x!, y!) + 0.05) / (Math.min(x!, y!) + 0.05);
};

describe('the role palette', () => {
  /* Printed in its own colour: a role tag, a monogram, an order badge, a selected filter tab.
     Those all sit on the night behind the sheet or on the panel, washed with the same colour. */
  it('reads as normal text where it is printed in its own colour', () => {
    for (const [role, hex] of Object.entries(ROLE_COLOR))
      for (const surface of [
        NIGHT,
        PANEL,
        RAISE,
        mix(hex, NIGHT, WASH),
        mix(hex, PANEL, WASH),
      ])
        expect(
          contrast(hex, surface),
          `${role} on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
  });
  /* A selected chip lightens its label, because a chip's wash sits on the raised surface inside
     a game card and the darkest accent would otherwise land just under AA on it. */
  it('reads as normal text on a selected chip, on every surface a chip sits on', () => {
    for (const [role, hex] of Object.entries(ROLE_COLOR)) {
      const label = mix(hex, '#ffffff', 0.7);
      for (const surface of [NIGHT, PANEL, RAISE])
        expect(
          contrast(label, mix(hex, surface, WASH)),
          `${role} chip on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('uses only the accents the profile already ships', () => {
    const allowed = new Set<string>(Object.values(PROFILE_ACCENTS));
    for (const [role, hex] of Object.entries(ROLE_COLOR))
      expect(allowed.has(hex), role).toBe(true);
  });
  /*
   * A game offers four to six roles at once, and two of them in the same hue would make the
   * colour decorative. Rainbow Six offers Flex beside Fill and EA FC offers Goalkeeper beside
   * Defender, which is what rules out one colour per kind of role.
   */
  it('gives the roles of any one game a different colour each', () => {
    for (const [game, catalog] of Object.entries(GAME_PICKS)) {
      const colours = catalog.roles.map((r) => roleColor(r.id));
      expect(new Set(colours).size, game).toBe(colours.length);
    }
  });
  it('knows every role a game or a character filter names', () => {
    for (const [game, catalog] of Object.entries(GAME_PICKS)) {
      const known = new Set(Object.keys(ROLE_COLOR));
      for (const role of catalog.roles)
        expect(known.has(role.id), `${game} ${role.id}`).toBe(true);
      for (const filter of catalog.filters)
        expect(known.has(filter.id), `${game} ${filter.id}`).toBe(true);
    }
  });
  /* Colour and shape say the same thing twice, so the grid reads without colour as well. */
  it('gives every role one of the five marks we drew', () => {
    for (const role of Object.keys(ROLE_COLOR))
      expect(['shield', 'crosshair', 'plus', 'eye', 'diamond']).toContain(
        roleShape(role),
      );
    expect(roleShape('not-a-role')).toBe('diamond');
    expect(roleColor('not-a-role')).toBe(PROFILE_ACCENTS.lavender);
  });
});
