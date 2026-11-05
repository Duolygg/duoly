// Sparky's knowledge from Fabian's original support assistant (lib/sparky.js, lib/trust.js,
// lib/chatRules.js, lib/prioTiers.js, lib/reports.js), reconciled with what is live today.
// Each entry is a reference note for the AI and a keyword route for the no-AI fallback.
// When a feature goes live or changes, update its entry here and CURRENT_FACTS in sparky.ts.

import type { SupportRole } from './sparky';

export type KnowledgeEntry = {
  id: string;
  roles: SupportRole[];
  /** Lowercase, accent-free regex used by the fallback router (from the original intents). */
  match: RegExp;
  text: string;
};

const ALL: SupportRole[] = ['guest', 'customer', 'teammate'];
const BUYERS: SupportRole[] = ['guest', 'customer'];
const TEAM: SupportRole[] = ['teammate'];

export const KNOWLEDGE: KnowledgeEntry[] = [
  // ---- customers and guests
  {
    id: 'reroll',
    roles: BUYERS,
    match:
      /re ?roll|swap|switch|new teammate|bad teammate|isnt great|not great|toxic|rude|flam|\bleft\b|afk|leaves|leaving|throw/,
    text: 'You can re-roll your teammate for free in the first 5 minutes after you’re matched, up to 2 times per order: the order goes back into the queue and that teammate can’t take it from the queue again. If they were toxic or tried to move you off Duoly, tell us here with screenshots and an admin looks at it.',
  },
  {
    id: 'cancel-refund',
    roles: BUYERS,
    match:
      /cancel|refund|money back|charge|chargeback|didnt (get|play)|hold|pending/,
    text: 'Nothing is charged until a teammate accepts. If nobody accepts within 5 minutes, or you cancel before that, the card hold is released (your bank may take a few days to show it). Once an order is being played, tell us what went wrong (no-show, left mid-game, toxic) and an admin reviews it; refunds after a match go back to your card through Stripe, and any part you paid with Duoly balance goes back to your balance.',
  },
  {
    id: 'rate',
    roles: BUYERS,
    match: /rate|rating|review|stars|feedback/,
    text: 'After your order is done you can rate your teammate with 1 to 5 stars, pick a few tags and write a short review in your order room. You can rate each order once, and add a tip of €1 to €100 together with your rating; 100% of the tip goes to your teammate. After rating, the thank you panel also invites you to review Duoly on Trustpilot, whatever your rating was.',
  },
  {
    id: 'twitch-book',
    roles: BUYERS,
    match: /twitch|stream(er|ing)?\b|live on/,
    text: 'You can book a session with a teammate who is streaming on Twitch right now: the “Live on Twitch” section on the homepage shows who is live and bookable, with their hourly rate, games, rating and Twitch link (it only shows while someone is live). Press Book, pick the game, how many hours, your server, in-game name and voice, and pay through the normal checkout; the total is their rate times the hours, and your Duoly balance is used first. PRO and creator discounts don’t apply to streamer bookings. The order goes only to that streamer: if they don’t accept within 5 minutes it is cancelled and nothing is charged. A streamer booking can’t be re-rolled.',
  },
  {
    id: 'mood',
    roles: BUYERS,
    match: /\bmood\b|chill|tryhard|teach me|vibe/,
    text: 'At checkout you can pick how the session should feel: Chill (relaxed games, zero pressure), Tryhard (comms on, play to win), Teach me (they explain the why and drop tips) or Just for fun (banter, memes and off-meta picks). It’s optional, your teammate sees it before accepting, and it isn’t offered for Social sessions.',
  },
  {
    id: 'cookies',
    roles: BUYERS,
    match: /cookie|tracking|analytics|privacy|consent|gdpr|dsgvo/,
    text: 'On your first visit the cookie banner lets you choose: only necessary cookies, or also analytics, marketing and creator referral cookies, each on its own. Analytics only runs if you allow it. You can change your choice anytime under “Cookie settings” in the footer; the privacy page explains every cookie.',
  },
  {
    id: 'apply',
    roles: ALL,
    match: /become|apply|work for|join (the )?team|be a teammate|hiring/,
    text: 'Apply on the “Become a teammate” page (/apply) with your rank, region and games, and a YouTube link to a short intro video (required). The page shows the minimum rank for each game and what teammates earn: 60% of each order. Admins review every application and reach out on Discord.',
  },
  {
    id: 'chat-rules',
    roles: ALL,
    match:
      /chat|message|paypal|venmo|whatsapp|telegram|snapchat|password|login details|outside/,
    text: 'Order chat keeps payments and accounts on Duoly: messages that ask for logins or move payments or contact off Duoly are blocked. Never share your login with anyone. Chat messages are up to 500 characters.',
  },
  {
    id: 'balance',
    roles: BUYERS,
    match: /wallet|balance|guthaben/,
    text: 'Your Duoly balance collects cashback, level-up gifts, the €50 report bounty and credits from Duoly. Switch it on at checkout (it is on by default) to pay for part or all of an order, for any game. It never expires; promotional balance can’t be paid out as cash, and it can’t pay tips. Your dashboard shows your balance.',
  },
  {
    id: 'loyalty',
    roles: BUYERS,
    match:
      /loyal|cashback|level|bronze|silver|gold|platinum|diamond|reward|perk|gift/,
    text: 'Loyalty levels by completed orders: Bronze from 0 (1% cashback), Silver from 100 (2%, €5 gift), Gold from 250 (3%, €15 gift, priority matching), Platinum from 500 (5%, €40 gift, one free 1-hour or 1-game coaching order every month), Diamond from 1000 (7%, €100 gift, pick a teammate you played with before). Cashback is on the card-paid part of each completed order and lands in your balance 14 days later. Gifts are added automatically. Your dashboard Rewards card shows your level.',
  },
  {
    id: 'social',
    roles: BUYERS,
    match:
      /\bsocial\b|just chat|watch together|\bmovie|sleep ?call|karaoke|\bsing\b|\be-?girls?\b/,
    text: 'Social sessions are time with a verified Gamer Girl without a game: Just Chat, Watch Together (a movie, show or stream on Discord), Sleep Call or Karaoke. Pick Social in the game list, choose the session and the hours, pay, and a Gamer Girl joins you on voice within minutes. The price per hour is on each card, with bundle discounts for 3, 5 or 10 hours. Social sessions are friendly company, never dating, romantic or sexual services. Wake-up calls are not available yet, because every order starts right away.',
  },
  {
    id: 'pro',
    roles: BUYERS,
    match: /\bpro\b|membership|subscription|abo/,
    text: 'Duoly PRO costs €9.99 a month ($9.99 for customers who use US dollars, charged in euros): 10% off every order on top of bundle discounts, priority matching and unlimited re-rolls (still in the first 5 minutes after acceptance). The first 7 days are free with no card needed, once per customer and card. To keep PRO after the trial, add a card in Manage PRO on your dashboard; without one it pauses until a card is added. Cancel anytime with Manage PRO; PRO stays active until the end of the paid month.',
  },
  // ---- teammates
  {
    id: 'twitch-stream',
    roles: TEAM,
    match: /twitch|stream(er|ing)?\b/,
    text: 'Twitch streaming lets customers book you while you stream. Admins switch it on per game, only for games you’re already approved for; your dashboard then shows a Twitch streaming panel. Set your hourly rate (€9.99 to €100; you keep 60%, like every order), which lengths from 1 to 10 hours you offer, and your Twitch username, which is required. Go online for streaming from the panel: we check with Twitch that your channel is live, and while your stream is off you drop off the list on your own and come back once you’re live again. You also need your dashboard online, a connected Discord and an account that isn’t suspended. You take one booking at a time and are hidden while you play, while a booking waits for you or while someone is paying for you. A booking goes only to you, never to Discord or other teammates; accept within 5 minutes or it is cancelled and refunded.',
  },
  {
    id: 'match-reports',
    roles: TEAM,
    match: /match report|win.?loss|winrate|\bwins?\b|\blosses\b|\bign\b/,
    text: 'On win/loss orders you report the wins and losses with each game’s in-game names and match link when you finish. Your winrate from these reports is the biggest factor in the performance ranking. Admins check reports: if a result or a screenshot is wrong, they correct it with a reason, it is noted in the audit log and your winrate follows the corrected numbers. Wrong or fake reports are treated like fake proof.',
  },
  {
    id: 'suspended',
    roles: TEAM,
    match: /suspend|banned|locked|logged out|kicked/,
    text: 'A suspended account is locked: you are logged out, can’t sign in or go online, and can’t take orders. An admin can’t suspend you in the middle of an order. Ask an admin if you think it’s a mistake.',
  },
  {
    id: 'online',
    roles: TEAM,
    match:
      /online|offline|toggle|cant go|cannot go|wont go|switch on|\bafk\b|inactiv|4 hours|still there/,
    text: 'To go online you need a connected Discord, at least one approved game and an account that isn’t suspended. Flip the Online switch on your dashboard. You stay online on every Duoly page, also in background tabs, so you can browse the site; closing every Duoly tab sets you offline after about 20 seconds. After 4 hours without any activity (clicking, typing, scrolling or moving the mouse on a Duoly page) you’re set offline automatically, never while you play an order or a streaming booking waits for you. 5 minutes before, a “Still there?” notification and a banner on your dashboard warn you; any click keeps you online. Only go online when you’re ready to play right away. An admin can set you offline, but never while you’re playing an order.',
  },
  {
    id: 'no-orders',
    roles: TEAM,
    match:
      /no orders|not getting|dont get|never get|why.*orders|see orders|notification|sound|ring|bell/,
    text: 'You get orders for the games you’re approved for, and Gamer Girl orders only if you’re approved for those. Allow browser notifications: while you’re online they reach you on every Duoly page (the bell sound plays only on your dashboard), once per order, and clicking one opens your dashboard. New orders don’t reach everyone at the same moment: teammates who take what they’re online for, finish orders and get good reviews see them first. Once an order shows up for you, the first to accept gets it. Before accepting you also see the session mood the customer picked, if any (Chill, Tryhard, Teach me or Just for fun).',
  },
  {
    id: 'duo-tiers',
    roles: TEAM,
    match:
      /\bapex\b(?!\s*legends)|duo pro|duo plus|\btiers?\b|top 1|top 5|performance|ranking|plus only|teammate level/,
    text: 'Duo services have three tiers in every game: Duo Plus, Duo Pro and Duo Apex (the top tier, for example FACEIT Duo in Counter-Strike 2). Standard teammates take Plus and Pro right away. A Duo Apex order goes first to teammates ranked TOP 1% or TOP 5% in the performance ranking; after 100 seconds, when it is posted in Discord, every Standard teammate approved for the game can take it. Teammates on the Plus only level take Duo Plus only. Admins set the level. The performance ranking updates every 12 hours from winrate (the biggest factor, counted from 20 games reported in match reports), retention, customer satisfaction and completed orders; your dashboard shows your bracket and what it takes to reach the next one.',
  },
  {
    id: 'games',
    roles: TEAM,
    match: /game|access|approved|add.*game|another game|more games/,
    text: 'Admins approve each game separately based on your rank. Want another game? Ask an admin.',
  },
  {
    id: 'proof',
    roles: TEAM,
    match: /proof|screenshot|mark as done|complete|finish|done/,
    text: 'When the last game is over, upload 1 to 5 screenshots of your match history or end screens with both of you in them, then press “Mark as done”. The customer can then rate you. Fake proof is zero tolerance.',
  },
  {
    id: 'rerolled',
    roles: TEAM,
    match: /re ?roll|swapped|replaced|took.*away/,
    text: 'Customers can re-roll in the first 5 minutes after you’re matched, up to 2 times. The order goes back into the queue and you won’t get it again from the queue. It isn’t a penalty, so just take the next one.',
  },
  {
    id: 'toxic-customer',
    roles: TEAM,
    match: /toxic|rude|creepy|harass|customer.*(bad|mean)|report/,
    text: 'If a customer crosses the line, stay calm, end the session if you need to, and tell an admin with screenshots. You won’t be penalised for protecting yourself.',
  },
  {
    id: 'handover',
    roles: TEAM,
    match: /handover|link|claim/,
    text: 'A handover link from an admin gives you that specific order, even before it shows up in your queue, and even if the customer re-rolled you earlier. It still needs a connected Discord, an account that isn’t suspended and approval for the game. Links stop working when the order is taken, cancelled or its 5 minute window ends.',
  },
  {
    id: 'discord',
    roles: TEAM,
    match: /discord|role|in session/,
    text: 'Connect Discord from your dashboard; it is required to go online, and once connected it can’t be disconnected. Once you connected Discord and joined the Duoly server, the roles Teammate, Online and In Session are synced automatically. If the Teammate role is taken away on Discord, your account is suspended (after any order you’re playing). An order nobody took after 100 seconds is posted in that game’s general channel; Social and Gamer Girl orders are posted in the general chat of the Social / Gamer Girl section instead. The Take this order button there gives you a handover link for that order.',
  },
  {
    id: 'rules',
    roles: TEAM,
    match: /rule|outside|off platform|socials/,
    text: 'The golden rules: online means ready, finish what you start, everything stays on Duoly (no outside payments or socials), never touch a customer’s account, and be the teammate you’d want.',
  },
  {
    id: 'priority',
    roles: TEAM,
    match: /priority|penalty|slower|later than|prio/,
    text: 'How fast you see new orders depends on reliability: taking what you’re online for, finishing orders and great reviews help; letting orders time out while online slows it down for a while. The exact numbers are internal and never shared.',
  },
  {
    id: 'pay',
    roles: TEAM,
    match: /paid|payout|pay day|payday|earn|money|friday|salary|when.*get|tip/,
    text: 'You earn 60% of the order price, fixed in USD when the order is booked, and earnings are recorded for every completed order. Payouts are weekly: each week runs Friday to Friday (Vienna time) and is paid on the Friday it ends. The minimum payout is $25; smaller amounts carry over to the next week. Before your first payout, fill in your payout details (legal name, address, country, date of birth and payout method; a tax number is optional). Tips are 100% yours and are paid out with your week.',
  },
  {
    id: 'trust',
    roles: TEAM,
    match: /deposit|held|hold|trust|tier|level|rookie|veteran|legend|elite/,
    text: 'Trust levels by completed orders: Rookie from 0 (10% deposit), Trusted from 100 (8%, Trusted badge), Veteran from 250 (5%, see high-value orders first), Elite from 500 (3%, priority matching), Legend from 1000 (no deposit, Legend badge). The deposit is held from each order and paid back with your payout 14 days after completion when there is no open report or dispute on that order. Refunded or disputed orders do not count towards your level.',
  },
];

export function knowledgeFor(role: SupportRole): KnowledgeEntry[] {
  return KNOWLEDGE.filter((entry) => entry.roles.includes(role));
}

export function knowledgeMatch(
  role: SupportRole,
  text: string,
): KnowledgeEntry | null {
  const x = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '');
  return knowledgeFor(role).find((entry) => entry.match.test(x)) ?? null;
}
