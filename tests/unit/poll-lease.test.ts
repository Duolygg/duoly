import { beforeEach, describe, expect, it } from 'vitest';

import {
  claimOrderBell,
  claimOrderNotification,
  releasePollLease,
  takePollLease,
} from '../../src/components/teammate/desk-keeper';

// One shared localStorage, as every tab of the site sees it.
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};

describe('one polling tab per watcher', () => {
  beforeEach(() => store.clear());

  it('lets the first tab poll and the others skip while it renews', () => {
    expect(takePollLease('w', 15000, { tab: 'a', now: 0 })).toBe(true);
    expect(takePollLease('w', 15000, { tab: 'b', now: 5000 })).toBe(false);
    expect(takePollLease('w', 15000, { tab: 'a', now: 5000 })).toBe(true);
    expect(takePollLease('w', 15000, { tab: 'b', now: 19000 })).toBe(false);
  });

  it('hands over when the holder stops renewing', () => {
    takePollLease('w', 15000, { tab: 'a', now: 0 });
    expect(takePollLease('w', 15000, { tab: 'b', now: 15001 })).toBe(true);
    expect(takePollLease('w', 15000, { tab: 'a', now: 16000 })).toBe(false);
  });

  it('hands over at once when the holder closes', () => {
    takePollLease('w', 15000, { tab: 'a', now: 0 });
    releasePollLease('w', { tab: 'b' }); // only the holder can give it up
    expect(takePollLease('w', 15000, { tab: 'b', now: 1 })).toBe(false);
    releasePollLease('w', { tab: 'a' });
    expect(takePollLease('w', 15000, { tab: 'b', now: 2 })).toBe(true);
  });

  it('lets the desk take the job over', () => {
    takePollLease('w', 15000, { tab: 'a', now: 0 });
    expect(
      takePollLease('w', 15000, { tab: 'desk', now: 1, force: true }),
    ).toBe(true);
    expect(takePollLease('w', 15000, { tab: 'a', now: 2 })).toBe(false);
  });

  it('keeps separate watchers apart', () => {
    takePollLease('orders', 15000, { tab: 'a', now: 0 });
    expect(takePollLease('support', 15000, { tab: 'b', now: 0 })).toBe(true);
  });
});

describe('the desk bell has its own claim', () => {
  beforeEach(() => store.clear());

  it('rings on the desk even after another page showed the popup', () => {
    expect(claimOrderNotification('o1', 0)).toBe(true); // popup on another page
    expect(claimOrderBell('o1', 1)).toBe(true); // the desk still rings
    expect(claimOrderBell('o1', 2)).toBe(false); // a second desk does not
    expect(claimOrderNotification('o1', 3)).toBe(false);
  });
});
