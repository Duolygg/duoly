import type {
  TransactionalEmailData,
  TransactionalEmailId,
} from './catalog.ts';

/** Synthetic preview data. Never used for real sends. */
const valorant = { name: 'Valorant', icon: '/assets/games/valorant.png' };
const league = {
  name: 'League of Legends',
  icon: '/assets/games/league-of-legends.png',
};

const order = {
  id: 'DL-1042',
  game: league,
  service: 'Duo Pro',
  units: 3,
  unit: 'game' as const,
  region: 'EUW',
  rank: 'Platinum II',
};

const kairo = {
  name: 'Kairo',
  avatar: '/assets/avatars/avatar-3.png',
  flag: '/email/flags/de.png',
  country: 'Germany',
  rank: 'Master 214 LP · Mid',
  rating: '4.97',
  languages: ['English', 'German'],
  bio: 'Calm comms, clean macro. I’ll teach you wave control while we climb.',
};

const eur = (cents: number) => ({ cents, currency: 'EUR' as const });
const usd = (cents: number) => ({ cents, currency: 'USD' as const });

export const samples: {
  [K in TransactionalEmailId]: TransactionalEmailData<K>;
} = {
  welcome: { firstName: 'Lea' },
  order_confirmed: {
    firstName: 'Lea',
    order,
    lines: [
      { label: 'Duo Pro × 3 games', amount: eur(1797) },
      { label: 'Bundle discount (10%)', amount: eur(-180) },
    ],
    total: eur(1617),
    paidWith: 'Apple Pay',
    paidAt: '22 Oct 2026, 19:42',
  },
  teammate_found: {
    firstName: 'Lea',
    order,
    ign: 'LeaPlays#EUW',
    teammate: kairo,
    rerollsLeft: 2,
  },
  order_completed: {
    firstName: 'Lea',
    order,
    teammate: { name: kairo.name, avatar: kairo.avatar },
    cashback: eur(16),
    tier: 'bronze',
    balance: eur(1240),
    completedOrders: 38,
    nextTierAt: 100,
  },
  order_cancelled: {
    firstName: 'Lea',
    order: {
      ...order,
      game: valorant,
      service: 'Rank Rush',
      units: 5,
      region: 'EU',
      rank: 'Gold 3',
    },
    reason: 'no_teammate',
    refund: eur(2549),
    balance: eur(2857),
  },
  level_up: {
    firstName: 'Lea',
    tier: 'silver',
    gift: eur(500),
    completedOrders: 100,
    next: { tier: 'gold', at: 250 },
  },
  application_received: { firstName: 'Kairo', game: 'League of Legends' },
  application_approved: {
    firstName: 'Kairo',
    games: ['League of Legends', 'Teamfight Tactics'],
  },
  application_declined: { firstName: 'Kairo', game: 'League of Legends' },
  payout: {
    firstName: 'Kairo',
    weekLabel: '16 to 23 Oct',
    status: 'paid',
    orders: 37,
    rating: '4.96',
    net: usd(35612),
    tips: usd(3800),
    depositsReleased: usd(2124),
    adjustments: [{ reason: 'Weekend bonus', amount: usd(500) }],
    total: usd(42036),
    heldNow: { amount: usd(3957), releases: '6 Nov' },
  },
  support_handoff: {
    requesterName: 'Lea',
    requesterRole: 'Customer',
    message: 'My teammate has not joined the lobby yet. Can someone check?',
    inboxUrl: 'https://duoly.gg/admin/support',
  },
  support_reply: {
    firstName: 'Lea',
    agentName: 'Mira',
    agentAvatar: '/assets/avatars/avatar-6.png',
    message:
      'Thanks for the details! I’ve added €5.00 to your balance for the wait yesterday. It’s ready to use on your next order.',
    conversationUrl: 'https://duoly.gg/dashboard#support',
  },
};
