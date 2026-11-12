/* global window, document, localStorage, sessionStorage, Notification, Worker, Blob, URL, navigator, setInterval, clearInterval, setTimeout, clearTimeout, fetch, Event, Audio */
import { createTeammateFetch, newEligibleOrders } from './teammate-data';
import { createDeskPresence, sendLeavingBeacon } from './presence-leader';
import { gameOf } from '../../design-reference/lib/games';

/**
 * Keeps an online teammate online, and tells them about new orders, everywhere on the site.
 *
 * - The desk (/teammate) and every other page check in every 10 s while the teammate is online.
 *   Leaving the desk no longer sets them offline; closing the last tab does, through the 20 s
 *   heartbeat timeout (migration 20261024142000_presence.sql).
 * - Background tabs: browsers slow page timers down to once a minute, which is past the 20 s
 *   timeout. The ticks come from a small worker, whose timers aren't slowed that way.
 * - New orders: the order bell and a browser notification for orders that fit the teammate's
 *   games and voice setting, on the desk and every other page. One bell and one notification
 *   per order across all open tabs: whichever tab sees the order first rings.
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
 * "New Order Available!" for one order, once across tabs. Silent: the tab that shows it plays
 * the bell. Pass { claimed: true } when the caller already claimed the order.
 */
export function showOrderNotification(
  order,
  onClick,
  { claimed = false } = {},
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
  // one popup per idle stretch across tabs: a claim lasts 30 minutes, and the next warning can
  // only come about 4 hours later (a deadline-based key could shift by a minute between check-ins)
  void afkIn;
  if (!claimOrderNotification('afk', now)) return;
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

  function applyPresence(data) {
    online = !!data.online;
    afkWarning = online && data.afkIn != null && data.afkIn <= AFK_WARN_SECONDS;
    if (afkWarning) showAfkWarning(data.afkIn);
  }

  /** The heartbeat itself. The answer goes to the other tabs of this browser too. */
  async function postCheckIn() {
    try {
      const { ok, data } = await post('/api/presence', {
        action: 'check-in',
        // The AFK rule counts activity on any Duoly page, so the leader sends the newest.
        lastActive: Math.max(lastActive, presence.activeAt()),
      });
      if (!ok) return;
      presence.beat(data);
      applyPresence(data);
    } catch {
      /* best effort */
    }
  }

  /**
   * One heartbeat per browser: only the leader tab posts, the others take its answer
   * (presence-leader.js, docs/product/background-work.md). The 10 s cadence and the server's 20 s
   * freshness rule are unchanged.
   */
  const presence = createDeskPresence({
    checkIn: () => (stopped ? Promise.resolve() : postCheckIn()),
    onBeat: (data) => {
      if (!stopped && data && typeof data === 'object') applyPresence(data);
    },
    ticker: backgroundTicker,
  });

  async function checkIn() {
    if (!presence.mayCheckIn()) return;
    await postCheckIn();
  }

  const activity = () => {
    lastActive = Date.now();
    presence.activity(lastActive);
    // warning is up: tell the server right away instead of at the next heartbeat. This posts even
    // from a follower tab, because the click happened here and the leader would only see it later.
    if (afkWarning && !afkCheck)
      afkCheck = setTimeout(() => {
        afkCheck = null;
        postCheckIn();
      }, 1000);
  };
  const events = ['pointerdown', 'pointermove', 'keydown', 'wheel'];
  events.forEach((ev) =>
    window.addEventListener(ev, activity, { passive: true }),
  );

  /**
   * The last Duoly tab of this browser is going away. The beacon writes nothing; it asks for a
   * presence-check timer so the Discord roles follow within one freshness window even when the
   * browser never comes back (oai-review F5).
   */
  const leaving = () => {
    if (presence.leaving()) sendLeavingBeacon(csrf);
  };
  window.addEventListener('pagehide', leaving);

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

  let bell = null;
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
      // the bell and the popup, in the one tab that sees the order first
      const mine = fresh.filter((order) => claimOrderNotification(order.id));
      if (!mine.length) return;
      bell = bell || newOrderBell();
      playOrderBell(bell);
      mine.forEach((order) =>
        showOrderNotification(
          order,
          () => {
            location.href = '/teammate';
          },
          { claimed: true },
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
    presence.stop();
    events.forEach((ev) => window.removeEventListener(ev, activity));
    window.removeEventListener('pagehide', leaving);
    clearTimeout(afkCheck);
    if (bell) bell.pause();
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
