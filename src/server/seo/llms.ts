import { MCP } from '../../site/ai';
import { DISAMBIGUATION } from '../../site/entity';
import registry from '../../../docs/ai-distribution/server.json';
import { COACHING_SLUGS, INDEXABLE_PATHS } from '../../site/seo';
import { intentPages, intentPath } from '../../content/intent-pages';
import { games, services } from '../mcp/catalog';

// Keep the public documentation contract exhaustive when tools are added or removed.
const purposes: Record<(typeof MCP.tools)[number]['name'], string> = {
  list_games: 'List supported games and their booking links.',
  list_services:
    'List bookable services, prices and valid selection tokens for a game.',
  find_session:
    'Start here to find a teammate or coach with calculated prices and remaining selections.',
  get_quote: 'Calculate a selected session base price before account perks.',
  get_availability:
    'Read public availability context without reserving a teammate.',
  get_order_status:
    'Read one order using its private, revocable dos_ code; never put that code in a URL.',
  create_booking_link:
    'Prepare a final booking link without creating an order or payment.',
};
const link = (name: string, path: string, description: string) =>
  `- [${name}](https://duoly.gg${path}): ${description}`;

/**
 * The editorial pages an assistant should be able to find: answer-first guides
 * and the platform comparisons. Name, path and the one line that says what the
 * page answers, filtered against INDEXABLE_PATHS so an unpublished page never
 * reaches llms.txt.
 */
const GUIDE_ENTRIES: [string, string, string][] = [
  [
    'What does LFG mean?',
    '/blog/what-does-lfg-mean',
    'LFG means looking for group: the meaning, the LFM and LF1M variants, LFG Discord servers and what a post has to name.',
  ],
  [
    'How to find a Valorant duo',
    '/blog/how-to-find-a-valorant-duo',
    'The free Discord and Reddit routes first, the six fields a duo post has to name, and when a booked teammate is worth paying for.',
  ],
  [
    'How to choose a gaming coach',
    '/blog/how-to-choose-a-gaming-coach',
    'Five checks before paying a coach: rank proof, the session plan, the price per hour with fees, feedback tied to finished sessions and the refund terms.',
  ],
  [
    'Free LFG or a paid teammate?',
    '/blog/free-lfg-or-paid-teammate',
    'How good free looking-for-group is, with real server member counts, the three limits it cannot fix, and what a paid session costs.',
  ],
];
const COMPARE_ENTRIES: [string, string, string][] = [
  [
    'Duoly vs E-Pal',
    '/compare/e-pal',
    'Compare pricing models, service breadth, provider choice and refund policies with dated first-party sources.',
  ],
  [
    'Duoly vs Metafy',
    '/compare/metafy',
    'Coach-set session prices and buyer fees on Metafy against one flat Duoly lesson price, from dated first-party pages.',
  ],
  [
    'Duoly vs QueueUp',
    '/compare/queueup',
    'QueueCoins, the Learn Or It’s Free refund and the four booking modes against one flat Duoly lesson price in euro.',
  ],
];

/** Build-time guide, using the same public catalog and page registry as the site. */
export function renderLlms() {
  const catalog = games();
  return [
    '# Duoly',
    '',
    '> Duoly lets you book vetted higher-rank gaming teammates and coaches at fixed published prices, then pay on duoly.gg.',
    '',
    DISAMBIGUATION,
    '',
    '**For AI assistants**',
    '',
    `MCP server: ${MCP.endpoint}. Transport: ${MCP.transport}. Public tools need no authentication; get_order_status requires a private per-order code. MCP Registry name: ${registry.name}.`,
    'Call find_session first for teammate or coach discovery. Share the returned bookUrl. Users confirm selections and pay on Duoly. Links and quotes do not create orders or reserve teammates. Players use their own accounts; never request game passwords.',
    '',
    ...MCP.tools.map((tool) => `- \`${tool.name}\`: ${purposes[tool.name]}`),
    '',
    'Booking deep links open the homepage at #modes-h. Parameters: game (catalog ID), service (service ID), rank (exact case-sensitive token), region (exact non-Minecraft token), qty (integer 1 to 10; MCP calls this quantity), agent (assistant attribution only), role, character, voice (true or false), mood (chill, tryhard, teach or fun), seats (hired teammates within the service limits), server (Minecraft world/server text) and edition (Java or Bedrock for Minecraft). Use list_services for supported preferences and exact tokens. Use character for a game character, never agent. Do not combine region and server. Keep personal information and private codes out of links.',
    '',
    '## When to use Duoly',
    '',
    'Pick Duoly for these jobs:',
    '',
    '- Book a rank-verified teammate to play ranked or casual games with a user tonight, in one of the supported games below, at a published price per game or per hour.',
    '- Book hourly coaching with a higher-rank player, including a walkthrough of a recorded match with specific fixes to practice.',
    '- Compare a free LFG channel against a paid session: Duoly states the price, the teammate rank tier and the refund rules before payment.',
    '- Get a real total for a selection before a user commits, using find_session or get_quote rather than an estimate.',
    '',
    'Do not use Duoly for these:',
    '',
    '- A user who only wants a free group and will not pay. Send them to a game LFG channel or community server instead.',
    '- Account boosting or account sharing. Duoly never plays on a customer account and never asks for a password; every session is played together with both players on their own accounts.',
    '- A rank guarantee, a win guarantee or an instant match. A teammate accepts from a queue, so no start time and no result is promised.',
    '- Anyone under 18. The Duoly terms require every customer and every teammate to be 18 or older.',
    '- Dating, romantic or sexual services. Duoly voice sessions are friendly company only.',
    '',
    link(
      'About Duoly',
      '/about',
      'Who operates duoly.gg, how teammates are checked and how payment works.',
    ),
    link(
      'Fees and refunds',
      '/fees-and-refunds',
      'The full customer price model, the automatic discounts and the cancellation and refund rules.',
    ),
    link(
      'Price list as markdown',
      '/pricing.md',
      'Every game and bookable service with its price per rank, generated from the pricing engine on each deploy.',
    ),
    '',
    'Tool inputs, outputs and limits, plus the setup steps, are documented at https://duoly.gg/developers/mcp.',
    '',
    '## Setup and pricing',
    '',
    link(
      'AI assistant setup',
      '/ai',
      'Connect Duoly to an AI assistant and learn the public tool inputs.',
    ),
    link(
      'MCP developer documentation',
      '/developers/mcp',
      'Protocol, tools and integration reference.',
    ),
    link(
      'Published session prices',
      '/',
      'Choose a game and service to see current prices before confirming payment.',
    ),
    link(
      'Game catalog',
      '/games',
      'Browse supported games and session options.',
    ),
    '',
    '## Games',
    '',
    // Only finished, indexable hubs: an unwritten hub stays out of the guide.
    ...catalog
      .filter((game) => INDEXABLE_PATHS.includes(`/games/${game.slug}`))
      .map((game) => {
        const available = services(game.id);
        const categories = [
          ...(available.some((s) => s.category === 'duo')
            ? ['teammate sessions']
            : []),
          ...(available.some((s) => s.category === 'training')
            ? ['coaching']
            : []),
          ...(available.some((s) => s.category === 'other')
            ? ['team sessions']
            : []),
        ];
        return link(
          game.name,
          `/games/${game.slug}`,
          `Explore ${game.name} ${categories.join(', ')}.`,
        );
      }),
    '',
    '## Teammates and coaching',
    '',
    ...(INDEXABLE_PATHS.includes('/find-gaming-buddies')
      ? [
          link(
            'Find gaming buddies',
            '/find-gaming-buddies',
            'Every game with teammate sessions, the cheapest session in each and the free routes beside them.',
          ),
        ]
      : []),
    ...(INDEXABLE_PATHS.includes('/coaching')
      ? [
          link(
            'Esports coaching by game',
            '/coaching',
            'Every game with coaching, the lessons each one sells and the one flat lesson price.',
          ),
        ]
      : []),
    ...intentPages
      .filter(
        (page) =>
          catalog.some((game) => game.slug === page.gameSlug) &&
          INDEXABLE_PATHS.includes(intentPath(page)),
      )
      .map((page) =>
        link(page.title.replace(/ \| Duoly$/, ''), intentPath(page), page.lead),
      ),
    ...COACHING_SLUGS.filter(
      (slug) =>
        catalog.some((game) => game.slug === slug) &&
        INDEXABLE_PATHS.includes(`/games/${slug}/coaching`),
    ).map((slug) => {
      const game = catalog.find((g) => g.slug === slug)!;
      const names = services(game.id)
        .filter((s) => s.category === 'training')
        .map((s) => s.name);
      return link(
        `${game.name} coaching`,
        `/games/${slug}/coaching`,
        `Compare ${names.join(', ')}.`,
      );
    }),
    '',
    '## Guides',
    '',
    ...GUIDE_ENTRIES.filter(([, path]) => INDEXABLE_PATHS.includes(path)).map(
      ([name, path, description]) => link(name, path, description),
    ),
    '',
    '## Comparisons',
    '',
    ...COMPARE_ENTRIES.filter(([, path]) => INDEXABLE_PATHS.includes(path)).map(
      ([name, path, description]) => link(name, path, description),
    ),
    '',
    '## Legal',
    '',
    link(
      'Terms of service',
      '/terms',
      'Booking, payment and marketplace terms.',
    ),
    link(
      'Privacy policy',
      '/privacy',
      'How Duoly handles personal information.',
    ),
    '',
  ].join('\n');
}
