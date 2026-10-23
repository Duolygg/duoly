import { FAQ_TABS } from '../../design-reference/lib/faq.js';

export const CHIPS = {
  guest: [
    'How does Duoly work?',
    'How much does it cost?',
    'Is my account safe?',
    'Talk to a human',
  ],
  customer: [
    'Where’s my teammate?',
    'Cancel or refund',
    'My teammate isn’t great',
    'Talk to a human',
  ],
  teammate: [
    'When do I get paid?',
    'Why can’t I go online?',
    'Why am I not getting orders?',
    'How does the deposit work?',
    'Talk to an admin',
  ],
} as const;

export type SupportRole = keyof typeof CHIPS;
export type CustomerOrder = {
  id: string;
  reference: string;
  title: string;
  game: string;
  units: number;
  status: string;
  amountEurCents: number;
  queuedAt: string;
  teammateName: string | null;
  rerollUntil: string | null;
};
export type SupportPerson = {
  role: SupportRole;
  userId?: string;
  name: string;
  email?: string;
  image?: string;
  customer?: {
    currentOrder: CustomerOrder | null;
    recentOrders: CustomerOrder[];
  };
  teammate?: {
    assignment: {
      orderId: string;
      reference: string;
      title: string;
      game: string;
      units: number;
      customerName: string;
      acceptedAt: string;
    } | null;
    completedOrders: number;
    recordedEarningsUsdCents: number;
    approvedGames: string[];
    discordConnected: boolean;
    suspended: boolean;
  };
};

export type PreparedReply = {
  text: string;
  handoff?: boolean;
  chips?: string[];
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] || '';
const human =
  /\b(human|agent|admin|person|real person|someone|support team|staff|mensch|mitarbeiter)\b|talk to (a|an|the)|speak to/i;
const moneyDispute =
  /chargeback|charged wrong|money dispute|stolen|fraud|refund refused|abgebucht|geld zurück/i;
const safety =
  /unsafe|threat|harass|stalk|dox|suicid|violence|sexually|bedroh|beläst/i;
const upset = /furious|angry|scam|hate|terrible|unacceptable|wütend|betrug/i;

const CURRENT_FACTS = [
  'Stripe authorises a card or wallet payment at checkout. It charges only when a teammate accepts.',
  'If nobody accepts within 5 minutes, or the customer cancels before acceptance, nothing is charged. Stripe releases the hold. A bank may take a few days to show that release.',
  'There is no Duoly wallet or balance. There is no cashback or reward level system yet.',
  'Booking, checkout, the 5 minute queue, acceptance, two rerolls during the first 5 minutes after acceptance, order chat with a safety filter, proof upload, completion, recorded teammate earnings, applications and Discord account linking are built.',
  'Tips, star reviews, reports and their bounty, teammate presence, trust levels and deposits, weekly payouts, priority, the leaderboard and Duoly PRO are coming later.',
  'A teammate can upload 1 to 5 proof images and mark an assignment complete. Earnings are recorded when completion succeeds. A payout schedule is not live yet.',
];

const orderLine = (order: CustomerOrder) =>
  `${order.reference} (${order.id}): ${order.title}, ${order.game}, ${order.units} unit${order.units === 1 ? '' : 's'}, status ${order.status}, €${(order.amountEurCents / 100).toFixed(2)}, queued ${order.queuedAt}, teammate ${order.teammateName ?? 'none'}, reroll until ${order.rerollUntil ?? 'none'}`;

function chipAnswer(person: SupportPerson, chip: string): string {
  if (chip === 'How does Duoly work?')
    return 'First, choose your game and session, enter your in-game details, complete Stripe checkout, then join the 5 minute queue. A verified teammate accepts, adds you in-game and plays with you on your own account.';
  if (chip === 'How much does it cost?')
    return 'Prices depend on the game, service and bundle. You see the exact total before you authorise payment at Stripe checkout.';
  if (chip === 'Is my account safe?')
    return 'You always play on your own account. Never share your login. Duoly blocks requests for passwords and outside payments in order chat.';
  if (chip === 'Where’s my teammate?') {
    const order = person.customer?.currentOrder;
    if (!order)
      return 'You do not have an open order right now. Start from the homepage when you are ready to book.';
    if (order.status === 'queued')
      return `${order.reference}, your ${order.title} for ${order.game}, is in the 5 minute queue. If nobody accepts, nothing is charged and Stripe releases the payment hold. Follow it in your order room at /queue/${order.id}.`;
    if (order.status === 'in_progress')
      return `${order.teammateName ?? 'Your teammate'} accepted ${order.reference}. Open /queue/${order.id} to chat and see the order.`;
    return `${order.reference} is ${order.status.replace('_', ' ')}. Open /queue/${order.id} for its current details.`;
  }
  if (chip === 'Cancel or refund') {
    const order = person.customer?.currentOrder;
    if (order?.status === 'queued')
      return `You can cancel ${order.reference} in /queue/${order.id}. Before a teammate accepts, nothing is charged and the hold is released by Stripe. Your bank may take a few days to show the release.`;
    return 'Before a teammate accepts, you can cancel and nothing is charged. If nobody accepts within 5 minutes, Stripe releases the hold automatically. If a teammate already accepted and there is a money problem, I can get a human to review it.';
  }
  if (chip === 'My teammate isn’t great')
    return 'You can reroll during the first 5 minutes after acceptance, up to twice per order. For toxic behaviour or a safety concern, keep the details in Duoly chat and ask for a human. Reports and review ratings are coming later.';
  if (chip === 'When do I get paid?') {
    const cents = person.teammate?.recordedEarningsUsdCents ?? 0;
    return `Your recorded earnings are $${(cents / 100).toFixed(2)}. Scheduled teammate payments are coming later, so Duoly does not have a live payout schedule yet. Ask an admin if you need help with a specific earning.`;
  }
  if (chip === 'Why can’t I go online?')
    return 'The teammate online toggle and live presence are coming later. Your dashboard still shows eligible orders based on your approved games. Connect Discord first because accepting an order requires it.';
  if (chip === 'Why am I not getting orders?') {
    const games = person.teammate?.approvedGames ?? [];
    return `You are approved for ${games.length ? games.join(', ') : 'no games yet'}. Eligible orders appear on your teammate dashboard. The presence toggle, priority controls and new-order bell are coming later. Ask an admin to check your game access if the list stays empty.`;
  }
  if (chip === 'How does the deposit work?')
    return 'Trust levels and teammate deposits are coming later. No live deposit is being held. Your completed assignments create recorded earnings.';
  return 'I can get someone from the Duoly team to help here.';
}

export function preparedAnswers(person: SupportPerson): string[] {
  return CHIPS[person.role].map(
    (chip) => `${chip}\n${chipAnswer(person, chip)}`,
  );
}

const normalise = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '');

export function preparedReply(
  person: SupportPerson,
  input: string,
): PreparedReply {
  const text = input.trim();
  const exact = CHIPS[person.role].find(
    (chip) => normalise(chip) === normalise(text),
  );
  if (exact && /talk to/i.test(exact)) return { text: '', handoff: true };
  if (exact) return { text: chipAnswer(person, exact) };
  if (
    human.test(text) ||
    moneyDispute.test(text) ||
    safety.test(text) ||
    upset.test(text)
  )
    return { text: '', handoff: true };
  const x = normalise(text);
  let chip: string | undefined;
  if (/cancel|refund|charge|money back|hold/.test(x)) chip = 'Cancel or refund';
  else if (
    /where|status|queue|teammate|order/.test(x) &&
    person.role === 'customer'
  )
    chip = 'Where’s my teammate?';
  else if (/toxic|rude|reroll|re-roll|bad teammate|left|afk/.test(x))
    chip = 'My teammate isn’t great';
  else if (/price|cost|how much/.test(x)) chip = 'How much does it cost?';
  else if (/safe|password|account|ban/.test(x)) chip = 'Is my account safe?';
  else if (/how.*work|what is duoly|book|order/.test(x))
    chip = 'How does Duoly work?';
  else if (/paid|payout|earn|money/.test(x) && person.role === 'teammate')
    chip = 'When do I get paid?';
  else if (/online|offline|toggle/.test(x) && person.role === 'teammate')
    chip = 'Why can’t I go online?';
  else if (
    /orders|getting|notification|bell/.test(x) &&
    person.role === 'teammate'
  )
    chip = 'Why am I not getting orders?';
  else if (/deposit|trust|tier/.test(x) && person.role === 'teammate')
    chip = 'How does the deposit work?';
  if (chip) return { text: chipAnswer(person, chip) };
  return {
    text: 'I’m not sure about that one. I can get someone from the team.',
    chips: [
      person.role === 'teammate' ? 'Talk to an admin' : 'Talk to a human',
    ],
  };
}

export function greeting(person: SupportPerson): string {
  const name = person.role === 'guest' ? '' : firstName(person.name);
  if (person.role === 'teammate')
    return `Hey ${name || 'there'}! I’m Sparky. I know your approved games, assignment and recorded earnings. Ask me anything, or get an admin.`;
  return `Hey${name ? ` ${name}` : ''}! I’m Sparky, Duoly’s assistant. I can check your order, explain payments, or get you a human.`;
}

export function buildGroundingContext(person: SupportPerson): string {
  const faq = FAQ_TABS.flatMap((tab) =>
    tab.items.map(([question, answer]) => `${question}\n${answer}`),
  ).join('\n\n');
  const ownData =
    person.role === 'customer'
      ? [
          `Current order: ${person.customer?.currentOrder ? orderLine(person.customer.currentOrder) : 'none'}`,
          'Recent orders:',
          ...(person.customer?.recentOrders.map(orderLine) ?? []),
        ].join('\n')
      : person.role === 'teammate'
        ? [
            `Current assignment: ${person.teammate?.assignment ? JSON.stringify(person.teammate.assignment) : 'none'}`,
            `Completed orders: ${person.teammate?.completedOrders ?? 0}`,
            `Recorded earnings USD cents: ${person.teammate?.recordedEarningsUsdCents ?? 0}`,
            `Approved games: ${(person.teammate?.approvedGames ?? []).join(', ') || 'none'}`,
            `Discord connected: ${person.teammate?.discordConnected ? 'yes' : 'no'}`,
            `Suspended: ${person.teammate?.suspended ? 'yes' : 'no'}`,
          ].join('\n')
        : 'Guest. No account or order data is available.';
  return [
    'AUTHORITATIVE CURRENT FACTS',
    ...CURRENT_FACTS,
    '',
    `ASKER\nRole: ${person.role}\nName: ${person.name}\n${ownData}`,
    '',
    'PREPARED ANSWERS',
    preparedAnswers(person).join('\n\n'),
    '',
    'FAQ',
    faq,
  ].join('\n');
}
