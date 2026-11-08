import type { HubPageCopy } from '../hub-pages';

export const arcRaiders: HubPageCopy = {
  gameSlug: 'arc-raiders',
  title: 'ARC Raiders LFG: Find a Raid Partner or Squad | Duoly',
  description:
    'Book an ARC Raiders raid partner, a full squad, an escort run or PvP coaching on Duoly, {{from_lower}}. Compare every raid and squad price.',
  eyebrow: 'ARC Raiders teammates',
  h1: 'ARC Raiders LFG: find a raid partner tonight',
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
    text: 'A Duoly ARC Raiders booking is a paid hour where reviewed raiders drop in with you on your own account. ARC Raiders sells by the hour, because an extraction raid has no fixed length and the loot run matters more than the match count. Duo Plus brings an experienced raider at {{p_duo1}} per hour, Duo Pro a Veteran at {{p_duo2}} and Duo Apex an Elite raider for high-risk maps. ARC Raiders has no ranked ladder, so every price is flat for everybody in 2026. For example, Learn the Maps costs {{p_learn}} per hour and covers relaxed loot routes and extraction points. Bundles cut the total: 3 hours get {{pct3}} off, 5 get {{pct5}} off and 10 get {{pct10}} off. Full Squad and Escort Run hire two raiders on one order, and the raid rules from Embark Studios still apply. Finally, every booking opens an order chat, where you agree routes and voice using Discord.',
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
      'One raider drops in with you on your own account, from high-risk raids to relaxed map learning.',
    team: 'Squad orders hire two raiders at once, so the listed price covers the whole group.',
    coaching:
      'The lesson runs for one hour on fights, third parties and clean extractions.',
  },
  steps: {
    heading: 'How does booking an ARC Raiders session work?',
    items: [
      'First, pick a service and the number of hours. Duo Pro is the Veteran option at {{p_duo2}} per hour, and 3 hours cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five hours get {{pct5}} off the total.',
      'Second, add your area, platform and language at checkout. For example, name Europe and keyboard, and say whether the hour is for loot or for fights, so your raider reads the real request from Duoly first.',
      'Third, meet your raider in the order chat, agree a map and voice using Discord, then invite each other with your Embark ID. A single Elite hour costs {{p_duo3}} in 2026. Ten hours get {{pct10}} off.',
    ],
    note: 'Duoly reviews every ARC Raiders teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which ARC Raiders session fits you?',
    intro:
      'The right ARC Raiders session is the one matching your goal for the hour, so pick the goal first and let the price follow. For example, a Veteran raid hour costs {{p_duo2}} in 2026, with {{pct3}} off 3 hours and {{pct5}} off 5. There is no rank picker, and voice runs using Discord in every session.',
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
        'ARC Raiders has no ranked ladder, so Duoly charges one flat price for everybody. A raid is risk and route knowledge rather than a visible rating, which means the raider tier is the only thing that changes the price. Duo Plus costs {{p_duo1}} per hour, Duo Pro {{p_duo2}} and Duo Apex the most, because an Elite raider takes the hardest maps. Learn the Maps sits below all three for relaxed runs.',
        'Flat pricing also makes the maths simple. For example, 3 Veteran hours cost {{p_duo2_x3}} with {{pct3}} off and 5 cost {{p_duo2_x5}} with {{pct5}} off in 2026. First, decide whether the hour is for loot or for fights, because the route changes completely. Second, agree what happens to shared loot before the drop. Finally, keep comms short using Discord, since a late call during a third party ends the run.',
      ],
    },
    {
      heading: 'How do Full Squad and Escort Run differ?',
      paragraphs: [
        'Full Squad is a single order hiring two Veteran raiders, so the listed price of {{p_squad}} per hour covers the whole group rather than one seat. You loot while both raiders hold the area and watch the extraction. Escort Run is the other shape at {{p_escort}} per hour in 2026. An Elite squad takes you to a specific piece of loot and back out, which suits one planned objective instead of an open session booked from Duoly.',
        'Pick by whether you have a target. For example, a player chasing one workbench upgrade gains more from an Escort Run than from an open hour of raids. First, name the map and the item. Second, agree the extraction point and a fallback. Finally, agree the loot split in the order chat before anybody drops, using Discord for voice. Bundles still apply, so 3 hours get {{pct3}} off and 5 get {{pct5}} off.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro raid hours',
      paragraphs: [
        'For example, here is a real booking, priced with the Duoly checkout calculator on {{checked}}. A player in Europe books 3 Duo Pro hours with a Veteran raider. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one hour. The order chat opens straight after payment, and the first message names the area, the goal and the gear: Europe, mid-tier kit, looking for loot runs rather than fights.',
        'The evening then runs on a short plan. First, both players agree a map and a loot route. Second, voice goes on using Discord and the invite goes out with the Embark ID. Third, after each run you agree one adjustment, such as extracting at the first safe window instead of pushing deeper. We found these numbers by running the price tool from Duoly for every service in 2026. Five hours take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is ARC Raiders coaching the better booking?',
      paragraphs: [
        'ARC Raiders coaching is the better booking when the goal is a repeatable fix rather than company for the next raid. PvP and Extraction is one hour with an Elite coach on fights, third parties and clean extractions, at {{p_pvp}} per hour in 2026. Finally, coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to raid sessions only.',
        'For example, a raider who dies to the same third party every run gains more from one coaching hour than from three more raids. Finally, a raider who simply does not know the maps gains more from Learn the Maps at {{p_learn}} per hour. ARC Raiders has no separate Duoly coaching page yet, so the lesson is booked from the prices above, and screen share runs using Discord so the coach sees your real route.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about ARC Raiders sessions?',
    items: [
      [
        'Is Duoly a free ARC Raiders teammate finder?',
        'Duoly is a paid marketplace with reviewed players. For example, Discord LFG channels and the in-game friend list from Embark Studios stay the free routes to a trio.',
      ],
      [
        'How much does a raid partner cost?',
        'Duo Pro is {{p_duo2}} per hour with a Veteran raider in 2026. First, bundles take {{pct3}} off 3 hours, and 10 hours cost {{p_duo2_x10}} with {{pct10}} off.',
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
        'Yes. Full Squad and Escort Run both hire {{seats_squad}} raiders on one order at {{p_squad}} and {{p_escort}} per hour, and voice runs using Discord.',
      ],
      [
        'Can you guarantee a successful extraction?',
        'No. A raid can end in a wipe whatever the plan. A Veteran raider improves your odds and your routes, never the outcome of a single run.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next ARC Raiders run?',
    text: 'Duo Pro is the raid hour with a Veteran raider from Duoly. For example, 3 hours cost {{p_duo2_x3}} with {{pct3}} off in 2026. Five hours get {{pct5}} off. Finally, agree your map and extraction point using Discord before the drop.',
  },
};
