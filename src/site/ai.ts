// Public custom connector is live. Directory listings are separate approvals.
export const AI_CONNECTOR_LIVE = true;
export function aiLaunchState(live: boolean = AI_CONNECTOR_LIVE) {
  return {
    label: live ? 'Available in Claude' : 'Launching soon in Claude',
    indexing: live ? 'index, follow' : 'noindex, follow',
    indexablePaths: live ? ['/ai'] : [],
    showSetup: live,
  } as const;
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
        'games: id, slug, name, bookUrl, url; canonical catalog url. Social is excluded.',
    },
    {
      name: 'list_services',
      inputs: 'game (required)',
      outputs:
        'game, services (id, name, description, fromPrice, category, unit, ranks, regions, editions, requiredInputs, bookUrl, url), url.',
    },
    {
      name: 'find_session',
      inputs:
        'game (required); goal or category, rank, region or server, quantity, budget, currency (EUR or USD), edition (optional)',
      outputs:
        'Up to three matching services with descriptions, real calculated prices, bookUrls and missingInputs. Start here for a teammate or coach. Incomplete selections have labelled from prices.',
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
        'game (optional), positive online counts when available, onlineByGame, bookUrl, label, readAt, cacheSeconds, notice, url; medianMatchSeconds, medianWindowDays and medianScope when available. No reservation.',
    },
    {
      name: 'get_order_status',
      inputs:
        'token (required): the private dos_ code generated in your order room',
      outputs:
        'One order status, game, service, quantity, current acceptance, teammate display names, team seat progress, nextStep and updatedAt. Revocable, read only and limited to this order.',
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
    status: AI_CONNECTOR_LIVE ? 'Add it yourself' : 'Launching first',
    detail: 'Find teammates and coaches in your conversation.',
    steps: [
      'Open Settings, then Connectors in Claude.',
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
