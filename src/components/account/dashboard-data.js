/* global Response, fetch */
// Serves the two endpoints the original Dashboard.jsx reads (/api/orders and /api/me/history)
// from the real ones (/api/orders/active, /api/orders/history, /api/orders/credits), in the
// original's data shape. Pure mapping: no business rules live here.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const get = async (url) => {
  const res = await fetch(url, {
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};
const ms = (iso) => (iso ? Date.parse(iso) : null);

// Stripe payment method types, as customers know them (Apple Pay and Google Pay arrive as card)
const METHODS = {
  card: 'Card',
  paypal: 'PayPal',
  klarna: 'Klarna',
  amazon_pay: 'Amazon Pay',
  revolut_pay: 'Revolut Pay',
  link: 'Link',
  ideal: 'iDEAL',
  bancontact: 'Bancontact',
  eps: 'EPS',
  blik: 'BLIK',
  twint: 'TWINT',
  p24: 'Przelewy24',
  mobilepay: 'MobilePay',
  multibanco: 'Multibanco',
  alipay: 'Alipay',
  wechat_pay: 'WeChat Pay',
  sepa_debit: 'SEPA Direct Debit',
  satispay: 'Satispay',
};
const methodName = (type) =>
  METHODS[type] ||
  (type
    ? type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
    : 'Card');

/**
 * What the customer paid, as they paid it (order_customer_dto payment, 20261102120000): a card part
 * Stripe charged in USD shows in USD; EUR (and any other currency, or a part paid from the wallet)
 * shows the EUR price. Null for a free order or before the migration (callers fall back to EUR).
 */
export function paidOf(o) {
  const p = o.payment;
  if (!p || o.free_perk) return null;
  const wallet = p.wallet_eur_cents > 0;
  const card = p.amount_minor !== null;
  return {
    ...(card && !wallet && p.currency === 'USD'
      ? { currency: 'USD', total: p.amount_minor / 100 }
      : { currency: 'EUR', total: o.amount_eur_cents / 100 }),
    method: !card
      ? 'Duoly balance'
      : methodName(p.method) + (wallet ? ' + Duoly balance' : ''),
  };
}
const CANCELLED = {
  queue_expired: 'Nobody took it in 5 minutes · not charged',
  customer_cancelled: 'You cancelled · not charged',
};

/** One order in the original's shape. */
export function toOriginalOrder(o) {
  return {
    id: o.id,
    ref: o.public_reference,
    status: o.status,
    game: o.game,
    title: o.title,
    games: o.units,
    region: o.region,
    rerolls: o.rerolls,
    teammate: o.teammate
      ? {
          name: o.teammate.name,
          image: o.teammate.image,
          country: o.teammate.country,
          trustBadge: o.teammate.trust_badge || null,
        }
      : null,
    lastTeammate: null,
    review: o.review
      ? {
          rating: o.review.rating,
          text: o.review.text,
          tags: o.review.tags,
          at: ms(o.review.at),
        }
      : null,
    createdAt: ms(o.created_at),
    queuedAt: ms(o.queued_at),
    acceptedAt: ms(o.accepted_at),
    completedAt: ms(o.completed_at),
    amountEur: o.amount_eur_cents / 100,
    paid: paidOf(o),
    cashback: 0,
    refund: null,
    cancelReason:
      o.status === 'cancelled'
        ? CANCELLED[o.cancel_reason] || 'Cancelled · not charged'
        : '',
    // Free monthly coaching (migration 20261026160000): the customer paid nothing.
    ...(o.free_perk === true ? { freePerk: true } : {}),
  };
}

/** The original /api/me/history payload, computed from the customer's real orders. */
export function toOriginalHistory(orders, walletData, now = Date.now()) {
  const list = orders
    .map(toOriginalOrder)
    .sort((a, b) => b.createdAt - a.createdAt);
  const completed = list.filter((o) => o.status === 'completed');
  const weekStart = (() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  })();
  // Teammates you've played with. The order DTO has no teammate id (privacy), so name + avatar
  // identify them; presence isn't built yet, so online is unknown (null).
  const mates = new Map();
  for (const o of completed) {
    if (!o.teammate) continue;
    const key = o.teammate.name + '|' + o.teammate.image;
    const m = mates.get(key) || {
      ...o.teammate,
      orders: 0,
      byGame: {},
      rating: null,
      online: null,
    };
    m.orders += 1;
    if (o.review) {
      m.ratingSum = (m.ratingSum || 0) + o.review.rating;
      m.rated = (m.rated || 0) + 1;
    }
    m.byGame[o.game] = (m.byGame[o.game] || 0) + 1;
    mates.set(key, m);
  }
  const credits = Array.isArray(walletData)
    ? walletData
    : walletData?.credits || [];
  const balance = Array.isArray(walletData) ? null : walletData?.balance;
  const credit = credits.reduce((t, c) => t + c.amount_eur_cents, 0) / 100;
  const cents = (key, fallback = 0) =>
    balance && Number.isFinite(Number(balance[key]))
      ? Number(balance[key])
      : fallback;
  return {
    now,
    orders: list,
    lifetimeOrders: completed.length,
    weekOrders: completed.filter((o) => o.completedAt >= weekStart).length,
    gamesPlayed: completed.reduce((t, o) => t + (o.games || 1), 0),
    mates: [...mates.values()]
      .map(({ byGame, ...m }) => ({
        ...m,
        rating: m.rated
          ? Math.round((m.ratingSum / m.rated) * 100) / 100
          : null,
        main: Object.entries(byGame).sort((a, b) => b[1] - a[1])[0][0],
      }))
      .sort((a, b) => b.orders - a.orders),
    wallet: cents('total_eur_cents', credit * 100) / 100,
    walletCashable: cents('cashable_eur_cents', credit * 100) / 100,
    walletPromo: cents('promo_eur_cents') / 100,
    refunds: cents('refunds_eur_cents', credit * 100) / 100,
    cashbackTotal: cents('cashback_eur_cents') / 100,
    cashbackMonth: 0,
    levelGifts: cents('level_gifts_eur_cents') / 100,
    gifted: cents('admin_eur_cents') / 100,
    walletSpent: cents('spent_eur_cents') / 100,
  };
}

/** Maps the customer_rewards RPC into Fabian's Rewards component props. */
export function toOriginalRewards(rewards) {
  const cashback = rewards?.cashback || {};
  return {
    orders: Number(rewards?.orders) || 0,
    cashbackTotal: (Number(cashback.earnedEurCents) || 0) / 100,
    cashbackMonth: (Number(cashback.monthEurCents) || 0) / 100,
    cashbackPending: (Number(cashback.pendingEurCents) || 0) / 100,
    pendingOrders: Number(cashback.pendingOrders) || 0,
    gifts: Array.isArray(rewards?.gifts) ? rewards.gifts : [],
    giftClaimed: true,
    // Added by 20261026160000; absent until then, which keeps those perks "coming soon".
    perks: rewards?.perks || null,
  };
}

export async function dashboardFetch(input) {
  const path = String(input);
  try {
    if (path === '/api/orders') {
      const { order } = await get('/api/orders/active');
      return json({ order: order ? toOriginalOrder(order) : null });
    }
    if (path === '/api/me/history') {
      const [h, c, rewards] = await Promise.all([
        get('/api/orders/history?limit=100'),
        get('/api/orders/credits').catch(() => ({ credits: [] })),
        get('/api/orders/rewards'),
      ]);
      return json({
        ...toOriginalHistory(h.orders || [], c),
        rewards: toOriginalRewards(rewards),
      });
    }
  } catch {
    return json({ error: 'unavailable' }, 503);
  }
  return json({ error: 'not found' }, 404);
}
