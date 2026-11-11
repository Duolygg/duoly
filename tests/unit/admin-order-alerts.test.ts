import { describe, expect, it } from 'vitest';

import {
  freshQueued,
  orderLine,
} from '../../src/components/admin/order-alerts';

const q = (orderId: string, status = 'queued') => ({
  orderId,
  status,
  service: 'Duo ranked',
  units: 1,
  game: 'valorant',
});

describe('admin new-order alerts', () => {
  it('treats everything already waiting on the first look as seen', () => {
    const { fresh, seen } = freshQueued(null, [q('a'), q('b')]);
    expect(fresh).toEqual([]);
    expect([...seen]).toEqual(['a', 'b']);
  });

  it('alerts only for queued orders it has not seen', () => {
    const first = freshQueued(null, [q('a')]);
    const next = freshQueued(first.seen, [
      q('c'),
      q('a'),
      q('d', 'in_progress'),
    ]);
    expect(next.fresh.map((o: { orderId: string }) => o.orderId)).toEqual([
      'c',
    ]);
    expect([...next.seen]).toEqual(['c', 'a']);
  });

  it('names the order like the teammate popup', () => {
    expect(orderLine({ ...q('a'), units: 3 })).toMatch(/^Duo ranked ×3 · /);
  });
});
