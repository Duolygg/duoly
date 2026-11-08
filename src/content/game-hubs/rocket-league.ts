import type { HubPageCopy } from '../hub-pages';

export const rocketLeague: HubPageCopy = {
  gameSlug: 'rocket-league',
  title: 'Rocket League LFG: Find a Doubles Partner | Duoly',
  description:
    'Book a Rocket League Doubles partner, a 3v3 fill or mechanics coaching on Duoly, {{from_lower}}. Compare Doubles and Standard prices.',
  eyebrow: 'Rocket League teammates',
  h1: 'Rocket League LFG: find a Doubles partner',
  lead: 'Free LFG Discords work for a casual night. Duoly books a reviewed Champion, Grand Champion or Supersonic Legend partner by the hour, fills 3v3 Standard and sells mechanics training.',
  cta: 'Book a Rocket League partner',
  facts: [
    'Champion+ to Supersonic Legend',
    'Ranked Doubles, Standard and extra modes',
    'Priced per hour, your own account',
  ],
  related: ['fortnite', 'minecraft', 'ea-sports-fc-27'],
  format: {
    heading: 'What can you book for Rocket League on Duoly?',
    text: 'A Duoly Rocket League booking is a paid hour where reviewed higher-rank players queue with you on your own account. Doubles sells by the hour, because one match lasts about five minutes and an hour covers a real session. Duo Plus brings a Champion+ partner, Duo Pro a Grand Champion and Duo Apex a Supersonic Legend. Prices follow your own rank, so a {{rank_duo2}} player pays {{p_duo2}} per hour for Duo Pro in November 2026. For example, Casual 3v3 and Extra Modes each cost {{p_casual}} per hour at every rank. Bundles cut the total: 3 hours get {{pct3}} off, 5 get {{pct5}} off and 10 get {{pct10}} off. The 3v3 Standard fill is priced per match instead, and the ranked rules from Psyonix still apply. Finally, every booking opens an order chat, where you agree rotations and voice using Discord.',
  },
  services: {
    duo1: 'An hour of Ranked Doubles with a Champion partner who rotates instead of chasing.',
    duo2: 'An hour of Ranked Doubles with a Grand Champion who sets you up and covers back post.',
    duo3: 'An hour of high-rank Doubles with a Supersonic Legend who wins kickoffs outright.',
    casual:
      'An hour of relaxed casual matches with someone who actually passes.',
    extra:
      'An hour of Rumble, Hoops, Snow Day, Dropshot and Heatseeker. Pure fun.',
    gg1v1:
      'A 1v1 Duels series against a verified Gamer Girl, rematches encouraged.',
    ggbuddy:
      'A patient Gamer Girl plays casual or extra modes and explains the basics as you go.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and keeps the mood up after a loss.',
    three:
      'Ranked Standard with your friend and one or two Grand Champions filling the team.',
    learn:
      'One live hour of Doubles with a Grand Champion coach explaining every decision.',
    mech: 'One hour of aerials, flicks and recoveries, with training packs to keep practicing.',
  },
  intros: {
    teammate:
      'One partner joins your games on your own account, from Ranked Doubles to casual and extra modes.',
    team: 'The Standard fill adds Grand Champion players to your 3v3 team, priced per match.',
    coaching:
      'Both lessons run for one hour, one live in Doubles and one on mechanics.',
  },
  steps: {
    heading: 'How does booking a Rocket League partner work?',
    items: [
      'First, pick a service and the number of hours. Duo Pro is the Ranked Doubles option with a Grand Champion, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five hours get {{pct5}} off.',
      'Second, add your region, rank, platform and language at checkout. For example, name Europe, {{rank_duo2}} and controller, so your partner reads the real request from Duoly before accepting the order.',
      'Third, meet your partner in the order chat, agree rotations and voice using Discord, then add each other with your Epic name. A single Duo Pro hour costs {{p_duo2}} at the same rank in 2026. Ten hours get {{pct10}} off.',
    ],
    note: 'Duoly reviews every Rocket League partner before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Rocket League session fits you?',
    intro:
      'The right Rocket League session is the one matching your goal for the hour, so pick the goal first and let the price follow. For example, a {{rank_duo2}} player climbing Doubles pays {{p_duo2}} per hour for Duo Pro in 2026, with {{pct3}} off 3 hours and {{pct5}} off 5. Voice runs using Discord in every session booked from Duoly.',
    picks: [
      {
        goal: 'Climbing Ranked Doubles?',
        service: 'duo2',
        answer:
          'Duo Pro adds a Grand Champion from {{p_duo2_low}} per hour, priced by your own rank and covering back post.',
      },
      {
        goal: 'Facing Supersonic Legend lobbies?',
        service: 'duo3',
        answer:
          'Duo Apex brings a Supersonic Legend who wins kickoffs, {{p_duo3}} per hour at {{rank_duo3}}.',
      },
      {
        goal: 'Want 3v3 Standard instead?',
        service: 'three',
        answer:
          'The Standard fill covers up to {{seats_three}} seats with Grand Champions, priced per match.',
      },
      {
        goal: 'Just want a fun evening?',
        service: 'extra',
        answer:
          'Extra Modes costs {{p_extra}} per hour across Rumble, Hoops, Snow Day, Dropshot and Heatseeker.',
      },
      {
        goal: 'Mechanics holding you back?',
        service: 'mech',
        answer:
          'Mechanics Training is one hour with a Grand Champion coach, ending with training packs.',
      },
    ],
  },
  sections: [
    {
      heading: 'Why is Rocket League Doubles priced by the hour?',
      paragraphs: [
        'An hour is the honest unit for Doubles, because one match lasts about five minutes. For example, an hour covers a whole session rather than a single kickoff. A per-match price would charge the same for a five-minute game and a session, so a pricing review in November 2026 moved Doubles to hourly and left the 3v3 Standard fill per match. An hour of Duo Pro costs {{p_duo2}} at {{rank_duo2}} and usually covers eight or more matches, which is enough to settle a rotation habit.',
        'Ranked prices follow your own rank, so a {{rank_duo2_low}} player pays {{p_duo2_low}} per hour and a {{rank_duo2_high}} player pays {{p_duo2_high}}, because higher lobbies need stronger partners. Casual hours keep one flat price, so Casual 3v3 and Extra Modes each cost {{p_casual}}. First, agree who takes kickoff. Second, agree a boost rule. Finally, bundles take {{pct3}} off 3 hours or {{pct5}} off 5, and voice runs using Discord with invites from Epic Games accounts.',
      ],
    },
    {
      heading: 'What makes a Doubles partner actually useful?',
      paragraphs: [
        'The Doubles partner you want is a player who rotates, so the two of you are never both chasing the same ball. Rotation beats raw mechanics at every rank below Supersonic Legend, which is why Duo Plus names a Champion+ partner and Duo Pro a Grand Champion who covers back post. For example, a {{rank_duo2}} player books Duo Pro at {{p_duo2}} per hour in 2026. Three hours cost {{p_duo2_x3}} with {{pct3}} off, and the ranked rules from Psyonix still apply.',
        'Agree the basics in the order chat before the first kickoff. First, decide who takes the diagonal kickoff and who cheats up. Second, agree a call for boost, because two players starving at once loses the next counter. Finally, keep calls short using Discord and name the next action instead of the last mistake. Bundles still apply, so 3 hours get {{pct3}} off and 5 get {{pct5}} off the total.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro hours in Europe',
      paragraphs: [
        'For example, here is a real booking, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} player in Europe books 3 Duo Pro hours of Ranked Doubles. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one hour. The order chat opens straight after payment, and the first message names the region, the rank and the goal: Europe, {{rank_duo2}}, controller, looking for a partner who shadows instead of double committing.',
        'The evening then runs on a short plan. First, both players agree kickoff positions and a boost rule. Second, voice goes on using Discord and the invite goes out with the Epic name. Third, after each match you agree one adjustment, such as holding back post for two more seconds. We found the rank spread by running the price tool from Duoly for every tier, so a {{rank_duo2_low}} player pays {{p_duo2_low}} in 2026. Five hours take {{pct5}} off.',
      ],
    },
    {
      heading: 'When is Rocket League coaching the better booking?',
      paragraphs: [
        'Rocket League coaching is the better booking when the goal is a repeatable fix rather than company for the next hour. A partner answers a quick question between matches. A coach drills one touch in free play and leaves you with training packs. Mechanics Training costs {{p_mech}} per hour in 2026. Finally, coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'For example, a player who misses every aerial gains more from one mechanics hour than from another Doubles session. Finally, a player who wants a relaxed evening gains more from Extra Modes at {{p_extra}} per hour. Play and Learn is one live Doubles hour with a Grand Champion coach at {{p_learn}}. The full service list and lesson formats live on the [Rocket League coaching page](/games/rocket-league/coaching), and screen share runs using Discord.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Rocket League sessions?',
    items: [
      [
        'Is Duoly a free Rocket League teammate finder?',
        'Duoly is a paid marketplace with reviewed players. For example, Discord LFG channels and the in-game party menu from Psyonix stay the free routes to a partner.',
      ],
      [
        'How much does a Doubles partner cost?',
        'Duo Pro is {{p_duo2}} per hour at {{rank_duo2}} in 2026. First, bundles take {{pct3}} off 3 hours, and 10 hours cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Why is Doubles priced per hour?',
        'One match lasts about five minutes, so an hour prices the real session. A booked hour usually covers eight or more Ranked Doubles matches.',
      ],
      [
        'Can we play 3v3 Standard?',
        'Yes. The Standard fill adds Grand Champion players to your team and is priced per match rather than per hour, because a Standard set is shorter.',
      ],
      [
        'Can we play the extra modes?',
        'Yes. Extra Modes covers Rumble, Hoops, Snow Day, Dropshot and Heatseeker at one flat hourly price with no rank picker.',
      ],
      [
        'Where do I book a Rocket League coach?',
        'On the Rocket League coaching page, with Mechanics Training by the hour and one live Doubles hour in Play and Learn, using Discord screen share.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for a Rocket League session?',
    text: 'Duo Pro is the Ranked Doubles session with a Grand Champion partner from Duoly. For example, 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off in 2026. Five hours get {{pct5}} off. Finally, agree your rotations using Discord before kickoff.',
  },
};
