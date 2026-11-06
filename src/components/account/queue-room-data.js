/* global Response, fetch, crypto, FormData */
// Serves the endpoints the original QueueRoom.jsx calls (/api/orders/:id GET + POST {action},
// /api/orders/:id/chat GET + POST {text}|{typing}) from the real ones, in the original's shape.
// Pure mapping: lifecycle rules stay server-side (customer_order, cancel, reroll, chat RPCs).
import { paidOf, toOriginalOrder } from './dashboard-data';
import { readChat, sendChat, setTyping } from '../../client/order-chat';

const REROLL_WINDOW_MS = 5 * 60 * 1000;
const QUEUE_MS = 5 * 60 * 1000;
const MAX_REROLLS = 2;
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const call = async (url, body) => {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
};
const ms = (iso) => (iso ? Date.parse(iso) : null);
const toRoomReport = (report) => ({
  id: report.reference,
  type: report.type,
  status: report.status,
  bounty: report.bounty_eur_cents / 100,
  at: ms(report.created_at),
  decidedAt: ms(report.decided_at),
  bountyOwed: !!report.bounty_owed,
});

/**
 * Our customer order DTO in the original QueueRoom shape.
 * @param {any} o
 * @param {{ proMember?: boolean, rerollLimit?: number | null }} [options]
 */
export function toRoomOrder(o, { proMember = false, rerollLimit } = {}) {
  // re-rolls per order (20261106170000): 2, 4 from Gold, null = unlimited with PRO
  const limit =
    rerollLimit === undefined ? (proMember ? null : MAX_REROLLS) : rerollLimit;
  const base = toOriginalOrder(o);
  const accepted = ms(o.accepted_at);
  return {
    ...base,
    // The original counts the 5-minute queue from creation; ours starts when payment queued it.
    createdAt: ms(o.queued_at) || base.createdAt,
    unit: o.unit,
    ign: o.ign,
    note: o.note,
    voice: o.voice,
    // QueueRoom tells 'you cancelled' from 'nobody took it' by the raw reason.
    cancelReason: o.cancel_reason || '',
    autoCancelMs: QUEUE_MS,
    // reroll_order checks the same limit
    rerollsLeft: limit === null ? 1 : Math.max(0, limit - o.rerolls),
    rerollsUnlimited: limit === null,
    rerollLimit: limit,
    rerollUntil: accepted ? accepted + REROLL_WINDOW_MS : null,
    // a team order shows what the customer paid for the whole team, not one seat's share
    paid: o.free_perk
      ? { currency: 'EUR', total: 0, method: 'Free with your perk' }
      : paidOf(
          o.team ? { ...o, amount_eur_cents: o.team.amount_eur_cents } : o,
        ) || {
          currency: 'EUR',
          total: (o.team ? o.team.amount_eur_cents : o.amount_eur_cents) / 100,
          method: 'Stripe checkout',
        },
    teammate: base.teammate
      ? {
          ...base.teammate,
          bio: o.teammate.bio || '',
          languages: o.teammate.languages || [],
        }
      : null,
    tip: o.tip || null,
    reports: (o.reports || []).map(toRoomReport),
    proof: [],
    // Team orders (20261106190000): the whole team, on every seat's order. Each member links to
    // its own seat order, where the customer rates, tips or reports that teammate.
    // 20261106190000: the customer's role and coaching character (order card)
    role: o.role || null,
    character: o.character || null,
    seat: o.seat || null,
    team: o.team
      ? {
          seats: o.team.seats,
          filled: o.team.filled,
          status: o.team.status,
          leadOrderId: o.team.lead_order_id,
          total: o.team.amount_eur_cents / 100,
          members: o.team.members.map((m) => ({
            orderId: m.order_id,
            seat: m.seat,
            status: m.status,
            reviewed: m.reviewed,
            // "Switch" on this teammate: 5 minutes from when the whole team was in (reroll_order)
            switchUntil:
              o.team.started_at && m.accepted_at && m.status === 'in_progress'
                ? Math.max(ms(m.accepted_at), ms(o.team.started_at)) +
                  REROLL_WINDOW_MS
                : null,
            switchesLeft:
              limit === null ? 1 : Math.max(0, limit - (m.rerolls || 0)),
            name: m.teammate ? m.teammate.name : '',
            image: m.teammate ? m.teammate.image : '',
            country: m.teammate ? m.teammate.country : '',
          })),
        }
      : null,
  };
}

/**
 * Team orders: which seat order the action or chat goes to.
 * - chat: every seat's chat holds the whole group conversation, so the lowest seat with a
 *   teammate in it (or this order when none is yet).
 * - cancel: while the team fills, cancelling any free seat cancels the whole team.
 * @param {any} order the last customer order DTO seen
 * @param {string} fallback this page's order id
 */
export function teamTarget(order, kind, fallback) {
  const team = order && order.team;
  if (!team) return fallback;
  const members = team.members || [];
  if (kind === 'chat') {
    const open = members.find((m) => m.status === 'in_progress');
    const any = members.find((m) => m.status === 'completed');
    return (open || any || {}).order_id || fallback;
  }
  if (kind === 'cancel' && team.status === 'waiting') {
    const free = members.find((m) => m.status === 'queued');
    return (free || {}).order_id || fallback;
  }
  return fallback;
}

const toRoomMessage = (m) => ({
  id: m.id,
  from: m.sender,
  text: m.body,
  at: ms(m.created_at),
  name: m.name,
  image: m.image,
});

export function createRoomFetch({
  orderId,
  csrf,
  proMember = false,
  rerollLimit,
}) {
  const base = '/api/orders/' + encodeURIComponent(orderId);
  let assignment = null;
  // Team orders: the last order DTO, so chat and cancel can go to the right seat (teamTarget).
  let last = null;
  let chatOrder = orderId;
  return async function roomFetch(input, init = {}) {
    const path = String(input).split('?')[0];
    const method = (init.method || 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : {};
    try {
      if (path === base && method === 'GET') {
        const { res, data } = await call(base);
        if (!res.ok || !data.order)
          return json({ error: data.error }, res.status || 503);
        last = data.order;
        return json({
          order: toRoomOrder(data.order, { proMember, rerollLimit }),
          now: Date.now(),
        });
      }
      if (path === base && method === 'POST') {
        if (!['cancel', 'reroll', 'review', 'report'].includes(body.action))
          return json({ error: 'That isn’t available yet.' }, 501);
        if (body.action === 'report') {
          const form = new FormData();
          form.set('type', body.type);
          form.set('description', body.text);
          for (const [index, dataUrl] of (body.evidence || []).entries()) {
            const blob = await (await fetch(dataUrl)).blob();
            form.append(
              'evidence',
              blob,
              `evidence-${index + 1}.${blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'}`,
            );
          }
          // team orders: the report is about the teammate picked in the form (their seat order)
          const reportOn =
            last &&
            last.team &&
            last.team.members.some((m) => m.order_id === body.orderId)
              ? '/api/orders/' + encodeURIComponent(body.orderId)
              : base;
          const res = await fetch(reportOn + '/report', {
            method: 'POST',
            credentials: 'same-origin',
            cache: 'no-store',
            redirect: 'error',
            headers: { 'X-CSRF-Token': csrf },
            body: form,
          });
          const data = await res.json().catch(() => ({}));
          return json(
            res.ok && data.report
              ? { report: toRoomReport(data.report) }
              : data,
            res.status,
          );
        }
        const payload =
          body.action === 'review'
            ? {
                csrf,
                rating: body.rating,
                tags: Array.isArray(body.tags) ? body.tags : [],
                text: typeof body.text === 'string' ? body.text : '',
                tip_cents: Number.isFinite(body.tip)
                  ? Math.round(body.tip * 100)
                  : 0,
                // a USD customer tips in dollars; the server charges it in EUR
                tip_currency: body.tipCurrency === 'USD' ? 'USD' : 'EUR',
              }
            : { csrf };
        // A team still filling is cancelled through any of its free seats, and the customer
        // switches one specific teammate through that teammate's own seat.
        const seatId =
          body.action === 'reroll' &&
          last &&
          last.team &&
          last.team.members.some((m) => m.order_id === body.orderId)
            ? body.orderId
            : null;
        const target =
          body.action === 'cancel'
            ? '/api/orders/' +
              encodeURIComponent(teamTarget(last, 'cancel', orderId))
            : seatId
              ? '/api/orders/' + encodeURIComponent(seatId)
              : base;
        const { res, data } = await call(target + '/' + body.action, payload);
        if (!res.ok || !data.order)
          return json(
            { error: data.error || 'That didn’t work. Try again.' },
            res.status || 503,
          );
        if (target !== base) {
          // the cancelled seat isn't this page's order: show this order's new state
          const again = await call(base);
          if (again.res.ok && again.data.order) data.order = again.data.order;
        }
        last = data.order;
        return json({
          order: toRoomOrder(data.order, { proMember, rerollLimit }),
          tipPayment: data.tipPayment || null,
          tipError: data.tipError || '',
        });
      }
      // Favorite the teammate on this order (20261106150000): { available, favorite }.
      if (
        path === base + '/favorite' &&
        (method === 'GET' || method === 'POST')
      ) {
        const { res, data } = await call(
          base + '/favorite',
          method === 'POST' ? { csrf, on: body.on === true } : undefined,
        );
        if (!res.ok || typeof data.favorite !== 'boolean')
          return json(
            { error: data.error || 'That didn’t work. Try again.' },
            res.status || 503,
          );
        return json({ available: !!data.available, favorite: data.favorite });
      }
      if (path === base + '/chat' && method === 'GET') {
        chatOrder = teamTarget(last, 'chat', orderId);
        const room = await readChat(fetch, chatOrder);
        assignment = room.assignment_id;
        return json({
          messages: room.messages.map(toRoomMessage),
          typing: room.typing.some((t) => t.role === 'teammate'),
          writable: room.writable,
        });
      }
      if (path === base + '/chat' && method === 'POST') {
        if (!assignment)
          return json({ error: 'Chat opens once a teammate accepts.' }, 409);
        if (body.typing) {
          await setTyping(fetch, chatOrder, csrf, assignment);
          return json({ ok: true });
        }
        const result = await sendChat(fetch, chatOrder, csrf, {
          assignment_id: assignment,
          request_id: crypto.randomUUID(),
          body: String(body.text || '').trim(),
        });
        if (result.outcome === 'blocked')
          return json({ error: result.note }, 422);
        return json({ message: toRoomMessage(result.message) });
      }
    } catch (e) {
      return json(
        {
          error:
            (e && e.name === 'ChatError' && e.message) ||
            'Can’t reach Duoly right now. Try again.',
        },
        (e && e.status) || 503,
      );
    }
    return json({ error: 'Not found.' }, 404);
  };
}
