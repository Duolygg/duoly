import type { HubPageCopy } from '../hub-pages';

export const fortnite: HubPageCopy = {
  gameSlug: 'fortnite',
  title: 'Fortnite LFG: Find a Duo or Squad Teammate | Duoly',
  description:
    'Book a Fortnite duo, a squad fill or a coach on Duoly, {{from_lower}}. Compare Ranked Duos, Zero Build, Reload and tournament cup prices.',
  eyebrow: 'Fortnite teammates',
  h1: 'Fortnite LFG: find a duo for your next hour',
  lead: 'Free LFG Discords work for a casual squad. Duoly books a reviewed Champion or Unreal teammate by the hour, fills a trio or squad and sells build coaching when you want to learn.',
  cta: 'Book a Fortnite teammate',
  facts: [
    'Champion+ to Unreal teammates',
    'Ranked Duos, Zero Build and Reload',
    'Priced per hour, your own account',
  ],
  related: [
    'apex-legends',
    'call-of-duty',
    'rocket-league',
    'counter-strike-2',
  ],
  format: {
    heading: 'What can you book for Fortnite on Duoly?',
    text: 'A Duoly Fortnite booking is a paid hour where reviewed higher-rank players queue with you on your own account. Fortnite sells by the hour, because a battle royale match has no fixed length. Duo Plus brings a Champion+ teammate, Duo Pro an Unreal teammate and Duo Apex a tournament-level player for high Unreal endgames. Prices follow your own rank, so a {{rank_duo2}} player in Europe pays {{p_duo2}} per hour for Duo Pro in November 2026. For example, Zero Build and Reload each cost {{p_zb}} per hour at every rank. Bundles cut the total: 3 hours get {{pct3}} off, 5 get {{pct5}} off and 10 get {{pct10}} off. Squad fills and Tournament Teammate cover cups and FNCS qualifiers run by Epic Games. Finally, every booking opens an order chat, where you agree drop spots, roles and voice using Discord.',
  },
  services: {
    duo1: 'An hour of Ranked Duos with a Champion player who calls drops, rotations and endgame.',
    duo2: 'An hour of Ranked Duos or Zero Build with an Unreal player who takes the hard fights.',
    duo3: 'An hour with a tournament-level player for high Unreal lobbies and pro-heavy endgames.',
    zb: 'An hour of Zero Build: positioning, cover and aim, at a relaxed pace.',
    reload:
      'An hour of Reload on the small map with respawns. Constant action, almost no waiting.',
    box: 'An hour of box fights and build fights in Creative with someone who will push you.',
    gg1v1:
      'A Creative 1v1 against a verified Gamer Girl: box fights and build battles.',
    ggbuddy:
      'A patient Gamer Girl plays Zero Build, Reload or Creative and explains the basics.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and keeps the mood up after a loss.',
    cup: 'Cash Cups, Victory Cups or FNCS qualifiers with a teammate who has tournament earnings.',
    squad:
      'Bring a friend or two and we fill your trio or squad with Unreal players who call rotations.',
    learn:
      'One live hour of Ranked with an Unreal coach explaining every decision out loud.',
    build:
      'One hour of piece control, edits and box fights in Creative, with drills to keep going.',
  },
  intros: {
    teammate:
      'One teammate joins your games on your own account, from Ranked Duos to Zero Build and Creative.',
    team: 'Squad fills add several Unreal players at once, priced for the seats you need covered.',
    coaching:
      'Both lessons run for one hour, one live in Ranked and one drilled in Creative.',
  },
  steps: {
    heading: 'How does booking a Fortnite duo work?',
    items: [
      'First, pick a service and the number of hours. Duo Pro is the Ranked Duos option with an Unreal teammate, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five hours get {{pct5}} off.',
      'Second, add your region, rank, input and language at checkout. For example, name Europe, {{rank_duo2}} and controller or keyboard, so your teammate reads the real request before accepting the order.',
      'Third, meet your teammate in the order chat, agree a drop spot and voice using Discord, then add each other with your Epic name. A single Duo Pro hour costs {{p_duo2}} at the same rank in 2026. Ten hours get {{pct10}} off.',
    ],
    note: 'Duoly reviews every Fortnite teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Fortnite session fits you?',
    intro:
      'The right Fortnite session is the one matching your goal for the hour. For example, a {{rank_duo2}} player climbing Ranked Duos pays {{p_duo2}} per hour for Duo Pro in 2026. Pick the goal first, because the queue and cup rules from Epic Games decide the rest. Voice runs using Discord, and {{pct5}} off applies to 5 hours.',
    picks: [
      {
        goal: 'Climbing Ranked Duos?',
        service: 'duo2',
        answer:
          'Duo Pro adds an Unreal teammate from {{p_duo2_low}} per hour, priced by your own rank.',
      },
      {
        goal: 'Hate building?',
        service: 'zb',
        answer:
          'Zero Build costs {{p_zb}} per hour at every rank, with no building and a calmer pace.',
      },
      {
        goal: 'Want nonstop fights?',
        service: 'reload',
        answer:
          'Reload costs {{p_zb}} per hour on the small map, where respawns keep the action going.',
      },
      {
        goal: 'Entering a Cash Cup or FNCS?',
        service: 'cup',
        answer:
          'Tournament Teammate covers {{seats_cup}} seats for {{p_cup}} per hour, with earnings on record.',
      },
      {
        goal: 'Losing every build fight?',
        service: 'build',
        answer:
          'Build and Edit Course is one Creative hour with an Unreal coach for {{p_build}}.',
      },
    ],
  },
  sections: [
    {
      heading: 'Why is Fortnite priced by the hour?',
      paragraphs: [
        'An hour is the honest unit for Fortnite, because a battle royale match from Epic Games has no fixed length. For example, one Ranked Duos game can end in the first zone or run twenty minutes into a pro endgame, so a per-match price would charge the same for both. An hour of Duo Pro costs {{p_duo2}} at {{rank_duo2}} in 2026 and usually covers several games. First, agree a drop spot. Second, agree whether the hour is for points or for practice.',
        'Ranked prices follow your own rank, so {{rank_duo2_low}} players pay {{p_duo2_low}} per hour and {{rank_duo2_high}} players pay {{p_duo2_high}}, because high Unreal lobbies need stronger teammates. Casual hours keep one flat price: Zero Build and Reload each cost {{p_zb}}, and Creative Box Fights costs {{p_box}}. Bundles take {{pct3}} off 3 hours or {{pct5}} off 5. Voice runs using Discord, and the invite goes out with your Epic name.',
      ],
    },
    {
      heading: 'Should you book a duo, a squad fill or a cup teammate?',
      paragraphs: [
        'A duo booking adds one teammate to your games. A squad fill is one order hiring several players at once, so Squad Fill covers up to {{seats_squad}} seats with Unreal players at {{p_squad}} per hour. Tournament Teammate is the competitive option for Cash Cups and FNCS qualifiers run by Epic Games, at {{p_cup}} per hour for {{seats_cup}} seats in 2026. Entry rules change per cup. Every cup has its own eligibility rules, so check the in-game compete tab before booking.',
        'Pick the seats you actually need, because every seat is priced separately. For example, a duo short one player for a trio sets Squad Fill to one seat instead of three. First, agree the drop and the rotation plan. Second, agree who carries the mats and who takes the first fight. Finally, keep comms on one call using Discord so the endgame calls reach everybody. Bundles still apply, so 3 hours get {{pct3}} off and 5 get {{pct5}} off.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro hours in Europe',
      paragraphs: [
        'For example, here is a real booking, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} controller player in Europe books 3 Duo Pro hours. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one hour. The order chat opens straight after payment, and the first message names the region, the rank and the input: Europe, {{rank_duo2}}, controller, looking for a partner who calls rotations early.',
        'The evening then runs on a short plan. First, both players agree a drop spot and a rotation route. Second, voice goes on using Discord and the invite goes out with the Epic name. Third, after each game you agree one adjustment, such as leaving the zone edge ten seconds earlier. We found the rank spread by running the price tool from Duoly for every tier, so a {{rank_duo2_low}} player pays {{p_duo2_low}} per hour. Five hours take {{pct5}} off.',
      ],
    },
    {
      heading: 'When is Fortnite coaching the better booking?',
      paragraphs: [
        'Fortnite coaching is the better booking when the goal is a repeatable fix rather than company for the next hour. A duo teammate answers a quick question between games. A coach drills one skill in Creative and leaves you with homework. Build and Edit Course costs {{p_build}} per hour in 2026. Finally, coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'For example, a player who loses every box fight gains more from one Creative hour than from another Ranked game. Finally, a player who only wants fun gains more from Reload at {{p_zb}} per hour. Play and Learn is one live Ranked hour with an Unreal coach at {{p_learn}}. The full service list, preparation tips and lesson formats live on the [Fortnite coaching page](/games/fortnite/coaching), and screen share runs using Discord.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Fortnite sessions?',
    items: [
      [
        'Is Duoly a free Fortnite teammate finder?',
        'Duoly is a paid marketplace with reviewed players. For example, Discord LFG channels and the in-game friend list from Epic Games stay the free routes to a squad.',
      ],
      [
        'How much does a Fortnite duo cost?',
        'Duo Pro is {{p_duo2}} per hour at {{rank_duo2}}, from {{p_duo2_low}} at the lowest rank. Zero Build and Reload each cost {{p_zb}} per hour.',
      ],
      [
        'Why per hour instead of per match?',
        'A battle royale match has no fixed length, so an hour prices the real session honestly in 2026. First, 3 hours get {{pct3}} off, and 5 hours get {{pct5}} off.',
      ],
      [
        'Can we play Zero Build only?',
        'Yes. Zero Build is its own service at {{p_zb}} per hour, and Duo Pro also covers Zero Build if you want an Unreal partner.',
      ],
      [
        'Can a teammate join a Cash Cup with me?',
        'Yes. Tournament Teammate is built for cups and FNCS qualifiers, and the eligibility rules from Epic Games still apply to both accounts.',
      ],
      [
        'Where do I book a Fortnite coach?',
        'On the Fortnite coaching page, with the Build and Edit Course by the hour and one live Ranked hour in Play and Learn, using Discord screen share.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to drop into Fortnite?',
    text: 'Duo Pro is the Ranked Duos session with an Unreal teammate from Duoly. For example, 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off in 2026. Five hours get {{pct5}} off. Finally, pick your rank and input, then meet your teammate using Discord.',
  },
};
