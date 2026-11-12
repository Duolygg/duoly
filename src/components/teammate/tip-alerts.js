/* global window, localStorage, Notification */
import { GAME } from '../../design-reference/lib/games';
import {
  backgroundTicker,
  claimOrderNotification,
  releasePollLease,
  takePollLease,
} from './desk-keeper';

/**
 * "You got a tip!" as a browser notification, on the desk and every other Duoly page.
 *
 * No new data: /api/teammate/stats already lists the teammate's orders from the last 8 days with
 * the tip they can keep on each one (teammate_stats(), migration 20261102160000_win_loss.sql).
 * This file remembers the tip it last saw per order, in localStorage so every tab and every page
 * share it, and pops up a notification when one goes up.
 *
 * - The first look in a browser only remembers what is there: tips from before don't pop up.
 * - One notification per tip across open tabs (claimOrderNotification, as for new orders).
 * - A refunded tip only lowers the remembered amount; it never pops up.
 */

const KNOWN_KEY = 'duoly-known-tips';
const TIP_LEASE = 'teammate-tips';
export const TIP_CHECK_MS = 60000;

/** The orders with a tip, as { orderId: amount }. */
function tipMap(recent) {
  const map = {};
  for (const e of Array.isArray(recent) ? recent : []) {
    if (e && typeof e.orderId === 'string' && Number(e.tip) > 0)
      map[e.orderId] = Number(e.tip);
  }
  return map;
}

/**
 * The tips that are new since `known` (null: nothing seen yet in this browser, so none are new),
 * and the map to remember next.
 */
export function freshTips(known, recent) {
  const now = tipMap(recent);
  const items = Array.isArray(recent) ? recent : [];
  if (!known || typeof known !== 'object') return { fresh: [], known: now };
  const fresh = [];
  for (const [orderId, amount] of Object.entries(now)) {
    const before = Number(known[orderId]) || 0;
    // a second tip on the same order (or a raised one) alerts for the difference
    if (amount > before + 0.004) {
      const entry = items.find((e) => e && e.orderId === orderId);
      fresh.push({
        orderId,
        amount: Math.round((amount - before) * 100) / 100,
        game: entry?.game ?? null,
      });
    }
  }
  return { fresh, known: now };
}

export function readKnownTips() {
  try {
    const value = JSON.parse(localStorage.getItem(KNOWN_KEY) || 'null');
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : null;
  } catch {
    return null;
  }
}

export function saveKnownTips(known) {
  try {
    localStorage.setItem(KNOWN_KEY, JSON.stringify(known));
  } catch {
    /* best effort */
  }
}

/** The title and text of the notification, kept apart so tests and the preview share them. */
export function tipNotificationText(tip) {
  const game = (tip.game && GAME[tip.game]?.name) || null;
  return {
    title: `You got a $${tip.amount.toFixed(2)} tip!`,
    body:
      (game ? `A customer tipped you for your ${game} order. ` : '') +
      '100% of it is yours and goes out with Friday’s payout.',
  };
}

/** One popup per tip across tabs. */
export function showTipNotification(tip, onClick, { claimed = false } = {}) {
  if (
    typeof Notification === 'undefined' ||
    Notification.permission !== 'granted' ||
    (!claimed && !claimOrderNotification(`tip-${tip.orderId}-${tip.amount}`))
  )
    return;
  try {
    const { title, body } = tipNotificationText(tip);
    const n = new Notification(title, {
      body,
      icon: '/icon-192.png',
      tag: `duoly-tip-${tip.orderId}`,
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

/**
 * Compares a fresh stats `recent` list with what this browser has seen, remembers it and shows
 * a notification for every new tip. The desk calls this after each stats load.
 */
export function checkTips(recent, onClick) {
  if (!Array.isArray(recent)) return [];
  const { fresh, known } = freshTips(readKnownTips(), recent);
  saveKnownTips(known);
  fresh.forEach((tip) => showTipNotification(tip, onClick));
  return fresh;
}

/**
 * Every page but the desk: looks for new tips once a minute, also while the teammate is offline
 * (a customer usually tips after the order, when they may have gone offline). With several pages
 * open, one of them checks for all (takePollLease). Returns a stop function.
 */
export function startTipWatch({ fetcher = window.fetch.bind(window) } = {}) {
  let busy = false;
  async function tick() {
    if (busy || !takePollLease(TIP_LEASE, TIP_CHECK_MS * 2)) return;
    busy = true;
    try {
      const res = await fetcher('/api/teammate/stats', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      checkTips(data?.stats?.recent, () => {
        window.location.href = '/teammate';
      });
    } catch {
      /* best effort */
    } finally {
      busy = false;
    }
  }
  const stopTicker = backgroundTicker(TIP_CHECK_MS, tick);
  const leave = () => releasePollLease(TIP_LEASE);
  window.addEventListener('pagehide', leave);
  tick();
  return () => {
    stopTicker();
    window.removeEventListener('pagehide', leave);
    leave();
  };
}
