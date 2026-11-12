/* global window, document, localStorage, sessionStorage, Notification, Worker, Blob, URL, navigator, setInterval, clearInterval, setTimeout, clearTimeout, fetch, Event, Audio */
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
 * - New orders: a browser notification for orders that fit the teammate's games and voice
 *   setting, on the desk and every other page, once per order across all open tabs. The bell
 *   rings only on the desk, where the order can be seen and accepted. Off the desk, one open
 *   page watches the queue for all of them (takePollLease), so five tabs cost one poll.
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
const KEEPER_LEASE = 'teammate-keeper';
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

/**
 * The bell has its own claim, apart from the popup: the desk rings even when another page of the
 * site already showed the popup for that order, and two open desks still ring only once.
 */
export function claimOrderBell(orderId, now = Date.now()) {
  return claimOrderNotification('bell:' + orderId, now);
}

// ---- one polling tab per watcher ----------------------------------------------------------------

/**
 * Each open tab used to poll the API on its own, and every poll costs a sign-in check plus three
 * lookups on the shared Supabase project. A lease in localStorage lets one tab per watcher poll
 * for all of them: the holder renews it on every tick, the others skip their tick, and when the
 * holder closes (pagehide releases it) or stops renewing, the next tab to tick takes over.
 */
const LEASE_PREFIX = 'duoly-poll-lease:';
const TAB_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * True when this tab may poll `name` now (and holds the lease for `ttlMs`). `force` takes it over
 * from another tab: the page where the alert matters most (the Live desk, the support inbox).
 */
export function takePollLease(
  name,
  ttlMs,
  { force = false, now = Date.now(), tab = TAB_ID } = {},
) {
  try {
    const key = LEASE_PREFIX + name;
    const held = JSON.parse(localStorage.getItem(key) || 'null');
    if (
      !force &&
      held &&
      held.tab !== tab &&
      typeof held.until === 'number' &&
      held.until > now
    )
      return false;
    localStorage.setItem(key, JSON.stringify({ tab, until: now + ttlMs }));
    return true;
  } catch {
    return true; // no storage: every tab polls, as before
  }
}

/** Gives the lease up (pagehide) so another open tab takes over on its next tick. */
export function releasePollLease(name, { tab = TAB_ID } = {}) {
  try {
    const key = LEASE_PREFIX + name;
    const held = JSON.parse(localStorage.getItem(key) || 'null');
    if (held && held.tab === tab) localStorage.removeItem(key);
  } catch {
    /* best effort */
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

// ---- the bell ---------------------------------------------------------------------------------

export const ORDER_BELL_SRC = '/assets/sounds/order-bell.wav';

export function newOrderBell() {
  if (typeof Audio === 'undefined') return null;
  const bell = new Audio(ORDER_BELL_SRC);
  bell.preload = 'auto';
  return bell;
}

/** The clip is ~3 s, played twice back to back (~6 s). */
export function playOrderBell(bell) {
  if (!bell) return;
  let plays = 0;
  bell.onended = () => {
    plays += 1;
    if (plays < 2) {
      bell.currentTime = 0;
      bell.play().catch(() => {});
    }
  };
  bell.currentTime = 0;
  bell.play().catch(() => {}); // browsers may block sound until the page has been clicked
}

// ---- the notification -------------------------------------------------------------------------

/**
 * "New Order Available!" for one order, once across tabs. Pass { claimed: true } when the caller
 * already claimed the order. Silent on the desk, where the bell plays; off the desk there is no
 * bell, so the popup keeps the system's own notification sound ({ silent: false }).
 */
export function showOrderNotification(
  order,
  onClick,
  { claimed = false, silent = true } = {},
) {
  if (
    typeof Notification === 'undefined' ||
    Notification.permission !== 'granted' ||
    (!claimed && !claimOrderNotification(order.id))
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
      icon: '/icon-192.png',
      // one tag per order: a shared tag only replaces the previous popup quietly
      tag: 'duoly-order-' + (order.id || Date.now()),
      silent,
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
  // one popup per idle stretch across tabs: a claim lasts 30 minutes, and the next warning can
  // only come about 4 hours later (a deadline-based key could shift by a minute between check-ins)
  void afkIn;
  if (!claimOrderNotification('afk', now)) return;
  try {
    const n = new Notification('Still there?', {
      body: 'You’ll go offline in a few minutes: no activity on Duoly for almost 4 hours. Click here to stay online.',
      icon: '/icon-192.png',
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
      // Off the desk: the popup only, once across tabs. The bell rings on the desk alone, where
      // the teammate can see and accept the order (owner decision 12 November 2026).
      const mine = fresh.filter((order) => claimOrderNotification(order.id));
      mine.forEach((order) =>
        showOrderNotification(
          order,
          () => {
            location.href = '/teammate';
          },
          { claimed: true, silent: false },
        ),
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
      // With several pages open, one of them watches the queue and Twitch for all of them.
      // Check-ins stay per tab: each one carries that tab's own last activity for the AFK timer.
      if (!takePollLease(KEEPER_LEASE, QUEUE_MS * 3, { now })) return;
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
  const leave = () => releasePollLease(KEEPER_LEASE);
  window.addEventListener('pagehide', leave);
  function stop() {
    if (stopped) return;
    stopped = true;
    stopTicker();
    events.forEach((ev) => window.removeEventListener(ev, activity));
    window.removeEventListener('pagehide', leave);
    leave();
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
