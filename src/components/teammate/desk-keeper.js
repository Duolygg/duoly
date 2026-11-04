/* global window, document, localStorage, sessionStorage, Notification, Worker, Blob, URL, navigator, setInterval, clearInterval, setTimeout, clearTimeout, fetch, Event */
import { createTeammateFetch, newEligibleOrders } from './teammate-data';
import { gameOf } from '../../design-reference/lib/games';

/**
 * Keeps an online teammate online, and tells them about new orders, everywhere on the site.
 *
 * - The desk (/teammate) and every other page check in every 10 s while the teammate is online.
 *   Leaving the desk no longer sets them offline; closing the last tab does, through the 20 s
 *   heartbeat timeout (migration 20261024142000_presence.sql).
 * - Background tabs: browsers slow page timers down to once a minute, which is past the 20 s
 *   timeout. The ticks come from a small worker, whose timers aren't slowed that way.
 * - New orders: a browser notification (no sound off the desk) for orders that fit the
 *   teammate's games and voice setting. One notification per order across all open tabs.
 * - Twitch streaming: the streaming panel's Twitch live check (migration 20261105150000) keeps
 *   running while they're on other pages.
 * - AFK: 4 hours without any activity on any Duoly page switch them offline (migration
 *   20261105160000). 5 minutes before, a browser notification (and a banner on the desk) warns them;
 *   any click or key press keeps them online.
 */

export const PRESENCE_MS = 10000;
/** The server's reason when 4 hours without activity switched them offline (20261105160000). */
export const AFK_OFFLINE_REASON = 'No activity for 4 hours';
export const AFK_WARN_SECONDS = 5 * 60;
const QUEUE_MS = 5000;
const SETTINGS_MS = 60000;
const STREAMING_MS = 30000;

/**
 * Calls fn every ms, also in a background tab. Falls back to setInterval without workers.
 * Returns a stop function.
 */
export function backgroundTicker(ms, fn) {
  try {
    const source = `setInterval(() => postMessage(0), ${Number(ms)});`;
    const url = URL.createObjectURL(
      new Blob([source], { type: 'text/javascript' }),
    );
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    worker.onmessage = () => fn();
    return () => worker.terminate();
  } catch {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  }
}

// ---- one notification per order across tabs --------------------------------------------------

const NOTIFIED_KEY = 'duoly-notified-orders';
const NOTIFIED_KEEP_MS = 30 * 60 * 1000;

/** True the first time any tab asks for this order; false afterwards. */
export function claimOrderNotification(orderId, now = Date.now()) {
  if (!orderId) return true;
  try {
    let list = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]');
    if (!Array.isArray(list)) list = [];
    list = list.filter(
      (e) => e && typeof e.id === 'string' && now - e.at < NOTIFIED_KEEP_MS,
    );
    if (list.some((e) => e.id === orderId)) return false;
    list.push({ id: orderId, at: now });
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(list.slice(-200)));
    return true;
  } catch {
    return true; // no storage: better a second popup than none
  }
}

// ---- the orders this tab already saw (survives moving between pages) --------------------------

const SEEN_KEY = 'duoly-desk-seen';

/** null when this tab hasn't seen the queue yet (then nothing counts as new). */
export function readSeenOrders() {
  try {
    const list = JSON.parse(sessionStorage.getItem(SEEN_KEY) || 'null');
    return Array.isArray(list)
      ? list.filter((id) => typeof id === 'string')
      : null;
  } catch {
    return null;
  }
}

export function saveSeenOrders(ids) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(0, 500)));
  } catch {
    /* best effort */
  }
}

// ---- the notification -------------------------------------------------------------------------

/**
 * "New Order Available!" for one order, once across tabs. Silent: the desk plays its own bell,
 * other pages play nothing.
 */
export function showOrderNotification(order, onClick) {
  if (
    typeof Notification === 'undefined' ||
    Notification.permission !== 'granted' ||
    !claimOrderNotification(order.id)
  )
    return;
  try {
    const title =
      order.title +
      (order.games > 1 ? ' ×' + order.games : '') +
      ' · ' +
      gameOf(order.game).name;
    const n = new Notification('New Order Available!', {
      body: 'New Order: ' + title + '\nPrice: $' + order.payout.toFixed(2),
      icon: '/assets/brand/logo-full.webp',
      // one tag per order: a shared tag only replaces the previous popup quietly
      tag: 'duoly-order-' + (order.id || Date.now()),
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

/** "Still there?" once per idle stretch, across tabs. */
export function showAfkWarning(afkIn, now = Date.now()) {
  if (
    typeof Notification === 'undefined' ||
    Notification.permission !== 'granted'
  )
    return;
  // the same deadline (to the minute) in every tab: one popup
  const deadline = Math.round((now + afkIn * 1000) / 60000);
  if (!claimOrderNotification('afk-' + deadline, now)) return;
  try {
    const n = new Notification('Still there?', {
      body: 'You’ll go offline in a few minutes: no activity on Duoly for almost 4 hours. Click here to stay online.',
      icon: '/assets/brand/logo-full.webp',
      tag: 'duoly-afk',
      requireInteraction: true,
    });
    n.onclick = () => {
      window.focus();
      n.close();
      // the click itself is activity: the next heartbeat keeps them online
      window.dispatchEvent(new Event('keydown'));
    };
  } catch {
    /* best effort */
  }
}

// ---- every page but the desk ------------------------------------------------------------------

/**
 * Runs on pages other than the desk. Does nothing for a teammate who is offline: only the desk
 * puts them online. Returns a stop function.
 */
export function startDeskKeeper({ csrf, fetcher, location = window.location }) {
  const api = createTeammateFetch({ csrf, ...(fetcher ? { fetcher } : {}) });
  const post = async (path, body) => {
    const res = await api(path, { method: 'POST', body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  };
  let stopped = false;
  let online = true; // until the first check-in says otherwise
  let lastActive = Date.now();
  let settings = null;
  let settingsAt = 0;
  let streamingAt = 0;
  let busy = false;
  let lastQueue = 0;

  let afkWarning = false;
  let afkCheck = null;
  const activity = () => {
    lastActive = Date.now();
    // warning is up: tell the server right away instead of at the next heartbeat
    if (afkWarning && !afkCheck)
      afkCheck = setTimeout(() => {
        afkCheck = null;
        checkIn();
      }, 1000);
  };
  const events = ['pointerdown', 'pointermove', 'keydown', 'wheel'];
  events.forEach((ev) =>
    window.addEventListener(ev, activity, { passive: true }),
  );

  async function checkIn() {
    try {
      const { ok, data } = await post('/api/presence', {
        action: 'check-in',
        lastActive,
      });
      if (!ok) return;
      online = !!data.online;
      afkWarning =
        online && data.afkIn != null && data.afkIn <= AFK_WARN_SECONDS;
      if (afkWarning) showAfkWarning(data.afkIn);
    } catch {
      /* best effort */
    }
  }

  async function loadSettings(now) {
    if (settings && now - settingsAt < SETTINGS_MS) return;
    try {
      const res = await api('/api/queue-settings');
      if (!res.ok) return;
      const s = await res.json();
      settings = {
        access: { games: s.compGames || s.allowedGames, gg: s.ggAccess },
        enabledGames: s.enabledGames,
        voiceOptIn: s.voiceOptIn,
      };
      settingsAt = now;
    } catch {
      /* best effort */
    }
  }

  async function checkQueue(now) {
    if (
      typeof Notification === 'undefined' ||
      Notification.permission !== 'granted'
    )
      return;
    await loadSettings(now);
    if (!settings) return;
    try {
      const res = await api('/api/desk');
      if (!res.ok) return;
      const data = await res.json();
      const fresh = data.mine
        ? [] // playing an order: no new-order popups
        : newEligibleOrders(readSeenOrders(), data.queue, settings.access, {
            enabledGames: settings.enabledGames,
            voiceOptIn: settings.voiceOptIn,
          });
      saveSeenOrders(data.queue.map((o) => o.id));
      fresh.forEach((order) =>
        showOrderNotification(order, () => {
          location.href = '/teammate';
        }),
      );
    } catch {
      /* best effort */
    }
  }

  async function keepStreaming(now) {
    if (now - streamingAt < STREAMING_MS) return;
    streamingAt = now;
    try {
      await fetch('/api/teammate/streaming', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
    } catch {
      /* best effort */
    }
  }

  let n = 0;
  async function tick() {
    if (stopped || busy || !online) return;
    busy = true;
    try {
      const now = Date.now();
      // check in every PRESENCE_MS; the ticker runs at QUEUE_MS
      if (n++ % Math.round(PRESENCE_MS / QUEUE_MS) === 0) await checkIn();
      if (!online || stopped) return stop();
      if (now - lastQueue >= QUEUE_MS - 500) {
        lastQueue = now;
        await checkQueue(now);
      }
      await keepStreaming(now);
    } finally {
      busy = false;
    }
  }

  const stopTicker = backgroundTicker(QUEUE_MS, tick);
  function stop() {
    if (stopped) return;
    stopped = true;
    stopTicker();
    events.forEach((ev) => window.removeEventListener(ev, activity));
    clearTimeout(afkCheck);
  }
  tick();
  return stop;
}

/** Started by the site layout on every page but the desk, for teammates only. */
export function mountDeskKeeper(doc = document) {
  const el = doc.querySelector('[data-desk-keeper]');
  const csrf = el?.getAttribute('data-csrf');
  if (!csrf || typeof navigator === 'undefined') return null;
  return startDeskKeeper({ csrf });
}
