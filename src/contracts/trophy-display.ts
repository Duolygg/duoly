import {
  RANK_MOMENT_LABEL,
  rarityRank,
  trophyArt,
  trophyGame,
  trophyLadder,
  trophyTier,
  type PublicTrophy,
  type Rarity,
} from './trophies';

/**
 * What the trophy case shows for one approved trophy. Everything is written here, on the server,
 * from the trophy's own fields, so the component only lays it out and a trophy with a missing
 * field simply has a shorter line instead of an empty slot.
 */
export interface TrophyView {
  id: string;
  rarity: Rarity;
  /** Emblem image: an official emblem file, or a drawn crest as an SVG data URL. */
  art: string;
  crest: boolean;
  alt: string;
  /** "Valorant · Peak rank" */
  eyebrow: string;
  /** "Radiant", "Immortal 3", "#412", "2nd place" */
  name: string;
  /** "Episode 10 Act 3 · EU · 612 RR" */
  meta: string;
  /** "Nov 2026" */
  verified: string;
  proofUrl: string | null;
  /** Grouping for the full list under the case. */
  game: string;
  gameName: string;
  kind: PublicTrophy['kind'];
  /** Same key for every season of one tier, e.g. "rank:gold". */
  group: string;
  /** Tier without division, e.g. "Gold". Empty for non-rank trophies. */
  tierName: string;
  season: string;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const month = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const ordinal = (n: number) => {
  const s =
    n % 100 >= 11 && n % 100 <= 13
      ? 'th'
      : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ??
        'th');
  return `${n}${s}`;
};
const join = (parts: (string | null | undefined | false)[]) =>
  parts.filter((x): x is string => Boolean(x && x.trim())).join(' · ');

/* ---------- drawn crests ----------
 * Leaderboard spots, tournament placings and titles have no official emblem, and a few tiers
 * have none on file. They get a Duoly crest in the trophy's rarity metal, drawn as a small SVG so
 * it costs no request and takes the same shine as an official emblem. */
const METAL: Record<Rarity, [string, string, string]> = {
  common: ['#F1EDF8', '#A49CB8', '#5E5672'],
  uncommon: ['#FFD9BC', '#C9773F', '#6E3418'],
  rare: ['#DCEAFF', '#5B8DFF', '#1E3A9E'],
  epic: ['#EEDDFF', '#9B6BFF', '#4B1FA8'],
  legendary: ['#FFF1C7', '#F2B544', '#8A5A12'],
  mythic: ['#FFF4D6', '#D6BBFF', '#5FB8E8'],
};
const LEAF = 'M0 0c7-5 16-5 22 0c-6 5-15 5-22 0z';
function laurel(): string {
  const leaves: string[] = [];
  for (let i = 0; i < 7; i++) {
    const a = 200 + i * 21;
    const r = (a * Math.PI) / 180;
    const x = 128 + 92 * Math.cos(r);
    const y = 134 + 92 * Math.sin(r);
    leaves.push(
      `<path d="${LEAF}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a + 100})"/>`,
    );
    leaves.push(
      `<path d="${LEAF}" transform="translate(${(256 - x).toFixed(1)} ${y.toFixed(1)}) rotate(${-(a + 100) + 180}) scale(1 -1)"/>`,
    );
  }
  return `<g fill="url(#m)" opacity=".95">${leaves.join('')}</g>`;
}
function glyph(kind: PublicTrophy['kind'], label: string): string {
  const metal =
    'fill="url(#m)" stroke="#120a22" stroke-opacity=".55" stroke-width="2" paint-order="stroke"';
  const font =
    'text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900"';
  if (kind === 'tournament')
    return `<path ${metal} d="M98 86h60v20c0 22-13 37-30 37s-30-15-30-37zm-15 6h15v9c0 11 5 19 11 23c-14-2-26-12-26-32zm90 0h-15v9c0 11-5 19-11 23c14-2 26-12 26-32zM121 143h14v15h13v12h-40v-12h13z"/>${label ? `<text x="128" y="124" ${font} font-size="24" fill="#120a22" fill-opacity=".7">${label}</text>` : ''}`;
  if (kind === 'title')
    return `<path ${metal} d="m128 82 13 28 30 4-22 21 6 30-27-15-27 15 6-30-22-21 30-4z"/>`;
  const size = label.length > 3 ? 34 : label.length > 2 ? 42 : 54;
  return `<text x="128" y="${label.length > 2 ? 146 : 150}" ${font} font-size="${size}" ${metal}>${label}</text>`;
}
const SHIELD = 'M128 36 200 68v58c0 46-31 79-72 96-41-17-72-50-72-96V68z';
const RIM = 'M128 48 190 76v50c0 40-27 69-62 84-35-15-62-44-62-84V76z';
const INNER = 'M128 58 182 82v44c0 34-23 60-54 74-31-14-54-40-54-74V82z';
export function trophyCrest(
  kind: PublicTrophy['kind'],
  rarity: Rarity,
  label: string,
): string {
  const [hi, mid, lo] = METAL[rarity];
  const defs = `<linearGradient id="m" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".5" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient><linearGradient id="r" x1="0" y1="1" x2=".6" y2="0"><stop offset="0" stop-color="${hi}"/><stop offset=".6" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient><radialGradient id="f" cx=".5" cy=".35" r=".75"><stop offset="0" stop-color="${mid}" stop-opacity=".5"/><stop offset=".7" stop-color="#160c2a"/><stop offset="1" stop-color="#0c0618"/></radialGradient><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><defs>${defs}</defs>${kind === 'leaderboard' ? laurel() : ''}<path fill="url(#m)" d="${SHIELD}"/><path fill="url(#r)" d="${RIM}"/><path fill="url(#f)" d="${INNER}"/><path fill="none" stroke="${hi}" stroke-opacity=".5" stroke-width="1.5" d="${INNER}"/><path fill="url(#s)" opacity=".5" d="M128 40 196 70v14L128 54 60 84V70z"/>${glyph(kind, label)}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * One trophy as the case shows it. Browser safe: the settings preview and the staff queue draw the
 * same card the public page does. `game` is the game's display name.
 */
type Body = Omit<
  TrophyView,
  'game' | 'gameName' | 'kind' | 'group' | 'tierName' | 'season'
>;
type AnyTrophy = Omit<PublicTrophy, 'verifiedAt'> & {
  verifiedAt: string | null;
};

export function trophyView(t: AnyTrophy, game: string): TrophyView {
  const tierName =
    t.kind === 'rank' && t.ladder && t.tier
      ? (trophyTier(t.game, t.ladder, t.tier)?.name ?? t.tier)
      : '';
  return {
    ...trophyBody(t, game),
    game: t.game,
    gameName: game,
    kind: t.kind,
    group: t.kind === 'rank' ? `${t.ladder}:${t.tier}` : `${t.kind}:${t.id}`,
    tierName,
    season: t.season ?? '',
  };
}

function trophyBody(t: AnyTrophy, game: string): Body {
  const info = trophyGame(t.game);
  const base = {
    id: t.id,
    rarity: t.rarity,
    verified: t.verifiedAt ? month(t.verifiedAt) : '',
    proofUrl: t.proofUrl,
  };
  if (t.kind === 'rank' && t.ladder && t.tier) {
    const ladder = trophyLadder(t.game, t.ladder);
    const tier = trophyTier(t.game, t.ladder, t.tier);
    const tierName = tier?.name ?? t.tier;
    const name = t.division ? `${tierName} ${t.division}` : tierName;
    const official = trophyArt(t.game, t.tier);
    return {
      ...base,
      art: official ?? trophyCrest('rank', t.rarity, tierName.slice(0, 1)),
      crest: !official,
      alt: `${game} ${name} emblem`,
      eyebrow: join([
        game,
        t.moment ? RANK_MOMENT_LABEL[t.moment] : ladder?.label,
      ]),
      name,
      meta: join([
        t.season,
        t.region,
        t.value != null && ladder?.value ? `${t.value} ${ladder.value}` : null,
      ]),
    };
  }
  if (t.kind === 'leaderboard' && t.position != null) {
    const official = info?.leaderboardArt
      ? trophyArt(t.game, info.leaderboardArt)
      : null;
    return {
      ...base,
      art: official ?? trophyCrest('leaderboard', t.rarity, String(t.position)),
      crest: !official,
      alt: `${game} leaderboard crest`,
      eyebrow: join([game, info?.leaderboard ?? 'Leaderboard']),
      name: `#${t.position}`,
      meta: join([t.season, t.region]),
    };
  }
  if (t.kind === 'tournament') {
    const place =
      t.position != null ? `${ordinal(t.position)} place` : 'Tournament';
    return {
      ...base,
      art: trophyCrest(
        'tournament',
        t.rarity,
        t.position != null ? String(t.position) : '',
      ),
      crest: true,
      alt: `${game} tournament crest`,
      eyebrow: join([game, 'Tournament']),
      name: place,
      meta: join([t.event, t.achievedOn ? month(t.achievedOn) : null]),
    };
  }
  return {
    ...base,
    art: trophyCrest('title', t.rarity, ''),
    crest: true,
    alt: `${game} title crest`,
    eyebrow: join([game, 'Title']),
    name: t.title ?? 'Title',
    meta: join([t.achievedOn ? month(t.achievedOn) : null]),
  };
}

/** One tier held across seasons, for the tally row: "Gold ×5". */
export interface TrophyTally {
  group: string;
  name: string;
  art: string;
  crest: boolean;
  rarity: Rarity;
  count: number;
}
export interface TrophyShelf {
  game: string;
  gameName: string;
  tally: TrophyTally[];
  items: TrophyView[];
}

/**
 * The full list under the case: one shelf per game, rarest game first. Ranks held in several
 * seasons are tallied by tier, so a long League history reads as "Gold ×5, Platinum ×3".
 */
export function trophyShelves(views: TrophyView[]): TrophyShelf[] {
  const shelves = new Map<string, TrophyShelf>();
  for (const v of views) {
    let shelf = shelves.get(v.game);
    if (!shelf) {
      shelf = { game: v.game, gameName: v.gameName, tally: [], items: [] };
      shelves.set(v.game, shelf);
    }
    shelf.items.push(v);
    if (v.kind !== 'rank') continue;
    const hit = shelf.tally.find((x) => x.group === v.group);
    if (hit) {
      hit.count += 1;
      if (rarityRank(v.rarity) > rarityRank(hit.rarity)) hit.rarity = v.rarity;
    } else
      shelf.tally.push({
        group: v.group,
        name: v.tierName,
        art: v.art,
        crest: v.crest,
        rarity: v.rarity,
        count: 1,
      });
  }
  for (const s of shelves.values()) {
    s.tally.sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity));
    /* Rarest first, then the newest season, so a tier's history reads 2022, 2021, 2020. */
    s.items.sort(
      (a, b) =>
        rarityRank(b.rarity) - rarityRank(a.rarity) ||
        b.season.localeCompare(a.season, 'en', { numeric: true }),
    );
  }
  return [...shelves.values()];
}

/**
 * The stage shows highlights: the best trophy of each tier or result, so ten seasons of Gold
 * stand there once and the full history lives in the list underneath.
 */
export function trophyHighlights(views: TrophyView[], max = 9): TrophyView[] {
  const seen = new Set<string>();
  const out: TrophyView[] = [];
  for (const v of views) {
    const key = `${v.game}|${v.group}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length === max) break;
  }
  return out;
}

/** Display order: rarest first, then the most recently verified. */
export const byRarity = (a: PublicTrophy, b: PublicTrophy) =>
  rarityRank(b.rarity) - rarityRank(a.rarity) ||
  b.verifiedAt.localeCompare(a.verifiedAt);

/**
 * Where trophy i sits on the arc when trophy `active` is in front. The ring wraps, so the front
 * trophy always has neighbours on both sides once there are three or more.
 */
export function trophyOffset(i: number, active: number, n: number): number {
  let d = i - active;
  if (n >= 3) {
    const half = Math.floor(n / 2);
    d = ((((d + half) % n) + n) % n) - half;
  }
  return d;
}
