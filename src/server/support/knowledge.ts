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
    text: 'Nothing is charged until a teammate accepts. If nobody accepts within 5 minutes, or you cancel before that, the card hold is released (your bank may take a few days to show it). Once an order is being played, tell us what went wrong (no-show, left mid-game, toxic) and an admin reviews it; refunds after a match go back to your card through Stripe. There is no Duoly wallet.',
  },
  {
    id: 'rate',
    roles: BUYERS,
    match: /rate|rating|review|stars|feedback/,
    text: 'After your order is done you can rate your teammate with 1 to 5 stars, pick a few tags and write a short review in your order room. You can rate each order once. Tips are not available yet.',
  },
  {
    id: 'apply',
    roles: ALL,
    match: /become|apply|work for|join (the )?team|be a teammate|hiring/,
    text: 'Apply on the “Become a teammate” page (/apply) with your rank and games. Admins review every application and reach out on Discord.',
  },
  {
    id: 'chat-rules',
    roles: ALL,
    match:
      /chat|message|paypal|venmo|whatsapp|telegram|snapchat|password|login details|outside/,
    text: 'Order chat keeps payments and accounts on Duoly: messages that ask for logins or move payments or contact off Duoly are blocked. Never share your login with anyone. Chat messages are up to 500 characters.',
  },
  // ---- teammates
  {
    id: 'online',
    roles: TEAM,
    match: /online|offline|toggle|cant go|cannot go|wont go|switch on/,
    text: 'To go online you need a connected Discord, at least one approved game and an account that isn’t suspended. Flip the Online switch on your dashboard and keep the tab open: if the dashboard closes, you go offline after about 20 seconds. Only go online when you’re ready to play right away. An admin can set you offline, but never while you’re playing an order.',
  },
  {
    id: 'no-orders',
    roles: TEAM,
    match:
      /no orders|not getting|dont get|never get|why.*orders|see orders|notification|sound|ring|bell/,
    text: 'You get orders for the games you’re approved for, and Gamer Girl orders only if you’re approved for those. Allow browser notifications so the bell and popup reach you while you’re online. New orders don’t reach everyone at the same moment: teammates who take what they’re online for, finish orders and get good reviews see them first. Once an order shows up for you, the first to accept gets it.',
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
    text: 'Connect Discord from your dashboard; it is required to go online. The Duoly server roles (Teammate, Online, In Session) and order posts in the game channels are coming soon.',
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
    text: 'Your earnings are recorded in USD for every completed order and shown on your dashboard. The plan is weekly payouts every Friday, but the payout schedule is not live yet, so an admin handles payouts for now. Tips are not available yet; when they are, they will be 100% yours.',
  },
  {
    id: 'trust',
    roles: TEAM,
    match: /deposit|held|hold|trust|tier|level|rookie|veteran|legend|elite/,
    text: 'Trust levels by completed orders: Rookie from 0 (10% deposit), Trusted from 100 (8%), Veteran from 250 (5%), Elite from 500 (3%), Legend from 1000 (no deposit). The deposit is held from each order and paid back after 14 days without a dispute. Deposit holding starts together with the payout schedule, which is not live yet.',
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
