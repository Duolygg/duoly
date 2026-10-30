import { BRACKETS } from '../../contracts/performance';

// Admin-only fictional data. Never imported by a public page, API or server module.
// Build the whole cohort so order percent_rank, eligibility and all five brackets
// have a real denominator. Only seven representative rows are displayed.
const round = (value: number) => Math.round(value * 100) / 100;
const AT = '2026-10-30T12:00:00.000Z';
const BEFORE = '2026-10-30T00:00:00.000Z';
const names: Record<number, string> = {
  1: 'Demo Nova',
  5: 'Demo Luna',
  10: 'Demo Atlas',
  25: 'Demo Echo',
  50: 'Demo Sage',
  75: 'Demo River',
  101: 'Demo Starter',
};
const previous: Record<number, number> = {
  1: 5,
  5: 12,
  10: 5,
  25: 30,
  50: 20,
  75: 45,
};

export const DEMO_COHORT = Array.from({ length: 101 }, (_, index) => {
  const position = index + 1;
  const eligible = position <= 100;
  const rank = eligible ? position : null;
  const retentionRate = eligible ? (101 - position) / 100 : 0;
  const avgRating = eligible ? round(5 - index * 0.04) : null;
  const retentionScore = eligible ? round(retentionRate * 100) : null;
  const satisfactionScore = eligible
    ? round(((avgRating! - 1) / 4) * 100)
    : null;
  const ordersScore = eligible ? round(((100 - position) / 99) * 100) : null;
  return {
    userId: 'demo-' + position,
    name: names[position] ?? 'Demo Teammate ' + position,
    eligible,
    reason: eligible ? '' : 'Needs 10 completed orders',
    completedOrders: eligible ? 400 - position : 2,
    reviews: eligible ? 100 : 0,
    avgRating,
    customers: eligible ? 100 : 2,
    returningCustomers: eligible ? 101 - position : 0,
    retentionRate,
    retentionScore,
    satisfactionScore,
    ordersScore,
    score: eligible
      ? round(
          (retentionScore! * 45 + satisfactionScore! * 35 + ordersScore! * 20) /
            100,
        )
      : null,
    rank,
    percentile: rank,
    bracket: rank
      ? (BRACKETS.find((bracket) => rank <= bracket) ?? null)
      : null,
    previousRank: previous[position] ?? null,
    discord: {
      status:
        position === 25 ? 'error' : position === 75 ? 'no_discord' : 'synced',
      detail: 'Simulated status only. No Discord request or role change.',
      username: null,
      syncedAt: null,
    },
  };
});

const representatives = [1, 5, 10, 25, 50, 75, 101];
export const DEMO_DATA = {
  discordEnabled: true, // Enables the shared status filter for simulated states only.
  run: { at: AT, eligible: 100, teammates: 101, trigger: 'demo', by: null },
  settings: {
    w_retention: 45,
    w_satisfaction: 35,
    w_orders: 20,
    window_days: 90,
    min_orders: 10,
    min_reviews: 5,
    min_customers: 3,
    updated_at: AT,
    updated_by: null,
  },
  contractors: DEMO_COHORT.filter((row) =>
    representatives.includes(Number(row.userId.slice(5))),
  ),
};

export const DEMO_HISTORY = Object.fromEntries(
  DEMO_DATA.contractors.map((row) => {
    const prior = row.previousRank ? DEMO_COHORT[row.previousRank - 1]! : row;
    return [
      row.userId,
      [row, prior].map((snapshot, index) => ({
        run: 'demo-run-' + index,
        at: index === 0 ? AT : BEFORE,
        eligible: snapshot.eligible,
        score: snapshot.score,
        rank: snapshot.rank,
        percentile: snapshot.percentile,
        bracket: snapshot.bracket,
        of: 100,
      })),
    ];
  }),
);
