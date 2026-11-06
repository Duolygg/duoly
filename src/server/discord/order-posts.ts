// Discord order posts (ledger #41, Fabian's lib/discordQueue.js).
// When an order has waited AFTER_MS in the queue without a teammate, the bot posts it in that
// game's #general channel, mentions the Teammate role and links the bot's own handover link.
// When the order is taken, cancelled or re-rolled, the post is edited so nobody clicks a dead link.
//
// Posts use Discord Components V2 (flag IS_COMPONENTS_V2). Public channels: the post never
// carries the customer's name, Discord, in-game name, country, note or loyalty level.

import type { OrderMood } from '../../contracts/orders';

export const POST_AFTER_MS = 100_000;
export const IS_COMPONENTS_V2 = 1 << 15;

export const COLORS = {
  open: 0xd6bbff, // Duoly lilac
  gg: 0xf0a6ff, // Gamer Girl pink
  taken: 0x5eeaa8, // mint
  closed: 0x6a6086, // muted
} as const;

export interface PostGame {
  id: string;
  name: string;
  short: string;
  icon: string; // site path of the 128px game icon
}

export const POST_GAMES: Record<string, PostGame> = Object.fromEntries(
  (
    [
      ['lol', 'League of Legends', 'League', 'league-of-legends'],
      ['val', 'Valorant', 'Valorant', 'valorant'],
      ['cs2', 'Counter-Strike 2', 'CS2', 'counter-strike-2'],
      ['fn', 'Fortnite', 'Fortnite', 'fortnite'],
      ['cod', 'Call of Duty', 'Call of Duty', 'call-of-duty'],
      ['apex', 'Apex Legends', 'Apex Legends', 'apex-legends'],
      ['r6', 'Rainbow Six Siege', 'Rainbow Six', 'rainbow-six-siege'],
      ['mr', 'Marvel Rivals', 'Marvel Rivals', 'marvel-rivals'],
      ['ow', 'Overwatch 2', 'Overwatch', 'overwatch-2'],
      ['rl', 'Rocket League', 'Rocket League', 'rocket-league'],
      ['tft', 'Teamfight Tactics', 'TFT', 'teamfight-tactics'],
      ['fc', 'EA SPORTS FC 27', 'FC 27', 'ea-sports-fc-27'],
      ['arc', 'ARC Raiders', 'ARC Raiders', 'arc-raiders'],
      ['mc', 'Minecraft', 'Minecraft', 'minecraft'],
      ['pu', 'Pokémon Unite', 'Pokémon Unite', 'pokemon-unite'],
      ['social', 'Social', 'Social', 'social'],
    ] as const
  ).map(([id, name, short, slug]) => [
    id,
    { id, name, short, icon: `/assets/games/${slug}.png` },
  ]),
);

export function postGame(id: string): PostGame {
  return (
    POST_GAMES[id] ?? {
      id,
      name: id.toUpperCase(),
      short: id.toUpperCase(),
      icon: '/apple-touch-icon.png',
    }
  );
}

/** What the post may show. Teammate-facing order facts only, nothing about the customer. */
export interface PostOrder {
  reference: string; // DL-48308
  game: string;
  title: string; // service title, e.g. "Duo Pro"
  units: number;
  unit: 'game' | 'hour' | string;
  rank: string | null;
  region: string | null;
  voice: boolean;
  // Added by 20261101120000; missing or null when the customer picked no mood.
  mood?: string | null;
  gg: boolean;
  payoutUsdCents: number;
  queuedAt: number; // ms
  cancelsAt: number; // ms
  // Added by 20261106190000 (team orders): one post per team, for its next free seat.
  // Missing or null on single-teammate orders.
  seats?: number | null;
  seatsTaken?: number | null;
  // Added by 20261106190000: the customer's role and the character they want coaching on.
  role?: string | null;
  character?: string | null;
}

/** The session mood as a post fact; names match the checkout (components/shared/moods.jsx). */
const MOOD_FACTS: Record<OrderMood, string> = {
  chill: '☕ **Chill**',
  tryhard: '🔥 **Tryhard**',
  teach: '🎓 **Teach me**',
  fun: '😂 **Just for fun**',
};
export const moodFact = (mood: string | null | undefined) =>
  mood && Object.hasOwn(MOOD_FACTS, mood) ? MOOD_FACTS[mood as OrderMood] : '';

export type CloseOutcome =
  'taken' | 'cancelled_customer' | 'expired' | 'cancelled' | 'rerolled';

export interface ClosedPost {
  order: Pick<PostOrder, 'reference' | 'game' | 'title' | 'units' | 'unit'>;
  outcome: CloseOutcome;
  at: number; // ms, when it was taken or closed
  teammate?: string | null; // public teammate display name, first name only
  waitedMs?: number | null; // from queue to accept
}

export interface PostOptions {
  site: string; // https://duoly.gg
  roleId?: string | null; // Teammate role to mention
  silent?: boolean; // show the role but notify nobody (testing)
}

const unix = (ms: number) => Math.floor(ms / 1000);
const plural = (n: number, unit: string) => {
  const word = unit === 'hour' ? 'hour' : 'game';
  return `${n} ${word}${n === 1 ? '' : 's'}`;
};
export const usd = (cents: number) =>
  '$' +
  (Math.max(0, Math.round(cents)) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const abs = (site: string, path: string) =>
  new URL(path, site.replace(/\/$/, '') + '/').toString();
// Markdown that a customer-free field could still carry (rank, region, title come from our own lists,
// but escape anyway so a stray * or _ never breaks the layout)
const md = (s: string) => s.replace(/([\\*_`~|>#[\]()-])/g, '\\$1');

function waited(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

const text = (content: string) => ({ type: 10, content });
const divider = (spacing: 1 | 2 = 1, visible = true) => ({
  type: 14,
  divider: visible,
  spacing,
});

/** The open post: banner, what it is, what it pays, when it goes, one big button. */
export function openPost(o: PostOrder, claimUrl: string, opt: PostOptions) {
  const g = postGame(o.game);
  const facts = [
    o.rank ? `🏆 **${md(o.rank)}**` : '',
    o.region ? `🌍 **${md(o.region)}**` : '',
    o.voice ? '🎙️ **Voice chat**' : '',
    moodFact(o.mood),
    o.role ? `🎯 **Plays ${md(o.role)}**` : '',
    o.character ? `🧩 **Coaching on ${md(o.character)}**` : '',
  ].filter(Boolean);

  const body: object[] = [
    {
      type: 12,
      items: [
        {
          media: { url: abs(opt.site, `/discord/orders/${g.id}.webp`) },
          description: `${g.name} order on Duoly`,
        },
      ],
    },
    {
      type: 9,
      components: [
        text(`-# ${md(g.name.toUpperCase())}  ·  ORDER ${md(o.reference)}`),
        text(`## ${md(o.title)} · ${plural(o.units, o.unit)}`),
        text(facts.length ? facts.join('   ') : '-# No rank or server given'),
      ],
      accessory: {
        type: 11,
        media: { url: abs(opt.site, g.icon) },
        description: g.name,
      },
    },
    divider(2),
    text(
      `### 💸 You earn ${usd(o.payoutUsdCents)}\n-# Paid with your weekly payout once the order is done.`,
    ),
  ];
  if (o.gg)
    body.push(
      text('🎀 **Gamer Girl order.** Only Gamer Girl teammates can take it.'),
    );
  if (o.seats && o.seats > 1)
    body.push(
      text(
        `👥 **Team order · ${o.seatsTaken ?? 0} of ${o.seats} seats taken.** ` +
          `Take a seat: you all start together once every seat is taken, and share one group chat.`,
      ),
    );
  body.push(
    divider(1, false),
    text(
      `⏳ Auto-cancels <t:${unix(o.cancelsAt)}:R>  ·  waiting since <t:${unix(o.queuedAt)}:t>`,
    ),
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 5,
          label: 'Take this order',
          emoji: { name: '⚡' },
          url: claimUrl,
        },
        {
          type: 2,
          style: 5,
          label: 'Teammate desk',
          url: abs(opt.site, '/teammate'),
        },
      ],
    },
  );

  const ping = opt.roleId ? `<@&${opt.roleId}> ` : '';
  return {
    flags: IS_COMPONENTS_V2,
    allowed_mentions: {
      parse: [],
      roles: opt.roleId && !opt.silent ? [opt.roleId] : [],
    },
    components: [
      text(
        `${ping}A **${md(g.name)}** player has waited over ${Math.round(POST_AFTER_MS / 1000)} seconds. First teammate to grab it plays it.`,
      ),
      {
        type: 17,
        accent_color: o.gg ? COLORS.gg : COLORS.open,
        components: body,
      },
    ],
  };
}

/** The closed post: compact, no banner, no ping, a disabled status button so it reads as done. */
export function closedPost(p: ClosedPost, opt: Pick<PostOptions, 'site'>) {
  const g = postGame(p.order.game);
  const what = `${md(p.order.title)} · ${plural(p.order.units, p.order.unit)}`;
  let title: string;
  let line: string;
  let color: number;
  let badge: { label: string; emoji: string; style: number };
  switch (p.outcome) {
    case 'taken':
      title = `✅ Taken`;
      line = `${p.teammate ? `**${md(p.teammate)}**` : 'A teammate'} picked it up <t:${unix(p.at)}:R>${p.waitedMs != null ? `, after ${waited(p.waitedMs)} in the queue` : ''}.`;
      color = COLORS.taken;
      badge = { label: 'Order taken', emoji: '✅', style: 3 };
      break;
    case 'rerolled':
      title = 'Re-rolled';
      line =
        'The customer switched teammates. If it waits again, it gets a new post.';
      color = COLORS.closed;
      badge = { label: 'Re-rolled', emoji: '🔁', style: 2 };
      break;
    case 'cancelled_customer':
      title = 'Cancelled';
      line = 'The customer cancelled it before anyone took it.';
      color = COLORS.closed;
      badge = { label: 'Cancelled', emoji: '✖️', style: 2 };
      break;
    case 'expired':
      title = 'Closed';
      line =
        'Nobody took it within 5 minutes, so the customer got their money back.';
      color = COLORS.closed;
      badge = { label: 'Closed', emoji: '⌛', style: 2 };
      break;
    default:
      title = 'Cancelled';
      line = 'This order was cancelled.';
      color = COLORS.closed;
      badge = { label: 'Cancelled', emoji: '✖️', style: 2 };
  }
  return {
    flags: IS_COMPONENTS_V2,
    allowed_mentions: { parse: [] },
    components: [
      {
        type: 17,
        accent_color: color,
        components: [
          {
            type: 9,
            components: [
              text(
                `-# ${md(g.name.toUpperCase())}  ·  ORDER ${md(p.order.reference)}`,
              ),
              text(`### ${title}  ·  ${what}`),
              text(line),
            ],
            accessory: {
              type: 11,
              media: { url: abs(opt.site, g.icon) },
              description: g.name,
            },
          },
          {
            type: 1,
            components: [
              {
                type: 2,
                style: badge.style,
                label: badge.label,
                emoji: { name: badge.emoji },
                custom_id: `duoly-order-closed-${p.order.reference}`.slice(
                  0,
                  100,
                ),
                disabled: true,
              },
            ],
          },
        ],
      },
    ],
  };
}
