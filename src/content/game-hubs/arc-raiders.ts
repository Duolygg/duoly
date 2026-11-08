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
  related: ['rainbow-six-siege', 'call-of-duty', 'minecraft'],
  format: {
    heading: 'What can you book for ARC Raiders on Duoly?',
    text: 'Duoly sells three things for ARC Raiders: one raider who drops in with you on your own account, a squad order that hires two raiders at once, and one hour of PvP and extraction coaching. Everything is priced per hour, because a raid has no fixed length and the loot you walk out with matters more than the run count. The raider tiers are Duo Plus with an experienced player at {{p_duo1}}, Duo Pro with a Veteran at {{p_duo2}} and Duo Apex with an Elite raider at {{p_duo3}}. Learn the Maps sits below all three at {{p_learn}} for relaxed loot routes. There is no rank picker, since ARC Raiders ships no ranked ladder, so the tier you choose is the only thing that moves the price. Bundles cut the total, {{pct3}} off 3 hours up to {{pct10}} off 10.',
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
      'Raid prices are per hour and flat for everybody, because ARC Raiders ships no ranked ladder and nothing on the page asks for a rank. The raider tier is the only thing that moves the number: an experienced player costs least, a Veteran sits in the middle and an Elite raider is for the high-risk maps. Bundles take {{pct3}} off 3 hours and {{pct5}} off 5.',
    team: 'Squad orders are priced per seat, so a card covers {{seats_squad}} raiders and the three of you drop as a full trio. Full Squad is an open hour where both Veterans hold the area while you loot, and Escort Run is the targeted version that takes you to one piece of loot and back out. Bundles take {{pct3}} off 3 hours.',
    coaching:
      'The lesson is priced by the hour and gets no bundle discount, so the {{pct3}} and {{pct5}} savings on raid hours do not reach it. PvP and Extraction is the hour for the deaths that keep repeating: how a fight starts, how a third party arrives, and how to leave with your kit instead of feeding it. Screen share runs on Discord.',
  },
  steps: {
    heading: 'How does booking an ARC Raiders session work?',
    items: [
      'Pick a service and the number of hours. Duo Pro is the Veteran tier at {{p_duo2}} per hour, and 3 hours cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five hours take {{pct5}} off.',
      'Add your area, platform and language at checkout. Name Europe and keyboard, and say whether the hour is for loot or for fights, so your raider reads the real request before accepting the order.',
      'Meet your raider in the order chat, agree a map, a route and voice, then add each other in game and squad up before the drop. A single Elite hour costs {{p_duo3}}.',
    ],
    note: 'Duoly reviews every ARC Raiders teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which ARC Raiders session fits you?',
    intro:
      'The right ARC Raiders session is the one matching your goal for the hour, so pick the goal first and let the price follow. There is no rank gate anywhere in the game, which means any two accounts can squad up and the tier only changes who you bring. Bundles cut totals by {{pct3}} on 3 hours and {{pct5}} on 5.',
    picks: [
      {
        goal: 'New to the maps?',
        service: 'learn',
        answer:
          'Learn the Maps costs {{p_learn}} per hour of relaxed runs through loot routes and extraction points.',
      },
      {
        goal: 'Want to come back with loot?',
        service: 'duo2',
        answer:
          'Duo Pro brings a Veteran raider at {{p_duo2}} per hour who picks routes and handles the fights.',
      },
      {
        goal: 'Going for a high-risk map?',
        service: 'duo3',
        answer:
          'Duo Apex brings an Elite raider for the biggest extractions and the hardest third parties.',
      },
      {
        goal: 'Want a full trio?',
        service: 'squad',
        answer:
          'Full Squad hires {{seats_squad}} Veterans on one order, and the listed price covers both seats.',
      },
      {
        goal: 'Only need the one big run?',
        service: 'escort',
        answer:
          'Escort Run sends an Elite squad to take you to the loot and back out again safely.',
      },
    ],
  },
  sections: [
    {
      heading: 'Why does ARC Raiders have no rank picker?',
      paragraphs: [
        'ARC Raiders ships no ranked ladder, so Duoly charges one flat price for everybody and nothing on the page asks for your rank. A raid is route knowledge and nerve rather than a visible rating, which means the raider tier is the only thing that changes what you pay: {{p_duo1}} per hour for an experienced player, {{p_duo2}} for a Veteran and {{p_duo3}} for an Elite raider on the high-risk maps. That also removes the queue problem other games have, because any two accounts can squad up together whatever their level.',
        'Flat pricing keeps the maths simple too. Three Veteran hours cost {{p_duo2_x3}} with {{pct3}} off and 5 cost {{p_duo2_x5}} with {{pct5}} off. Decide before the drop whether the hour is for loot or for fights, since the route changes completely, and agree what happens to shared loot while you are still in the order chat. Keep comms short once you are out there, because a late call during a third party ends the run.',
      ],
    },
    {
      heading: 'How do Full Squad and Escort Run differ?',
      paragraphs: [
        'Full Squad is one order that hires two Veteran raiders, so the listed {{p_squad}} per hour covers the whole group rather than a single seat. You loot while both raiders hold the area and watch the extraction, which turns a solo trip into a proper trio. Escort Run is the other shape at {{p_escort}} per hour: an Elite squad takes you to one specific piece of loot and back out again, which suits a single planned objective instead of an open session.',
        'Pick by whether you have a target. A player chasing one workbench upgrade gains more from an Escort Run than from an open hour of raids, while a player who just wants company for the evening gains more from the open hour. Name the map and the item first, agree the extraction point and a fallback second, and settle the loot split in the order chat before anybody drops. Bundles still apply, so 3 hours get {{pct3}} off and 5 get {{pct5}} off.',
      ],
    },
    {
      heading: 'Example raid night: three Duo Pro hours',
      paragraphs: [
        'Here is an example raid night, priced with the Duoly checkout calculator on {{checked}}. A player in Europe books 3 Duo Pro hours with a Veteran raider. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for a single hour. The order chat opens straight after payment, and the first message names the area, the goal and the kit: Europe, mid-tier gear, looking for loot runs rather than fights.',
        'From there the night runs on a short plan. You agree a map and a loot route, voice goes on, and you squad up in game before the first drop. After each run you pick one adjustment, such as extracting at the first safe window instead of pushing one building deeper. The same shape works for Learn the Maps at {{p_learn}} per hour, and 5 hours of anything take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is ARC Raiders coaching the better booking?',
      paragraphs: [
        'ARC Raiders coaching is the better booking when the goal is a repeatable fix rather than company for the next raid. PvP and Extraction is one hour with an Elite coach on fights, third parties and clean extractions, at {{p_pvp}} per hour. Coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to raid hours only.',
        'A raider who dies to the same third party every run gains more from that hour than from three more raids, because the coach can name the pattern and give you something to practise. A raider who simply does not know the maps gains more from Learn the Maps at {{p_learn}} per hour. ARC Raiders has no separate coaching page on Duoly yet, so the lesson is booked from the prices above, and screen share runs on Discord so the coach watches your real route rather than a description of it.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about ARC Raiders sessions?',
    items: [
      [
        'Is Duoly a free ARC Raiders teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game friend list from Embark Studios stay the free routes to a trio.',
      ],
      [
        'How much does a raid partner cost?',
        'Duo Pro is {{p_duo2}} per hour with a Veteran raider. Bundles take {{pct3}} off 3 hours, and 10 hours cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Why is there no rank picker?',
        'ARC Raiders has no ranked ladder, so every service keeps one flat price and the raider tier is the only thing that changes what you pay.',
      ],
      [
        'Who keeps the loot?',
        'You do. Agree the split in the order chat before the drop, and remember a raider is paid for the hour rather than for a guaranteed extraction.',
      ],
      [
        'Can two raiders come with me?',
        'Yes. Full Squad and Escort Run both hire {{seats_squad}} raiders on one order at {{p_squad}} and {{p_escort}} per hour, with voice on Discord.',
      ],
      [
        'Can you guarantee a successful extraction?',
        'No. A raid can end in a wipe whatever the plan. A Veteran raider improves your odds and your routes, never the outcome of a single run.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next ARC Raiders run?',
    text: 'Duo Pro is the raid hour with a Veteran raider from Duoly, and 3 hours cost {{p_duo2_x3}} with {{pct3}} off. Learn the Maps stays {{p_learn}} per hour if you want the routes first. Pick your hours, then agree the map and the extraction point with your raider in the order chat.',
  },
};
