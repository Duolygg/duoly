// Trust levels: the more orders a contractor completes, the smaller the security deposit
// held from each payout. `from` = completed orders needed to reach the level.
// Shared by the server (earnings ledger) and the browser (TrustScore, admin).
export const TIERS = [
  { id: 'rookie', name: 'Rookie', from: 0, deposit: 10, color: '#B9B0D6', glow: 'rgba(185, 176, 214, .3)', perk: 'Standard order access' },
  { id: 'trusted', name: 'Trusted', from: 100, deposit: 8, color: '#9EE6FF', glow: 'rgba(158, 230, 255, .35)', perk: 'Trusted badge on your profile' },
  { id: 'veteran', name: 'Veteran', from: 250, deposit: 5, color: '#D6BBFF', glow: 'rgba(214, 187, 255, .4)', perk: 'See high-value orders first' },
  { id: 'elite', name: 'Elite', from: 500, deposit: 3, color: '#F0A6FF', glow: 'rgba(240, 166, 255, .4)', perk: 'Priority matching' },
  { id: 'legend', name: 'Legend', from: 1000, deposit: 0, color: '#FFD27A', glow: 'rgba(255, 210, 122, .45)', perk: 'No deposit + Legend badge' }
];
export const RELEASE_DAYS = 14; // held deposits are paid back after this many days without a dispute

export function tierFor(completed) {
  let t = TIERS[0];
  TIERS.forEach((x) => { if (completed >= x.from) t = x; });
  return t;
}
