import type { HubPageCopy } from '../hub-pages';

export const pubg: HubPageCopy = {
  gameSlug: 'pubg',
  title: 'PUBG Teammates: Ranked Squads and Coaching | Duoly',
  description:
    'Book a PUBG: Battlegrounds teammate for Ranked, a squad fill or recoil coaching on Duoly, {{from_lower}}. Compare Ranked and Duos prices.',
  eyebrow: 'PUBG teammates',
  h1: 'PUBG teammates for Ranked, Duos and squads',
  lead: 'Discord LFG channels work for finding a regular squad. Duoly books a reviewed Diamond or Master player for your next hour of Ranked, fills your squad and sells recoil and positioning coaching.',
  cta: 'Book a PUBG teammate',
  facts: [
    'Diamond+ and Master teammates',
    'Ranked, Normal Duos and Arcade',
    'Voice on Discord, your own account',
  ],
  related: [
    'apex-legends',
    'fortnite',
    'rocket-league',
    'call-of-duty',
    'valorant',
  ],
  format: {
    heading: 'What can you book for PUBG on Duoly?',
    text: 'Duoly sells three things for PUBG: Battlegrounds: one teammate who joins your squad on your own account, a Squad Fill for the seats you are missing, and coaching. Everything is booked by the hour, because a match ends whenever you die or win. Duo Plus brings a Diamond+ player who calls the drop, Duo Pro a Master player who reads the zone, and Normal Duos a Master partner for the two-player mode. Ranked follows your own tier, from {{p_duo2_low}} to {{p_duo2_high}} per hour on Duo Pro, while Normal Duos stays {{p_duos}} and Arcade {{p_arcade}} per hour for everybody. The fill: Squad Fill covers up to {{seats_squad}} seats from {{p_squad_low}} per hour. Recoil and Positioning is one hour on spray control at {{p_spray}}. Bundles of {{main}} take {{bundles}}. Name your perspective using Discord first.',
  },
  services: {
    duo1: 'An hour of Ranked with a Diamond player who calls drops and rotations.',
    duo2: 'An hour of Ranked with a Master player who reads the zone and picks fights.',
    duos: 'Normal Duos with a Master partner, just the two of you.',
    arcade:
      'Team Deathmatch, Intense Battle Royale and Arcade modes to warm up your spray.',
    gg1v1:
      'A custom match 1v1 against a verified Gamer Girl, rematches encouraged.',
    ggbuddy:
      'A patient Gamer Girl plays with you and explains the basics as you go.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and cheers every chicken dinner.',
    squad:
      'Fill your squad with Master players who call rotations and trade properly.',
    learn:
      'One live hour of Ranked with a Master coach explaining every decision.',
    spray:
      'One hour on spray control, attachments and where to stand in every circle.',
  },
  intros: {
    teammate:
      'Teammate prices are per hour, and the Ranked tiers read your own tier, so a Master lobby costs more than a Bronze one. Normal Duos, Arcade and TDM, plus the Gamer Girl sessions, hold one price for everybody, because none of them move your rank. One teammate joins your squad on your own account. Only {{main}} is sold in bundles, {{bundles}}, and every other service books {{picker}}. Pick the mode, because only the Ranked cards carry a tier list. Read the tier beside the price: Duo Plus is a Diamond+ player, Duo Pro a Master player and Normal Duos a Master partner at {{p_duos}} per hour. Name TPP or FPP and the drop you like in the order chat using Discord.',
    team: 'Squad Fill is priced per seat, so the card covers up to {{seats_squad}} seats from {{p_squad_low}} per hour and falls when your squad is only one player short. Count the seats you actually need, because a duo short two players books 2 rather than 3. Agree the jobs, because a four wants somebody on smokes, somebody driving and one caller rather than four lone wolves. The fill reads your Ranked tier like the duo tiers do, from {{p_squad_low}} per hour, and 5 hours take {{pick5}} off. For example, a solo player books 3 seats and keeps the drop call using Discord.',
    coaching:
      'Lessons are priced by the hour and get no quantity or bundle discount, so the {{pct3}} to {{pct10}} bundle savings on teammate sessions do not apply. Recoil and Positioning costs {{p_spray}} per hour with a Master coach, starts in the Training Mode and ends in live matches. Play and Learn is the live option at {{p_learn}}, where a Master coach talks through one real Ranked hour. Pick the problem rather than the format. For example, a player who loses every long range fight books Recoil and Positioning instead of a fourth Ranked hour. Screen share runs using Discord, the coach never logs into your account, and no lesson from Duoly promises a tier.',
  },
  steps: {
    heading: 'How does booking a PUBG teammate work?',
    items: [
      'Pick a service and the number of hours. Duo Pro is the Ranked tier with a Master teammate, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five hours take {{pct5}} off.',
      'Add your region, tier, perspective and language at checkout. Name Europe, {{rank_duo2}} and TPP, so your teammate reads the real request before accepting the order.',
      'Meet your teammate in the order chat using Discord. Add each other in the game and agree the drop before the plane leaves. A single hour of Duo Pro costs {{p_duo2}} at the same tier, and Arcade stays {{p_arcade}}.',
    ],
    note: 'Duoly reviews every PUBG teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which PUBG session fits you?',
    intro:
      'The right PUBG session is the one matching your goal for the evening, so pick the goal first and let the price follow. Normal Duos and Arcade hold one price for everybody, {{p_duos}} and {{p_arcade}} per hour, because neither moves your rank. Ranked is priced by your own tier instead, from {{p_duo2_low}} per hour on Duo Pro, and a Squad Fill is priced per seat. A {{main}} bundle takes {{bundles}}, so a bundle beats booking 1 at a time. Voice runs using Discord.',
    picks: [
      {
        goal: 'Climbing Ranked this season?',
        service: 'duo2',
        answer:
          'Duo Pro adds a Master teammate from {{p_duo2_low}} per hour, priced by your own tier.',
      },
      {
        goal: 'Want just the two of you?',
        service: 'duos',
        answer:
          'Normal Duos costs {{p_duos}} per hour with a Master partner and no rank on the line.',
      },
      {
        goal: 'Need a full squad tonight?',
        service: 'squad',
        answer:
          'Squad Fill covers up to {{seats_squad}} seats with Master players who call rotations.',
      },
      {
        goal: 'Only want to warm up?',
        service: 'arcade',
        answer:
          'Arcade and TDM costs {{p_arcade}} per hour: fast fights and no waiting.',
      },
      {
        goal: 'Losing every long range fight?',
        service: 'spray',
        answer:
          'Recoil and Positioning is one hour with a Master coach, at {{p_spray}}.',
      },
    ],
  },
  sections: [
    {
      heading: 'Who is the teammate you drop with?',
      paragraphs: [
        'The teammate you drop with is a reviewed PUBG player who applied for the game and showed a Ranked tier before taking orders. The tiers: Duo Plus names a Diamond+ player, Duo Pro a Master player from {{p_duo2_low}} per hour and Normal Duos a Master partner for the two-player mode. Orders are not auto-assigned, because a teammate picks yours up from the queue, so the person who accepts chose your request. For example, say whether you play FPP or TPP in the order chat using Discord.',
        'What the tier buys you is zone reads. A Master teammate picks the compound before the circle closes, knows when to rotate early, and calls which squad to fight and which to leave. Voice runs using Discord, so the call lands before the blue zone does. Your tier also sets the price: Duo Pro runs {{p_duo2_low}} per hour at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}, because higher lobbies need stronger teammates. Bundles of {{main}} cut that total: {{bundles}}. You keep your account, your loadout and your tier across all 3 hours.',
      ],
    },
    {
      heading: 'How does a PUBG Squad Fill work?',
      paragraphs: [
        'A Squad Fill is one order that hires several players at once, so a half-empty squad becomes a full four. The fill covers up to {{seats_squad}} seats with Master players at {{p_squad}} per hour at {{rank_squad}}, and 5 hours cost {{p_squad_x5}} with {{pick5}} off. Every seat is priced separately, so a duo short two players books 2 seats instead of 3. For example, a trio who always run out of smokes book 1 seat and name the job.',
        'Agree the plan before the plane: the drop, who carries the smokes and who drives. Then agree one caller, because four people calling rotations on voice is how a top ten turns into a wipe. Keep everybody on one call using Discord, and nobody ever needs your login. Bundles of {{main}} still apply, {{bundles}}, read from Duoly checkout in 2026.',
      ],
    },
    {
      heading: 'Example evening: three hours of Duo Pro in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} player in Europe books 3 hours of Duo Pro with a Master teammate. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one hour. The order chat opens straight after payment, and the first message names the region, the tier and the perspective: Europe, {{rank_duo2}}, third person squads, looking to win more late game fights.',
        'From there the evening runs on a short plan. You agree a drop and a backup, voice goes on, and the invite goes out in the game. After each match you pick one change, for example rotating to the edge of the next circle before the zone moves instead of after, agreed using Discord. Five hours take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is PUBG coaching the better booking?',
      paragraphs: [
        'PUBG coaching is the better booking when you lose fights you should win. Recoil and Positioning is one hour with a Master coach on spray control, attachments and where to stand in every circle, at {{p_spray}} per hour, drilled in the Training Mode and practised live. Play and Learn is one live hour of Ranked with a Master coach at {{p_learn}}. Coaching carries no quantity or bundle discount, so the {{pct3}} to {{pct10}} bundle savings apply to teammate hours only.',
        'For example, a player who loses every long range fight gains more from one coaching hour at {{p_spray}} than from three more hours of Ranked. A player who only wants to warm up gains more from Arcade and TDM at {{p_arcade}} per hour, where respawns keep the fights coming. Screen share runs using Discord, and the coach never logs into your account. Duoly reviews every PUBG coach before any order goes live. The nearest neighbours here are [Apex Legends teammates](/games/apex-legends) and [Fortnite teammates](/games/fortnite), both battle royales priced by the hour.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about PUBG sessions?',
    items: [
      [
        'Is Duoly a free PUBG squad finder?',
        'No: Duoly is a paid marketplace with reviewed players, so Discord LFG channels and your friends list stay the free routes to a regular squad.',
      ],
      [
        'How much does a PUBG teammate cost?',
        'Duo Pro is {{p_duo2}} per hour at {{rank_duo2}}, from {{p_duo2_low}} at the lowest tier. Bundles of {{main}} take {{bundles}}, so 10 hours cost {{p_duo2_x10}}.',
      ],
      [
        'Why is PUBG booked by the hour?',
        'A PUBG match ends whenever your squad is out or wins, so a per match price would suit neither side, and an hour prices the real session the same for everybody.',
      ],
      [
        'Does my teammate play on my account?',
        'No: your teammate plays on their own account in your squad while you play on yours, and nobody from Duoly ever asks for your login.',
      ],
      [
        'Can I play first person or third person?',
        'Both work: name FPP or TPP in the order chat using Discord, and your teammate queues the same perspective with you for the whole booking.',
      ],
      [
        'Does a teammate booking fill my whole squad?',
        'No: a duo adds one teammate and the other seats come from your friends or the queue, so book a Squad Fill at {{p_squad}} per hour when you want several at once.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next drop?',
    text: 'Duo Pro is the Ranked tier with a Master teammate from Duoly, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off. Five hours take {{pct5}} off and 10 hours take {{pct10}} off. Arcade stays {{p_arcade}} per hour for everybody, and Normal Duos costs {{p_duos}}. Squad Fill hires Master players for up to {{seats_squad}} seats from {{p_squad_low}} per hour when you want the whole squad in 2026. Pick your tier and perspective, then agree the drop in the order chat using Discord.',
  },
};
