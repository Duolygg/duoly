import { GAMES, GAME } from './games';
import { CATALOG } from './catalog';

// The homepage FAQ. Also published as FAQPage structured data (app/page.jsx), so search engines and
// AI answers get the same, precise wording. Keep facts in sync with the product:
// prices → components/Home.jsx data(), bundles → Home.jsx renderVals(), servers → lib/servers.js,
// rank minimums → components/Apply.jsx NEEDS, refunds → lib/orders.js (5-minute auto-cancel).
const gameList = GAMES.map((g) => g.name);
// Price ranges straight from the catalog, so the FAQ never quotes stale prices.
const eur = (n) => '€' + n.toFixed(2);
const all = Object.entries(CATALOG).flatMap(([id, c]) => c.services.map(([, cat, , , , price, o = {}]) => ({ id, cat, price, unit: o.unit || c.unit, fun: !!o.fun })));
const range = (list) => [Math.min(...list.map((x) => x.price)), Math.max(...list.map((x) => x.price))];
const [gameLo, gameHi] = range(all.filter((x) => x.cat === 'duo' && !x.fun && x.unit === 'game'));
const [hourLo, hourHi] = range(all.filter((x) => x.cat === 'duo' && !x.fun && x.unit === 'hour'));
const [funLo] = range(all.filter((x) => x.fun));
const hourly = Object.keys(CATALOG).filter((id) => CATALOG[id].unit === 'hour').map((id) => GAME[id].name);
const HOURLY_LINE = hourly.slice(0, -1).join(', ') + ' and ' + hourly[hourly.length - 1];
const GAME_LINE = gameList.slice(0, -1).join(', ') + ' and ' + gameList[gameList.length - 1];

export const FAQ_TABS = [
  { id: 'start', label: 'Getting started', items: [
    ['What is Duoly?',
      'Duoly matches you with a verified, high-rank teammate who joins your lobby and plays with you on your own account. Pick your game and mode, pay, and a teammate usually joins in under 2 minutes. Ranked duos, chill games, coaching and Gamer Girl duos are all available.'],
    ['How does it work?',
      'Four steps: choose your game and what you want (ranked duo, bundle, coaching or a chill session), enter your in-game name and server, pay, and wait in the queue. The first teammate who accepts adds you in-game, and you can chat with them in your order room until the last game is played.'],
    ['How fast do I get matched?',
      'Usually in under 2 minutes, and you can watch it happen live. You can cancel for free until someone accepts. If nobody does within 5 minutes, the order cancels itself and the full amount goes back to your Duoly wallet automatically.'],
    ['Which games can I play?',
      GAME_LINE + '. Every game has its own verified teammates, ranks and modes.'],
    ['Which servers and regions do you cover?',
      'Every server each game has: from EUW, EUNE, NA, KR and the Riot servers in Asia for League of Legends, to Valorant’s shards, Fortnite’s matchmaking regions and Rocket League’s 12 regions. You pick your server at checkout and your teammate sees it before they accept. For Minecraft you just tell us the server or world you play on.'],
    ['Do I need an account?',
      'Yes, a free one. It takes ten seconds with Discord, Google or email. It’s how we connect your order to you, keep you updated while you wait and let you rebook teammates you liked.']
  ] },
  { id: 'pay', label: 'Prices & payments', items: [
    ['How much does a duo cost?',
      'Duos cost ' + eur(gameLo) + ' to ' + eur(gameHi) + ' per game, depending on the game and how high your teammate is ranked. ' + HOURLY_LINE + ' are booked by the hour instead, from ' + eur(hourLo) + ' to ' + eur(hourHi) + ', because a game there has no fixed length. Fun modes start at ' + eur(funLo) + '. You always see the exact total before you pay, in euros or US dollars.'],
    ['Are there discounts for more games?',
      'Yes. Book 5 games or hours at once and you save 20%. Every game also has three bundles of its most popular service in the Bundles tab: 10% off 3, 20% off 5 and 25% off 10. Duoly PRO members save another 10% on every order.'],
    ['Which payment methods can I use?',
      'Apple Pay, Google Pay, PayPal and all major credit and debit cards. Payments go through a secure checkout, and we never see or store your card details.'],
    ['Can I cancel or get a refund?',
      'You can cancel for free until a teammate accepts, and unmatched orders are refunded automatically after 5 minutes. If something goes wrong after that, contact support from your order and a real person reviews it, usually within minutes.'],
    ['Do I pay per game or all at once?',
      'All at once. You pay the full price for every game or hour in your order once, when you queue, and nothing is charged after each game. You can cancel for free until a teammate accepts.'],
    ['What is my Duoly balance?',
      'Refunds, cashback and level-up gifts go to your Duoly balance. At checkout you can switch it on to pay for part or all of your next order, for any game. It doesn’t expire.'],
    ['What is Duoly PRO?',
      'An optional membership for €4.99 a month: 10% off every order, priority matching and free re-rolls on every game. The first 7 days are free and you can cancel anytime.']
  ] },
  { id: 'safe', label: 'Safety', items: [
    ['Is my game account safe?',
      'Yes. You always play on your own account and never share your login. Asking for a password is against our rules, and our chat blocks messages asking for logins or outside payments automatically.'],
    ['Can I get banned for playing with a Duoly teammate?',
      'Playing in a party with another player is normal matchmaking in every game we support. We don’t offer account sharing or boosting on your account, and teammates must follow each game’s rules, with no cheats, scripts or exploits.'],
    ['What if my teammate is toxic or leaves?',
      'Re-roll to a new teammate for free, up to twice per order, and report them in one tap. Teammates who leave games, flame or break our rules are removed, and support makes it right with you.'],
    ['Are my payment and personal details private?',
      'Yes. Teammates only see your first name, in-game name and order details. They never see what you paid or how you paid, and everything stays inside Duoly.']
  ] },
  { id: 'mates', label: 'Teammates', items: [
    ['Who are the teammates?',
      'Real players verified at the top of their game, for example Diamond 1+ in League of Legends, Immortal 1+ in Valorant and Premier 20,000+ or FACEIT Level 9+ in Counter-Strike 2. Our team approves every teammate for each game separately, and all of them follow the Duoly Teammate Code.'],
    ['What is a Gamer Girl duo?',
      'A session with a verified female teammate, either casual games with good company or ranked games on voice. It’s about gaming and great conversation, and the same safety and respect rules apply as for every session.'],
    ['What are Social sessions?',
      'Time with a verified Gamer Girl without a game: just chat, watch a movie or stream together on Discord, a sleep call while you fall asleep, or karaoke. You book by the hour and she joins you on voice within minutes. Social sessions are friendly company, never dating, romantic or sexual services.'],
    ['Can I choose my teammate’s role, agent or champion?',
      'Yes. Add what you need in the order notes, like “I play support, you jungle”, and talk it through in the order chat once you’re matched.'],
    ['Can I play with the same teammate again?',
      'Yes. Favourite them after your games and rebook them directly whenever they’re online.'],
    ['How do I become a Duoly teammate?',
      'Apply on our “Become a teammate” page with your rank and the games you play. If you meet the rank requirements and pass our review, you choose your own hours, get paid every Friday and keep 100% of your tips.']
  ] }
];

// For FAQPage structured data: every question on the page, across all tabs.
export const faqJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_TABS.flatMap((t) => t.items.map(([q, a]) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a }
  })))
});
