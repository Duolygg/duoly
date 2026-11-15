/*
 * Role colours and role glyphs, drawn by us.
 *
 * No publisher artwork ships (DESIGN decision 1), so a role is told apart by a colour and a
 * shape we drew: sixteen generic marks that say what the role does, never a copy of an in-game
 * icon. No two roles of one game share a mark, which is what tests/unit/profile-picker-colours
 * holds them to, and shape and colour carry the same information twice, so the grid reads by
 * colour at a glance and still reads without colour at all.
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

/*
 * Which mark a role gets. Sixteen of them, because a glyph that two roles of the same game share
 * is decoration: Valorant printed the same eye on Initiator, Controller and Sentinel, and a
 * teammate reading the filter row learned nothing from any of them. The rule the test holds to
 * is per game, not global, so Recon and Initiator may both be the radar and never meet.
 */
const ROLE_SHAPE = {
  // Holds ground.
  shield: [
    'tank',
    'vanguard',
    'defender',
    'anchor',
    'defense',
    'sentinel',
    'offlane',
    'top',
    'baron',
  ],
  // Opens the fight.
  crosshair: [
    'damage',
    'duelist',
    'adc',
    'carry',
    'entry',
    'attacker',
    'forward',
    'dps',
    'assault',
    'attack',
    'dragon',
  ],
  // Keeps the team alive.
  plus: ['support', 'supporter', 'strategist', 'healer', 'soft-support'],
  // Buys the vision the team plays on.
  eye: ['hard-support'],
  // Holds the middle.
  diamond: ['mid', 'midfielder', 'all-rounder'],
  // Plays whatever is short.
  asterisk: ['fill', 'any'],
  // Plays several, by choice.
  swap: ['flex'],
  // Gets there first.
  bolt: ['skirmisher', 'speedster'],
  // Finds out where they are.
  radar: ['initiator', 'recon'],
  // Takes the sightline away.
  cloud: ['controller'],
  // One shot from distance.
  scope: ['awper'],
  // Waits out of sight.
  moon: ['lurker'],
  // Makes the call.
  flag: ['igl'],
  // Never where it was a moment ago.
  route: ['roamer'],
  // Starts between the lanes.
  leaf: ['jungle'],
  // Last one back.
  net: ['goalkeeper'],
};
const SHAPE_OF = Object.fromEntries(
  Object.entries(ROLE_SHAPE).flatMap(([shape, roles]) =>
    roles.map((r) => [r, shape]),
  ),
);
export const ROLE_SHAPES = Object.keys(ROLE_SHAPE);
export const roleShape = (role) => SHAPE_OF[role] || 'diamond';

/*
 * The marks themselves, drawn on a 16 box at one stroke weight, so a row of chips reads as one
 * set rather than as sixteen icons from sixteen places. None of them copies an in-game icon.
 */
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
  asterisk: <path d="M8 2.2v11.6M3 5.1l10 5.8M13 5.1 3 10.9" />,
  swap: (
    <path d="M2.8 6.1h9.2M9.6 3.7 12 6.1 9.6 8.5M13.2 9.9H4M6.4 7.5 4 9.9l2.4 2.4" />
  ),
  bolt: <path d="M9.4 1.9 3.8 9.2h3.3l-.5 4.9L12.2 6.8H8.9Z" />,
  radar: (
    <>
      <path d="M3.9 7.6a4.5 4.5 0 0 1 4.5 4.5M3.9 4.1a8 8 0 0 1 8 8" />
      <circle cx="3.9" cy="12.1" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  cloud: (
    <path d="M11.67 12.67H6A4.67 4.67 0 1 1 10.47 6h1.19a3 3 0 1 1 0 6.67Z" />
  ),
  scope: (
    <>
      <circle cx="8" cy="8" r="4.8" />
      <path d="M8 3.6v8.8M3.6 8h8.8" />
      <circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  moon: <path d="M8 2a4 4 0 0 0 6 6 6 6 0 1 1-6-6Z" />,
  flag: <path d="M4.4 14.2V2.6h7.6l-1.7 2.9 1.7 2.9H4.4" />,
  route: (
    <>
      <path d="M3 12.3 6.3 7.3l3 3.1 3.2-4.5" />
      <circle cx="13.3" cy="4.8" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  leaf: (
    <>
      <path d="M13.3 2.7c-6.5 0-10 2.9-10 6.8a3.5 3.5 0 0 0 3.5 3.5c4 0 6.5-3.6 6.5-10.3Z" />
      <path d="M5.2 12.6 9.2 8.6" />
    </>
  ),
  net: <path d="M2.6 4.8h10.8v6.8H2.6zM6.2 4.8v6.8M9.8 4.8v6.8M2.6 8.2h10.8" />,
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
