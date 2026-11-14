/*
 * The dashboards' first paint. Both used to render $0.00 and zero counts on the server and swap
 * in the real figures after their first request; now the server reads the data while rendering
 * (dashboard-preload.ts, teammate.astro) and passes it in, and with nothing to pass in they show
 * a dash, never a zero that is not true.
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import Dashboard from '../../src/components/account/Dashboard.jsx';
import { toOriginalHistory } from '../../src/components/account/dashboard-data.js';

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  role: 'customer',
  name: 'Sam Example',
  email: 'sam@example.invalid',
};
const render = (props: Record<string, unknown>) =>
  renderToString(
    createElement(Dashboard, {
      user,
      csrf: 'x',
      cur: 'EUR',
      usdRate: 1,
      ...props,
    }),
  );

describe('customer dashboard first paint', () => {
  it('starts with the preloaded balance and counts, not zeros', () => {
    const history = {
      ...toOriginalHistory([], { credits: [] }),
      wallet: 17.5,
      lifetimeOrders: 6,
      gamesPlayed: 14,
    };
    const html = render({ initialHistory: history });
    expect(html).toContain('17.50');
    expect(html).not.toMatch(/[€$]0\.00 balance/);
  });

  it('shows a dash rather than a $0.00 it cannot back up when nothing was preloaded', () => {
    const html = render({});
    expect(html).not.toMatch(/[€$]0\.00/);
    expect(html).toContain('—');
  });
});

describe('teammate desk first paint', () => {
  const teammate = {
    id: '00000000-0000-4000-8000-000000000002',
    role: 'teammate',
    name: 'Tia Example',
    email: 'tia@example.invalid',
  };
  it('shows dashes, never $0.00, when no stats were preloaded', async () => {
    const { default: Teammate } =
      await import('../../src/components/teammate/Teammate.jsx');
    const html = renderToString(
      createElement(Teammate, {
        user: teammate,
        csrf: 'x',
        discordLinked: true,
        presence: null,
      }),
    );
    expect(html).not.toMatch(/\$0\.00/);
    expect(html).not.toContain('held right now');
  });

  it('starts with the preloaded earnings when the page read them', async () => {
    const { default: Teammate } =
      await import('../../src/components/teammate/Teammate.jsx');
    const { TeammateStatsResponseSchema } =
      await import('../../src/contracts/reviews');
    const initialStats = TeammateStatsResponseSchema.parse({
      now: 1,
      me: teammate.id,
      stats: {
        completed: 12,
        tier: { name: 'Rookie', deposit: 10 },
        held: 3,
        saved: 0,
        rating: null,
        reviews: 0,
        tipsTotal: 42.5,
        recent: [],
        latestReviews: [],
        adjustments: [],
      },
      leaderboard: {},
    });
    const html = renderToString(
      createElement(Teammate, {
        user: teammate,
        csrf: 'x',
        discordLinked: true,
        presence: null,
        initialStats,
      }),
    );
    expect(html).toContain('$42.50');
    expect(html).toContain('held right now');
  });
});
