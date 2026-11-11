/* global Notification, window */
import {
  ORDER_BELL_SRC,
  claimOrderNotification,
  playOrderBell,
} from '../teammate/desk-keeper';
import { gameOf } from '../../design-reference/lib/games';

/**
 * New-order alerts for the admin dashboard, the same bell and popup the teammate desk uses.
 * AdminApp watches the queue on every admin page (also in a background tab), so admins hear
 * about new orders without keeping the Live desk open.
 */

export const ORDER_WATCH_MS = 5000;
// the newest orders are enough: anything queued was created in the last few minutes
export const ORDER_WATCH_PATH = '/api/admin/orders?limit=50';
export const BELL_SRC = ORDER_BELL_SRC;

/**
 * Queued orders not in `seen` (order UUIDs). With no `seen` yet (first look after opening the
 * page) nothing counts as new, so a reload doesn't ring for orders already waiting.
 */
export function freshQueued(seen, orders) {
  const queued = (orders || []).filter(
    (o) => o && o.status === 'queued' && o.orderId,
  );
  if (!seen) return { fresh: [], seen: new Set(queued.map((o) => o.orderId)) };
  return {
    fresh: queued.filter((o) => !seen.has(o.orderId)),
    seen: new Set(queued.map((o) => o.orderId)),
  };
}

/** True once per order across this admin's open tabs (so the bell rings in one tab only). */
export function claimAdminAlert(orderId) {
  return claimOrderNotification('admin:' + orderId);
}

/** The teammate desk's bell: the ~3 s clip played twice back to back. */
export const playBell = playOrderBell;

export function orderLine(order) {
  const units = Number(order.units) || 1;
  return (
    (order.service || 'Order') +
    (units > 1 ? ' ×' + units : '') +
    ' · ' +
    gameOf(order.game).name
  );
}

/** "New Order Available!", silent because the bell already plays. */
export function showAdminOrderNotification(order, count, onClick) {
  if (
    typeof Notification === 'undefined' ||
    Notification.permission !== 'granted'
  )
    return;
  try {
    const payout = (Number(order.payoutUsdCents) || 0) / 100;
    const n = new Notification('New Order Available!', {
      body:
        'New Order: ' +
        orderLine(order) +
        '\nPrice: $' +
        payout.toFixed(2) +
        (count > 1 ? '  (+' + (count - 1) + ' more)' : ''),
      icon: '/assets/brand/logo-full.webp',
      // one tag per order: a shared tag only replaces the previous popup quietly
      tag: 'duoly-admin-order-' + order.orderId,
      silent: true,
    });
    n.onclick = () => {
      window.focus();
      n.close();
      onClick?.();
    };
  } catch {
    /* best effort */
  }
}
