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
        }
      : null,
    lastTeammate: null,
    review: null,
    createdAt: ms(o.created_at),
    completedAt: ms(o.completed_at),
    amountEur: o.amount_eur_cents / 100,
    paid: null,
    cashback: 0,
    refund: null,
    cancelReason:
      o.status === 'cancelled'
        ? CANCELLED[o.cancel_reason] || 'Cancelled · not charged'
        : '',
  };
}

/** The original /api/me/history payload, computed from the customer's real orders. */
export function toOriginalHistory(orders, credits, now = Date.now()) {
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
    m.byGame[o.game] = (m.byGame[o.game] || 0) + 1;
    mates.set(key, m);
  }
  const credit = credits.reduce((t, c) => t + c.amount_eur_cents, 0) / 100;
  return {
    now,
    orders: list,
    lifetimeOrders: completed.length,
    weekOrders: completed.filter((o) => o.completedAt >= weekStart).length,
    gamesPlayed: completed.reduce((t, o) => t + (o.games || 1), 0),
    mates: [...mates.values()]
      .map(({ byGame, ...m }) => ({
        ...m,
        main: Object.entries(byGame).sort((a, b) => b[1] - a[1])[0][0],
      }))
      .sort((a, b) => b.orders - a.orders),
    wallet: credit,
    refunds: credit,
    cashbackTotal: 0,
    cashbackMonth: 0,
    levelGifts: 0,
    gifted: 0,
    walletSpent: 0,
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
      const [h, c] = await Promise.all([
        get('/api/orders/history?limit=100'),
        get('/api/orders/credits').catch(() => ({ credits: [] })),
      ]);
      return json(toOriginalHistory(h.orders || [], c.credits || []));
    }
  } catch {
    return json({ error: 'unavailable' }, 503);
  }
  return json({ error: 'not found' }, 404);
}
