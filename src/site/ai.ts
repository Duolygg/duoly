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

// A setup guide is not a live integration or an assistant-store approval.
export const AI_ASSISTANTS = [
  {
    name: 'Claude',
    status: 'Coming soon',
    detail:
      'Duoly is not connected yet. After launch, eligible Claude plans can use the custom connector steps below.',
    steps: [
      'Open Customize, then Connectors in Claude (older interfaces use Settings, then Connectors).',
      'Choose Add, then Add custom connector. Name it Duoly and enter the MCP URL below.',
      'Choose No sign in, finish adding it and enable Duoly from Connectors in your conversation.',
    ],
  },
  {
    name: 'ChatGPT',
    status: 'Coming soon',
    detail:
      'Duoly is not available in the ChatGPT app directory. Book directly on Duoly while platform eligibility is reviewed.',
    steps: [],
  },
  {
    name: 'Gemini',
    status: 'Coming soon',
    detail:
      'Duoly is not a connected app in Gemini yet. Book directly on Duoly today.',
    steps: [],
  },
  {
    name: 'Perplexity',
    status: 'Coming soon',
    detail:
      'Custom remote connectors are supported. Duoly setup opens after the server launches.',
    steps: [
      'Open Plugins, then Add custom, Add MCP connector and Remote. Some interfaces use Customize, then Connectors.',
      'Name the connector Duoly and enter the MCP URL below.',
      'In Advanced, choose None for authentication and Streamable HTTP for transport. Review the acknowledgement, add and enable it.',
    ],
  },
  {
    name: 'Mistral Le Chat',
    status: 'Coming soon',
    detail:
      'Custom MCP connectors are supported. Duoly setup instructions will follow the launch compatibility check.',
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
