/*
 * Role colours and role glyphs, drawn by us.
 *
 * No publisher artwork ships (DESIGN decision 1), so a role is told apart by a colour and a
 * shape we drew: five generic marks (shield, crosshair, plus, eye, diamond) that say what the
 * role does, never a copy of an in-game icon. Shape and colour carry the same information twice,
 * so the grid reads by colour at a glance and still reads without colour at all.
 *
 * Colours come from PROFILE_ACCENTS, the eight a teammate can already pick for their page, so the
 * settings screen and the public profile use one palette. They are assigned so that the four to
 * six roles of any one game are always four to six different hues: Rainbow Six offers Flex and
 * Fill side by side, and EA FC offers Goalkeeper beside Defender, which is what rules out the
 * obvious "every shield is ice" mapping. Measured against the panel (#120B22) the eight run
 * 5.9:1 to 14.0:1, so a role name set in one of them clears WCAG AA as normal text.
 */
import React from 'react';
import { PROFILE_ACCENTS } from '../../contracts/teammate-profile';

const { violet, lavender, cyan, mint, pink, coral, gold, ice } =
  PROFILE_ACCENTS;

/** Role id to accent. Unknown roles (a game with free text) fall back to lavender. */
export const ROLE_COLOR = {
  // League and Wild Rift
  top: ice,
  jungle: violet,
  mid: gold,
  adc: coral,
  support: mint,
  fill: lavender,
  baron: ice,
  dragon: coral,
  // Valorant
  duelist: coral,
  initiator: gold,
  controller: violet,
  sentinel: cyan,
  // Counter-Strike and Siege
  entry: coral,
  awper: gold,
  lurker: violet,
  igl: pink,
  flex: gold,
  anchor: ice,
  roamer: pink,
  attack: coral,
  defense: ice,
  // Overwatch and Rivals
  tank: ice,
  damage: coral,
  vanguard: ice,
  strategist: mint,
  // Apex
  assault: coral,
  skirmisher: pink,
  recon: cyan,
  // Pokémon UNITE
  attacker: coral,
  'all-rounder': violet,
  speedster: pink,
  defender: ice,
  supporter: mint,
  // EA FC
  goalkeeper: gold,
  midfielder: violet,
  forward: coral,
  any: lavender,
  // Dota
  carry: coral,
  offlane: violet,
  'soft-support': cyan,
  'hard-support': mint,
  // World of Warcraft
  healer: mint,
  dps: coral,
};
export const roleColor = (role) => ROLE_COLOR[role] || lavender;

/** Which of the five marks a role gets: what the role does, not what game it is from. */
const ROLE_SHAPE = {
  shield: [
    'tank',
    'vanguard',
    'defender',
    'anchor',
    'goalkeeper',
    'defense',
    'top',
    'baron',
  ],
  crosshair: [
    'damage',
    'duelist',
    'adc',
    'carry',
    'entry',
    'attacker',
    'forward',
    'dps',
    'awper',
    'assault',
    'attack',
    'dragon',
  ],
  plus: [
    'support',
    'supporter',
    'strategist',
    'healer',
    'soft-support',
    'hard-support',
  ],
  eye: ['initiator', 'recon', 'lurker', 'igl', 'controller', 'sentinel'],
  diamond: [
    'skirmisher',
    'speedster',
    'roamer',
    'offlane',
    'jungle',
    'mid',
    'midfielder',
    'all-rounder',
    'flex',
    'fill',
    'any',
  ],
};
const SHAPE_OF = Object.fromEntries(
  Object.entries(ROLE_SHAPE).flatMap(([shape, roles]) =>
    roles.map((r) => [r, shape]),
  ),
);
export const roleShape = (role) => SHAPE_OF[role] || 'diamond';

const PATHS = {
  shield: (
    <path d="M8 1.7 13.5 3.9v3.9c0 3.1-2.1 5.4-5.5 6.5-3.4-1.1-5.5-3.4-5.5-6.5V3.9Z" />
  ),
  crosshair: (
    <>
      <circle cx="8" cy="8" r="4.3" />
      <path d="M8 1.4v2.1M8 12.5v2.1M1.4 8h2.1M12.5 8h2.1" />
    </>
  ),
  plus: <path d="M8 2.6v10.8M2.6 8h10.8" />,
  eye: (
    <>
      <path d="M1.6 8S4.2 3.8 8 3.8 14.4 8 14.4 8 11.8 12.2 8 12.2 1.6 8 1.6 8Z" />
      <circle cx="8" cy="8" r="1.7" />
    </>
  ),
  diamond: <path d="M8 1.6 14.4 8 8 14.4 1.6 8Z" />,
};

/** The mark for a role, 14px, inheriting its colour from the chip it sits in. */
export default function RoleGlyph({ role, size = 14 }) {
  return (
    <svg
      className="pk-glyph"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[roleShape(role)]}
    </svg>
  );
}
