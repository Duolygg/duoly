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
  related: ['fortnite', 'apex-legends', 'call-of-duty', 'arc-raiders'],
  format: {
    heading: 'What can you book for PUBG on Duoly?',
    text: 'Duoly sells three things for PUBG: Battlegrounds: one teammate who joins your squad on your own account, a Squad Fill for the seats you are missing, and coaching. Everything is booked by the hour, because a match ends whenever you die or win. Duo Plus brings a Diamond+ player who calls the drop, Duo Pro a Master player who reads the zone, and Normal Duos a Master partner for the two-player mode. Ranked follows your own tier, from {{p_duo2_low}} to {{p_duo2_high}} per hour on Duo Pro, while Arcade stays {{p_arcade}} per hour for everybody. Bundles take {{pct3}} off 3 hours up to {{pct10}} off 10.',
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
      'Teammate prices are per hour, and the Ranked tiers read your own tier, so a Master lobby costs more than a Bronze one. Normal Duos and Arcade hold one price for everybody, because neither moves your rank. One teammate joins your squad on your own account, and bundles take {{pct3}} off 3 hours or {{pct5}} off 5. A tier name says who Duoly hires, never who may squad with you: the Ranked squad rules come from Krafton, so the teammate has to be eligible to queue with you under the rules of the game. Check the squad in the client before the first match.',
    team: 'Squad Fill is priced per seat, so the card covers up to {{seats_squad}} seats and falls when your squad is only one player short. It reads your Ranked tier like the duo tiers, and bundles take {{pct3}} off 3 hours.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount, so the {{pct3}} and {{pct5}} savings on teammate sessions do not apply. Recoil and Positioning starts in the Training Mode and ends in live matches, and screen share runs on Discord.',
  },
  steps: {
    heading: 'How does booking a PUBG teammate work?',
    items: [
      'Pick a service and the number of hours. Duo Pro is the Ranked tier with a Master teammate, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five hours take {{pct5}} off.',
      'Add your region, tier, perspective and language at checkout. Name Europe, {{rank_duo2}} and TPP, so your teammate reads the real request before accepting the order.',
      'Meet your teammate in the order chat, add each other in the game and agree the drop before the plane leaves. A single hour of Duo Pro costs {{p_duo2}} at the same tier.',
    ],
    note: 'Duoly reviews every PUBG teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which PUBG session fits you?',
    intro:
      'The right PUBG session is the one that matches your goal for the evening, so pick the goal first and let the price follow. Ranked is priced by your own tier, from {{p_duo2_low}} per hour on Duo Pro, with {{pct3}} off 3 hours and {{pct5}} off 5. Normal Duos and Arcade carry no rank.',
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
        'Every Duoly PUBG teammate applied for the game and showed a Ranked tier before taking orders. Duo Plus names a Diamond+ player and Duo Pro a Master player, and Normal Duos brings a Master partner for the two-player mode. Ranked is played in squads, so a duo teammate takes one seat and the other seats come from your friends or the queue. Tell your teammate whether you play first person or third person in the order chat.',
        'What the tier buys you is zone reads. A Master teammate picks the compound before the circle closes, knows when to rotate early, and calls which squad to fight and which to leave. Voice runs on Discord, so the call lands before the blue zone does. Your tier also sets the price: Duo Pro runs {{p_duo2_low}} per hour at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}, because higher lobbies need stronger teammates. You keep your account and your rank.',
      ],
    },
    {
      heading: 'How does a PUBG Squad Fill work?',
      paragraphs: [
        'A Squad Fill is one order that hires several players at once, so a half-empty squad becomes a full four. The fill covers up to {{seats_squad}} seats with Master players at {{p_squad}} per hour at {{rank_squad}}, and 5 hours cost {{p_squad_x5}} with {{pick5}} off. Every seat is priced separately, so a duo short two players books two seats instead of three.',
        'Agree the plan before the plane: the drop, who carries the smokes and who drives. Then agree one caller, because four people calling rotations on voice is how a top ten turns into a wipe. Keep everybody on one Discord call. Bundles still apply, {{pct3}} off 3 hours and {{pct5}} off 5.',
      ],
    },
    {
      heading: 'Example evening: three hours of Duo Pro in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} player in Europe books 3 hours of Duo Pro with a Master teammate. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one hour. The order chat opens straight after payment, and the first message names the region, the tier and the perspective: Europe, {{rank_duo2}}, third person squads, looking to win more late game fights.',
        'From there the evening runs on a short plan. You agree a drop and a backup, voice goes on, and the invite goes out in the game. After each match you pick one change, such as rotating to the edge of the next circle before the zone moves instead of after. Five hours take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is PUBG coaching the better booking?',
      paragraphs: [
        'PUBG coaching is the better booking when you lose fights you should win. Recoil and Positioning is one hour with a Master coach on spray control, attachments and where to stand in every circle, at {{p_spray}} per hour, drilled in the Training Mode and practiced live. Coaching carries no bundle discount.',
        'A player who loses every long range fight gains more from one coaching hour than from three more hours of Ranked. A player who wants to warm up gains more from Arcade at {{p_arcade}} per hour. Play and Learn is one live hour of Ranked with a Master coach at {{p_learn}}, and screen share runs on Discord.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about PUBG sessions?',
    items: [
      [
        'Is Duoly a free PUBG squad finder?',
        'No. Duoly is a paid marketplace with reviewed players. Discord LFG channels and your friends list stay the free routes to a regular squad.',
      ],
      [
        'How much does a PUBG teammate cost?',
        'Duo Pro is {{p_duo2}} per hour at {{rank_duo2}}, from {{p_duo2_low}} at the lowest tier. Bundles take {{pct3}} off 3 hours, and 10 hours cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Why is PUBG booked by the hour?',
        'Because a match ends whenever your squad is out or wins, so a per match price would not be fair to either side. An hour is the same for everybody.',
      ],
      [
        'Does my teammate play on my account?',
        'No. Your teammate plays on their own account in your squad, and you play on yours. Nobody asks for your login.',
      ],
      [
        'Can I play first person or third person?',
        'Both. Name your perspective in the order chat, and your teammate queues the same one with you.',
      ],
      [
        'Does a teammate booking fill my whole squad?',
        'No. A duo adds one teammate, and the other seats come from your friends or the queue. Book a Squad Fill when you want several at once.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next drop?',
    text: 'Duo Pro is the Ranked tier with a Master teammate from Duoly, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off. Arcade stays {{p_arcade}} per hour for everybody. Agree your drop on Discord before the plane leaves.',
  },
};
