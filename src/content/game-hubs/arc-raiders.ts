import type { HubPageCopy } from '../hub-pages';

export const arcRaiders: HubPageCopy = {
  gameSlug: 'arc-raiders',
  title: 'ARC Raiders Duo Lobbies, Squads and Coaching | Duoly',
  description:
    'Book an ARC Raiders duo lobby, a full squad, an escort run or PvP coaching on Duoly, {{from_lower}}. Compare every duo, squad and raid price.',
  eyebrow: 'ARC Raiders teammates',
  h1: 'Book an ARC Raiders duo lobby, a squad or coaching',
  lead: 'Free LFG Discords work for a casual trio. Duoly books a reviewed experienced, Veteran or Elite raider by the hour, sends a full squad with you and sells PvP and extraction coaching.',
  cta: 'Book an ARC Raiders teammate',
  facts: [
    'Experienced, Veteran and Elite raiders',
    'Raids, escort runs and map learning',
    'Priced per hour, your own account',
  ],
  related: [
    'world-of-warcraft',
    'pokemon-unite',
    'teamfight-tactics',
    'minecraft',
    'ea-sports-fc-27',
  ],
  intent:
    'After the LFG page rather than every ARC Raiders service? It covers loot routes, extraction calls and how a duo splits one raid.',
  format: {
    heading: 'What can you book for ARC Raiders on Duoly?',
    text: 'An ARC Raiders booking on Duoly is a single reviewed raider, a squad order or one coaching hour. First, everything is priced per hour, because a raid has no fixed length and the loot you walk out with matters more than the run count. The raider tiers are Duo Plus with an experienced player at {{p_duo1}}, Duo Pro with a Veteran at {{p_duo2}} and Duo Apex with an Elite raider at {{p_duo3}}. Learn the Maps sits below all three at {{p_learn}} for relaxed loot routes. Bundles cut the total, {{pct3}} off 3 hours up to {{pct10}} off 10. There is no rank picker, because the matchmaking notes from Embark Studios describe no ranked tier at all and read playstyle history, squad size and latency instead, checked in November 2026. For example, say whether the hour is for loot or fights using Discord.',
  },
  services: {
    duo1: 'An hour of raids with a player who knows the loot spots and the safe ways out.',
    duo2: 'An hour with a Veteran who handles fights, picks routes and gets you out with loot.',
    duo3: 'An hour with an Elite raider for high-risk maps and the biggest extractions.',
    learn:
      'Relaxed runs to learn the maps, the best loot routes and where to extract safely.',
    ggbuddy:
      'A patient Gamer Girl runs relaxed loot routes with you and explains the basics.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and keeps the mood up after a wipe.',
    squad:
      'Two Veterans join you as a full trio. You loot, they keep you alive.',
    escort:
      'An Elite squad escorts you to the big loot and back out again, safely.',
    pvp: 'One hour on fights, third parties and clean extractions on every map.',
  },
  intros: {
    teammate:
      'Raid prices are per hour and flat for everybody, because ARC Raiders has no ranked tier and nothing on the page asks for a rank. The raider tier is the only thing that moves the number: {{p_duo1}} per hour for an experienced player, {{p_duo2}} for a Veteran and {{p_duo3}} for an Elite raider. First, pick the goal, because loot routes and fight routes are different hours. Second, read the matchmaking note: Embark Studios published in 2026 that every squad member feeds the matchmaking profile, so a Veteran beside you raises the lobby difficulty rather than lowering it. Bundles take {{pct3}} off 3 hours and {{pct5}} off 5. For example, agree the map using Discord before hour 1.',
    team: 'A squad order is one order that hires two raiders at once, so a solo trip becomes a full trio. Full Squad covers {{seats_squad}} raiders at {{p_squad}} per hour and holds the area while you loot. Escort Run is the targeted version at {{p_escort}}, taking you to one piece of loot and back out. First, decide whether you have a target, because the answer picks the service. Matchmaking from Embark Studios prefers equal squad sizes and reads the whole squad, published in 2026, so a trio meets other trios. Bundles take {{pct3}} off 3 hours and {{pct5}} off 5. For example, settle the loot split using Discord before anybody drops.',
    coaching:
      'The lesson is priced by the hour and gets no bundle discount at all, so the {{pct3}} and {{pct5}} savings on raid hours stop here. PvP and Extraction costs {{p_pvp}} per hour and covers the deaths that keep repeating: how a fight starts, how a third party arrives, and how to leave with your kit instead of feeding it. First, pick the problem rather than the format. For example, a raider who dies to the same third party books the coaching hour instead of a fourth raid hour at {{p_duo2}}. Screen share runs using Discord, and no lesson from Duoly promises an extraction.',
  },
  steps: {
    heading: 'How does booking an ARC Raiders session work?',
    items: [
      'Pick a service and the number of hours first. Duo Pro is the Veteran tier at {{p_duo2}} per hour, and 3 hours cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five hours take {{pct5}} off.',
      'Second, add your area, platform and language at checkout. For example, name Europe and keyboard, and say whether the hour is for loot or for fights, so your raider reads the real request.',
      'Finally, meet your raider in the order chat using Discord. Agree a map, a route and the loot split, then add each other in game and squad up before the drop. One Elite hour costs {{p_duo3}}.',
    ],
    note: 'Duoly reviews every ARC Raiders teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which ARC Raiders session fits you?',
    intro:
      'The right ARC Raiders session is the one matching your goal for the hour. First, every service is flat priced, because the matchmaking notes from Embark Studios describe no ranked tier and no rank gate anywhere in 2026. Duo Pro costs {{p_duo2}} per hour and Learn the Maps {{p_learn}}, so the tier only changes who you bring. For example, 3 hours take {{pct3}} off and 5 hours take {{pct5}} off, so a bundle beats booking 1. Voice runs using Discord.',
    picks: [
      {
        goal: 'New to the maps?',
        service: 'learn',
        answer:
          'Learn the Maps costs {{p_learn}} per hour of relaxed runs through loot routes and exits.',
      },
      {
        goal: 'Want to come back with loot?',
        service: 'duo2',
        answer:
          'Duo Pro brings a Veteran raider at {{p_duo2}} per hour who picks routes and handles fights.',
      },
      {
        goal: 'Going for a high-risk map?',
        service: 'duo3',
        answer:
          'Duo Apex brings an Elite raider for {{p_duo3}} per hour, for the biggest extractions.',
      },
      {
        goal: 'Want a full trio?',
        service: 'squad',
        answer:
          'Full Squad hires {{seats_squad}} Veterans for {{p_squad}} per hour on one order.',
      },
      {
        goal: 'Only need the one big run?',
        service: 'escort',
        answer:
          'Escort Run costs {{p_escort}} per hour and takes you to the loot and back out.',
      },
    ],
  },
  sections: [
    {
      heading: 'Why does ARC Raiders have no rank picker?',
      paragraphs: [
        'ARC Raiders is an extraction shooter with no ranked tier, so Duoly charges one flat price of {{p_duo2}} per Veteran hour and nothing at checkout asks for your rank. First, pick the raider instead of a rank: Duo Plus is an experienced raider at {{p_duo1}} per hour, Duo Pro a Veteran at {{p_duo2}} and Duo Apex an Elite raider at {{p_duo3}}. Learn the Maps is the gentlest start at {{p_learn}} per hour. For example, a first raid on a new map goes further with a guide than with a gunfighter.',
        'What changes instead is lobby difficulty. Every squad member feeds the matchmaking profile, so a Veteran beside you raises the opposition rather than lowering it. Flat pricing keeps the maths simple: 3 Veteran hours cost {{p_duo2_x3}} with {{pct3}} off and 5 cost {{p_duo2_x5}} with {{pct5}} off. Decide before the drop whether the hour is for loot or for fights, because the route changes completely. Keep comms short out there, because a late call during a third party ends the run, so use Discord.',
      ],
    },
    {
      heading: 'How do Full Squad and Escort Run differ?',
      paragraphs: [
        'Full Squad is one order that hires two Veteran raiders, so the listed {{p_squad}} per hour covers the whole group rather than a single seat. You loot while both raiders hold the area and watch the extraction, which turns a solo trip into a proper trio. Escort Run is the other shape at {{p_escort}} per hour: an Elite squad takes you to one specific piece of loot and back out, which suits a single planned objective. First, decide whether you have a target.',
        'For example, a player chasing one workbench upgrade gains more from an Escort Run than from an open raid hour, while a player who wants company for the evening gains more from the open hour at {{p_duo2}}. Name the map and the item, agree the extraction point and a fallback, then settle the loot split in the order chat before anybody drops. Matchmaking from Embark Studios prefers equal squad sizes, published in 2026, so a trio normally meets other trios. Bundles take {{pct3}} off 3 hours and {{pct5}} off 5, agreed using Discord.',
      ],
    },
    {
      heading: 'Example raid night: three Duo Pro hours',
      paragraphs: [
        'Here is an example raid night, priced with the Duoly checkout calculator on {{checked}}. A player in Europe books 3 Duo Pro hours with a Veteran raider. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one hour. ARC Raiders has no ranked tier, so nothing at checkout asks for a rank and the price is the same for everybody. The order chat opens straight after payment, and the first message names the area, the goal and the kit: Europe, mid-tier gear, looking for loot runs rather than fights.',
        'From there the night runs on a short plan. You agree a map and a loot route, voice goes on, and you squad up in game before the first drop. After each run you pick one adjustment, for example extracting at the first safe window instead of pushing 1 building deeper, agreed using Discord. The same shape works for Learn the Maps at {{p_learn}} per hour, and 5 hours take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is ARC Raiders coaching the better booking?',
      paragraphs: [
        'ARC Raiders coaching is the better booking when the goal is a repeatable fix rather than company for the next raid. PvP and Extraction is one hour with an Elite coach on fights, third parties and clean extractions, at {{p_pvp}} per hour. Coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to raid hours only.',
        'First, name the death you keep repeating. For example, a raider who dies to the same third party gains more from one coaching hour at {{p_pvp}} than from a fourth raid, because a coach can name the pattern and leave you something to practise. A raider who simply does not know the maps gains more from Learn the Maps at {{p_learn}} per hour in 2026. ARC Raiders has no separate coaching page on Duoly yet, so the lesson is booked from the prices above, and screen share runs using Discord so the coach watches your real route. Two neighbours are worth a look: [Rainbow Six Siege teammates](/games/rainbow-six-siege) for tight-angle gunfights, and [PUBG teammates](/games/pubg) for the same loot-and-leave tension on a bigger map.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about ARC Raiders sessions?',
    items: [
      [
        'Is Duoly a free ARC Raiders teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game friend list from Embark Studios are the free routes, so try those first.',
      ],
      [
        'How much does a raid partner cost?',
        'Duo Pro is {{p_duo2}} per hour with a Veteran raider. Ten hours cost {{p_duo2_x10}} with {{pct10}} off in 2026, and 3 hours take {{pct3}} off.',
      ],
      [
        'Why is there no rank picker?',
        'ARC Raiders has no ranked tier, so every service keeps one flat price. Matchmaking from Embark Studios reads playstyle history, squad size and latency instead.',
      ],
      [
        'Who keeps the loot?',
        'You do: agree the split in the order chat before the drop, for example 50% each on shared finds. A raider is paid for the hour rather than for a guaranteed extraction.',
      ],
      [
        'Can two raiders come with me?',
        'Yes: Full Squad and Escort Run both hire {{seats_squad}} raiders on one order at {{p_squad}} and {{p_escort}} per hour, with voice using Discord.',
      ],
      [
        'Can you guarantee a successful extraction?',
        'No: a raid can end in a wipe whatever the plan. A Veteran raider improves your odds and your routes, never the outcome of a single run.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next ARC Raiders run?',
    text: 'Duo Pro is the raid hour with a Veteran raider from Duoly. Three hours cost {{p_duo2_x3}} with {{pct3}} off, and 5 hours take {{pct5}} off. Learn the Maps stays {{p_learn}} per hour for the routes first, and Full Squad costs {{p_squad}}. ARC Raiders has no ranked tier, so no rank gate stands between any two accounts, and matchmaking from Embark Studios reads playstyle history and squad size in 2026. For example, agree the map and the extraction point using Discord.',
  },
};
