import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BEAT_FRESH_MS,
  DESK_CHANNEL,
  PEER_FRESH_MS,
  PRESENCE_MS,
  WATCHDOG_MS,
  createDeskPresence,
  lastTab,
  leaderOf,
  liveIds,
  sendLeavingBeacon,
} from '../../src/components/teammate/presence-leader';

/**
 * One desk heartbeat per browser (phase 4 of docs/product/background-work.md). What these tests
 * hold onto: the 10 s cadence and the server's 20 s freshness rule do not change, so the worst
 * case of a leader that disappears has to stay inside the window, and the failure direction has to
 * be "one extra check-in", never "nobody checked in".
 */

/** A BroadcastChannel between tabs of one fictional browser, with no real timers in it. */
function browser() {
  type Tab = {
    name: string;
    open: boolean;
    onmessage?: (event: { data: unknown }) => void;
    postMessage: (message: unknown) => void;
    close: () => void;
  };
  const tabs: Tab[] = [];
  const make = (name: string): Tab => {
    const tab: Tab = {
      name,
      open: true,
      postMessage: (message) => {
        for (const other of tabs)
          if (other !== tab && other.open && other.name === name)
            other.onmessage?.({ data: structuredClone(message) });
      },
      close: () => {
        tab.open = false;
      },
    };
    tabs.push(tab);
    return tab;
  };
  return { make, tabs };
}

let clock: number;
const now = () => clock;
/** The coordinator's own check-in is async; let it finish before counting. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A ticker that only runs when a test says so, so the watchdog is deterministic. */
function ticks() {
  const fns: (() => void)[] = [];
  const ticker = (ms: number, fn: () => void) => {
    expect(ms).toBe(WATCHDOG_MS);
    fns.push(fn);
    return () => {
      const at = fns.indexOf(fn);
      if (at >= 0) fns.splice(at, 1);
    };
  };
  return { ticker, run: () => fns.slice().forEach((fn) => fn()) };
}

interface Opened {
  tab: ReturnType<typeof createDeskPresence>;
  posts: number;
  runWatchdog: () => void;
}

function openTab(
  bus: ReturnType<typeof browser>,
  id: string,
  onBeat?: (data: unknown) => void,
  /** False for a tab whose check-ins never land, so its heartbeat stays stale. */
  succeeds = true,
): Opened {
  const watchdog = ticks();
  const state = { posts: 0 };
  const tab = createDeskPresence({
    id,
    now,
    ticker: watchdog.ticker,
    makeChannel: (name) => bus.make(name),
    checkIn: async () => {
      state.posts += 1;
      if (succeeds) tab.beat({ online: true, tab: id });
    },
    ...(onBeat ? { onBeat } : {}),
  });
  return {
    tab,
    get posts() {
      return state.posts;
    },
    runWatchdog: watchdog.run,
  };
}

beforeEach(() => {
  clock = Date.parse('2026-11-12T12:00:00.000Z');
});

describe('who leads', () => {
  it('is the lowest live id, which every tab works out on its own', () => {
    const peers = new Map([
      ['b', clock],
      ['c', clock],
    ]);
    expect(liveIds(peers, 'd', clock)).toStrictEqual(['b', 'c', 'd']);
    expect(leaderOf(peers, 'd', clock)).toBe('b');
    expect(leaderOf(new Map([['z', clock]]), 'a', clock)).toBe('a');
  });

  it('forgets a tab that has said nothing for PEER_FRESH_MS', () => {
    const peers = new Map([['a', clock]]);
    expect(leaderOf(peers, 'b', clock + PEER_FRESH_MS - 1)).toBe('a');
    expect(leaderOf(peers, 'b', clock + PEER_FRESH_MS)).toBe('b');
    expect(lastTab(peers, 'b', clock + PEER_FRESH_MS)).toBe(true);
    expect(lastTab(peers, 'b', clock)).toBe(false);
  });
});

describe('one heartbeat per browser', () => {
  it('lets one tab post and gives the others the same answer', async () => {
    const bus = browser();
    const seen: unknown[] = [];
    const first = openTab(bus, 'a');
    const second = openTab(bus, 'b', (data) => seen.push(data));
    // Both tabs know about each other through `hi` and its answer.
    expect(first.tab.peerCount()).toBe(2);
    expect(second.tab.peerCount()).toBe(2);
    expect(first.tab.isLeader()).toBe(true);
    expect(second.tab.isLeader()).toBe(false);

    expect(first.tab.mayCheckIn()).toBe(true);
    await first.tab.beat({ online: true, afkIn: 14400 });
    expect(seen).toStrictEqual([{ online: true, afkIn: 14400 }]);

    clock += PRESENCE_MS;
    expect(second.tab.mayCheckIn()).toBe(false);
    expect(first.tab.mayCheckIn()).toBe(true);
  });

  it('is every tab’s own job without BroadcastChannel, which is today’s behaviour', () => {
    const tab = createDeskPresence({
      id: 'a',
      now,
      checkIn: async () => undefined,
      makeChannel: () => null,
    });
    expect(tab.isLeader()).toBe(true);
    expect(tab.mayCheckIn()).toBe(true);
    clock += 10 * PRESENCE_MS;
    expect(tab.mayCheckIn()).toBe(true);
    tab.stop();
  });

  it('checks in from a follower rather than let the heartbeat go stale', () => {
    const bus = browser();
    const leader = openTab(bus, 'a');
    const follower = openTab(bus, 'b');
    leader.tab.beat({ online: true });
    expect(follower.tab.mayCheckIn()).toBe(false);
    clock += BEAT_FRESH_MS;
    expect(follower.tab.mayCheckIn()).toBe(false);
    clock += 1;
    expect(follower.tab.mayCheckIn()).toBe(true);
  });

  it('never lets a leader that vanished cost more than the 20 s freshness window', () => {
    // The guarantee the server's rule needs: the watchdog notices BEAT_FRESH_MS after the last
    // check-in and looks again every WATCHDOG_MS, so the gap can never reach 20 s.
    expect(BEAT_FRESH_MS + WATCHDOG_MS).toBeLessThan(20_000);
    // And a healthy leader beats every PRESENCE_MS, well inside the fresh window, so the watchdog
    // stays quiet instead of doubling the writes.
    expect(PRESENCE_MS).toBeLessThan(BEAT_FRESH_MS);
  });
});

describe('the watchdog', () => {
  it('stays quiet while the leader keeps beating', async () => {
    const bus = browser();
    const leader = openTab(bus, 'a');
    const follower = openTab(bus, 'b');
    for (let n = 0; n < 5; n++) {
      leader.tab.beat({ online: true });
      clock += WATCHDOG_MS;
      follower.runWatchdog();
      clock += WATCHDOG_MS;
      follower.runWatchdog();
      await settle();
    }
    expect(follower.posts).toBe(0);
  });

  it('posts from the follower once the leader stopped beating', async () => {
    const bus = browser();
    const leader = openTab(bus, 'a');
    const follower = openTab(bus, 'b');
    leader.tab.beat({ online: true });
    clock += BEAT_FRESH_MS + 1;
    follower.runWatchdog();
    await settle();
    expect(follower.posts).toBe(1);
  });

  it('never posts faster than the cadence, even when its own check-ins keep failing', async () => {
    const bus = browser();
    // Its check-ins never land, so its heartbeat never looks fresh and its watchdog fires on
    // every single look. The cap is the only thing between that and a write every 5 seconds.
    const leader = openTab(bus, 'a', undefined, false);
    const other = openTab(bus, 'b');
    clock += BEAT_FRESH_MS + 1;
    other.tab.activity(clock); // the second tab is still there
    for (let n = 0; n < 12; n++) {
      clock += 400;
      leader.runWatchdog();
      await settle();
    }
    expect(leader.tab.peerCount()).toBe(2);
    expect(leader.posts).toBe(1);
    clock += PRESENCE_MS;
    other.tab.activity(clock);
    leader.runWatchdog();
    await settle();
    expect(leader.posts).toBe(2);
  });

  it('takes the cadence over on its own tick once the leader is really gone', async () => {
    const bus = browser();
    const leader = openTab(bus, 'a');
    const follower = openTab(bus, 'b');
    leader.tab.beat({ online: true });
    expect(follower.tab.isLeader()).toBe(false);
    clock += BEAT_FRESH_MS + 1;
    follower.runWatchdog();
    await settle();
    expect(follower.posts).toBe(1);
    // Leadership moved here, so the heartbeat is back on a 10 s tick and not on the watchdog.
    expect(follower.tab.isLeader()).toBe(true);
    expect(follower.tab.mayCheckIn()).toBe(true);
    clock += WATCHDOG_MS;
    follower.runWatchdog();
    await settle();
    expect(follower.posts).toBe(1);
  });

  it('does nothing in a browser with only one tab', async () => {
    const bus = browser();
    const only = openTab(bus, 'a');
    clock += 10 * PRESENCE_MS;
    only.runWatchdog();
    await settle();
    expect(only.posts).toBe(0);
  });
});

describe('a tab going away', () => {
  it('hands over at once instead of waiting for the next tick', async () => {
    const bus = browser();
    const leader = openTab(bus, 'a');
    const next = openTab(bus, 'b');
    leader.tab.beat({ online: true });
    clock += PRESENCE_MS;
    expect(leader.tab.leaving()).toBe(false);
    await settle();
    expect(next.posts).toBe(1);
    expect(next.tab.isLeader()).toBe(true);
  });

  it('does not hand over while the heartbeat is still fresh', async () => {
    const bus = browser();
    const leader = openTab(bus, 'a');
    const next = openTab(bus, 'b');
    leader.tab.beat({ online: true });
    clock += 1000;
    leader.tab.leaving();
    await settle();
    expect(next.posts).toBe(0);
  });

  it('knows it is the last tab, which is what sends the beacon', () => {
    const bus = browser();
    const first = openTab(bus, 'a');
    const second = openTab(bus, 'b');
    expect(second.tab.leaving()).toBe(false);
    expect(first.tab.leaving()).toBe(true);
  });

  it('counts a tab that was closed without saying goodbye as gone after PEER_FRESH_MS', () => {
    const bus = browser();
    const first = openTab(bus, 'a');
    openTab(bus, 'b');
    expect(first.tab.leaving()).toBe(false);
    clock += PEER_FRESH_MS;
    expect(first.tab.leaving()).toBe(true);
  });

  it('says goodbye when it stops, so an offline teammate leaves the roster', async () => {
    const bus = browser();
    const first = openTab(bus, 'a');
    const second = openTab(bus, 'b');
    second.tab.stop();
    expect(first.tab.peerCount()).toBe(1);
    expect(first.tab.leaving()).toBe(true);
    // A stopped tab stops posting, however late its watchdog fires.
    clock += 10 * PRESENCE_MS;
    second.runWatchdog();
    await settle();
    expect(second.posts).toBe(0);
  });
});

describe('activity on any page', () => {
  it('shares the newest activity, so the AFK rule still counts every tab', () => {
    const bus = browser();
    const leader = openTab(bus, 'a');
    const follower = openTab(bus, 'b');
    expect(leader.tab.activeAt()).toBe(0);
    follower.tab.activity(clock);
    expect(leader.tab.activeAt()).toBe(clock);
    // Throttled: the leader needs the timestamp, not every pointermove.
    clock += 1000;
    follower.tab.activity(clock);
    expect(leader.tab.activeAt()).toBe(clock - 1000);
    clock += WATCHDOG_MS;
    follower.tab.activity(clock);
    expect(leader.tab.activeAt()).toBe(clock);
  });

  it('keeps the newest of several tabs', () => {
    const bus = browser();
    const leader = openTab(bus, 'a');
    const second = openTab(bus, 'b');
    const third = openTab(bus, 'c');
    third.tab.activity(clock + 5000);
    second.tab.activity(clock);
    expect(leader.tab.activeAt()).toBe(clock + 5000);
  });
});

describe('the leaving beacon', () => {
  it('asks for a presence-check timer and writes nothing, with the CSRF token in the body', async () => {
    const sent: { url: string; body: string; type: string }[] = [];
    const beacon = (url: string, body: Blob) => {
      sent.push({ url, body: '', type: body.type });
      return true;
    };
    expect(sendLeavingBeacon('csrf-token', beacon)).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toBe('/api/teammate/presence');
    expect(sent[0]!.type).toBe('application/json');
  });

  it('carries only the action and the token: no "offline" write anywhere', async () => {
    let body: Blob | null = null;
    sendLeavingBeacon('csrf-token', (_url: string, blob: Blob) => {
      body = blob;
      return true;
    });
    const text = await body!.text();
    expect(JSON.parse(text)).toStrictEqual({
      csrf: 'csrf-token',
      action: 'leaving',
    });
    expect(text).not.toContain('online');
  });

  it('does nothing without a token or without sendBeacon', () => {
    expect(sendLeavingBeacon('', () => true)).toBe(false);
    expect(sendLeavingBeacon('csrf-token', undefined)).toBe(false);
  });

  it('swallows a browser that refuses the beacon', () => {
    expect(
      sendLeavingBeacon('csrf-token', () => {
        throw new Error('blocked');
      }),
    ).toBe(false);
  });
});

describe('the channel name', () => {
  it('is one roster for the desk and every other page', () => {
    expect(DESK_CHANNEL).toBe('duoly-desk-presence');
    const bus = browser();
    const desk = createDeskPresence({
      id: 'a',
      now,
      checkIn: async () => undefined,
      makeChannel: (name) => bus.make(name),
      ticker: () => () => undefined,
    });
    const otherPage = createDeskPresence({
      id: 'b',
      now,
      checkIn: async () => undefined,
      makeChannel: (name) => bus.make(name),
      ticker: () => () => undefined,
    });
    expect(desk.peerCount()).toBe(2);
    expect(otherPage.isLeader()).toBe(false);
    expect(bus.tabs.every((tab) => tab.name === DESK_CHANNEL)).toBe(true);
  });

  it('survives a channel that throws on every send', () => {
    const tab = createDeskPresence({
      id: 'a',
      now,
      checkIn: async () => undefined,
      ticker: () => () => undefined,
      makeChannel: () => ({
        postMessage: () => {
          throw new Error('channel closed');
        },
        close: () => undefined,
      }),
    });
    expect(() => tab.beat({ online: true })).not.toThrow();
    expect(() => tab.leaving()).not.toThrow();
    expect(() => tab.stop()).not.toThrow();
  });
});

describe('a beat a follower cannot render', () => {
  it('is swallowed, because a heartbeat is not a rendering problem', () => {
    const bus = browser();
    const leader = openTab(bus, 'a');
    const onBeat = vi.fn(() => {
      throw new Error('setState after unmount');
    });
    openTab(bus, 'b', onBeat);
    expect(() => leader.tab.beat({ online: true })).not.toThrow();
    expect(onBeat).toHaveBeenCalledTimes(1);
  });
});
