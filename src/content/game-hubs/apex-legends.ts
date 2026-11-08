import type { HubPageCopy } from '../hub-pages';

export const apexLegends: HubPageCopy = {
  gameSlug: 'apex-legends',
  title: 'Apex Legends LFG: Find Ranked Teammates | Duoly',
  description:
    'Book an Apex Legends duo, a full trio or a coach on Duoly, {{from_lower}}. Compare Ranked, the Duos playlist, Mixtape and movement lesson prices.',
  eyebrow: 'Apex Legends teammates',
  h1: 'Apex Legends LFG: find Ranked teammates tonight',
  lead: 'Free LFG Discords work for a casual squad. Duoly books a reviewed Diamond, Master or Predator teammate by the hour, fills your trio and sells a movement course when you want to learn.',
  cta: 'Book an Apex teammate',
  facts: [
    'Diamond+ to Apex Predator teammates',
    'Ranked, Duos playlist and Mixtape',
    'Priced per hour, your own account',
  ],
  related: ['overwatch-2', 'fortnite', 'call-of-duty'],
  format: {
    heading: 'What can you book for Apex Legends on Duoly?',
    text: 'A Duoly Apex Legends booking is a paid hour where reviewed higher-rank players queue with you on your own account. Apex sells by the hour, because a battle royale match has no fixed length. Duo Plus brings a Diamond+ teammate to Ranked and Duo Pro a Master or Apex Predator who reads the ring and picks the right fights. Prices follow your own rank, so a {{rank_duo2}} player pays {{p_duo2}} per hour for Duo Pro in November 2026. For example, Mixtape costs {{p_mix}} per hour at every rank, because casual playlists keep one flat price. Bundles cut the total: 3 hours get {{pct3}} off, 5 get {{pct5}} off and 10 get {{pct10}} off. Full Trio hires two players at once, and the ranked rules from Respawn Entertainment still apply to your lobby. Finally, every booking opens an order chat, where you agree legends, drops and voice using Discord.',
  },
  services: {
    duo1: 'An hour of Ranked with a Diamond player who calls drops, rotations and fights clearly.',
    duo2: 'An hour of Ranked with a Master or Predator who reads the ring and times every push.',
    duos: 'The Duos playlist: just the two of you, more fights and quicker games.',
    mix: 'An hour of Team Deathmatch, Control and Gun Run to warm up or learn a legend.',
    pubs: 'An hour of unranked battle royale to try a legend or weapon with cover.',
    gg1v1:
      'A Firing Range 1v1 against a verified Gamer Girl, rematches encouraged.',
    ggbuddy:
      'A patient Gamer Girl plays Mixtape or pubs with you and explains the basics as you go.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and keeps the mood up after a loss.',
    trio: 'Two high-rank players fill your trio. You play your legend, they handle the rest.',
    learn:
      'One live hour of Ranked with a Master coach explaining every decision out loud.',
    move: 'One hour of tap strafes, slide jumps, wall bounces and positioning in the Firing Range.',
  },
  intros: {
    teammate:
      'One teammate joins your games on your own account, from Ranked to the Duos playlist and Mixtape.',
    team: 'Full Trio hires two high-rank players on one order, so the listed price covers both seats.',
    coaching:
      'Both lessons run for one hour, one live in Ranked and one in the Firing Range.',
  },
  steps: {
    heading: 'How does booking an Apex Legends duo work?',
    items: [
      'First, pick a service and the number of hours. Duo Pro is the Ranked option with a Master or Predator teammate, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five hours get {{pct5}} off.',
      'Second, add your area, rank, platform and language at checkout. For example, name Europe, {{rank_duo2}} and your legend pool, so your teammate reads the real request from Duoly before accepting the order.',
      'Third, meet your teammate in the order chat, agree a drop spot and voice using Discord, then invite each other with your EA ID. A single Duo Pro hour costs {{p_duo2}} at the same rank in 2026. Ten hours get {{pct10}} off.',
    ],
    note: 'Duoly reviews every Apex teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Apex Legends session fits you?',
    intro:
      'The right Apex session is the one matching your goal for the hour. For example, a {{rank_duo2}} player climbing Ranked pays {{p_duo2}} per hour for Duo Pro in 2026, with {{pct3}} off 3 hours and {{pct5}} off 5. Voice runs using Discord in every session booked from Duoly.',
    picks: [
      {
        goal: 'Climbing Ranked this split?',
        service: 'duo2',
        answer:
          'Duo Pro adds a Master or Predator teammate from {{p_duo2_low}} per hour, priced by your own rank and ready to shotcall.',
      },
      {
        goal: 'Tired of a third random?',
        service: 'duos',
        answer:
          'The Duos playlist costs {{p_duos}} per hour for the two of you, with more fights and much quicker games.',
      },
      {
        goal: 'Learning a new legend?',
        service: 'pubs',
        answer:
          'Pubs and Legend Practice is unranked battle royale with cover, so a new legend costs nothing in points.',
      },
      {
        goal: 'Want a full trio?',
        service: 'trio',
        answer:
          'Full Trio hires {{seats_trio}} high-rank players on one order, and the listed price covers both seats.',
      },
      {
        goal: 'Movement holding you back?',
        service: 'move',
        answer:
          'The Movement Course is one Firing Range hour with a Master coach, drilling tap strafes and slide jumps.',
      },
    ],
  },
  sections: [
    {
      heading: 'Who is the teammate you queue with?',
      paragraphs: [
        'A Duoly Apex teammate is a reviewed player who applied for the game and showed a rank before taking orders. Duo Plus names a Diamond+ player and Duo Pro a Master or Apex Predator. The tier describes the teammate, never your own lobby. Ranked rules from Respawn Entertainment still decide the entry cost and the split reset, so share your area and rank in the order chat first. For example, a {{rank_duo2}} player pays {{p_duo2}} per hour in 2026.',
        'What the rank buys you is a squad that moves together. First, a Master teammate calls the drop and the first rotation instead of chasing a fight across two zones. Second, voice runs using Discord, so a knocked call lands before the push. {{rank_duo2_high}} players pay {{p_duo2_high}} per hour, because higher lobbies need stronger teammates, and bundles take {{pct3}} off 3 hours or {{pct5}} off 5. You keep your legend and your account.',
      ],
    },
    {
      heading: 'Should you book Ranked, Duos or Mixtape?',
      paragraphs: [
        'Ranked is the mode where an hour of calm rotations is worth paying for, so Duo Plus and Duo Pro are priced by your own rank. The Duos playlist is the two-player mode at a flat {{p_duos}} per hour, with shorter games and more fights per hour. Mixtape is the fast playlist of Team Deathmatch, Control and Gun Run at {{p_mix}} per hour in 2026. Mixtape suits a warm-up or a first look at a legend.',
        'Pick by how much time you have. For example, a player with one free hour gains more from Mixtape or Duos than from a Ranked session that ends in two games. First, agree the legend pair, because a recon and a controller legend want different fights. Second, agree who takes the first engage. Finally, keep comms short using Discord, since a late call costs the fight. Bundles still apply, so 3 hours get {{pct3}} off and 5 get {{pct5}} off.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro hours in Europe',
      paragraphs: [
        'For example, here is a real booking, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} player in Europe books 3 Duo Pro hours of Ranked. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one hour. The order chat opens straight after payment, and the first message names the area, the rank and the legend pool: Europe, {{rank_duo2}}, Bloodhound or Bangalore, looking for a partner who scans before the push.',
        'The evening then runs on a short plan. First, both players agree a drop spot and a backup. Second, voice goes on using Discord and the invite goes out with the EA ID. Third, after each game you agree one adjustment, such as rotating a zone earlier. We found the rank spread by running the price tool from Duoly for every tier, so a {{rank_duo2_low}} player pays {{p_duo2_low}} per hour in 2026. Five hours take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Apex coaching the better booking?',
      paragraphs: [
        'Apex coaching is the better booking when the goal is a repeatable fix rather than company for the next hour. A duo teammate answers a quick question between games. A coach drills one skill in the Firing Range and leaves you with homework. The Movement Course costs {{p_move}} per hour in 2026. Finally, coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'For example, a player who cannot escape a bad fight gains more from one movement hour than from another Ranked game. Finally, a player who wants a relaxed evening gains more from Mixtape at {{p_mix}} per hour. Play and Learn is one live Ranked hour with a Master coach at {{p_learn}}. The full service list, preparation tips and lesson formats live on the [Apex Legends coaching page](/games/apex-legends/coaching), and screen share runs using Discord.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Apex Legends sessions?',
    items: [
      [
        'Is Duoly a free Apex Legends teammate finder?',
        'Duoly is a paid marketplace with reviewed players. For example, Discord LFG channels and the in-game social features from Respawn Entertainment stay the free routes to a squad.',
      ],
      [
        'How much does an Apex duo cost?',
        'Duo Pro is {{p_duo2}} per hour at {{rank_duo2}} in 2026. First, bundles take {{pct3}} off 3 hours, and 10 hours cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Why per hour instead of per match?',
        'A battle royale match has no fixed length, so an hour prices the real session honestly. One booked hour usually covers several Ranked games with the same teammate.',
      ],
      [
        'Can we play the Duos playlist instead of trios?',
        'Yes. The Duos playlist is its own service at a flat price, with just the two of you, shorter games and more fights for each booked hour.',
      ],
      [
        'Does Full Trio fill both empty seats?',
        'Yes. Full Trio hires {{seats_trio}} high-rank players on a single order, and the listed price covers the whole group rather than one seat.',
      ],
      [
        'Where do I book an Apex Legends coach?',
        'On the Apex Legends coaching page, with the Firing Range Movement Course by the hour and one live Ranked hour in Play and Learn, using Discord screen share.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to drop into Apex Legends?',
    text: 'Duo Pro is the Ranked session with a Master or Predator teammate from Duoly. For example, 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off in 2026. Five hours get {{pct5}} off. Finally, agree your drop using Discord and invite each other from Respawn’s in-game menu.',
  },
};
