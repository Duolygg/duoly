// Customer perks shown in the browser (migration 20261026160000, MONEY-RULES section 9).
// The server checks every rule again; these only decide what the UI offers.

/**
 * Free monthly coaching: any coaching service (catalog category training), exactly 1 unit.
 * @param {{ cat: string, units: number, bundle?: string | null }} selection
 */
export function freeCoachingFits({ cat, units, bundle = null }) {
  return cat === 'training' && units === 1 && !bundle;
}

/** 'YYYY-MM' to the month's English name ('2026-10' -> 'October'). */
export function monthName(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if (!m) return 'this month';
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  return date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
}

/** Status line for the free coaching card, or '' when it does not apply. */
export function freeCoachingStatus(perks) {
  const fc = perks && perks.freeCoaching;
  if (!fc || !fc.eligible) return '';
  const name = monthName(fc.month);
  if (fc.available)
    return 'Your free coaching session for ' + name + ' is ready';
  return 'Used for ' + name + '. Back on the 1st.';
}

export const LEVEL_NAMES = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
};
