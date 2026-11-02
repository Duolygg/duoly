import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MatchReports from '../../src/components/admin/MatchReports.jsx';

// Admin, Teammates, Match reports (20261102160000).
const report = (over: Record<string, unknown> = {}) => ({
  orderId: '11111111-1111-4111-8111-111111111111',
  reference: 'DL-48321',
  game: 'lol',
  service: 'duo2',
  title: 'Duo Pro',
  units: 2,
  orderIgn: 'Alex#EUW',
  customer: 'Alex',
  teammate: { id: 't1', name: 'Mina', image: '' },
  state: 'completed',
  games: [
    {
      teammateIgn: 'Mina#EUW',
      customerIgn: 'Alex#EUW',
      link: 'https://op.gg/m/1',
    },
    {
      teammateIgn: 'Mina#EUW',
      customerIgn: 'alex #euw',
      link: 'https://op.gg/m/2',
    },
  ],
  wins: 2,
  losses: 0,
  createdAt: '2026-11-02T20:00:00Z',
  updatedAt: '2026-11-02T20:00:00Z',
  ...over,
});
const render = (reports: unknown[]) =>
  renderToStaticMarkup(
    React.createElement(MatchReports, { reports, api: {} } as never),
  );

describe('admin match reports', () => {
  it('lists each report with the order, teammate, customer, W/L and whether it counts', () => {
    const html = render([
      report(),
      report({ reference: 'DL-2', state: 'handed_over', wins: 0, losses: 2 }),
    ]);
    expect(html).toContain('DL-48321 · Duo Pro ×2');
    expect(html).toContain('Mina played with Alex');
    expect(html).toContain('2W');
    expect(html).toContain('Counts');
    expect(html).toContain('Handed over');
  });

  it('marks a report whose customer IGN isn’t the one on the order', () => {
    // same player, other spelling: not marked
    expect(render([report()])).not.toContain('IGN differs</span>');
    const html = render([
      report({
        games: [
          {
            teammateIgn: 'Mina#EUW',
            customerIgn: 'Random#EUW',
            link: 'https://op.gg/m/1',
          },
          {
            teammateIgn: 'Mina#EUW',
            customerIgn: 'Alex#EUW',
            link: 'https://op.gg/m/2',
          },
        ],
      }),
    ]);
    expect(html).toContain('IGN differs</span>');
    expect(html).toContain('IGN differs · 1');
  });

  it('is a tab in Admin, Teammates and admins only', () => {
    const page = readFileSync('src/components/admin/Teammates.jsx', 'utf8');
    expect(page).toContain("tab('reports', 'Match reports', null)");
    const sql = readFileSync(
      'supabase/migrations/20261102160000_win_loss.sql',
      'utf8',
    );
    expect(sql).toContain(
      "if not exists(select 1 from public.admin_caller()) then return public.order_error(403, 'Admins only.'); end if;",
    );
  });
});
