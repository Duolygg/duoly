import { SITE, LEGAL_UPDATED } from './site';

// The text of the Terms and Privacy pages (components/LegalPage.jsx renders it).
// Everything here describes how Duoly really works: upfront payment, the 5-minute auto-cancel, the Duoly
// balance (lib/orders.js), rank prices (lib/ranks.js), the Discord bot and queue posts, the cookies we set.
// Change the behaviour → change the text here too, and bump LEGAL_UPDATED in lib/site.js.
//
// Blocks: 'text' (a paragraph, **bold** works) · { list: [...] } · { note: 'text' } (highlighted) ·
//         { cards: [[title, text], ...] } (small grid) · { table: [[head...], [row...], ...] }
// Not legal advice: have a lawyer look at both before launch.

const who = SITE.company || SITE.name;
// how to reach us about something, without making up a mailbox: email if set, otherwise the contact form
const reach = (mail, topic) => (mail ? 'email **' + mail + '** or use the [contact form](/contact?topic=' + topic + ')' : 'use the [contact form](/contact?topic=' + topic + ') (pick “' + (topic === 'privacy' ? 'Privacy & data' : 'Something else') + '”)');
const privacyMail = SITE.privacyEmail || SITE.supportEmail;

export const TERMS = {
  slug: 'terms', kicker: 'Legal', title: 'Terms of Service', updated: LEGAL_UPDATED,
  intro: 'The rules for using Duoly, in plain language. By creating an account or booking a session you agree to them, so they’re worth two minutes of your time.',
  summary: [
    ['card', 'Pay once, upfront', 'You pay the full price for every game or hour in your order when you queue. Nothing is charged after each game.'],
    ['undo', 'Free cancel until accepted', 'Nobody accepts within 5 minutes? The order cancels itself and the full amount goes back to your Duoly balance.'],
    ['shield', 'Your account stays yours', 'Teammates play with you on their own accounts. Nobody ever asks for your password.'],
    ['heart', 'Respect, always', 'No harassment, no cheating, no toxicity, on both sides. Breaking that can end your account.']
  ],
  sections: [
    { id: 'about', title: 'What Duoly is', blocks: [
      'Duoly (“we”, “us”) runs duoly.gg, a platform where players (“customers”) book sessions with vetted, rank-verified players (“teammates”): ranked duos, team fills, social games, Gamer Girl sessions and coaching, across the games listed on the site.',
      'Every session is played **together**: the teammate joins your lobby and plays alongside you, on their own account. Duoly is not an account-sharing or “boosting” service, and we never play on your account.',
      'Duoly is not affiliated with, endorsed or sponsored by Riot Games, Valve, Epic Games, Activision, Electronic Arts, Ubisoft, Blizzard, NetEase, Psyonix, Mojang, Embark Studios, The Pokémon Company or any other game publisher. All game names and logos belong to their owners.'
    ] },
    { id: 'accounts', title: 'Your account', blocks: [
      'You need a free account to book. You can sign up with email and password, Google or Discord.',
      { list: [
        'You must be at least **18 years old** to book or to work as a teammate.',
        'Give us correct details and keep your login safe. You’re responsible for what happens on your account.',
        'One account per person. Don’t sell, share or transfer it.',
        'You can delete your account at any time through support. Open orders and your Duoly balance are settled first (see “Your Duoly balance”).'
      ] }
    ] },
    { id: 'booking', title: 'Booking a session', blocks: [
      'Pick a game, a service and how many games or hours you want, then queue. Before you pay you see exactly what you get, from which rank, and the total.',
      { list: [
        '**Your rank sets the price for ranked play.** Lower ranks pay less, higher ranks pay more. Pick the rank you really have: a wrong rank can make a session impossible to play, and isn’t a reason for a refund.',
        '**Matching:** your order goes live to rank-verified teammates for that game. The first one who accepts plays with you. Most orders are taken within a couple of minutes, but we can’t promise a teammate will always be free.',
        '**In-game name and server:** add the right in-game name and server so your teammate can invite you. A note for your teammate is optional.',
        '**Voice:** if you choose voice, your teammate joins you on Discord. Otherwise you use the order chat.'
      ] }
    ] },
    { id: 'payment', title: 'Prices & payment', blocks: [
      'Prices are shown in euros. If you pick US dollars, we convert the euro price at the day’s European Central Bank rate plus a small currency margin (1%), rounded up to .99. The price you see at checkout is the price you pay.',
      { note: '**One payment, upfront.** You pay the full price for every game or hour in your order once, when you queue. There is no charge after each game, no subscription and nothing hidden.' },
      { list: [
        'Bundles (3, 5 or 10 games or hours) are discounted and shown as one price.',
        'Payments are processed by our payment provider. We never see or store your full card details.',
        'You can pay part or all of an order with your Duoly balance (see below).',
        'Prices can change over time, but never for an order you already placed.'
      ] }
    ] },
    { id: 'cancel', title: 'Cancellations & refunds', blocks: [
      { cards: [
        ['Before a teammate accepts', 'Cancel any time in your order room, free of charge. The full amount goes back to your Duoly balance.'],
        ['Nobody accepts within 5 minutes', 'The order cancels itself automatically and the full amount goes back to your Duoly balance. You don’t need to do anything.'],
        ['Something went wrong during the session', 'No-show, a teammate leaving, toxic behaviour: report it from your order room. A real person reviews it and can refund the order to your balance.']
      ] },
      'Refunds go to your Duoly balance by default, so you can rebook right away. If you’d rather have the money back on your original payment method, contact support and we’ll do it wherever the law gives you that right.',
      '**Right of withdrawal (EU/EEA consumers):** when you queue, you ask us to start the service right away. Your 14-day right of withdrawal ends once the session has been fully played. Until a teammate accepts you can cancel for free anyway.'
    ] },
    { id: 'balance', title: 'Your Duoly balance', blocks: [
      'Refunds, cashback and level-up gifts are added to your Duoly balance. You can switch it on at checkout to pay part or all of an order, for any game.',
      { list: [
        'Your balance doesn’t expire.',
        'Cashback and gifts are promotional: they can only be spent on Duoly and can’t be paid out as cash.',
        'Money refunded to your balance can be paid back to your original payment method on request.',
        'If we find abuse (for example fake orders to collect cashback), we can remove the balance it earned.'
      ] }
    ] },
    { id: 'conduct', title: 'How we play together', blocks: [
      'Duoly only works if sessions are fun and safe for everyone. Customers and teammates both agree to:',
      { list: [
        'treat each other with respect: no harassment, hate speech, threats, discrimination or sexual content;',
        'never ask for, give or use someone else’s login. Nobody at Duoly will ever ask for your password;',
        'not cheat, script, exploit or use third-party tools the game doesn’t allow;',
        'not arrange payment outside Duoly or move a session off the platform to avoid fees;',
        'follow the terms and rules of the game you’re playing.'
      ] },
      '**Gamer Girl and Social sessions** (just chat, watch together, sleep call, karaoke) are about good company and conversation. They are never dating, romantic or sexual services, and requests like that end the session and can end your account.',
      'Breaking these rules can lead to a warning, a cancelled order without refund, or a blocked account, depending on how serious it is.'
    ] },
    { id: 'games', title: 'Games & publisher rules', blocks: [
      'Playing together in a party is allowed in every game we offer. You stay responsible for following the rules of the game you play. Duoly isn’t liable for actions a publisher takes against an account because of how that account was used.',
      'Some modes (for example League of Legends Arena) are only available while the publisher runs them. If a mode disappears, open orders for it are cancelled and refunded to your balance.'
    ] },
    { id: 'reviews', title: 'Reviews, reports & proof', blocks: [
      'After a session you can rate your teammate. Keep reviews honest and about the session.',
      'Teammates upload proof of the games they played (such as a match-history screenshot). Reports and their evidence are only seen by the people involved and the Duoly team.',
      'Anything you post on Duoly must be yours to share, and you give us permission to use it to run the service (for example to show a review on a teammate’s profile).'
    ] },
    { id: 'teammates', title: 'For teammates', blocks: [
      'Teammates apply, are rank-verified and follow the [Teammate Code](/rules) in addition to these terms. Teammates are independent players, not employees of Duoly, and are responsible for their own taxes.',
      { list: [
        'Teammates earn **60%** of each order’s price. Duoly keeps 40% for payments, matching, support and the platform.',
        'Earnings are paid weekly (Friday to Friday). We can hold a payout while a report about that order is reviewed.',
        'Teammates must connect Discord and keep their verified rank honest.'
      ] }
    ] },
    { id: 'liability', title: 'Liability', blocks: [
      'We do our best to keep Duoly running and to match you quickly, but we can’t guarantee the site is always available, that a teammate is always free, or a particular result (like winning a game or reaching a rank).',
      'We are liable without limitation for intent and gross negligence and for injury to life, body or health. For slight negligence we are only liable for breaches of essential obligations, limited to the damage that is typical and foreseeable. Nothing here limits your rights as a consumer under the law.'
    ] },
    { id: 'changes', title: 'Changes, termination & law', blocks: [
      'We may update these terms, for example when we add features. We’ll show the new date at the top and tell you about important changes before they apply. Orders you already placed keep the terms they were placed under.',
      'You can stop using Duoly at any time. We can suspend or close an account that breaks these terms; any balance from refunds is paid back to you.',
      'These terms are governed by Austrian law. If you’re a consumer, you keep the protection of the mandatory laws of your country, and you can bring a claim in your home courts. EU consumers can also use the EU’s online dispute resolution platform at ec.europa.eu/consumers/odr.'
    ] },
    { id: 'contact', title: 'Contact', blocks: [
      'Questions about these terms? Chat with us any time from the bubble in the corner, or ' + reach(SITE.supportEmail, 'other') + '.'
    ] }
  ]
};

export const PRIVACY = {
  slug: 'privacy', kicker: 'Legal', title: 'Privacy Policy', updated: LEGAL_UPDATED,
  intro: 'What we collect, why we need it and what you can do about it. Short version: we use your data to run your sessions, optional analytics and ad measurement need your consent, and we never sell your data.',
  summary: [
    ['eye', 'Your choice for analytics and ads', 'Privacy-friendly analytics and server-side ad measurement only with your OK. No ad pixels on the site. We never sell your data.'],
    ['lock', 'Never sold', 'We don’t sell or rent your data, and we only share it where it’s needed to run your session.'],
    ['card', 'No card details', 'Your payment details go straight to the payment provider. We only see the amount and the method. If you tick “save” at checkout, the provider keeps your card for Play again; we only see its brand and last 4 digits.'],
    ['user', 'You’re in control', 'See, correct, download or delete your data whenever you want.']
  ],
  sections: [
    { id: 'controller', title: 'Who is responsible', blocks: [
      who + (SITE.address ? ', ' + SITE.address : ', ' + SITE.city) + ' is responsible (“controller”) for the personal data processed on duoly.gg. For anything about your data, ' + reach(privacyMail, 'privacy') + '.'
    ] },
    { id: 'collect', title: 'What we collect', blocks: [
      { table: [
        ['Data', 'What exactly', 'Why'],
        ['Account', 'Name, email, password (stored only as a secure hash), profile picture, country, languages, short bio, preferred currency', 'To give you an account and show your profile to your teammate'],
        ['Sign-in with Google or Discord', 'Name, email, profile picture and, for Discord, your Discord ID and username', 'To log you in, and for teammates to give them their Discord roles'],
        ['Orders', 'Game, service, rank, server, in-game name, number of games, your note, price, payment method, order times', 'To match you, run the session and keep your order history'],
        ['Session content', 'Order chat messages, proof screenshots, reviews, reports and the evidence you attach', 'To run the session, keep it safe and handle disputes'],
        ['Support', 'Support chat messages and contact form messages, with your name and email if you give them', 'To answer you'],
        ['Duoly balance', 'Refunds, cashback, gifts and what you spent from it', 'To keep your balance correct'],
        ['Teammate applications', 'Name, email, Discord, country, age confirmation, game, rank, links, availability, motivation', 'To review applications'],
        ['Teammates', 'Online status, games switched on, accepted and missed orders, earnings and payouts', 'To route orders fairly and pay teammates']
      ] },
      'We don’t ask for sensitive data and we never ask for your game account password.'
    ] },
    { id: 'legal-bases', title: 'Why we’re allowed to', blocks: [
      { list: [
        '**Contract** (Art. 6(1)(b) GDPR): your account, orders, payments, balance, the session chat and support.',
        '**Legitimate interests** (Art. 6(1)(f) GDPR): keeping Duoly safe (reports, fraud and abuse checks, blocking accounts), fair order routing for teammates, and improving the service.',
        '**Legal obligation** (Art. 6(1)(c) GDPR): keeping invoices and payment records for as long as tax law requires.',
        '**Consent** (Art. 6(1)(a) GDPR): optional things like browser notifications for admins. You can withdraw consent at any time.'
      ] }
    ] },
    { id: 'sharing', title: 'Who sees your data', blocks: [
      { list: [
        '**Your teammate** sees what they need for the session: your first name, profile picture, rank, server, in-game name, your note and the order chat. They don’t see your email or what you paid.',
        '**Duoly’s teammate Discord:** if an order waits a while, our bot posts it in the teammate server so someone grabs it. That post shows the service, rank, server, your note and the teammate’s pay. It never shows your name or email.',
        '**The Duoly team** (admins) can see orders, chats, reports and support messages to help you and keep the platform safe.',
        '**Service providers** who process data for us under contract: our hosting provider, our payment provider, Google and Discord (only if you sign in with them), and Discord for the teammate bot.',
        '**Authorities**, only where the law requires it.'
      ] },
      'Some of these providers can be outside the EU/EEA. In that case we rely on an adequacy decision (such as the EU–US Data Privacy Framework) or the EU’s Standard Contractual Clauses.'
    ] },
    { id: 'cookies', title: 'Cookies and local storage', blocks: [
      'Necessary cookies keep the site working. You can allow Analytics, Marketing and Creator link separately, or accept or refuse all optional purposes in one click. The creator cookie remembers whose link you used for 30 days so they get credit for your first order. Change your choices any time through [Cookie settings](#cookie-settings). Analytics and ad measurement are planned and are not active yet.',
      { table: [
        ['Name', 'Type', 'What it does', 'How long'],
        ['__Host-duoly-session (including numbered chunks and sign-in -code-verifier cookies), duoly-session on local HTTP', 'Cookie', 'Keeps you signed in and completes secure sign-in', 'Up to 400 days; sign-in cookies are cleared after use'],
        ['__Host-duoly-csrf, duoly-csrf on local HTTP', 'Cookie', 'Protects forms', '1 hour'],
        ['__Host-duoly-pending-email, duoly-pending-email on local HTTP', 'Cookie', 'Remembers the email while you confirm registration', '5 minutes'],
        ['dl_support', 'Cookie', 'Remembers your support chat if you’re not signed in', '1 year'],
        ['duoly-currency', 'Cookie', 'Remembers EUR or USD', '1 year'],
        ['ph_<project>_posthog (optional)', 'Cookie and local storage', 'Analytics, only with your consent', '1 year'],
        ['duoly-consent', 'Cookie', 'Remembers your Analytics, Marketing and Creator link choices (v2)', '1 year'],
        ['__Host-duoly-ref, duoly-ref on local HTTP (optional)', 'Cookie', 'Remembers the creator whose link you used, only with your consent', '30 days'],
        ['duoly-currency, duoly-ign-*', 'Local storage', 'Remembers your currency and in-game name on this device', 'Until you clear it'],
        ['Pending order', 'Session storage', 'Keeps your pick while you sign in', 'Until you close the tab']
      ] },
      'Fonts are loaded from Google Fonts, which means your browser connects to Google’s servers and shares your IP address with them. Exchange rates come from a public European Central Bank feed; no personal data is sent there.'
    ] },
    { id: 'analytics', title: 'Analytics', blocks: [
      'Analytics is planned and is not active yet. The following describes how it will work once enabled.',
      'With your permission, we use **PostHog (PostHog Inc.)**, with data stored in **PostHog EU Cloud, Frankfurt**, to improve the site and fix errors.',
      'We collect pages visited, clicks, booking and checkout steps, device and browser type and approximate country. Session recordings show the site with everything you type and chat text hidden. We never send your name, email, Discord name, in-game name or messages to PostHog. When you are signed in, we link events to your account ID only.',
      'The legal basis is **your consent (Art. 6(1)(a) GDPR)**. Withdraw any time through [Cookie settings](#cookie-settings). If you decline, we only count visits anonymously without cookies, using a daily changing hash that cannot identify you. This anonymous counting is also planned and is not active yet.',
      'Analytics events are kept for up to **1 year** and recordings for up to **30 days**. We also record payments, orders and reviews on our servers to measure how the service works: amounts, game and service, with no personal details in these measurements.'
    ] },
    { id: 'marketing', title: 'Marketing', blocks: [
      'Server-side ad measurement is planned for our ads and is not active yet. If you allow Marketing, when you arrive from an ad we keep the ad click ID. After you book, our servers send **Meta Platforms Ireland** and **Google Ireland** the purchase value, time and that click ID so they can count the conversion and help us measure and improve our ads. For Meta we also send a hashed email only with this consent. No ad pixels run on the site.',
      'The legal basis is **your consent (Art. 6(1)(a) GDPR)**. Withdraw any time through [Cookie settings](#cookie-settings). Without this consent, nothing goes to ad platforms.'
    ] },
    { id: 'retention', title: 'How long we keep it', blocks: [
      { list: [
        'Account data: as long as you have an account. After you delete it we remove or anonymise it within 30 days.',
        'Orders and payment records: 7 years, because Austrian tax law requires it.',
        'Session chats, proof and reports: up to 2 years after the order, so we can handle disputes and abuse.',
        'Support chats and contact messages: up to 2 years after the last message.',
        'Applications that weren’t accepted: 6 months.'
      ] }
    ] },
    { id: 'rights', title: 'Your rights', blocks: [
      'Under the GDPR you have the right to:',
      { cards: [
        ['Access', 'Get a copy of the data we have about you.'],
        ['Correction', 'Fix anything that’s wrong. Most of it you can change on your profile.'],
        ['Deletion', 'Have your account and data deleted (unless we must keep something by law).'],
        ['Portability', 'Get your data in a common, machine-readable format.'],
        ['Restriction & objection', 'Limit or object to processing based on legitimate interests.'],
        ['Withdraw consent', 'At any time, for anything based on consent.']
      ] },
      'To use any of these, ' + reach(privacyMail, 'privacy') + '. We reply within one month. You can also complain to a data protection authority; in Austria that’s the Datenschutzbehörde (dsb.gv.at).'
    ] },
    { id: 'security', title: 'Security', blocks: [
      'Passwords are stored only as salted hashes, the site runs over HTTPS, and only the Duoly team can access the admin tools, with every admin action logged. No system is perfect, but if something ever goes wrong we’ll tell you and the authorities as the law requires.'
    ] },
    { id: 'kids', title: 'Age', blocks: [
      'Duoly is for people aged 18 and over. We don’t knowingly collect data from anyone younger. If you think someone under 18 has an account, let us know and we’ll delete it.'
    ] },
    { id: 'changes', title: 'Changes', blocks: [
      'When we change this policy we update the date at the top, and we tell you about important changes before they apply.'
    ] }
  ]
};
