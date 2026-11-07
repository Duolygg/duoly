import { servicesFor } from '../design-reference/lib/catalog.js';
import { ranksOf } from '../design-reference/lib/ranks.js';
import { serversFor } from '../design-reference/lib/servers.js';
import { characterLabel, rolesFor } from './roles';
import { seatRule } from './seats';

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
    (v) => integer(v, 1, 10),
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
  return { values, invalid };
}
