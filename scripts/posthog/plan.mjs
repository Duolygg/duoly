import {
  EVENT_CATALOGUE,
  SERVER_EVENT_CATALOGUE,
  OUTBOX_EVENT_CATALOGUE,
} from '../../src/contracts/analytics-events.ts';

export const MARKER = '[duoly]';
export const BUILT_INS = [
  '$pageview',
  '$pageleave',
  '$autocapture',
  '$exception',
  '$web_vitals',
  '$rageclick',
  '$dead_click',
  '$ai_generation',
  '$ai_span',
];
export const INTERNAL_FILTERS = [
  {
    key: '$internal_or_test_user',
    type: 'person',
    operator: 'is_not',
    value: ['true'],
  },
  { key: 'internal', type: 'event', operator: 'is_not', value: ['true'] },
];
export const PUBLIC_SQL =
  "coalesce(toString(properties.internal), 'false') != 'true' AND coalesce(toString(person.properties.$internal_or_test_user), 'false') != 'true'";
const identified =
  "coalesce(toString(properties.$process_person_profile), 'true') != 'false'";
const event = (name, extra = {}) => ({
  kind: 'EventsNode',
  event: name,
  name,
  math: 'total',
  ...extra,
});
const base = {
  dateRange: { date_from: '-30d' },
  filterTestAccounts: true,
  properties: INTERNAL_FILTERS,
};
const trends = (names, extra = {}) => ({
  kind: 'TrendsQuery',
  ...base,
  interval: 'day',
  series: names.map((n) => (typeof n === 'string' ? event(n) : n)),
  trendsFilter: { display: 'ActionsLineGraph' },
  ...extra,
});
const funnel = (names, extra = {}) => ({
  kind: 'FunnelsQuery',
  ...base,
  series: names.map((n) => event(n)),
  funnelsFilter: {
    funnelVizType: 'steps',
    funnelOrderType: 'ordered',
    funnelWindowInterval: 14,
    funnelWindowIntervalUnit: 'day',
  },
  ...extra,
});
const sql = (query) => ({ kind: 'HogQLQuery', query });
const behaviors = (key, value = 'performed_event', extra = {}) => ({
  type: 'behavioral',
  key,
  value,
  event_type: 'events',
  time_value: 365,
  time_interval: 'day',
  ...extra,
});
const group = (values) => ({ type: 'AND', values });
const area = (name) =>
  /ai_|support/.test(name)
    ? 'sparky'
    : /pro_/.test(name)
      ? 'pro'
      : /checkout|booking|payment|wallet|perk/.test(name)
        ? 'booking'
        : /order|match|handover|desk|payout|teammate|streaming/.test(name)
          ? 'marketplace'
          : /review|tip|trustpilot|rebook/.test(name)
            ? 'quality'
            : name.startsWith('$')
              ? 'health'
              : 'acquisition';

/** Pure, deterministic, no credentials or network. Native queries use catalogue names. */
export function buildPlan() {
  const dashboards = [
    'North star',
    'Booking funnel',
    'Liquidity',
    'Acquisition',
    'Retention',
    'Quality',
    'Health',
    'Sparky',
  ].map((name, index) => ({
    number: index + 1,
    name: `${MARKER} ${index + 1}. ${name}`,
    description: `${MARKER} POSTHOG-SPEC section 10. Free plan. Internal traffic excluded. Sparse data is expected; PostHog is not the ledger.`,
  }));
  const insights = [];
  const add = (board, key, name, query, events, description = '') =>
    insights.push({
      board,
      key,
      name: `${MARKER} ${key} ${name}`,
      description: `${MARKER} ${description || name}`.slice(0, 400),
      query,
      events,
    });
  const t = (board, key, name, names, extra = {}, description) =>
    add(
      board,
      key,
      name,
      trends(names, extra),
      names.map((n) => (typeof n === 'string' ? n : n.event)),
      description,
    );
  const q = (board, key, name, query, events, description) =>
    add(board, key, name, sql(query), events, description);
  t(1, '01-funded', 'Funded orders per week', ['order_funded'], {
    interval: 'week',
  });
  t(
    1,
    '01-eur',
    'Funded EUR (booking value, not net revenue)',
    [event('order_funded', { math: 'sum', math_property: 'funded_eur_cents' })],
    {
      interval: 'week',
      trendsFilter: {
        display: 'ActionsLineGraph',
        formula: 'A / 100',
        aggregationAxisPrefix: 'EUR ',
      },
    },
  );
  q(
    1,
    '01-repeat',
    'New vs repeat identified customers',
    `SELECT toStartOfWeek(timestamp) AS week, if(timestamp = first_at, 'new', 'repeat') AS customer_type, uniqExact(events.distinct_id) AS customers FROM events JOIN (SELECT distinct_id, min(timestamp) AS first_at FROM events WHERE event = 'order_funded' AND ${PUBLIC_SQL} AND ${identified} GROUP BY distinct_id) AS firsts ON events.distinct_id = firsts.distinct_id WHERE event = 'order_funded' AND timestamp >= now() - INTERVAL 90 DAY AND ${PUBLIC_SQL} AND ${identified} GROUP BY week, customer_type ORDER BY week`,
    ['order_funded'],
    'Identified consented customers only; first means first observed since tracking began, not lifetime. A customer can appear in both weekly buckets.',
  );
  q(
    1,
    '01-pro',
    'PRO active (observed consented state)',
    `SELECT countIf(state = 'active') AS active FROM (SELECT distinct_id, argMax(properties.state, timestamp) AS state FROM events WHERE event IN ('pro_activated', 'pro_resumed', 'pro_paused', 'pro_ended', 'pro_trial_started') AND ${PUBLIC_SQL} AND ${identified} GROUP BY distinct_id)`,
    [
      'pro_activated',
      'pro_resumed',
      'pro_paused',
      'pro_ended',
      'pro_trial_started',
    ],
    'Latest observed PRO state per identified account since tracking began. No historical baseline, not an authoritative active-subscription count.',
  );
  const steps = [
    '$pageview',
    'game_selected',
    'service_selected',
    'booking_confirm_opened',
    'checkout_started',
    'payment_submitted',
    'order_funded',
    'order_matched',
    'order_completed',
  ];
  add(
    2,
    '02-full',
    'Full booking journey (card branch)',
    funnel(steps),
    steps,
    'Actual catalogue names, ordered, 14 days. payment_submitted filters to order. Wallet/free can skip payment; use funding funnel too. Click drop-off users for persons/replays (consented only).',
  );
  insights.at(-1).query.series[5].properties = [
    { key: 'kind', type: 'event', operator: 'exact', value: ['order'] },
  ];
  const fundingSteps = ['checkout_started', 'order_funded'];
  add(
    2,
    '02-funding',
    'Checkout to funded (all payment methods)',
    funnel(fundingSteps, {
      funnelsFilter: {
        funnelVizType: 'steps',
        funnelWindowInterval: 1,
        funnelWindowIntervalUnit: 'day',
        funnelOrderType: 'ordered',
      },
    }),
    fundingSteps,
  );
  for (const [key, property, type] of [
    ['game', 'game', 'event'],
    ['device', '$device_type', 'event'],
    ['channel', '$session_entry_channel_type', 'event'],
    ['currency', 'display_currency', 'event'],
  ]) {
    add(
      2,
      `02-${key}`,
      `Booking conversion by ${key}`,
      funnel(['booking_confirm_opened', 'checkout_started', 'order_funded'], {
        breakdownFilter: { breakdown: property, breakdown_type: type },
      }),
      ['booking_confirm_opened', 'checkout_started', 'order_funded'],
      'Breakdown uses first available step property; absent properties appear as none. No inferred attribution.',
    );
  }
  add(
    2,
    '02-time',
    'Time from checkout to funding',
    funnel(fundingSteps, {
      funnelsFilter: {
        funnelVizType: 'time_to_convert',
        funnelWindowInterval: 1,
        funnelWindowIntervalUnit: 'day',
        funnelOrderType: 'ordered',
      },
    }),
    fundingSteps,
  );
  add(
    2,
    '02-paths',
    'Paths after checkout, no funding in session',
    {
      kind: 'PathsQuery',
      ...base,
      properties: [
        ...INTERNAL_FILTERS,
        {
          type: 'hogql',
          key: "properties.$session_id NOT IN (SELECT properties.$session_id FROM events WHERE event = 'order_funded' AND timestamp >= now() - INTERVAL 30 DAY AND properties.$session_id IS NOT NULL)",
        },
      ],
      pathsFilter: {
        startPoint: 'checkout_started',
        includeEventTypes: ['$pageview', 'custom_event'],
        stepLimit: 8,
        edgeLimit: 50,
      },
    },
    ['checkout_started', 'order_funded', '$pageview'],
    'Session-only exclusion; missing session IDs cannot establish same-session abandonment. Drop-off persons and eligible replays are available in funnel UI.',
  );
  t(
    3,
    '03-wait',
    'Match wait p50 and p90 seconds',
    [
      event('order_matched', { math: 'median', math_property: 'wait_seconds' }),
      event('order_matched', { math: 'p90', math_property: 'wait_seconds' }),
    ],
    {
      trendsFilter: {
        display: 'ActionsLineGraph',
        aggregationAxisFormat: 'duration',
      },
    },
  );
  q(
    3,
    '03-expiry',
    'Queue expiry share by hour and game',
    `SELECT toStartOfHour(timestamp) AS hour, properties.game AS game, countIf(event = 'order_expired') / nullIf(count(), 0) AS expiry_share FROM events WHERE event IN ('order_matched', 'order_expired') AND timestamp >= now() - INTERVAL 7 DAY AND ${PUBLIC_SQL} GROUP BY hour, game ORDER BY hour`,
    ['order_matched', 'order_expired'],
    'Expired / (matched + expired) outcome events, not order-level probability: rerolls can emit another match; no order identifier is sent.',
  );
  t(
    3,
    '03-online',
    'Teammates going online per hour (includes supply)',
    [
      event('desk_online_changed', {
        properties: [
          { key: 'online', type: 'event', operator: 'exact', value: ['true'] },
        ],
      }),
    ],
    {
      interval: 'hour',
      dateRange: { date_from: '-7d' },
      filterTestAccounts: false,
      properties: [
        { key: 'internal', type: 'event', operator: 'is_not', value: ['true'] },
      ],
    },
    'Supply exception: teammate person internal flag is intentionally included, owner internal=true events excluded. Otherwise every teammate is filtered out. Counts transitions, not online concurrency.',
  );
  t(
    3,
    '03-passes',
    'Offer passes per funded order (aggregate proxy)',
    ['order_offer_passed', 'order_funded'],
    { trendsFilter: { display: 'ActionsLineGraph', formula: 'A / B' } },
    'Aggregate passes / funded events per day. No order id exists to compute exact passes per order.',
  );
  t(
    4,
    '04-traffic',
    'Visitors by acquisition channel',
    [event('$pageview', { math: 'dau' })],
    {
      breakdownFilter: {
        breakdown: '$session_entry_channel_type',
        breakdown_type: 'event',
      },
    },
  );
  t(4, '04-landing', 'Pageviews by route', ['$pageview'], {
    breakdownFilter: { breakdown: 'route', breakdown_type: 'event' },
  });
  t(4, '04-creators', 'Creator link landings', ['creator_link_landed']);
  add(
    4,
    '04-conversion',
    'Landing route to funded conversion',
    funnel(['$pageview', 'order_funded'], {
      breakdownFilter: { breakdown: 'route', breakdown_type: 'event' },
    }),
    ['$pageview', 'order_funded'],
  );
  add(
    5,
    '05-retention',
    'Weekly funded customer retention',
    {
      kind: 'RetentionQuery',
      ...base,
      dateRange: { date_from: '-90d' },
      retentionFilter: {
        targetEntity: { id: 'order_funded', type: 'events' },
        returningEntity: { id: 'order_funded', type: 'events' },
        retentionType: 'retention_first_time',
        period: 'Week',
        totalIntervals: 8,
      },
    },
    ['order_funded'],
  );
  add(
    5,
    '05-lifecycle',
    'Weekly funded customer lifecycle',
    {
      kind: 'LifecycleQuery',
      ...base,
      interval: 'week',
      series: [event('order_funded')],
      lifecycleFilter: {},
    },
    ['order_funded'],
  );
  add(
    5,
    '05-stickiness',
    'Booking stickiness (active days in 30 days)',
    {
      kind: 'StickinessQuery',
      ...base,
      interval: 'day',
      series: [event('order_funded')],
      stickinessFilter: {},
    },
    ['order_funded'],
  );
  t(6, '06-ratings', 'Review rating distribution', ['review_submitted'], {
    breakdownFilter: { breakdown: 'rating', breakdown_type: 'event' },
    trendsFilter: { display: 'ActionsBarValue' },
  });
  for (const [key, numerator, denominator] of [
    ['tips', 'tip_paid', 'order_completed'],
    ['trustpilot', 'trustpilot_clicked', 'review_confirmation_shown'],
    ['rebook', 'rebook_clicked', 'order_completed'],
  ])
    t(
      6,
      `06-${key}`,
      `${key} event rate (aggregate)`,
      [numerator, denominator],
      {
        trendsFilter: {
          display: 'ActionsLineGraph',
          formula: 'A / B',
          aggregationAxisFormat: 'percentage_scaled',
        },
      },
      'Event ratio in each day, not a deduplicated same-order causal conversion. May exceed 100% when events span dates or repeat.',
    );
  t(7, '07-exceptions-route', 'Exceptions by route', ['$exception'], {
    breakdownFilter: { breakdown: 'route', breakdown_type: 'event' },
  });
  t(7, '07-exceptions-release', 'Exceptions by release', ['$exception'], {
    breakdownFilter: { breakdown: 'app_release', breakdown_type: 'event' },
  });
  t(7, '07-failures', 'Checkout failures by reason', ['checkout_failed'], {
    breakdownFilter: { breakdown: 'reason_code', breakdown_type: 'event' },
  });
  t(
    7,
    '07-vitals',
    'LCP p90 by route (milliseconds)',
    [
      event('$web_vitals', {
        math: 'p90',
        math_property: '$web_vitals_LCP_value',
      }),
    ],
    {
      breakdownFilter: { breakdown: 'route', breakdown_type: 'event' },
      trendsFilter: {
        display: 'ActionsLineGraph',
        aggregationAxisFormat: 'duration_ms',
      },
    },
  );
  for (const name of ['$rageclick', '$dead_click'])
    t(7, `07-${name.slice(1)}`, `${name.slice(1)} by route`, [name], {
      breakdownFilter: { breakdown: 'route', breakdown_type: 'event' },
    });
  q(
    7,
    '07-outbox',
    'Outbox heartbeat: delivered facts per hour',
    `SELECT toStartOfHour(timestamp) AS hour, count() AS delivered_events FROM events WHERE properties.source = 'outbox' AND timestamp >= now() - INTERVAL 7 DAY AND ${PUBLIC_SQL} GROUP BY hour ORDER BY hour`,
    Object.keys(OUTBOX_EVENT_CATALOGUE),
    'Activity proxy, not scheduler heartbeat. Idle marketplace can have zero events with a healthy drain; no synthetic heartbeat event exists in the catalogue.',
  );
  t(8, '08-generations', 'Sparky generations', ['$ai_generation']);
  t(
    8,
    '08-tokens',
    'Sparky actual input, output and cached tokens',
    [
      '$ai_input_tokens',
      '$ai_output_tokens',
      '$ai_cache_read_input_tokens',
    ].map((p) => event('$ai_generation', { math: 'sum', math_property: p })),
  );
  t(
    8,
    '08-latency',
    'Sparky generation latency p50 and p90',
    [
      event('$ai_generation', { math: 'median', math_property: '$ai_latency' }),
      event('$ai_generation', { math: 'p90', math_property: '$ai_latency' }),
    ],
    {
      trendsFilter: {
        display: 'ActionsLineGraph',
        aggregationAxisFormat: 'duration',
      },
    },
  );
  t(
    8,
    '08-cost',
    'Sparky token-derived cost USD (PostHog model pricing)',
    [
      event('$ai_generation', {
        math: 'sum',
        math_property: '$ai_total_cost_usd',
      }),
    ],
    {
      trendsFilter: {
        display: 'ActionsLineGraph',
        aggregationAxisPrefix: 'USD ',
      },
    },
    'PostHog derives cost from actual tokens and model pricing at ingestion; missing cost is unknown, not zero/free. Check LLM Analytics model pricing before interpreting.',
  );
  t(
    8,
    '08-handoff',
    'Handoff requests / generations',
    ['support_handoff_requested', '$ai_generation'],
    {
      trendsFilter: {
        display: 'ActionsLineGraph',
        formula: 'A / B',
        aggregationAxisFormat: 'percentage_scaled',
      },
    },
    'Aggregate event ratio, not conversation-level handoff probability.',
  );
  t(8, '08-tools', 'Generations by executed tool names', ['$ai_generation'], {
    breakdownFilter: { breakdown: 'tool_names', breakdown_type: 'event' },
  });
  q(
    2,
    '02-first-repeat',
    'Session funding by first vs repeat observed customer',
    `SELECT if(first_funding < checkout_at, 'repeat', 'first observed') AS customer_type, count() AS sessions_started, countIf(funded_at >= checkout_at AND funded_at <= checkout_at + INTERVAL 1 DAY) AS sessions_funded, sessions_funded / nullIf(sessions_started, 0) AS conversion_rate FROM (SELECT distinct_id, properties.$session_id AS session_id, minIf(timestamp, event = 'checkout_started') AS checkout_at, minIf(timestamp, event = 'order_funded') AS funded_at FROM events WHERE event IN ('checkout_started', 'order_funded') AND timestamp >= now() - INTERVAL 30 DAY AND ${PUBLIC_SQL} AND ${identified} GROUP BY distinct_id, session_id HAVING countIf(event = 'checkout_started') > 0 AND session_id IS NOT NULL) AS attempts LEFT JOIN (SELECT distinct_id, min(timestamp) AS first_funding FROM events WHERE event = 'order_funded' AND ${PUBLIC_SQL} AND ${identified} GROUP BY distinct_id) AS firsts ON attempts.distinct_id = firsts.distinct_id GROUP BY customer_type`,
    ['checkout_started', 'order_funded'],
    'Same-session funding within 24h; repeat means first observed funding predates checkout. Identified sessions only, no pre-tracking history; missing session links excluded.',
  );
  for (const goal of ['user_signed_up', 'order_funded'])
    add(
      4,
      `04-web-${goal}`,
      `Web Analytics: ${goal} conversion goal`,
      {
        kind: 'WebOverviewQuery',
        ...base,
        conversionGoal: { customEventName: goal },
      },
      ['$pageview', goal],
      'Native Web Analytics overview with saved conversionGoal. Global Web Analytics UI selector is independent; no marketing subscription or group analytics.',
    );
  for (const [metric, unit] of [
    ['INP', 'duration_ms'],
    ['FCP', 'duration_ms'],
    ['CLS', 'numeric'],
  ])
    t(
      7,
      `07-vitals-${metric.toLowerCase()}`,
      `${metric} p90 by route`,
      [
        event('$web_vitals', {
          math: 'p90',
          math_property: `$web_vitals_${metric}_value`,
        }),
      ],
      {
        breakdownFilter: { breakdown: 'route', breakdown_type: 'event' },
        trendsFilter: {
          display: 'ActionsLineGraph',
          aggregationAxisFormat: unit,
        },
      },
    );
  const alertSpecs = [
    [
      'checkout-spike',
      'Checkout failed spike (>5 in rolling hour)',
      'checkout_failed',
      '1 HOUR',
      { upper: 5 },
    ],
    [
      'expiry-day',
      'Order expired (>3 in rolling day)',
      'order_expired',
      '1 DAY',
      { upper: 3 },
    ],
    [
      'outbox-zero',
      'Outbox delivered facts zero for 6h',
      null,
      '6 HOUR',
      { lower: 1 },
    ],
    [
      'pageviews-zero',
      'Pageviews zero for 24h',
      '$pageview',
      '24 HOUR',
      { lower: 1 },
    ],
    [
      'funding-zero',
      'Funded orders zero for 3 days',
      'order_funded',
      '3 DAY',
      { lower: 1 },
    ],
  ];
  // Silence alerts only mean something with steady traffic (spec: "after launch"). They stay
  // paused until real daily volume exists; flip this set to enable them.
  const PAUSED_UNTIL_LAUNCH = new Set(['outbox-zero', 'funding-zero']);
  const alerts = alertSpecs.map(([key, name, e, window, bounds]) => {
    const insightKey = `07-alert-${key}`;
    q(
      7,
      insightKey,
      name,
      `SELECT count() AS value FROM events WHERE ${e ? `event = '${e}'` : "properties.source = 'outbox'"} AND timestamp >= now() - INTERVAL ${window} AND ${PUBLIC_SQL}`,
      e ? [e] : Object.keys(OUTBOX_EVENT_CATALOGUE),
    );
    return {
      name: `${MARKER} ${name}`,
      insightKey,
      threshold: { configuration: { type: 'absolute', bounds } },
      condition: { type: 'absolute_value' },
      calculation_interval: 'hourly',
      enabled: !PAUSED_UNTIL_LAUNCH.has(key),
      config: {
        type: 'HogQLAlertConfig',
        column: 'value',
        evaluation: 'last_row',
      },
      investigation_agent_enabled: false,
      investigation_gates_notifications: false,
      skip_weekend: false,
    };
  });
  const catalogue = { ...EVENT_CATALOGUE, ...SERVER_EVENT_CATALOGUE };
  const events = [...Object.keys(catalogue), ...BUILT_INS].map((name) => ({
    name,
    description: `${MARKER} ${name.replaceAll('_', ' ')}. Source: ${name in OUTBOX_EVENT_CATALOGUE ? 'database outbox; authoritative transition, at-least-once delivery' : name in EVENT_CATALOGUE ? 'browser; Analytics consent required' : name in SERVER_EVENT_CATALOGUE ? 'server direct; identified only with Analytics consent' : name.startsWith('$ai_') ? 'Sparky server telemetry; no prompt/answer content' : 'PostHog SDK built-in; consent-gated'}. Properties: ${Object.keys(catalogue[name] || {}).join(', ') || 'sanitized SDK metadata only'}.`,
    tags: ['duoly', area(name)],
    verified: true,
  }));
  const props = new Map();
  for (const [name, schema] of Object.entries(catalogue))
    for (const [key, kind] of Object.entries(schema)) {
      const old = props.get(key);
      props.set(key, {
        name: key,
        property_type:
          kind === 'int' ? 'Numeric' : kind === 'bool' ? 'Boolean' : 'String',
        description: `${MARKER} ${key.replaceAll('_', ' ')}; ${key.endsWith('_cents') ? 'integer EUR cents (divide by 100 for EUR)' : kind === 'int' ? 'non-negative integer' : kind === 'bool' ? 'boolean' : Array.isArray(kind) ? `allowed: ${kind.join(', ')}` : 'bounded slug; no free text'}. Events: ${[...(old?.events || []), name].join(', ')}.`,
        tags: ['duoly', area(name)],
        verified: true,
        events: [...(old?.events || []), name],
      });
    }
  for (const [name, type, description] of [
    [
      'source',
      'String',
      'Producer source; outbox identifies delivered database facts.',
    ],
    ['internal', 'Boolean', 'Owner/internal outbox activity: exclude true.'],
    ['route', 'String', 'Sanitized route template, never raw private URLs.'],
    ['app_release', 'String', 'Deployed application release.'],
    [
      '$ai_input_tokens',
      'Numeric',
      'Actual provider input tokens including cache.',
    ],
    ['$ai_output_tokens', 'Numeric', 'Actual provider output tokens.'],
    [
      '$ai_cache_read_input_tokens',
      'Numeric',
      'Actual cached input tokens, a subset of input tokens.',
    ],
    ['$ai_latency', 'Numeric', 'Elapsed seconds.'],
    ['$ai_model', 'String', 'Provider model identifier.'],
    ['$ai_provider', 'String', 'Model provider.'],
    ['$ai_is_error', 'Boolean', 'Generation or tool failed.'],
    ['$ai_http_status', 'Numeric', 'Provider response status.'],
    ['$ai_span_name', 'String', 'Safe tool identifier, no arguments.'],
    [
      '$ai_total_cost_usd',
      'Numeric',
      'PostHog computed USD from token usage and model price; missing means unknown.',
    ],
    ['$ai_trace_id', 'String', 'Opaque per-turn trace.'],
    ['$ai_span_id', 'String', 'Opaque span identifier.'],
    ['$ai_parent_id', 'String', 'Opaque parent generation identifier.'],
    [
      '$ai_session_id',
      'String',
      'Conversation identifier only with Analytics consent.',
    ],
    [
      'tool_names',
      'String',
      'Safe executed tool names; no definitions or results.',
    ],
    ['outcome', 'String', 'Bounded outcome enum.'],
    ['viewer_role', 'String', 'Customer or teammate; browser super property.'],
    ['$device_type', 'String', 'SDK device classification.'],
    [
      '$session_entry_channel_type',
      'String',
      'PostHog channel classification.',
    ],
    [
      '$web_vitals_LCP_value',
      'Numeric',
      'Largest contentful paint, milliseconds.',
    ],
  ])
    if (!props.has(name))
      props.set(name, {
        name,
        property_type: type,
        description: `${MARKER} ${description}`,
        tags: ['duoly', area(name)],
        verified: true,
      });
  const cohorts = [
    {
      name: `${MARKER} Funded customers`,
      description: `${MARKER} Identified people with 1+ order_funded in 365 days. Personless facts cannot form customers.`,
      values: [behaviors('order_funded')],
    },
    {
      name: `${MARKER} Repeat customers (2+ order_funded)`,
      description: `${MARKER} 2+ observed funded events in 365 days, not lifetime.`,
      values: [
        behaviors('order_funded', 'performed_event_multiple', {
          operator: 'gte',
          operator_value: 2,
        }),
      ],
    },
    {
      name: `${MARKER} Checkout started not funded 24h`,
      description: `${MARKER} Checkout in last 24h and no funding in last 24h, person-level (not same-session).`,
      values: [
        behaviors('checkout_started', 'performed_event', {
          time_value: 24,
          time_interval: 'hour',
        }),
        behaviors('order_funded', 'performed_event', {
          time_value: 24,
          time_interval: 'hour',
          negation: true,
        }),
      ],
    },
    {
      name: `${MARKER} Teammates`,
      description: `${MARKER} Actual browser person role=teammate OR observed desk online transition within 365 days. No group analytics.`,
      operator: 'OR',
      values: [
        { key: 'role', type: 'person', operator: 'exact', value: ['teammate'] },
        behaviors('desk_online_changed'),
      ],
    },
  ].map(({ values, operator = 'AND', ...rest }) => ({
    ...rest,
    is_static: false,
    filters: {
      properties: {
        type: operator,
        values: operator === 'AND' ? values : values.map((v) => group([v])),
      },
      filterTestAccounts: !rest.name.endsWith('Teammates'),
    },
  }));
  const actions = [
    {
      name: `${MARKER} Funded order`,
      description: `${MARKER} Database-confirmed funding, all payment methods.`,
      tags: ['duoly', 'booking'],
      steps: [{ event: 'order_funded' }],
      post_to_slack: false,
    },
  ];
  const surveys = [
    {
      name: `${MARKER} Survey A: booking blockers`,
      description: `${MARKER} DRAFT: positive checkout_started trigger only. API cannot express NOT order_funded in same session. checkout_abandon_detected is catalogued but deliberately not emitted. Do not launch until safe session-level eligibility exists.`,
      questions: [
        {
          type: 'single_choice',
          question: 'What stopped you from booking?',
          choices: [
            'Price',
            'No suitable teammate',
            'Payment problem',
            'Just browsing',
            'Other',
          ],
          hasOpenChoice: true,
          description: 'Do not include personal or payment details.',
          descriptionContentType: 'text',
          optional: false,
        },
      ],
      conditions: {
        events: {
          values: [{ name: 'checkout_started' }],
          repeatedActivation: false,
        },
        seenSurveyWaitPeriodInDays: 7,
      },
    },
    {
      name: `${MARKER} Survey B: book again`,
      description: `${MARKER} Post-review NPS-style 0-10 booking intent. Draft because the site explicitly disables surveys; no site code changed.`,
      questions: [
        {
          type: 'rating',
          question: 'How likely are you to book again?',
          display: 'number',
          scale: 10,
          isNpsQuestion: true,
          lowerBoundLabel: 'Not at all likely',
          upperBoundLabel: 'Extremely likely',
          optional: false,
        },
      ],
      conditions: {
        events: {
          values: [{ name: 'review_confirmation_shown' }],
          repeatedActivation: false,
        },
        seenSurveyWaitPeriodInDays: 7,
      },
    },
  ].map((s) => ({
    ...s,
    type: 'popover',
    schedule: 'once',
    start_date: null,
    end_date: null,
    archived: false,
    responses_limit: 100,
    enable_partial_responses: false,
  }));
  return {
    dashboards,
    heatmapSettings: {
      capture_mode: 'url_allowlist',
      url_allowlist: [
        'https://duoly.gg/',
        'https://duoly.gg/games/*',
        'https://duoly.gg/pro',
      ],
    },
    insights,
    events,
    properties: [...props.values()],
    cohorts,
    actions,
    surveys,
    alerts,
    settings: {
      timezone: 'Europe/Vienna',
      app_urls: ['https://duoly.gg'],
      capture_dead_clicks: true,
      autocapture_exceptions_opt_in: true,
      autocapture_web_vitals_opt_in: true,
      surveys_opt_in: true,
      heatmaps_opt_in: true,
      test_account_filters_default_checked: true,
      test_account_filters: INTERNAL_FILTERS,
    },
  };
}
