import type { HubPageCopy } from '../hub-pages';

export const apexLegends: HubPageCopy = {
  gameSlug: 'apex-legends',
  title: 'Apex Legends Duos, Trios and Coaching | Duoly',
  description:
    'Book an Apex Legends duo, a full trio or a coach on Duoly, {{from_lower}}. Compare Ranked, Duos, Trios, Mixtape and movement lesson prices.',
  eyebrow: 'Apex Legends teammates',
  h1: 'Book an Apex Legends duo, a trio or a coach',
  lead: 'Free LFG Discords work for a casual squad. Duoly books a reviewed Diamond, Master or Apex Predator teammate by the hour, fills your trio and sells a movement course when you want to learn.',
  cta: 'Book an Apex teammate',
  facts: [
    'Diamond+ to Apex Predator teammates',
    'Ranked, Duos playlist and Mixtape',
    'Priced per hour, your own account',
  ],
  related: [
    'fortnite',
    'rocket-league',
    'ea-sports-fc-27',
    'pubg',
    'call-of-duty',
  ],
  intent:
    'Want the squad-finding page rather than every Apex service? It sets the free Discords and in-game tools next to the paid Ranked sessions.',
  format: {
    heading: 'What can you book for Apex Legends on Duoly?',
    text: 'An Apex Legends booking on Duoly is an hour of play, because a battle royale match has no fixed length. First, the tiers are Duo Plus with a Diamond+ teammate and Duo Pro with a Master or Apex Predator who reads the ring. Ranked prices follow your own rank, from {{p_duo2_low}} to {{p_duo2_high}} per hour on Duo Pro. Mixtape keeps one flat price of {{p_mix}} per hour at every rank, and the Duos playlist costs {{p_duos}}. Bundles cut the total, {{pct3}} off 3 hours up to {{pct10}} off 10. Second, the fill: Full Trio hires {{seats_trio}} Master+ players from {{p_trio_low}} per hour, so a solo queue becomes a real trio on one order. Third, the lessons, from {{p_move}} per hour in the Firing Range. For example, share your area and rank in the order chat using Discord first.',
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
      'Teammate prices are per hour, because an Apex match can end on the first ring or run to the last squad. Ranked sessions read your own rank: Duo Pro costs {{p_duo2_low}} per hour at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. The Duos playlist, Mixtape and Pubs hold one price for everybody. First, pick the mode, because the mode decides whether the rank list on a card matters. Second, read the teammate tier beside the price: Duo Plus names a Diamond+ player and Duo Pro a Master or Apex Predator at {{p_duo2}} per hour. The Duos playlist is the two-player format at {{p_duos}}, where nobody fills a third seat. Bundles take {{pct3}} off 3 hours and {{pct5}} off 5. For example, agree the drop spot using Discord before hour 1.',
    team: 'Full Trio is one order that hires two players at once, so a solo queue becomes a real trio from {{p_trio_low}} for {{seats_trio}} seats. First, decide whether you want one teammate or two, because a Ranked trio is 3 players and the Duos playlist is 2. Full Trio reads your own rank like the Ranked duos do, from {{p_trio_low}} per hour. Second, agree the legend classes, since a trio wants scan, cover and damage covered rather than three Skirmishers. Bundles still take {{pct3}} off 3 hours and {{pct5}} off 5. For example, a solo player books both seats and keeps their own legend.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount at all, so the {{pct3}} and {{pct5}} savings on teammate hours stop here. The Movement Course costs {{p_move}} per hour in the Firing Range, drilling tap strafes, zip rotations and wall bounces. Play and Learn is the live option where a Master coach talks through one real Ranked hour at {{p_learn}}. First, pick the problem rather than the format. For example, a player who cannot escape a bad fight books the Movement Course instead of a fourth Ranked hour. Screen share runs using Discord, and no lesson from Duoly promises a rank.',
  },
  steps: {
    heading: 'How does booking an Apex Legends duo work?',
    items: [
      'Pick a service and the number of hours first. Duo Pro is the Ranked tier with a Master or Predator teammate, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five hours take {{pct5}} off.',
      'Second, add your area, rank, platform and language at checkout. For example, name Europe, {{rank_duo2}} and your legend pool, so your teammate reads the real request before accepting.',
      'Finally, meet your teammate in the order chat using Discord. Agree a drop spot and a backup, then invite each other with your EA ID. One Duo Pro hour costs {{p_duo2}} at {{rank_duo2}}.',
    ],
    note: 'Duoly reviews every Apex teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Apex Legends session fits you?',
    intro:
      'The right Apex session is the one matching your goal for the hour. First, the casual playlists stay flat at every rank: Mixtape is {{p_mix}} per hour and Pubs and Legend Practice {{p_pubs}}. Ranked is priced by your own rank, from {{p_duo2_low}} per hour on Duo Pro, and Full Trio is priced per seat instead. For example, 3 hours take {{pct3}} off and 5 hours take {{pct5}} off, so a bundle beats booking 1. Voice runs using Discord.',
    picks: [
      {
        goal: 'Climbing Ranked this split?',
        service: 'duo2',
        answer:
          'Duo Pro adds a Master or Predator teammate from {{p_duo2_low}} per hour, priced by your own rank.',
      },
      {
        goal: 'Tired of a third random?',
        service: 'duos',
        answer:
          'The Duos playlist costs {{p_duos}} per hour for the two of you, with quicker games.',
      },
      {
        goal: 'Learning a new legend?',
        service: 'pubs',
        answer:
          'Pubs and Legend Practice is unranked battle royale at {{p_pubs}} per hour, with cover.',
      },
      {
        goal: 'Want a full trio?',
        service: 'trio',
        answer:
          'Full Trio hires {{seats_trio}} Master+ players from {{p_trio_low}} per hour, so a solo queue becomes a trio.',
      },
      {
        goal: 'Movement holding you back?',
        service: 'move',
        answer:
          'The Movement Course is one Firing Range hour with a Master coach for {{p_move}}.',
      },
    ],
  },
  sections: [
    {
      heading: 'Who is the teammate you queue with?',
      paragraphs: [
        'The teammate you queue with is a reviewed Apex player who applied for the game and showed a rank before taking orders. Duo Plus names a Diamond+ player from {{p_duo1_low}} per hour and Duo Pro a Master or Apex Predator at {{p_duo2}}, which is the top tier Duoly sells for the game. Orders are not auto-assigned: a teammate picks yours up from the queue, so the person who accepts chose your request. Nobody from Duoly ever logs into your account.',
        'What the rank buys is a squad that moves together. A Master teammate calls the drop and the first rotation instead of chasing a fight across two zones. Voice runs using Discord, so a knocked call lands before the push rather than after the trade. Rank also sets the price: Duo Pro costs {{p_duo2_low}} per hour at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. Bundles cut that total by {{pct3}} on 3 hours and {{pct5}} on 5. For example, you keep your legend and your account in all 3 hours.',
      ],
    },
    {
      heading: 'What does a Full Trio booking include in Apex?',
      paragraphs: [
        'Full Trio is one order that hires two Master+ players at once, so a solo queue becomes a real trio from {{p_trio_low}} per hour for {{seats_trio}} seats. First, Apex Ranked plays in squads of 3, so two hired seats is the whole rest of your squad. Second, agree the legend classes, because a trio wants scan, ground control and damage rather than three of the same. For example, a Recon main books both seats and asks for a Controller and a Support legend.',
        'The Duos playlist is the other shape at {{p_duos}} per hour, with 2-player squads, shorter games and nobody filling a third seat. Full Trio reads your own rank like the Ranked duos do, from {{p_trio_low}} per hour. Voice runs using Discord, invites go out with your EA ID, and nobody needs your login. Bundles still take {{pct3}} off 3 hours and {{pct5}} off 5, read from Duoly checkout in 2026.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro hours in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} player in Europe books 3 Duo Pro hours of Ranked with a Master teammate. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one hour. The order chat opens straight after payment, and the first message names the area, the rank and the legend pool: Europe, {{rank_duo2}}, Bloodhound or Bangalore, looking for a partner who scans before the push.',
        'From there the evening runs on a short plan. You agree a drop spot and a backup, voice goes on, and the invite goes out with the EA ID. After each game you pick one adjustment, for example rotating a zone earlier instead of holding the edge, agreed using Discord. An hour usually covers 2 or 3 Ranked games at that rank, and 5 hours take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Apex coaching the better booking?',
      paragraphs: [
        'Apex coaching is the better booking when the goal is a repeatable fix rather than company for the next hour. A duo teammate answers a quick question between games. A coach drills one skill in the Firing Range and leaves you with homework. The Movement Course costs {{p_move}} per hour, and coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate hours only.',
        'First, name the fight you keep losing. For example, a player who cannot escape a bad fight gains more from one movement hour at {{p_move}} than from a fourth Ranked game. A player who wants a relaxed evening gains more from Mixtape at {{p_mix}} per hour in 2026. Play and Learn is one live Ranked hour with a Master coach at {{p_learn}}, and screen share runs using Discord. The full service list, preparation tips and lesson formats live on the [Apex Legends coaching page](/games/apex-legends/coaching). The [Apex Legends LFG page](/games/apex-legends/lfg) sets the free Discords beside the paid hours, and [Fortnite teammates](/games/fortnite) and [PUBG teammates](/games/pubg) cover the other two battle royales Duoly sells.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Apex Legends sessions?',
    items: [
      [
        'Is Duoly a free Apex Legends teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game social features from Respawn Entertainment are the free routes, so try those first.',
      ],
      [
        'How much does an Apex duo cost?',
        'Duo Pro is {{p_duo2}} per hour at {{rank_duo2}}, and {{p_duo2_low}} at the lowest rank. Ten hours cost {{p_duo2_x10}} with {{pct10}} off in 2026.',
      ],
      [
        'How do I book a full Apex Legends trio?',
        'Full Trio hires {{seats_trio}} Master+ players from {{p_trio_low}} per hour, so a solo queue becomes a real trio on one order and one order chat.',
      ],
      [
        'Why per hour instead of per match?',
        'A battle royale match has no fixed length, so an hour prices the real session honestly. One booked hour usually covers several Ranked games with the same teammate.',
      ],
      [
        'Can we play the Duos playlist instead of trios?',
        'Yes: the Duos playlist is its own service at {{p_duos}} per hour, with shorter games and more fights for each booked hour, agreed using Discord.',
      ],
      [
        'Where do I book an Apex Legends coach?',
        'The Apex Legends coaching page sells the Firing Range Movement Course by the hour, plus one live Ranked hour in Play and Learn. Coaching gets no bundle discount.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to drop into Apex Legends?',
    text: 'Duo Pro is the Ranked tier with a Master or Predator teammate from Duoly. Three hours at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off, and 5 hours take {{pct5}} off. Mixtape stays {{p_mix}} per hour at any rank, and Pubs costs {{p_pubs}}. Full Trio hires {{seats_trio}} Master+ players from {{p_trio_low}} per hour when you want the whole squad in 2026. For example, agree your drop using Discord, then invite each other in game.',
  },
};
