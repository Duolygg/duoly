import { expect, it } from 'vitest';
import { callTool } from '../../src/server/mcp/tools';
import { games, services } from '../../src/server/mcp/catalog';
import { goalOf, goalServices, GOALS } from '../../src/server/mcp/goals';
it('uses explicit whole-word rules and asks about ambiguity', () => {
  expect(() => goalOf('climbing wall')).toThrow(/Clarify/);
  expect(() => goalOf('learn and climb')).toThrow(/Clarify/);
  expect(goalOf('learn and climb', 'review')).toBe('review');
  expect(goalOf('relax')).toBe('have_fun');
});
it('intersects every goal rule with bookable services and never exposes excluded categories', async () => {
  for (const game of games())
    for (const goal of GOALS) {
      const ids = goalServices(game.id, goal);
      const eligible = services(game.id).filter((s) =>
        ids ? ids.includes(s.id) : s.casual,
      );
      if (!eligible.length) {
        await expect(
          callTool('find_session', { game: game.id, goalType: goal }, { fx }),
        ).rejects.toThrow(/No services/);
        continue;
      }
      const result = await callTool(
        'find_session',
        { game: game.id, goalType: goal },
        { fx },
      );
      const recommendation = result.structuredContent.recommendation as {
        serviceId: string;
        reason: string;
      };
      expect(eligible.map((s) => s.id)).toContain(recommendation.serviceId);
      expect(recommendation.reason).not.toMatch(
        /win rate|guaranteed wins|[\u2013\u2014]| & /,
      );
      expect(
        (result.structuredContent.matches as Array<{ category: string }>).every(
          (s) => !['gg', 'social'].includes(s.category),
        ),
      ).toBe(true);
    }
});
const fx = async () => ({
  rate: 1.08,
  source: 'fallback' as const,
  date: '2026-11-07',
  fetchedAt: 0,
});
it('recommends a catalog-backed climbing option and defaults to EUR', async () => {
  const result = await callTool(
    'find_session',
    {
      game: 'lol',
      goal: 'I want to climb',
      rank: 'Gold',
      server: 'EUW',
      quantity: 3,
    },
    { fx },
  );
  expect(result.structuredContent.recommendation).toMatchObject({
    serviceId: 'duo1',
    goal: 'climb',
    reason: expect.stringContaining('Diamond'),
  });
  expect(result.structuredContent.missingInputs).toEqual([]);
  expect(result.content[0]!.text).toContain('3 games');
  expect(result.content[0]!.text).toContain('Recommended');
  expect(result.content[0]!.text.length).toBeLessThan(1500);
});
it('uses an explicit goal token for learning and applies EUR budgets', async () => {
  const result = await callTool(
    'find_session',
    {
      game: 'val',
      goal: 'help me improve',
      goalType: 'learn',
      budget: 13,
      quantity: 1,
    },
    { fx },
  );
  expect(result.structuredContent.recommendation).toMatchObject({
    serviceId: 'learn',
    goal: 'learn',
  });
  expect(result.structuredContent.budgetApplied).toBe(true);
});
it('does not invent ranked climbing for Minecraft', async () => {
  await expect(
    callTool('find_session', { game: 'mc', goal: 'climb' }, { fx }),
  ).rejects.toThrow(/No.*goal/);
});
it.each([1, 2])(
  'pluralizes hourly summaries for %i units',
  async (quantity) => {
    const result = await callTool(
      'get_quote',
      { game: 'val', service: 'vod', server: 'EU', quantity, currency: 'EUR' },
      { fx },
    );
    expect(result.content[0]!.text).toContain(
      `${quantity} ${quantity === 1 ? 'hour;' : 'hours;'}`,
    );
  },
);
