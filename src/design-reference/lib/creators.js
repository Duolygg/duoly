// The creator program (/creators): what creators earn and what their viewers get.
// These are proposals to review, not settled deals: change the numbers here and the page follows.
// Money check: Duoly keeps 40% of each order (teammates get 60%, lib/orders.js PLATFORM_FEE). Commission
// and the viewer discount both come out of that 40%, so keep commission + discount well below it.
// NOTE: creator codes aren't tracked at checkout yet. That's the next build step before the program goes live.
const DISCOUNT = 10;
export const CREATOR = {
  viewerDiscount: DISCOUNT,  // % off a viewer's first order with a creator's code
  attributionMonths: 12,     // creators earn on every order a referred viewer places for this long
  payoutMin: 50,             // € minimum before a monthly payout
  avgOrder: 18.87,           // € a typical order (3 games of League Duo Pro at €6.99, −10% bundle), used by the earnings calculator
  tiers: [
    // [id, name, orders per month from your code (from), commission %, perks]
    { id: 'rising', name: 'Rising', from: 0, commission: 8, perks: ['Your own code and link', DISCOUNT + `% off for your viewers' first order`, 'Monthly payouts from €50', 'Creator Discord channel'] },
    { id: 'partner', name: 'Partner', from: 25, commission: 10, perks: ['Everything in Rising', '2 free sessions a month for content', 'Featured on Duoly socials', 'Custom code (e.g. YOURNAME10)'] },
    { id: 'elite', name: 'Elite', from: 100, commission: 12, perks: ['Everything in Partner', 'Play with top teammates on stream', 'Sponsored stream deals', 'A personal contact at Duoly'] }
  ]
};

export const tierFor = (ordersPerMonth) => CREATOR.tiers.reduce((t, x) => (ordersPerMonth >= x.from ? x : t), CREATOR.tiers[0]);
