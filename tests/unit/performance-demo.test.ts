import { describe, expect, it } from 'vitest';
import {
  DEMO_COHORT,
  DEMO_DATA,
  DEMO_HISTORY,
} from '../../src/components/admin/performance-demo';
import { BRACKETS } from '../../src/contracts/performance';

const round = (value: number) => Math.round(value * 100) / 100;

describe('admin performance sample data', () => {
  it('matches the live scoring and percentile rules across 100 eligible synthetic ranks', () => {
    const eligible = DEMO_COHORT.filter((row) => row.eligible);
    expect(eligible).toHaveLength(100);
    expect(new Set(eligible.map((row) => row.rank)).size).toBe(100);
    for (const row of eligible) {
      expect(row.retentionScore).toBe(
        round((row.returningCustomers / row.customers) * 100),
      );
      expect(row.satisfactionScore).toBe(
        round(((row.avgRating! - 1) / 4) * 100),
      );
      const lower = eligible.filter(
        (other) => other.completedOrders < row.completedOrders,
      ).length;
      expect(row.ordersScore).toBe(round((lower / 99) * 100));
      expect(row.score).toBe(
        round(
          (row.retentionScore! * 45 +
            row.satisfactionScore! * 35 +
            row.ordersScore! * 20) /
            100,
        ),
      );
      const rank =
        eligible.filter(
          (other) =>
            other.score! > row.score! ||
            (other.score === row.score &&
              other.completedOrders > row.completedOrders),
        ).length + 1;
      expect(row.rank).toBe(rank);
      expect(row.percentile).toBe(rank);
      expect(row.bracket).toBe(
        BRACKETS.find((bracket) => rank <= bracket) ?? null,
      );
      expect(row.completedOrders).toBeGreaterThanOrEqual(
        DEMO_DATA.settings.min_orders,
      );
      expect(row.reviews).toBeGreaterThanOrEqual(
        DEMO_DATA.settings.min_reviews,
      );
      expect(row.customers).toBeGreaterThanOrEqual(
        DEMO_DATA.settings.min_customers,
      );
    }
    expect(DEMO_DATA.run.eligible).toBe(100);
    expect(DEMO_DATA.run.teammates).toBe(DEMO_COHORT.length);
  });

  it('shows representative rows for every bracket, unranked and ineligible with matching current history', () => {
    expect(DEMO_DATA.contractors).toHaveLength(7);
    expect(
      DEMO_DATA.contractors
        .filter((row) => row.bracket)
        .map((row) => row.bracket),
    ).toEqual([...BRACKETS]);
    expect(DEMO_COHORT.find((row) => !row.eligible)?.score).toBeNull();
    for (const row of DEMO_DATA.contractors) {
      expect(row.name).toMatch(/^Demo /);
      const history = DEMO_HISTORY[row.userId]!;
      expect(history[0]).toMatchObject({
        rank: row.rank,
        score: row.score,
        bracket: row.bracket,
        eligible: row.eligible,
        of: 100,
      });
      expect(history[1]!.rank).toBe(row.previousRank);
      for (const snapshot of history.filter((entry) => entry.eligible)) {
        expect(snapshot.bracket).toBe(
          BRACKETS.find(
            (bracket) => (snapshot.rank! / snapshot.of) * 100 <= bracket,
          ) ?? null,
        );
      }
    }
    expect(DEMO_HISTORY['demo-1']![1]!.bracket).toBe(5);
  });
});
