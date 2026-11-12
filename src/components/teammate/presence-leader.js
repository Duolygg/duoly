/* global BroadcastChannel, crypto, navigator, Blob, setInterval, clearInterval */

/**
 * One desk heartbeat per browser instead of one per tab (phase 4 of
 * docs/product/background-work.md).
 *
 * Four tabs open on Duoly write `desk_check_in` four times every 10 seconds today. All four writes
 * say the same thing, and on Supabase Free that is the kind of idle write this whole build exists
 * to remove. So the tabs of one browser agree over a BroadcastChannel on one leader, and only the
 * leader posts; the others get the leader's answer over the same channel and keep exactly the UI
 * they would have had.
 *
 * Nothing about the cadence or the rules changes: the leader still checks in every 10 seconds, the
 * server still treats a heartbeat older than 20 seconds as offline (migration
 * 20261024142000_presence.sql), and the 4 hour AFK rule still works off `lastActive`.
 *
 * Two things make the 20 second window safe when the leader disappears:
 *
 * - A tab that goes away says so (`bye` on `pagehide`), and the next leader checks in at once
 *   rather than waiting for its own tick.
 * - A tab that dies without saying anything (a renderer crash) is caught by a watchdog: while a
 *   leader's check-in is older than BEAT_FRESH_MS, every other tab checks in itself. The watchdog
 *   runs on the same worker-driven ticker the desk uses, because a background tab's
 *   `setTimeout` is throttled to about once a minute, which is well past the 20 seconds.
 *
 * Worst case is therefore BEAT_FRESH_MS + WATCHDOG_MS = 18 s, inside the window, and the failure
 * direction is "two tabs check in", which is exactly today's behaviour.
 *
 * Without BroadcastChannel (an old browser, a test environment) every tab is its own leader, which
 * is today's behaviour too.
 */

/** One channel for the whole site: the desk and every other page share the roster. */
export const DESK_CHANNEL = 'duoly-desk-presence';
/** The desk's heartbeat interval, repeated here so this module needs no import. */
export const PRESENCE_MS = 10000;
/**
 * A leader's check-in counts as fresh for this long: the 10 s cadence plus 5 s of slack for a slow
 * request, and still under the server's 20 s window once the watchdog interval is added.
 */
export const BEAT_FRESH_MS = 15000;
/** How often the watchdog looks, and how often a tab says "still here". */
export const WATCHDOG_MS = 4000;
/** A tab that has not said anything for this long is treated as gone. */
export const PEER_FRESH_MS = 25000;

/** Short, unguessable enough to break ties, and never sent anywhere but this browser. */
export function tabId() {
  try {
    return crypto.randomUUID();
  } catch {
    return 'tab-' + Math.random().toString(36).slice(2, 12);
  }
}

/** The ids that have spoken recently, including this tab, sorted. Pure. */
export function liveIds(peers, selfId, now) {
  const live = [selfId];
  for (const [id, at] of peers)
    if (id !== selfId && now - at < PEER_FRESH_MS) live.push(id);
  return live.sort();
}

/**
 * The leader is simply the lowest live id, so every tab works it out on its own and no handover
 * message can be lost. A new tab with a lower id takes over at once, and it checks in as part of
 * mounting anyway, so taking over never leaves a gap.
 */
export function leaderOf(peers, selfId, now) {
  return liveIds(peers, selfId, now)[0];
}

/** True when nobody else has spoken recently: this is the last tab of the browser. Pure. */
export function lastTab(peers, selfId, now) {
  return liveIds(peers, selfId, now).length === 1;
}

/**
 * @param {{
 *   checkIn: () => Promise<unknown>,
 *   onBeat?: (data: unknown) => void,
 *   id?: string,
 *   channelName?: string,
 *   now?: () => number,
 *   ticker?: (ms: number, fn: () => void) => () => void,
 *   makeChannel?: (name: string) => { postMessage: (m: unknown) => void, close: () => void } | null,
 * }} options
 */
export function createDeskPresence(options) {
  const {
    checkIn,
    onBeat,
    id = tabId(),
    channelName = DESK_CHANNEL,
    now = () => Date.now(),
    ticker,
  } = options;
  const peers = new Map();
  let lastBeat = 0;
  let lastTry = 0;
  let lastShared = 0;
  let remoteActive = 0;
  let stopped = false;
  let busy = false;

  const channel = (() => {
    try {
      if (options.makeChannel) return options.makeChannel(channelName);
      if (typeof BroadcastChannel === 'undefined') return null;
      return new BroadcastChannel(channelName);
    } catch {
      return null;
    }
  })();

  const send = (message) => {
    try {
      channel?.postMessage({ ...message, id });
    } catch {
      /* a closed channel is the same as no channel: this tab leads itself */
    }
  };

  /**
   * Checks in right away, outside the host's own tick: a takeover may not wait 10 seconds. Capped
   * at one a heartbeat interval, so a leader whose requests are failing cannot make every other
   * tab post faster than the cadence this build is allowed to change (which is: not at all).
   */
  const checkInNow = async () => {
    const at = now();
    if (stopped || busy || at - lastTry < PRESENCE_MS) return;
    lastTry = at;
    busy = true;
    try {
      await checkIn();
    } catch {
      /* the host logs its own failures; a missed beat is one extra check-in, never a wrong state */
    } finally {
      busy = false;
    }
  };

  const receive = (message) => {
    if (stopped || !message || typeof message !== 'object') return;
    const from = message.id;
    if (typeof from !== 'string' || from === id) return;
    const at = now();
    if (message.t === 'bye') {
      peers.delete(from);
      // The tab that leaves may have been the leader; whoever leads now says so immediately.
      if (leaderOf(peers, id, at) === id && at - lastBeat >= PRESENCE_MS)
        void checkInNow();
      return;
    }
    peers.set(from, at);
    if (message.t === 'hi') {
      // Answer a new tab so it learns about this one without waiting for a heartbeat.
      send({ t: 'here' });
      return;
    }
    if (message.t === 'act') {
      // The 4 hour AFK rule counts activity on any Duoly page, so the leader has to report the
      // newest activity of any tab, not only its own (migration 20261105160000).
      if (typeof message.at === 'number' && message.at > remoteActive)
        remoteActive = message.at;
      return;
    }
    if (message.t === 'beat') {
      lastBeat = at;
      if (onBeat) {
        try {
          onBeat(message.data);
        } catch {
          /* a follower's own rendering problem is not this module's business */
        }
      }
    }
  };

  if (channel) {
    channel.onmessage = (event) => receive(event?.data);
    send({ t: 'hi' });
  }

  /**
   * Two jobs, both cheap and both inside this browser: say "still here", so every tab's roster is
   * current, and catch a leader that died without saying goodbye. The second one forgets the tabs
   * that went quiet with it, which is what moves leadership here and puts the 10 second cadence
   * back on this tab's own tick instead of leaving it to the watchdog.
   */
  const watchdog = channel
    ? (ticker ?? ((ms, fn) => fallbackTicker(ms, fn)))(WATCHDOG_MS, () => {
        if (stopped) return;
        send({ t: 'alive' });
        if (peers.size === 0) return;
        const at = now();
        if (at - lastBeat <= BEAT_FRESH_MS) return;
        for (const [peer, seen] of peers)
          if (at - seen > BEAT_FRESH_MS) peers.delete(peer);
        void checkInNow();
      })
    : null;

  return {
    id,
    /** Only the leader posts, unless no leader's answer has arrived for a while. */
    mayCheckIn(at = now()) {
      if (!channel) return true;
      if (leaderOf(peers, id, at) === id) return true;
      return at - lastBeat > BEAT_FRESH_MS;
    },
    /** The leader shares the answer it got, which is also its "I am alive" message. */
    beat(data, at = now()) {
      lastBeat = at;
      send({ t: 'beat', data });
    },
    /**
     * This tab saw a click, a key press or a move. Shared at most once every WATCHDOG_MS, because
     * the leader needs the timestamp, not the events.
     */
    activity(at = now()) {
      if (!channel || at - lastShared < WATCHDOG_MS) return;
      lastShared = at;
      send({ t: 'act', at });
    },
    /** The newest activity another tab reported, so the leader can send the real maximum. */
    activeAt() {
      return remoteActive;
    },
    /** True when this was the last tab, so the caller sends the leaving beacon. */
    leaving(at = now()) {
      const alone = lastTab(peers, id, at);
      send({ t: 'bye' });
      return alone;
    },
    isLeader(at = now()) {
      return !channel || leaderOf(peers, id, at) === id;
    },
    peerCount(at = now()) {
      return liveIds(peers, id, at).length;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      watchdog?.();
      send({ t: 'bye' });
      try {
        channel?.close();
      } catch {
        /* already closed */
      }
    },
  };
}

/** Only used when the host passes no ticker; the desk passes its worker-driven one. */
function fallbackTicker(ms, fn) {
  const id = setInterval(fn, ms);
  return () => clearInterval(id);
}

/**
 * The last tab is going away: ask the server for a presence-check timer, and nothing else. It
 * never writes `desk_set_online(false)`, because `pagehide` also fires on an ordinary navigation
 * and on closing one of several tabs (oai-review F5). `sendBeacon` is the only thing a browser
 * still runs while the page is unloading; the body carries the CSRF token exactly like every other
 * presence call, so the endpoint's CSRF and Origin checks are unchanged.
 */
export function sendLeavingBeacon(csrf, beacon) {
  try {
    const send =
      beacon ??
      (typeof navigator !== 'undefined' && navigator.sendBeacon
        ? navigator.sendBeacon.bind(navigator)
        : null);
    if (!send || !csrf) return false;
    return !!send(
      '/api/teammate/presence',
      new Blob([JSON.stringify({ csrf, action: 'leaving' })], {
        type: 'application/json',
      }),
    );
  } catch {
    return false;
  }
}
