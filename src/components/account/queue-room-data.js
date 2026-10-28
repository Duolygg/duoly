/* global Response, fetch, crypto, FormData */
// Serves the endpoints the original QueueRoom.jsx calls (/api/orders/:id GET + POST {action},
// /api/orders/:id/chat GET + POST {text}|{typing}) from the real ones, in the original's shape.
// Pure mapping: lifecycle rules stay server-side (customer_order, cancel, reroll, chat RPCs).
import { toOriginalOrder } from './dashboard-data';
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

/** Our customer order DTO in the original QueueRoom shape. */
export function toRoomOrder(o) {
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
    rerollsLeft: Math.max(0, MAX_REROLLS - o.rerolls),
    rerollUntil: accepted ? accepted + REROLL_WINDOW_MS : null,
    paid: {
      currency: 'EUR',
      total: o.amount_eur_cents / 100,
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
  };
}

const toRoomMessage = (m) => ({
  id: m.id,
  from: m.sender,
  text: m.body,
  at: ms(m.created_at),
  name: m.name,
  image: m.image,
});

export function createRoomFetch({ orderId, csrf }) {
  const base = '/api/orders/' + encodeURIComponent(orderId);
  let assignment = null;
  return async function roomFetch(input, init = {}) {
    const path = String(input).split('?')[0];
    const method = (init.method || 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : {};
    try {
      if (path === base && method === 'GET') {
        const { res, data } = await call(base);
        if (!res.ok || !data.order)
          return json({ error: data.error }, res.status || 503);
        return json({ order: toRoomOrder(data.order), now: Date.now() });
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
          const res = await fetch(base + '/report', {
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
              }
            : { csrf };
        const { res, data } = await call(base + '/' + body.action, payload);
        if (!res.ok || !data.order)
          return json(
            { error: data.error || 'That didn’t work. Try again.' },
            res.status || 503,
          );
        return json({
          order: toRoomOrder(data.order),
          tipPayment: data.tipPayment || null,
          tipError: data.tipError || '',
        });
      }
      if (path === base + '/chat' && method === 'GET') {
        const room = await readChat(fetch, orderId);
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
          await setTyping(fetch, orderId, csrf, assignment);
          return json({ ok: true });
        }
        const result = await sendChat(fetch, orderId, csrf, {
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
