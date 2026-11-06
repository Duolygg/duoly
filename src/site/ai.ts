// Flip only after the Claude connector is available to customers.
export const AI_CONNECTOR_LIVE = false;
export function aiLaunchState(live: boolean = AI_CONNECTOR_LIVE) {
  return {
    label: live ? 'Available in Claude' : 'Launching soon in Claude',
    indexing: live ? 'index, follow' : 'noindex, follow',
    indexablePaths: live ? ['/ai'] : [],
    showSetup: live,
  };
}

// Public documentation contract. Update alongside the server before launch.
export const MCP = {
  endpoint: 'https://duoly.gg/mcp',
  transport: 'Stateless Streamable HTTP',
  protocolVersions: ['2026-07-28', '2025-11-25', '2025-06-18'],
  rateLimits: { minute: 60, day: 2000 },
  tools: [
    {
      name: 'list_games',
      inputs: 'None',
      outputs:
        'games: id, slug, name, url; canonical catalog url. Social is excluded.',
    },
    {
      name: 'list_services',
      inputs: 'game (required)',
      outputs:
        'game, services (id, name, category, unit, ranks, regions, editions, requiredInputs, url), url.',
    },
    {
      name: 'get_quote',
      inputs:
        'game, service, quantity (integer 1 to 10), currency (EUR or USD), server (required); rank and edition (Java or Bedrock) when the service requires them',
      outputs:
        'kind, basis, notReserved, currency, amountMinor, amountEurMinor, formattedPrice, unit, quantity, quotedAt, fx, notice, bookUrl, url. Base price before account perks.',
    },
    {
      name: 'get_availability',
      inputs: 'game (optional)',
      outputs:
        'game (optional), online, onlineByGame, label, readAt, cacheSeconds, notice, url; medianMatchSeconds, medianWindowDays and medianScope when available. No reservation.',
    },
    {
      name: 'create_booking_link',
      inputs: 'game (required); service (optional)',
      outputs:
        'bookUrl, url, notice. Selects the game and optional service. No order is created.',
    },
  ],
} as const;

export const AI_ASSISTANTS = [
  {
    name: 'Claude',
    status: AI_CONNECTOR_LIVE ? 'Add it yourself' : 'Coming soon',
    detail: 'Find teammates and coaches in your conversation.',
    steps: [
      'Open Customize, then Connectors in Claude.',
      'Add a custom connector named Duoly using the URL below.',
      'Add it without signing in, then enable Duoly in your conversation.',
    ],
  },
  {
    name: 'ChatGPT',
    status: 'Coming soon',
    detail: 'Explore games and compare session prices.',
    steps: [],
  },
  {
    name: 'Gemini',
    status: 'Coming soon',
    detail: 'Find a session that fits your game and budget.',
    steps: [],
  },
  {
    name: 'Perplexity',
    status: 'Coming soon',
    detail: 'Search for teammates and coaching options.',
    steps: [],
  },
  {
    name: 'Mistral Le Chat',
    status: 'Coming soon',
    detail: 'Choose a service and continue on Duoly.',
    steps: [],
  },
] as const;

export const AI_PROMPTS = [
  'Find me a Valorant coach tonight for under 15 euros. Check the price and availability on Duoly.',
  'Find someone to play League of Legends ARAM with me on Duoly.',
  'Find a Marvel Rivals duo on Duoly and show me the session price.',
  'Help me find a Pokemon Unite teammate on Duoly.',
  'Compare Rocket League coaching options on Duoly and prepare a booking link.',
  'Find a Fortnite duo on Duoly. Show me the price before I book.',
] as const;
