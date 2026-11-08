import { servicesFor } from '../design-reference/lib/catalog.js';
import { ranksOf } from '../design-reference/lib/ranks.js';
import { serversFor } from '../design-reference/lib/servers.js';
import { characterLabel, rolesFor } from './roles';
import { seatRule } from './seats';
import { BUNDLE_UNITS, QUANTITIES } from './pricing';

// Only existing booking controls. Attribution and payment choices are not preferences.
export const BOOKING_PARAMS = [
  'game',
  'service',
  'tab',
  'rank',
  'region',
  'qty',
  'role',
  'character',
  'voice',
  'mood',
  'server',
  'edition',
  'seats',
  'ign',
  'note',
  'creatorCode',
] as const;
export function bookingParam(params: URLSearchParams, key: string) {
  return params.getAll(key).length === 1 ? params.get(key)! : undefined;
}
export type BookingPreferences = {
  rank?: string;
  region?: string;
  qty?: number;
  role?: string;
  character?: string;
  voice?: boolean;
  mood?: string;
  mcServer?: string;
  mcEdition?: 'Java' | 'Bedrock';
  seats?: number;
  ign?: string;
  orderNote?: string;
  creatorCode?: string;
};
/** Pure browser-safe validation, shared by link producers and the landing page. */
export function parseBookingPreferences(
  params: URLSearchParams,
  game: string,
  service: string,
) {
  const values: BookingPreferences = {};
  const invalid: string[] = [];
  const mode = servicesFor(game).modes.find(
    (m: { id: string }) => m.id === service,
  );
  if (!mode) return { values, invalid: ['service'] };
  const accept = (
    key: string,
    valid: (value: string) => boolean,
    apply: (value: string) => void,
  ) => {
    if (!params.has(key)) return;
    const value = bookingParam(params, key);
    if (value === undefined || !valid(value)) invalid.push(key);
    else apply(value);
  };
  const integer = (value: string, min: number, max: number) =>
    /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max;
  accept(
    'rank',
    (v) => ranksOf(game, service).includes(v),
    (v) => {
      values.rank = v;
    },
  );
  accept(
    'qty',
    // 1 to 5 from the quantity picker, or a bundle count on the game's main service
    (v) =>
      integer(v, 1, 10) &&
      ((QUANTITIES as readonly number[]).includes(Number(v)) ||
        (service === servicesFor(game).main &&
          (BUNDLE_UNITS as readonly number[]).includes(Number(v)))),
    (v) => {
      values.qty = Number(v);
    },
  );
  accept(
    'role',
    (v) => rolesFor(game, service).includes(v),
    (v) => {
      values.role = v;
    },
  );
  accept(
    'character',
    (v) =>
      !!characterLabel(game, mode.cat) &&
      v.trim().length > 0 &&
      v.trim().length <= 40,
    (v) => {
      values.character = v.trim();
    },
  );
  accept(
    'voice',
    (v) => game !== 'social' && ['true', 'false'].includes(v),
    (v) => {
      values.voice = v === 'true';
    },
  );
  accept(
    'mood',
    (v) =>
      game !== 'social' && ['chill', 'tryhard', 'teach', 'fun'].includes(v),
    (v) => {
      values.mood = v;
    },
  );
  const conflict = params.has('server') && params.has('region');
  accept(
    'region',
    (v) =>
      !conflict &&
      game !== 'mc' &&
      serversFor(game).some((s: string[]) => s[0] === v),
    (v) => {
      values.region = v;
    },
  );
  accept(
    'server',
    (v) =>
      !conflict &&
      game === 'mc' &&
      v.trim().length >= 2 &&
      v.trim().length <= 60,
    (v) => {
      values.mcServer = v.trim();
    },
  );
  accept(
    'edition',
    (v) => game === 'mc' && ['Java', 'Bedrock'].includes(v),
    (v) => {
      values.mcEdition = v as 'Java' | 'Bedrock';
    },
  );
  const rule = seatRule(game, service);
  accept(
    'seats',
    (v) => integer(v, rule.min, rule.max),
    (v) => {
      values.seats = Number(v);
    },
  );
  // Explicit hand-written links only: never solicit or emit private text in MCP URLs.
  accept(
    'ign',
    (v) => v.trim().length >= 2 && v.trim().length <= 40,
    (v) => {
      values.ign = v.trim();
    },
  );
  accept(
    'note',
    (v) => v.trim().length <= 200,
    (v) => {
      values.orderNote = v.trim();
    },
  );
  // Syntax only. The existing CreatorCode control and checkout still check eligibility.
  accept(
    'creatorCode',
    (v) => /^[A-Z0-9]{3,20}$/.test(v),
    (v) => {
      values.creatorCode = v;
    },
  );
  return { values, invalid };
}
