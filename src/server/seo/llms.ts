import { MCP } from '../../site/ai';
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

/** Build-time guide, using the same public catalog and page registry as the site. */
export function renderLlms() {
  const catalog = games();
  return [
    '# Duoly',
    '',
    '> Duoly lets you book vetted higher-rank gaming teammates and coaches at fixed published prices, then pay on duoly.gg.',
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
    ...catalog.map((game) => {
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
