import type { IntentPage } from './intent-pages';

export interface FreeRoute {
  label: string;
  url?: string;
  text: string;
}
export interface GuideCheck {
  yes: boolean;
  text: string;
}
export interface GuidePriceRow {
  label: string;
  value: string;
}
export interface FlowAnswer {
  text: string;
  /** Where the answer leads: a free route, the next question or a booking. */
  kind: 'free' | 'next' | 'paid';
}
export interface FlowStep {
  question: string;
  yes: FlowAnswer;
  no: FlowAnswer;
}

/** Free versus paid guidance for games with a published paid example. */
export interface GameDuoGuide {
  gameSlug: string;
  heading: string;
  answer: string;
  freeIntro: string;
  freeRoutes: FreeRoute[];
  /** When the external links were last confirmed live. */
  linksNote: string;
  freeGets: string;
  limits: string[];
  paidIntro: string;
  paidChecks: GuideCheck[];
  /** Visible caption naming the service, rank and server of the rows. */
  priceCaption: string;
  priceRows: GuidePriceRow[];
  paidExample: string;
  flowIntro: string;
  flow: FlowStep[];
  faqExtra: [string, string][];
}

const FREE_LIMITS = [
  'Replies depend on who is online when you post',
  'Rank and role are self-reported',
  'Planned sessions can fall through',
  'Voice quality and language vary',
];

export const GUIDE_PAGES: GameDuoGuide[] = [
  {
    gameSlug: 'league-of-legends',
    heading: 'Should I find a League duo for free or pay for one?',
    answer:
      'Finding a League duo for free is the right start for most players. Free LFG is a set of community spaces, such as the League of Legends Discord, RiftQ and DUO.OP.GG, where players post a server, role and rank. A free duo costs €0 and can grow into a regular group over many evenings. A paid duo is a reviewed, higher-rank teammate who joins a booked session at an agreed time. Paying makes sense for a specific goal. For example, a Gold player climbing on EUW in 2026 can book 3 Duo Pro games with a Master+ partner from Duoly with the {{pct3}} bundle discount for {{lolPro3}}. Five games cost {{lolPro5}} with {{pct5}} off. Paying makes less sense for casual company, because free communities already cover ARAM and normals well. Try free first, and book when reliability, rank or a fixed time matters more than the price.',
    freeIntro:
      'Free LFG is the no-cost way to meet League players on your server, and every post costs €0.',
    freeRoutes: [
      {
        label: 'League of Legends Discord',
        url: 'https://discord.gg/leagueoflegends',
        text: 'a partnered community server run in collaboration with Riot Games. Read the rules first, then post your server, role, mode and playing time.',
      },
      {
        label: 'RiftQ',
        url: 'https://riftq.com/euw',
        text: 'a League duo finder with filters for server, role and mode. Post once with the same details.',
      },
      {
        label: 'DUO.OP.GG',
        url: 'https://duo.op.gg/en/lol/',
        text: 'the duo board from OP.GG, sorted by region and role. Reply with your rank and champion pool.',
      },
      {
        label: 'Players you meet in game',
        text: 'after a good match, add the player as a friend using the League client and invite again.',
      },
    ],
    linksNote: 'We found every link in this list live on 8 November 2026.',
    freeGets:
      'no cost, a large pool of players and a chance to build a regular group.',
    limits: FREE_LIMITS,
    paidIntro:
      'A paid Duoly session is a booked block of games with a reviewed teammate at a known price. The price is fixed before checkout, and the order chat on Duoly sets the start time for the first game. Between games, you can ask the teammate questions about the last match.',
    paidChecks: [
      { yes: true, text: 'Ranked climb with a Master+ partner' },
      { yes: true, text: 'A set time agreed in the order chat' },
      { yes: true, text: 'Comms in your language' },
      { yes: false, text: 'Costs money for every game' },
    ],
    priceCaption: 'Duo Pro at Gold on EUW, in euro',
    priceRows: [
      { label: '1 game', value: '{{lolPro}}' },
      {
        label: '3 games, {{pct3}} off',
        value: '{{lolPro3}}',
      },
      {
        label: '5 games, {{pct5}} off',
        value: '{{lolPro5}}',
      },
    ],
    paidExample:
      'For example, a Gold player on EUW who wants 3 focused ranked games tonight pays {{lolPro3}}. Casual company is cheaper using Discord, where a post costs €0. Prices were checked in November 2026. Duoly reviews every teammate before any order, and you agree in the order chat whether voice runs on Discord or in the League client.',
    flowIntro:
      'A decision flow is the quickest way to choose between a free League duo and a paid session from Duoly. Answer 3 questions in order, starting with the first one. For example, a Gold player on EUW in November 2026 lands on a different answer for ARAM than for ranked. Each answer points to a free route, the next step or a paid session.',
    flow: [
      {
        question: 'Do you mainly want casual company for ARAM or normals?',
        yes: {
          text: 'Yes: start with the free communities above.',
          kind: 'free',
        },
        no: { text: 'No: go to step 2.', kind: 'next' },
      },
      {
        question:
          'Do you need a set time tonight or a higher-rank partner for ranked?',
        yes: { text: 'Yes: go to step 3.', kind: 'next' },
        no: {
          text: 'No: a free LFG post using Discord is enough.',
          kind: 'free',
        },
      },
      {
        question: 'Is {{lolPro3}} for 3 Duo Pro games at Gold worth the goal?',
        yes: {
          text: 'Yes: book a paid session with the {{pct3}} bundle discount.',
          kind: 'paid',
        },
        no: { text: 'No: stay with free LFG at €0.', kind: 'free' },
      },
    ],
    faqExtra: [
      [
        'Should I pay for a League duo or find one free?',
        'Try free communities first for casual games. Book a paid session for a set time, a chosen service or a higher-rank partner.',
      ],
      [
        'What does a League Duo Pro session cost?',
        'A Gold player on EUW pays {{lolPro}} per game for Duo Pro. Three games cost {{lolPro3}} with the {{pct3}} discount, and 5 games cost {{lolPro5}} with {{pct5}} off.',
      ],
    ],
  },
  {
    gameSlug: 'marvel-rivals',
    heading: 'Should I find a Marvel Rivals duo for free or pay for one?',
    answer:
      'Finding a Marvel Rivals duo for free is the right start for most players. Free LFG is a set of community spaces, such as the official Marvel Rivals Discord and the Rivals LFG board, where players post a platform, region, rank and role. A free duo costs €0 and can grow into a regular group over many evenings. A paid duo is a reviewed, higher-rank teammate who joins a booked session at an agreed time. Paying makes sense for a specific goal. For example, a Platinum player in Europe in 2026 can book 3 Duo Pro matches with a Grandmaster+ partner from Duoly with the {{pct3}} bundle discount for {{mrPro3}}. Five matches cost {{mrPro5}} with {{pct5}} off. Paying makes less sense for casual Quick Match company, because free communities already cover casual play well. Try free first.',
    freeIntro:
      'Free LFG is the no-cost way to meet Marvel Rivals players on your platform, and every post costs €0.',
    freeRoutes: [
      {
        label: 'Official Marvel Rivals Discord',
        url: 'https://discord.gg/marvelrivals',
        text: 'the verified server linked from the Marvel Rivals website by NetEase Games. Read the rules first, then post your platform, region, rank and preferred role.',
      },
      {
        label: 'Rivals LFG board',
        url: 'https://rivalslfg.com/lfg',
        text: 'a public board for Marvel Rivals teammate posts. Filter by Vanguard, Duelist, Strategist or Flex and reply with your platform and region.',
      },
      {
        label: 'Players you meet in Quick Match',
        text: 'after a good match, send a friend request and ask about queueing again. A specific invite beats a generic post.',
      },
    ],
    linksNote: 'We found both links in this list live on 8 November 2026.',
    freeGets:
      'no cost, a large pool of players and a chance to build a regular group using Discord.',
    limits: FREE_LIMITS,
    paidIntro:
      'A paid Duoly session is a booked block of matches with a reviewed teammate at a known price. The price is fixed before checkout, and the order chat on Duoly sets the start time for the first match. Between matches, you can ask the teammate questions about the last fight.',
    paidChecks: [
      { yes: true, text: 'Competitive with a Grandmaster+ partner' },
      { yes: true, text: 'A set time agreed in the order chat' },
      { yes: true, text: 'A Team-Up pair practiced on voice' },
      { yes: false, text: 'Costs money for every match' },
    ],
    priceCaption: 'Duo Pro at Platinum in Europe, in euro',
    priceRows: [
      { label: '1 match', value: '{{mrPro}}' },
      {
        label: '3 matches, {{pct3}} off',
        value: '{{mrPro3}}',
      },
      {
        label: '5 matches, {{pct5}} off',
        value: '{{mrPro5}}',
      },
    ],
    paidExample:
      'For example, a Platinum player in Europe who wants 3 focused Competitive matches tonight pays {{mrPro3}}. Casual company is cheaper using Discord, where a post costs €0. Prices were checked in November 2026. Duoly reviews every teammate before any order, and you agree in the order chat whether voice runs on Discord or in-game chat.',
    flowIntro:
      'A decision flow is the quickest way to choose between a free Marvel Rivals duo and a paid session from Duoly. Answer 3 questions in order, starting with the first one. For example, a Platinum player in Europe in November 2026 lands on a different answer for Quick Match than for Competitive. Each answer points to a free route, the next step or a paid session.',
    flow: [
      {
        question:
          'Do you mainly want casual company for Quick Match or Arcade?',
        yes: {
          text: 'Yes: start with the free communities above.',
          kind: 'free',
        },
        no: { text: 'No: go to step 2.', kind: 'next' },
      },
      {
        question:
          'Do you need a set time tonight or a higher-rank partner for Competitive?',
        yes: { text: 'Yes: go to step 3.', kind: 'next' },
        no: {
          text: 'No: a free LFG post using Discord is enough.',
          kind: 'free',
        },
      },
      {
        question:
          'Is {{mrPro3}} for 3 Duo Pro matches at Platinum worth the goal?',
        yes: {
          text: 'Yes: book a paid session with the {{pct3}} bundle discount.',
          kind: 'paid',
        },
        no: { text: 'No: stay with free LFG at €0.', kind: 'free' },
      },
    ],
    faqExtra: [
      [
        'Should I pay for a Marvel Rivals duo or find one free?',
        'Try free communities first for casual Quick Match. Book a paid session for a set time or a Grandmaster+ partner in Competitive.',
      ],
      [
        'What does a Marvel Rivals Duo Pro session cost?',
        'A Platinum player in Europe pays {{mrPro}} per match for Duo Pro in 2026. Three matches cost {{mrPro3}} with {{pct3}} off.',
      ],
    ],
  },
];

export const guideForGame = (slug: string) =>
  GUIDE_PAGES.find((guide) => guide.gameSlug === slug);

/** Fill price tokens from checkout-derived quotes; unknown tokens fail loudly. */
export function renderGuideText(text: string, prices: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = prices[key];
    if (value === undefined) throw new Error(`Unknown price token ${key}`);
    return value;
  });
}

/** Replace price tokens in every string of a plain data structure. */
export function renderTokens<T>(value: T, prices: Record<string, string>): T {
  if (typeof value === 'string') return renderGuideText(value, prices) as T;
  if (Array.isArray(value))
    return value.map((item) => renderTokens(item, prices)) as T;
  if (value && typeof value === 'object' && typeof value !== 'function') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        typeof item === 'function' ? item : renderTokens(item, prices),
      ]),
    ) as T;
  }
  return value;
}

/** The visible FAQ: page questions plus the guide answers, prices filled. */
export function guideFaq(
  page: IntentPage,
  prices: Record<string, string>,
): [string, string][] {
  const guide = guideForGame(page.gameSlug);
  return renderTokens([...page.faq, ...(guide?.faqExtra ?? [])], prices);
}
