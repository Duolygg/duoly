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
    text: 'Duoly sells three things for Rocket League: one partner who queues with you on your own account, a 3v3 Standard fill that completes your team, and coaching by the hour. Doubles sells by the hour, because a single match runs about seven minutes and an hour is the smallest unit that covers a real session. The partner tiers are Duo Plus with a Champion+ player, Duo Pro with a Grand Champion and Duo Apex with a Supersonic Legend, priced by your own rank from {{p_duo2_low}} to {{p_duo2_high}} on Duo Pro. Casual modes keep one flat price at every rank, so Casual 3v3 and Extra Modes each cost {{p_casual}} per hour. The 3v3 Standard fill is priced per match instead, at {{p_three}} for {{seats_three}} seats. Bundles cut the total, {{pct3}} off 3 up to {{pct10}} off 10.',
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
      'Pick a service and the number of hours. Duo Pro is the Ranked Doubles tier with a Grand Champion, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five hours take {{pct5}} off.',
      'Add your region, rank, platform and language at checkout. Name Europe, {{rank_duo2}} and controller, so your partner reads the real request before accepting the order.',
      'Meet your partner in the order chat, agree kickoff positions, a boost rule and voice, then add each other by Epic name and party up. A single Duo Pro hour costs {{p_duo2}} at the same rank.',
    ],
    note: 'Duoly reviews every Rocket League partner before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Rocket League session fits you?',
    intro:
      'The right Rocket League session is the one matching your goal for the hour, so pick the goal first and let the price follow. Ranked Doubles parties carry no rank gate at all, which is why any tier can queue 2v2 with you, while casual modes keep one flat price for everybody. Bundles cut totals by {{pct3}} on 3 hours and {{pct5}} on 5.',
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
        'An hour is the honest unit for Doubles, because a single match runs about seven minutes. Charging per match would price a kickoff and a session the same way, so Doubles sells hourly and only the 3v3 Standard fill stays per match at {{p_three}}. An hour of Duo Pro costs {{p_duo2}} at {{rank_duo2}} and realistically covers six or seven matches once queue time and replays are counted, which is enough to settle one rotation habit rather than chase a single result.',
        'Ranked prices follow your own rank, so a {{rank_duo2_low}} player pays {{p_duo2_low}} per hour and a {{rank_duo2_high}} player pays {{p_duo2_high}}, because higher lobbies need a stronger partner. Casual hours ignore rank entirely, which is why Casual 3v3 and Extra Modes each cost {{p_casual}}. Agree who takes the diagonal kickoff before the first match, agree a boost rule second, and remember bundles take {{pct3}} off 3 hours or {{pct5}} off 5.',
      ],
    },
    {
      heading: 'Can any rank party up for Ranked Doubles?',
      paragraphs: [
        'Yes. Psyonix applies no rank disparity limit to 2v2 parties, so a Bronze player and a Supersonic Legend can queue Ranked Doubles together, and matchmaking weights the lobby towards the higher-ranked player instead of blocking the party. The limit that does exist belongs to 3v3: a two-player party can only queue Ranked Standard if both players sit within three ranks of each other. The Standard fill sidesteps that by completing your party to a full three, where the restriction no longer applies.',
        'The partner you actually want is one who rotates, so the two of you are never both chasing the same ball. Rotation beats raw mechanics at every rank below Supersonic Legend, which is why Duo Plus names a Champion+ partner and Duo Pro a Grand Champion who covers back post and calls boost. Set that up in the order chat: who cheats up on kickoff, who shadows, and one call for boost, because two players starving at once loses the counter.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro hours in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} player in Europe books 3 Duo Pro hours of Ranked Doubles. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for a single hour. The order chat opens straight after payment, and the first message names the region, the rank and the goal: Europe, {{rank_duo2}}, controller, looking for a partner who shadows instead of double committing.',
        'From there the evening runs on a short plan. You agree kickoff positions and a boost rule, voice goes on, and you party up by Epic name. After each match you pick one adjustment, such as holding back post for two more seconds before committing. The same shape works for Extra Modes at {{p_extra}} per hour if you want a lighter night, and 5 hours of anything take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Rocket League coaching the better booking?',
      paragraphs: [
        'Rocket League coaching is the better booking when the goal is a repeatable fix rather than company for the next hour. A partner answers a quick question between matches; a coach drills one touch in free play and leaves you with training packs. Mechanics Training costs {{p_mech}} per hour, and coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'A player who misses every aerial gains more from that hour than from another Doubles session, because the fix lives in free play rather than in a ranked lobby. A player who wants a relaxed evening gains more from Extra Modes at {{p_extra}} per hour. Play and Learn sits between the two at {{p_learn}}: one live Doubles hour with a Grand Champion coach talking through every decision. The full service list and lesson formats live on the [Rocket League coaching page](/games/rocket-league/coaching).',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Rocket League sessions?',
    items: [
      [
        'Is Duoly a free Rocket League teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game party menu from Psyonix stay the free routes to a partner.',
      ],
      [
        'How much does a Doubles partner cost?',
        'Duo Pro is {{p_duo2}} per hour at {{rank_duo2}}, from {{p_duo2_low}} at the lowest rank. Bundles take {{pct3}} off 3 hours, and 10 hours cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Why is Doubles priced per hour?',
        'A match runs about seven minutes, so an hour prices the real session. A booked hour realistically covers six or seven Ranked Doubles matches.',
      ],
      [
        'Can any rank queue Ranked Doubles together?',
        'Yes. Psyonix sets no rank disparity limit on 2v2 parties. Only a two-player party queueing Ranked Standard has to stay within three ranks, which a full three avoids.',
      ],
      [
        'Can we play 3v3 Standard?',
        'Yes. The Standard fill adds Grand Champion players to your team at {{p_three}} per match for {{seats_three}} seats, priced per match rather than per hour.',
      ],
      [
        'Where do I book a Rocket League coach?',
        'On the Rocket League coaching page, with Mechanics Training by the hour and one live Doubles hour in Play and Learn, using Discord screen share.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for a Rocket League session?',
    text: 'Duo Pro is the Ranked Doubles hour with a Grand Champion partner from Duoly, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off. Extra Modes stays {{p_extra}} per hour at any rank. Pick your rank and platform, then agree kickoffs and boost with your partner in the order chat.',
  },
};
