import type { EmailContent } from '../model.ts';
import type { LoyaltyTier } from '../theme.ts';
import { loyaltyTiers } from '../theme.ts';

/**
 * Transactional emails the application sends through the Resend API.
 * Amounts are integer minor units (cents) to match the order foundation.
 */

export interface Money {
  cents: number;
  currency: 'EUR' | 'USD';
}

export function formatMoney(
  money: Money,
  options: { sign?: boolean } = {},
): string {
  const formatted = new Intl.NumberFormat(
    money.currency === 'USD' ? 'en-US' : 'en-IE',
    {
      style: 'currency',
      currency: money.currency,
    },
  ).format(Math.abs(money.cents) / 100);
  if (!options.sign) return money.cents < 0 ? `\u2212${formatted}` : formatted;
  return `${money.cents < 0 ? '\u2212' : '+'}${formatted}`;
}

export interface Game {
  name: string;
  /** Public path of the game icon, for example /assets/games/valorant.png. */
  icon: string;
}

export interface OrderSummary {
  id: string;
  game: Game;
  service: string;
  units: number;
  unit: 'game' | 'hour';
  region: string;
  rank?: string;
}

export interface TeammateCard {
  name: string;
  avatar: string;
  flag?: string;
  country?: string;
  rank?: string;
  rating?: string;
  languages?: string[];
  bio?: string;
}

const plural = (count: number, unit: string) =>
  `${count} ${unit}${count === 1 ? '' : 's'}`;

function orderTitle(order: OrderSummary): string {
  return `${order.service} \u00d7 ${plural(order.units, order.unit)}`;
}

function orderMeta(order: OrderSummary): string[] {
  return [
    order.game.name,
    order.region,
    ...(order.rank ? [`from ${order.rank}`] : []),
  ];
}

const join = (site: string, path: string) =>
  `${site.replace(/\/$/, '')}${path}`;

// ---------------------------------------------------------------------------------------------
// Account

export interface WelcomeData {
  firstName: string;
}

export function welcome(data: WelcomeData, site: string): EmailContent {
  return {
    subject: `Welcome to Duoly, ${data.firstName}`,
    preheader:
      'Your account is ready. Here’s how to get a high-rank teammate in your lobby.',
    eyebrow: 'Welcome to Duoly',
    title: `Hey ${data.firstName}, you’re in.`,
    titleAccent: 'Let’s find your duo.',
    hero: 'brand',
    blocks: [
      {
        type: 'paragraph',
        text: 'Your account is confirmed. Book a rank-verified teammate for 15 games, from League of Legends to Pokémon Unite, and play together within minutes.',
      },
      {
        type: 'list',
        title: 'How it works',
        items: [
          {
            title: 'Pick your game',
            text: 'Choose a service, your rank and your region. The price is shown upfront.',
          },
          {
            title: 'Pay once',
            text: 'Check out in seconds. Your Duoly balance is used first.',
          },
          {
            title: 'Duo up',
            text: 'The first eligible teammate to accept joins your lobby, usually within a couple of minutes.',
          },
          {
            title: 'Earn as you play',
            text: 'Every finished order counts toward Silver, Gold and beyond, with cashback on each one.',
          },
        ],
      },
      {
        type: 'button',
        label: 'Find my duo',
        url: join(site, '/'),
        secondary: { label: 'My dashboard', url: join(site, '/dashboard') },
      },
      {
        type: 'note',
        tone: 'safe',
        title: 'Stay safe',
        text: 'Keep payments and logins on Duoly. Teammates will never ask for them.',
      },
    ],
    reason: 'You’re getting this because you created a Duoly account.',
  };
}

// ---------------------------------------------------------------------------------------------
// Orders

export interface OrderConfirmedData {
  firstName: string;
  order: OrderSummary;
  lines: { label: string; amount: Money }[];
  total: Money;
  paidWith: string;
  paidAt: string;
}

export function orderConfirmed(
  data: OrderConfirmedData,
  site: string,
): EmailContent {
  const room = join(site, `/queue/${encodeURIComponent(data.order.id)}`);
  return {
    subject: `Order ${data.order.id} confirmed: finding your duo`,
    preheader: `${orderTitle(data.order)} in ${data.order.game.name}. Teammates are being notified now.`,
    eyebrow: 'Order confirmed',
    title: 'You’re in the queue.',
    titleAccent: 'Finding your duo now.',
    headerMeta: `Order ${data.order.id}`,
    blocks: [
      {
        type: 'order',
        gameIcon: data.order.game.icon,
        gameName: data.order.game.name,
        title: orderTitle(data.order),
        meta: orderMeta(data.order),
        status: { label: 'Finding your duo', tone: 'live' },
      },
      {
        type: 'steps',
        steps: [
          { label: 'Paid', state: 'done' },
          { label: 'Matching', state: 'active' },
          { label: 'In game', state: 'todo' },
          { label: 'Done', state: 'todo' },
        ],
      },
      {
        type: 'paragraph',
        text: `Thanks, ${data.firstName}. Eligible teammates are being notified right now and most orders are picked up within a couple of minutes. Keep the order room open to see the moment someone accepts.`,
      },
      { type: 'button', label: 'Open order room', url: room },
      {
        type: 'details',
        title: 'Receipt',
        rows: [
          ...data.lines.map((line) => ({
            label: line.label,
            value: formatMoney(line.amount),
            accent: line.amount.cents < 0,
          })),
          { label: 'Paid with', value: data.paidWith },
          { label: 'Date', value: data.paidAt },
        ],
        total: { label: 'Total paid', value: formatMoney(data.total) },
      },
      {
        type: 'note',
        tone: 'safe',
        title: 'Not matched within 5 minutes?',
        text: 'The order cancels itself and you pay nothing: a card, wallet or PayPal hold is released, and any other payment is refunded in full.',
      },
    ],
    reason: 'You’re getting this because you placed an order on Duoly.',
  };
}

export interface TeammateFoundData {
  firstName: string;
  order: OrderSummary;
  ign: string;
  teammate: TeammateCard;
  rerollsLeft: number;
}

export function teammateFound(
  data: TeammateFoundData,
  site: string,
): EmailContent {
  const room = join(site, `/queue/${encodeURIComponent(data.order.id)}`);
  const name = data.teammate.name;
  const blocks: EmailContent['blocks'] = [
    { type: 'teammate', ...data.teammate, status: 'Joining your lobby' },
    {
      type: 'steps',
      steps: [
        { label: 'Paid', state: 'done' },
        { label: 'Matched', state: 'done' },
        { label: 'In game', state: 'active' },
        { label: 'Done', state: 'todo' },
      ],
    },
    {
      type: 'paragraph',
      text: `${name} accepted your ${orderTitle(data.order)} order in ${data.order.game.name}. Your in-game name ${data.ign} is already shared, so hop into the order chat and sort out the invite.`,
    },
    { type: 'button', label: 'Open order chat', url: room },
  ];
  if (data.rerollsLeft > 0) {
    blocks.push({
      type: 'note',
      tone: 'info',
      title: 'Not the right fit?',
      text: `You can swap teammates ${data.rerollsLeft === 1 ? 'once more' : `up to ${data.rerollsLeft} times`} within 5 minutes of the match. Tap Re-roll in the order room.`,
    });
  }
  blocks.push({
    type: 'note',
    tone: 'safe',
    title: 'Keep it on Duoly',
    text: 'Teammates will never ask for your password, login or a payment outside Duoly. If someone does, report it from the order room.',
  });
  return {
    subject: `${name} is your duo for ${data.order.game.name}`,
    preheader: `${name} accepted order ${data.order.id}. Open the chat to get into a lobby.`,
    eyebrow: 'Match found',
    title: `Meet ${name},`,
    titleAccent: 'your teammate is ready.',
    headerMeta: `Order ${data.order.id}`,
    blocks,
    reason: 'You’re getting this because you placed an order on Duoly.',
  };
}

export interface OrderCompletedData {
  firstName: string;
  order: OrderSummary;
  teammate: { name: string; avatar: string };
  cashback: Money;
  tier: LoyaltyTier;
  balance: Money;
  completedOrders: number;
  nextTierAt?: number;
}

export function orderCompleted(
  data: OrderCompletedData,
  site: string,
): EmailContent {
  const room = join(site, `/queue/${encodeURIComponent(data.order.id)}`);
  const tier = loyaltyTiers[data.tier];
  const name = data.teammate.name;
  return {
    subject: `GG! Rate your session with ${name}`,
    preheader: `Order ${data.order.id} is complete and ${formatMoney(data.cashback)} cashback is in your balance.`,
    eyebrow: 'Order complete',
    title: `GG, ${data.firstName}!`,
    titleAccent: `How was ${name}?`,
    hero: 'mascots',
    headerMeta: `Order ${data.order.id}`,
    blocks: [
      {
        type: 'order',
        gameIcon: data.order.game.icon,
        gameName: data.order.game.name,
        title: orderTitle(data.order),
        meta: [...orderMeta(data.order), `with ${name}`],
        status: { label: 'Completed', tone: 'done' },
      },
      {
        type: 'stats',
        items: [
          {
            label: 'Cashback earned',
            value: formatMoney(data.cashback, { sign: true }),
            caption: `${tier.cashback}% at ${tier.name}`,
            tone: 'safe',
          },
          {
            label: 'Duoly balance',
            value: formatMoney(data.balance),
            caption: 'use it at checkout',
            tone: 'info',
          },
          ...(data.nextTierAt
            ? [
                {
                  label: 'Next level',
                  value: `${data.completedOrders}/${data.nextTierAt}`,
                  caption: 'orders',
                  tone: 'gold' as const,
                },
              ]
            : []),
        ],
      },
      {
        type: 'paragraph',
        text: `Your rating helps other players find great teammates. If ${name} carried, add a tip: 100% of it goes to them.`,
      },
      {
        type: 'button',
        label: 'Rate and tip',
        url: `${room}#review`,
        secondary: { label: 'Book again', url: join(site, '/') },
      },
      {
        type: 'note',
        tone: 'warn',
        title: 'Something off?',
        text: 'Report a problem from the order room. Our team reviews every report.',
      },
    ],
    reason: 'You’re getting this because you placed an order on Duoly.',
  };
}

export interface OrderCancelledData {
  firstName: string;
  order: OrderSummary;
  reason: 'no_teammate' | 'customer' | 'support';
  supportNote?: string;
  refund: Money;
  balance: Money;
}

export function orderCancelled(
  data: OrderCancelledData,
  site: string,
): EmailContent {
  const intro = {
    no_teammate:
      'Nobody picked up your order within 5 minutes, so we cancelled it and returned the full amount to your Duoly balance. Evenings in Europe are usually the busiest time to queue.',
    customer:
      'You cancelled your order before a teammate accepted it, so the full amount is back in your Duoly balance.',
    support:
      'Our support team cancelled your order and returned the full amount to your Duoly balance.',
  }[data.reason];
  const blocks: EmailContent['blocks'] = [
    {
      type: 'order',
      gameIcon: data.order.game.icon,
      gameName: data.order.game.name,
      title: orderTitle(data.order),
      meta: orderMeta(data.order),
      status: { label: 'Cancelled', tone: 'off' },
    },
    { type: 'paragraph', text: intro },
  ];
  if (data.reason === 'support' && data.supportNote) {
    blocks.push({
      type: 'quote',
      author: 'Note from Duoly support',
      text: data.supportNote,
    });
  }
  blocks.push(
    {
      type: 'details',
      rows: [
        {
          label: 'Refunded to balance',
          value: formatMoney(data.refund, { sign: true }),
          accent: true,
        },
      ],
      total: { label: 'New balance', value: formatMoney(data.balance) },
    },
    {
      type: 'paragraph',
      text: 'Your balance never expires and is used first at checkout.',
    },
    {
      type: 'button',
      label: 'Queue again',
      url: join(site, '/'),
      secondary: { label: 'View balance', url: join(site, '/dashboard') },
    },
  );
  return {
    subject:
      data.reason === 'no_teammate'
        ? `No duo this time: ${formatMoney(data.refund)} is back in your balance`
        : `Order ${data.order.id} cancelled and refunded`,
    preheader: `${formatMoney(data.refund)} was added to your Duoly balance.`,
    eyebrow: 'Order cancelled',
    title:
      data.reason === 'no_teammate' ? 'No duo this time.' : 'Order cancelled.',
    titleAccent: 'Your money is back.',
    headerMeta: `Order ${data.order.id}`,
    blocks,
    reason: 'You’re getting this because you placed an order on Duoly.',
  };
}

// ---------------------------------------------------------------------------------------------
// Rewards

export interface LevelUpData {
  firstName: string;
  tier: Exclude<LoyaltyTier, 'bronze'>;
  gift: Money;
  completedOrders: number;
  next?: { tier: LoyaltyTier; at: number };
}

export function levelUp(data: LevelUpData, site: string): EmailContent {
  const tier = loyaltyTiers[data.tier];
  const next = data.next ? loyaltyTiers[data.next.tier] : undefined;
  return {
    subject: `You reached ${tier.name}! ${formatMoney(data.gift)} is on us`,
    preheader: `${tier.cashback}% back on every order from now on, plus a ${formatMoney(data.gift)} gift in your balance.`,
    eyebrow: 'Level up',
    title: `You hit ${tier.name}!`,
    titleAccent: `Here’s ${formatMoney(data.gift)} on us.`,
    hero: 'mascots',
    blocks: [
      {
        type: 'tier',
        tier: data.tier,
        headline: `${tier.cashback}% back on every order`,
        gift: `${formatMoney(data.gift)} gift added`,
      },
      {
        type: 'paragraph',
        text: `${data.completedOrders} completed orders, ${data.firstName}. From now on you get ${tier.cashback}% back on every order, added to your Duoly balance when it completes. Your ${formatMoney(data.gift)} level-up gift is already there.`,
      },
      ...(next && data.next
        ? [
            {
              type: 'stats' as const,
              items: [
                {
                  label: 'Orders completed',
                  value: String(data.completedOrders),
                  caption: `${tier.name} unlocked`,
                  tone: 'safe' as const,
                },
                {
                  label: 'Next level',
                  value: next.name,
                  caption: `at ${data.next.at} orders, ${next.cashback}% back`,
                  tone: 'info' as const,
                },
              ],
            },
          ]
        : []),
      { type: 'button', label: 'Use my balance', url: join(site, '/') },
    ],
    reason:
      'You’re getting this because you reached a new Duoly Rewards level.',
  };
}

// ---------------------------------------------------------------------------------------------
// Teammates

export interface ApplicationData {
  firstName: string;
  game: string;
}

export function applicationReceived(
  data: ApplicationData,
  site: string,
): EmailContent {
  return {
    subject: 'We got your Duoly teammate application',
    preheader: `Thanks for applying to play ${data.game} on Duoly. Here’s what happens next.`,
    eyebrow: 'Application received',
    title: 'Thanks for applying,',
    titleAccent: `${data.firstName}!`,
    hero: 'mascots',
    blocks: [
      {
        type: 'paragraph',
        text: `We’ve got your application to play ${data.game} on Duoly. Our team reviews every application by hand, including your rank and the profile link you shared.`,
      },
      {
        type: 'list',
        title: 'What happens next',
        items: [
          {
            title: 'Review',
            text: 'We check your rank, your history and your answers.',
          },
          {
            title: 'Decision',
            text: 'You’ll hear from us by email either way.',
          },
          {
            title: 'Get set up',
            text: 'Approved teammates link Discord, set their games and go online.',
          },
        ],
      },
      {
        type: 'note',
        tone: 'info',
        title: 'While you wait',
        text: 'Read the teammate rules so you’re ready from your first order.',
      },
      {
        type: 'button',
        label: 'Read the teammate rules',
        url: join(site, '/rules'),
      },
    ],
    reason:
      'You’re getting this because you applied to become a Duoly teammate.',
  };
}

export interface ApplicationApprovedData {
  firstName: string;
  games: string[];
}

export function applicationApproved(
  data: ApplicationApprovedData,
  site: string,
): EmailContent {
  const games =
    data.games.length > 1
      ? `${data.games.slice(0, -1).join(', ')} and ${data.games[data.games.length - 1]}`
      : (data.games[0] ?? 'your game');
  return {
    subject: 'You’re in! Welcome to the Duoly team',
    preheader: `You can now take orders for ${games}. Three quick steps to your first order.`,
    eyebrow: 'You’re in',
    title: 'Welcome to the team,',
    titleAccent: `${data.firstName}.`,
    hero: 'brand',
    blocks: [
      {
        type: 'paragraph',
        text: `Your application was approved. You can now take orders for ${games}.`,
      },
      {
        type: 'stats',
        items: [
          {
            label: 'Your share',
            value: '60%',
            caption: 'of every order',
            tone: 'safe',
          },
          {
            label: 'Tips',
            value: '100%',
            caption: 'always yours',
            tone: 'gold',
          },
          {
            label: 'Payday',
            value: 'Fridays',
            caption: 'weekly, in USD',
            tone: 'info',
          },
        ],
      },
      {
        type: 'list',
        title: 'Get ready for your first order',
        items: [
          {
            title: 'Link your Discord',
            text: 'You need it to go online and to get the Teammate role on our server.',
          },
          {
            title: 'Finish your profile',
            text: 'Add a photo, a short bio and your languages. Customers see them when you accept.',
          },
          {
            title: 'Go online',
            text: 'Flip the switch on your dashboard. Orders for your games show up with a bell.',
          },
        ],
      },
      {
        type: 'button',
        label: 'Open teammate dashboard',
        url: join(site, '/teammate'),
        secondary: { label: 'Teammate rules', url: join(site, '/rules') },
      },
      {
        type: 'note',
        tone: 'gold',
        title: 'About your security deposit',
        text: 'As a Rookie, 10% of each payout is held for 14 days and released if there’s no dispute. It drops as you complete orders, down to 0% at Legend.',
      },
    ],
    reason:
      'You’re getting this because your Duoly teammate application was approved.',
  };
}

export function applicationDeclined(
  data: ApplicationData,
  site: string,
): EmailContent {
  return {
    subject: 'An update on your Duoly application',
    preheader: `About your application to play ${data.game} on Duoly.`,
    eyebrow: 'Application update',
    title: 'Thanks for applying,',
    titleAccent: `${data.firstName}.`,
    blocks: [
      {
        type: 'paragraph',
        text: `We’ve reviewed your application to play ${data.game} on Duoly, and we can’t approve it right now.`,
      },
      {
        type: 'paragraph',
        text: 'Spots depend on demand for each game and rank, so this can change. You’re welcome to apply again later, for example after a rank update or for another game.',
      },
      {
        type: 'button',
        label: 'See teammate requirements',
        url: join(site, '/apply'),
      },
    ],
    reason:
      'You’re getting this because you applied to become a Duoly teammate.',
  };
}

export interface PayoutData {
  firstName: string;
  weekLabel: string;
  status: 'paid' | 'on_hold';
  holdReason?: string;
  orders: number;
  rating: string;
  net: Money;
  tips: Money;
  depositsReleased: Money;
  adjustments: { reason: string; amount: Money }[];
  total: Money;
  heldNow?: { amount: Money; releases: string };
}

export function payout(data: PayoutData, site: string): EmailContent {
  const onHold = data.status === 'on_hold';
  const blocks: EmailContent['blocks'] = [
    {
      type: 'stats',
      items: [
        {
          label: 'Orders',
          value: String(data.orders),
          caption: 'completed',
          tone: 'info',
        },
        {
          label: 'Avg rating',
          value: `\u2605 ${data.rating}`,
          caption: 'this week',
          tone: 'gold',
        },
        {
          label: 'Tips',
          value: formatMoney(data.tips),
          caption: '100% yours',
          tone: 'safe',
        },
      ],
    },
  ];
  if (onHold) {
    blocks.push({
      type: 'note',
      tone: 'warn',
      title: 'Why it’s on hold',
      text:
        data.holdReason ??
        'Our team needs to check something before this payout goes out.',
    });
  } else {
    blocks.push({
      type: 'paragraph',
      text: `Nice week, ${data.firstName}. Your payout has been sent and usually lands within a few business days, depending on your bank.`,
    });
  }
  blocks.push({
    type: 'details',
    title: data.weekLabel,
    rows: [
      { label: 'Earnings after deposit', value: formatMoney(data.net) },
      { label: 'Tips', value: formatMoney(data.tips) },
      { label: 'Deposits released', value: formatMoney(data.depositsReleased) },
      ...data.adjustments.map((adjustment) => ({
        label: adjustment.reason,
        value: formatMoney(adjustment.amount, { sign: true }),
        accent: adjustment.amount.cents > 0,
      })),
    ],
    total: {
      label: onHold ? 'Payout on hold' : 'Total payout',
      value: formatMoney(data.total),
    },
  });
  if (data.heldNow) {
    blocks.push({
      type: 'note',
      tone: 'gold',
      title: `${formatMoney(data.heldNow.amount)} in deposits held`,
      text: `It releases on ${data.heldNow.releases} if there are no disputes.`,
    });
  }
  blocks.push({
    type: 'button',
    label: onHold ? 'Contact support' : 'View earnings',
    url: join(site, onHold ? '/contact' : '/teammate'),
  });
  return {
    subject: onHold
      ? `Your Duoly payout for ${data.weekLabel} is on hold`
      : `Payday! ${formatMoney(data.total)} is on its way`,
    preheader: onHold
      ? 'Here’s why, and how to get it moving again.'
      : `${data.orders} orders, ${formatMoney(data.tips)} in tips. Here’s your breakdown.`,
    eyebrow: onHold ? 'Payout on hold' : 'Payout sent',
    title: onHold ? 'Your payout' : 'Payday!',
    titleAccent: onHold
      ? 'is on hold.'
      : `${formatMoney(data.total)} is on its way.`,
    hero: onHold ? undefined : 'mascots',
    headerMeta: data.weekLabel,
    blocks,
    reason: 'You’re getting this because you’re a Duoly teammate.',
  };
}

// ---------------------------------------------------------------------------------------------
// Support

export interface SupportReplyData {
  firstName: string;
  agentName: string;
  agentAvatar?: string;
  message: string;
  conversationUrl: string;
}

export function supportReply(data: SupportReplyData): EmailContent {
  return {
    subject: `${data.agentName} from Duoly replied`,
    preheader: data.message.slice(0, 110),
    eyebrow: 'New reply',
    title: `${data.agentName} from Duoly`,
    titleAccent: 'replied to you.',
    blocks: [
      {
        type: 'quote',
        author: data.agentName,
        avatar: data.agentAvatar,
        text: data.message,
      },
      {
        type: 'paragraph',
        text: `Answer in the chat, ${data.firstName}, so the whole conversation stays in one place.`,
      },
      { type: 'button', label: 'Continue the chat', url: data.conversationUrl },
    ],
    reason: 'You’re getting this because you contacted Duoly support.',
  };
}
