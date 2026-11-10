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
  related: [
    'ea-sports-fc-27',
    'minecraft',
    'arc-raiders',
    'fortnite',
    'apex-legends',
  ],
  intent:
    'After the duo page rather than every Rocket League service? It covers rotation, boost calls and the casual modes next to Ranked Doubles.',
  format: {
    heading: 'What can you book for Rocket League on Duoly?',
    text: 'A Rocket League booking on Duoly is a single reviewed partner, a 3v3 Standard fill or a coaching hour. First, Doubles sells by the hour, because one match runs about seven minutes. The partner tiers are Duo Plus with a Champion+ player, Duo Pro with a Grand Champion and Duo Apex with a Supersonic Legend, priced by your own rank from {{p_duo2_low}} to {{p_duo2_high}} on Duo Pro. Casual 3v3 and Extra Modes each hold one flat price of {{p_casual}} per hour. The 3v3 Standard fill is priced per match instead, from {{p_three_low}} for {{seats_three}} seats. Bundles of {{main}} cut the total, {{bundles}}. Second, the lessons: Mechanics Training is an hour on aerials, flicks and recoveries at {{p_mech}}, and Play and Learn is a live Doubles hour at {{p_learn}}. For example, agree kickoff positions using Discord first.',
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
      'Teammate prices are per hour, because one match runs about seven minutes. The Ranked Doubles tiers read your own rank: Duo Pro costs {{p_duo2_low}} per hour at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. Casual 3v3 and Extra Modes hold one price for everybody. First, pick the mode, because the mode decides whether the rank list on a card matters. Second, read the partner tier beside the price: Duo Plus names a Champion+ player, Duo Pro a Grand Champion and Duo Apex a Supersonic Legend from {{p_duo3_low}} per hour. Only {{main}} is sold in bundles, {{bundles}}, and every other service books {{picker}}. For example, agree a boost rule using Discord before hour 1.',
    team: 'The 3v3 Standard fill is the one service priced per match rather than per hour, because a Standard set is shorter than a Doubles session. 3v3 Standard covers up to {{seats_three}} seats at {{p_three}} at {{rank_three}}, from {{p_three_low}} at {{rank_three_low}}. First, count the seats you actually need, because every seat is priced on its own. Second, agree who takes third man, because a Standard three that all rotates forward concedes the counter. Bundles of {{main}} take {{bundles}}. For example, a pair short 1 player books 1 seat rather than 2, agreed using Discord.',
    coaching:
      'Lessons are priced by the hour and get no quantity or bundle discount at all, so the {{pct3}} to {{pct10}} bundle savings on teammate hours stop here. Mechanics Training costs {{p_mech}} per hour, drilling aerials, flicks and recoveries, and ends with training packs you keep. Play and Learn is the live option where a Grand Champion coach talks through one real Doubles hour at {{p_learn}}. First, pick the problem rather than the format. For example, a player who misses every aerial books the free play hour instead of a fourth Doubles hour. Screen share runs using Discord, and no lesson from Duoly promises a rank.',
  },
  steps: {
    heading: 'How does booking a Rocket League partner work?',
    items: [
      'Pick a service and the number of hours first. Duo Pro is the Ranked Doubles tier with a Grand Champion, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five hours take {{pct5}} off.',
      'Second, add your region, rank, platform and language at checkout. For example, name Europe, {{rank_duo2}} and controller, so your partner reads the real request before accepting.',
      'Finally, meet your partner in the order chat using Discord. Agree kickoff positions, a boost rule and voice, then add each other by Epic name and party up. One Duo Pro hour costs {{p_duo2}} at {{rank_duo2}}.',
    ],
    note: 'Duoly reviews every Rocket League partner before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Rocket League session fits you?',
    intro:
      'The right Rocket League session is the one matching your goal for the hour. First, the casual modes keep one flat price at every rank: Casual 3v3 and Extra Modes are each {{p_casual}} per hour. Ranked Doubles is priced by your own rank, from {{p_duo2_low}} per hour on Duo Pro, and the 3v3 Standard fill is priced per seat instead. For example, a {{main}} bundle takes {{bundles}}, so a bundle beats booking 1. Voice runs using Discord.',
    picks: [
      {
        goal: 'Climbing Ranked Doubles?',
        service: 'duo2',
        answer:
          'Duo Pro adds a Grand Champion from {{p_duo2_low}} per hour, priced by your own rank.',
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
          'The Standard fill covers up to {{seats_three}} seats from {{p_three_low}}, priced per match.',
      },
      {
        goal: 'Just want a fun evening?',
        service: 'extra',
        answer:
          'Extra Modes costs {{p_extra}} per hour across Rumble, Hoops, Snow Day and Heatseeker.',
      },
      {
        goal: 'Mechanics holding you back?',
        service: 'mech',
        answer:
          'Mechanics Training is one hour with a Grand Champion coach for {{p_mech}}.',
      },
    ],
  },
  sections: [
    {
      heading: 'Why is Rocket League Doubles priced by the hour?',
      paragraphs: [
        'An hour is the honest unit for Doubles, because one match runs about seven minutes. Charging per match would price a kickoff and a session the same way, so Doubles sells hourly and only the 3v3 Standard fill stays per match from {{p_three_low}}. An hour of Duo Pro costs {{p_duo2}} at {{rank_duo2}} and realistically covers 6 or 7 matches once queue time is counted. First, settle one rotation habit rather than chasing a single result.',
        'Ranked prices follow your own rank: a {{rank_duo2_low}} player pays {{p_duo2_low}} per hour and a {{rank_duo2_high}} player pays {{p_duo2_high}}. Casual hours ignore rank entirely, so Casual 3v3 and Extra Modes each cost {{p_casual}} in 2026. Agree who takes the diagonal kickoff before the first match, then agree a boost rule. Bundles of {{main}} take {{bundles}}. For example, two players starving for boost at once loses the counter, so name one caller using Discord.',
      ],
    },
    {
      heading: 'What does a 3v3 Standard fill include?',
      paragraphs: [
        'The 3v3 Standard fill is the one Rocket League service priced per match rather than per hour, because a Standard set is shorter than a Doubles session. It covers up to {{seats_three}} seats at {{p_three}} per match with Grand Champion players, and it reads your own rank like the Doubles tiers do, from {{p_three_low}}. First, count the seats, so a pair short 1 player books 1 rather than 2. For example, a pair who always concede the counter book one seat and ask for a dedicated third man.',
        'The fill starts like any other order. Pick the service, pick the seat count, pay once, then meet the team in the order chat. Name your platform, your input and the rotation you want to practise, because a Doubles habit and a Standard habit are different jobs. Voice runs using Discord, invites go out from the Rocket League party menu, and nobody needs your login. Bundles of {{main}} still take {{bundles}} in 2026.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro hours in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} player in Europe books 3 Duo Pro hours of Ranked Doubles. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one hour. A booked hour realistically covers 6 or 7 Ranked Doubles matches, because one match runs about seven minutes. The order chat opens straight after payment, and the first message names the region, the rank and the goal: Europe, {{rank_duo2}}, controller, looking for a partner who shadows instead of double committing.',
        'From there the evening runs on a short plan. You agree kickoff positions and a boost rule, voice goes on, and you party up by Epic name. After each match you pick one adjustment, for example holding back post 2 seconds longer before committing, agreed using Discord. The same shape works for Extra Modes at {{p_extra}} per hour on a lighter night, and 5 hours take {{pick5}} off the total.',
      ],
    },
    {
      heading: 'When is Rocket League coaching the better booking?',
      paragraphs: [
        'Rocket League coaching is the better booking when the goal is a repeatable fix rather than company for the next hour. A partner answers a quick question between matches. A coach drills one touch in free play and leaves you with training packs. Mechanics Training costs {{p_mech}} per hour, and coaching carries no quantity or bundle discount, so the {{pct3}} to {{pct10}} bundle savings apply to teammate hours only.',
        'First, name the touch you keep missing. For example, a player who misses every aerial gains more from one free play hour at {{p_mech}} than from a fourth Doubles hour, because the fix lives outside a ranked lobby. A player who wants a relaxed evening gains more from Extra Modes at {{p_extra}} per hour in 2026. Play and Learn sits between the two at {{p_learn}}: one live Doubles hour with a Grand Champion coach, using Discord screen share. The full service list and lesson formats live on the [Rocket League coaching page](/games/rocket-league/coaching). [Fortnite teammates](/games/fortnite) and [EA SPORTS FC 27 partners](/games/ea-sports-fc-27) are the nearest neighbours here.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Rocket League sessions?',
    items: [
      [
        'Is Duoly a free Rocket League teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game party menu from Psyonix are the free routes, so try those first.',
      ],
      [
        'How much does a Doubles partner cost?',
        'Duo Pro is {{p_duo2}} per hour at {{rank_duo2}}, and {{p_duo2_low}} at the lowest rank. Ten hours cost {{p_duo2_x10}} with {{pct10}} off in 2026.',
      ],
      [
        'How do I book a full Rocket League three?',
        'The 3v3 Standard fill covers up to {{seats_three}} seats from {{p_three_low}} per match with Grand Champion players, and it is priced per match rather than per hour.',
      ],
      [
        'Why is Doubles priced per hour?',
        'A match runs about seven minutes, so an hour prices the real session. A booked hour realistically covers 6 or 7 Ranked Doubles matches.',
      ],
      [
        'Can we play 3v3 Standard?',
        'Yes: the Standard fill adds Grand Champion players from {{p_three_low}} per match for {{seats_three}} seats, priced per match rather than per hour.',
      ],
      [
        'Where do I book a Rocket League coach?',
        'The Rocket League coaching page sells Mechanics Training by the hour, plus one live Doubles hour in Play and Learn. Coaching gets no quantity or bundle discount.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for a Rocket League session?',
    text: 'Duo Pro is the Ranked Doubles hour with a Grand Champion partner from Duoly. Three hours at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off, and 5 hours take {{pct5}} off. Extra Modes stays {{p_extra}} per hour at any rank, and Casual 3v3 costs {{p_casual}}. The 3v3 Standard fill covers up to {{seats_three}} seats from {{p_three_low}} per match with Grand Champion players in 2026. For example, agree kickoffs and boost using Discord.',
  },
};
