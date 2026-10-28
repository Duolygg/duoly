// Admin-only read data behind Sparky's admin tools (ledger #25, S3).
// Reuses the admin dashboard read RPCs (admin_orders_page, admin_order_reports,
// admin_accounts, admin_customers, admin_teammates) called with the asker's own
// signed-in Supabase client, so the database re-checks the admin role on every
// call (admin_caller() refuses anyone else with 403). No new SQL, read only.
// Outputs are shaped down to what an admin needs in a chat answer: no emails,
// no internal ids, no Stripe ids or provider errors, no evidence storage keys,
// no avatar URLs and no priority or delay numbers.
import { GAME } from '../../design-reference/lib/games.js';
import { PAYMENT_MEANING } from './lookup';

/** The only admin RPCs Sparky reads: dashboard read models, no commands. */
export type AdminReadFn =
  | 'admin_orders_page'
  | 'admin_order_reports'
  | 'admin_accounts'
  | 'admin_customers'
  | 'admin_teammates';

export type AdminRpc = (
  fn: AdminReadFn,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;

const gameName = (id: unknown) =>
  (GAME as Record<string, { name?: string } | undefined>)[String(id)]?.name ??
  String(id ?? '');
const eur = (cents: unknown) =>
  cents === null || cents === undefined ? null : Number(cents) / 100;
const text = (value: unknown, max = 200) =>
  typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, max)
    : null;
const num = (value: unknown) =>
  value === null || value === undefined || value === '' ? null : Number(value);

type Json = Record<string, unknown>;
const obj = (value: unknown): Json | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : null;
const list = (value: unknown): Json[] =>
  Array.isArray(value) ? (value.map(obj).filter(Boolean) as Json[]) : [];

export class AdminLookupError extends Error {}

/** Calls one admin RPC and unwraps the `{ error: { code, message } }` envelope. */
async function read(
  rpc: AdminRpc,
  fn: AdminReadFn,
  args?: Json,
): Promise<Json> {
  const { data, error } = await rpc(fn, args);
  const payload = obj(data);
  if (error || !payload) throw new AdminLookupError(`${fn} failed`);
  if (payload.error) throw new AdminLookupError(`${fn} refused`);
  return payload;
}

export type AdminOrderSummary = {
  reference: string;
  status: string;
  game: string;
  service: string;
  units: number;
  unit: string;
  voice: boolean;
  gamerGirl: boolean;
  region: string | null;
  priceEur: number | null;
  teammatePayoutUsd: number | null;
  customer: {
    name: string;
    ordersPlaced: number | null;
    loyaltyLevel: string | null;
  };
  teammate: {
    name: string;
    rating: number | null;
    trustTier: string | null;
  } | null;
  payment: {
    method: string;
    state: string;
    meaning: string;
    processing: string | null;
    currency: string | null;
    amount: number | null;
    problem: boolean;
    refundedAt: string | null;
    refundReason: string | null;
  } | null;
  refunds: {
    adminRefundedAt: string | null;
    adminRefundReason: string | null;
    balanceRefundEur: number | null;
  };
  cancel: {
    at: string;
    reason: string | null;
    adminNote: string | null;
  } | null;
  rerollsUsed: number;
  timestamps: {
    created: string | null;
    queued: string | null;
    accepted: string | null;
    completed: string | null;
  };
  review: { rating: number; tags: string[] } | null;
  tip: { amountEur: number; state: string; refundedEur: number } | null;
  reports: {
    reference: string;
    type: string;
    status: string;
    at: string | null;
    by: string;
    against: string;
    bountyEur: number | null;
    decidedAt: string | null;
    decisionNote: string | null;
  }[];
};

export type PersonSummary = {
  name: string;
  role: string;
  owner: boolean;
  joined: string | null;
  lastSignIn: string | null;
  discordLinked: boolean;
  blocked: { reason: string | null; at: string | null } | null;
  suspended: { reason: string | null; at: string | null } | null;
  customer?: {
    ordersPlaced: number;
    ordersCompleted: number;
    spentEur: number;
    lastOrderAt: string | null;
    walletEur: number;
    walletCashableEur: number;
    walletPromoEur: number;
    loyaltyLevel: string | null;
    cashbackPercent: number | null;
    nextLevel: string | null;
    ordersToNextLevel: number | null;
    chatWarnings: number;
  };
  teammate?: {
    approvedGames: string[];
    gamerGirl: boolean;
    online: boolean;
    playingNow: boolean;
    completedOrders: number;
    acceptedOrders: number;
    rating: number | null;
    reviews: number;
    chatWarnings: number;
    trustTier: string | null;
    depositPercent: number | null;
    depositHeldUsd: number;
    earnedLast30DaysUsd: number;
    payout: {
      owedUsd: number | null;
      thisWeekSoFarUsd: number | null;
      autoHeldUsd: number | null;
      carriedUsd: number | null;
      minimumUsd: number | null;
      payoutDetailsComplete: boolean;
    } | null;
  };
};

export type SparkyAdminLookup = {
  orderByReference(reference: string): Promise<AdminOrderSummary | null>;
  personSummary(query: string): Promise<{
    matchedBy: 'id' | 'email' | 'name';
    people: PersonSummary[];
    moreMatches: number;
  }>;
};

const PAGE = 500;
const MAX_PAGES = 20;
const MAX_PEOPLE = 3;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function shapeOrder(row: Json, reports: Json[]): AdminOrderSummary {
  const pay = obj(row.payment);
  const review = obj(row.review);
  const tip = obj(row.tip);
  const loyalty = obj(row.customerLoyalty);
  const trust = obj(row.teammateTrust);
  const state = String(pay?.state ?? '');
  const settle = String(pay?.settle ?? 'none');
  const minor = num(pay?.amountMinor);
  return {
    reference: String(row.id),
    status: String(row.status),
    game: gameName(row.game),
    service: text(row.service, 120) ?? '',
    units: Number(row.units),
    unit: String(row.unit ?? ''),
    voice: row.voice === true,
    gamerGirl: row.gg === true,
    region: text(row.region, 40),
    priceEur: eur(row.amountCents),
    teammatePayoutUsd: eur(row.payoutUsdCents),
    customer: {
      name: text(row.customer, 80) ?? '',
      ordersPlaced: num(row.customerOrderCount),
      loyaltyLevel: text(loyalty?.name, 40),
    },
    teammate:
      row.teammateId || row.teammate
        ? {
            name: text(row.teammate, 80) ?? 'Unknown teammate',
            rating: num(row.teammateRating),
            trustTier: text(trust?.trust_tier, 40),
          }
        : null,
    payment: pay
      ? {
          method: String(pay.method || 'card'),
          state,
          meaning: PAYMENT_MEANING[state]?.[1] ?? 'Unknown payment state.',
          processing:
            settle === 'none'
              ? null
              : settle === 'capture'
                ? 'A charge is being processed right now.'
                : 'A release is being processed right now.',
          currency: text(pay.currency, 8),
          amount: minor === null ? null : minor / 100,
          // The provider error text stays in the admin dashboard.
          problem: !!pay.error,
          refundedAt: text(pay.refundedAt, 40),
          refundReason: text(pay.refundReason, 200),
        }
      : null,
    refunds: {
      adminRefundedAt: text(row.adminRefundedAt, 40),
      adminRefundReason: text(row.adminRefundReason, 200),
      balanceRefundEur: eur(row.refundCents),
    },
    cancel: row.cancelledAt
      ? {
          at: String(row.cancelledAt),
          reason: text(row.cancelReason, 200),
          adminNote: text(row.adminCancelNote, 200),
        }
      : null,
    rerollsUsed: Number(row.rerolls ?? 0),
    timestamps: {
      created: text(row.createdAt, 40),
      queued: text(row.queuedAt, 40),
      accepted: text(row.acceptedAt, 40),
      completed: text(row.completedAt, 40),
    },
    review: review
      ? {
          rating: Number(review.rating),
          tags: Array.isArray(review.tags)
            ? review.tags.map((t) => String(t).slice(0, 40)).slice(0, 10)
            : [],
        }
      : null,
    tip: tip
      ? {
          amountEur: Number(tip.amount),
          state: String(tip.state),
          refundedEur: Number(tip.refunded ?? 0),
        }
      : null,
    reports: reports.map((r) => ({
      reference: String(r.reference),
      type: text(r.typeLabel, 80) ?? String(r.type),
      status: String(r.status),
      at: text(r.at, 40),
      by: text(r.byName, 80) ?? '',
      against: text(obj(r.against)?.name, 80) ?? '',
      bountyEur: num(r.bounty),
      decidedAt: text(r.decidedAt, 40),
      decisionNote: text(r.decisionNote, 200),
    })),
  };
}

const blockState = (value: unknown) => {
  const b = obj(value);
  return b ? { reason: text(b.reason, 200), at: text(b.at, 40) } : null;
};

export function shapePerson(
  account: Json,
  customer: Json | null,
  teammate: Json | null,
): PersonSummary {
  const role = String(account.role);
  const access = obj(account.access);
  const base: PersonSummary = {
    name: text(account.name, 80) || 'No display name',
    role,
    owner: account.owner === true,
    joined: text(account.firstSeen, 40),
    lastSignIn: text(account.lastSeen, 40),
    discordLinked: !!account.discord,
    blocked: customer ? blockState(customer.blocked) : null,
    suspended: teammate
      ? blockState(teammate.suspended)
      : access?.suspended === true
        ? { reason: null, at: null }
        : null,
  };
  if (customer) {
    const loyalty = obj(customer.loyalty);
    const level = obj(loyalty?.level);
    const next = obj(loyalty?.next);
    base.customer = {
      ordersPlaced: Number(customer.placed ?? 0),
      ordersCompleted: Number(customer.completed ?? 0),
      spentEur: Number(customer.spentCents ?? 0) / 100,
      lastOrderAt: text(customer.lastOrderAt, 40),
      walletEur: Number(customer.walletCents ?? 0) / 100,
      walletCashableEur: Number(customer.walletCashableCents ?? 0) / 100,
      walletPromoEur: Number(customer.walletPromoCents ?? 0) / 100,
      loyaltyLevel: text(level?.name, 40),
      cashbackPercent: num(level?.cashback),
      nextLevel: text(next?.name, 40),
      ordersToNextLevel: next ? num(loyalty?.remaining) : null,
      chatWarnings: Number(customer.warnings ?? 0),
    };
  }
  if (teammate) {
    const trust = obj(teammate.trust);
    const payout = obj(teammate.payout);
    base.teammate = {
      approvedGames: (Array.isArray(teammate.games) ? teammate.games : []).map(
        gameName,
      ),
      gamerGirl: teammate.gg === true,
      online: teammate.online === true,
      playingNow: teammate.playing === true,
      completedOrders: Number(teammate.completed ?? 0),
      acceptedOrders: Number(teammate.accepted ?? 0),
      rating: num(teammate.rating),
      reviews: Number(teammate.reviews ?? 0),
      chatWarnings: Number(teammate.warnings ?? 0),
      trustTier: text(trust?.trust_tier, 40),
      depositPercent: num(trust?.deposit_percent),
      depositHeldUsd: Number(teammate.depositHeldUsdCents ?? 0) / 100,
      earnedLast30DaysUsd: Number(teammate.earned30UsdCents ?? 0) / 100,
      payout: payout
        ? {
            owedUsd: num(payout.owed),
            thisWeekSoFarUsd: num(payout.due),
            autoHeldUsd: num(payout.held),
            carriedUsd: num(payout.carried),
            minimumUsd: num(payout.minimum),
            payoutDetailsComplete: payout.details === true,
          }
        : null,
    };
  }
  return base;
}

const fold = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function sparkyAdminLookup(rpc: AdminRpc): SparkyAdminLookup {
  return {
    async orderByReference(reference) {
      let row: Json | null = null;
      for (let page = 0; page < MAX_PAGES && !row; page += 1) {
        const data = await read(rpc, 'admin_orders_page', {
          p_limit: PAGE,
          p_offset: page * PAGE,
        });
        const orders = list(data.orders);
        row = orders.find((o) => o.id === reference) ?? null;
        if (orders.length < PAGE || (page + 1) * PAGE >= Number(data.total))
          break;
      }
      if (!row) return null;
      const reports = list(
        (await read(rpc, 'admin_order_reports')).reports,
      ).filter((r) => r.orderId === reference);
      return shapeOrder(row, reports);
    },

    async personSummary(query) {
      const q = query.trim();
      const matchedBy = UUID.test(q)
        ? 'id'
        : q.includes('@')
          ? 'email'
          : 'name';
      const accounts = list((await read(rpc, 'admin_accounts')).accounts);
      let found: Json[];
      if (matchedBy === 'id')
        found = accounts.filter(
          (a) => String(a.id).toLowerCase() === q.toLowerCase(),
        );
      else if (matchedBy === 'email')
        found = accounts.filter((a) => fold(String(a.email ?? '')) === fold(q));
      else {
        const needle = fold(q);
        const exact = accounts.filter(
          (a) => fold(String(a.name ?? '')) === needle,
        );
        found = exact.length
          ? exact
          : accounts.filter((a) => fold(String(a.name ?? '')).includes(needle));
      }
      const picked = found.slice(0, MAX_PEOPLE);
      const needCustomers = picked.some((a) => a.role === 'customer');
      const needTeammates = picked.some((a) => a.role === 'teammate');
      const [customers, teammates] = await Promise.all([
        needCustomers
          ? read(rpc, 'admin_customers').then((d) => list(d.customers))
          : Promise.resolve([] as Json[]),
        needTeammates
          ? read(rpc, 'admin_teammates').then((d) => list(d.teammates))
          : Promise.resolve([] as Json[]),
      ]);
      return {
        matchedBy,
        people: picked.map((a) =>
          shapePerson(
            a,
            a.role === 'customer'
              ? (customers.find((c) => c.id === a.id) ?? null)
              : null,
            a.role === 'teammate'
              ? (teammates.find((t) => t.id === a.id) ?? null)
              : null,
          ),
        ),
        moreMatches: Math.max(0, found.length - picked.length),
      };
    },
  };
}
