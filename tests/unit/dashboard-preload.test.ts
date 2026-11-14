import { describe, expect, it } from 'vitest';
import { loadDashboardPreload } from '../../src/server/orders/dashboard-preload';

/** Supabase's query builder: awaitable, but with no .catch of its own. */
const thenable = (result: { data: unknown; error: unknown }) => ({
  then: (ok: (v: typeof result) => unknown, fail?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(ok, fail),
});

describe('loadDashboardPreload', () => {
  it('works with a query builder that has no .catch', async () => {
    const client = {
      rpc: () => thenable({ data: null, error: { message: 'nope' } }),
    };
    const out = await loadDashboardPreload(client as never);
    expect(out).toEqual({ history: null, live: undefined });
  });

  it('leaves everything to the browser when a read throws', async () => {
    const client = {
      rpc: () => {
        throw new Error('down');
      },
    };
    const out = await loadDashboardPreload(client as never);
    expect(out).toEqual({ history: null, live: undefined });
  });
});
