import type { HubPageCopy } from '../hub-pages';

export const apexLegends: HubPageCopy = {
  gameSlug: 'apex-legends',
  title: 'Apex Legends Duos, Trios and Coaching | Duoly',
  description:
    'Book an Apex Legends duo, a full trio or a coach on Duoly, {{from_lower}}. Compare Ranked, Duos, Trios, Mixtape and movement lesson prices.',
  eyebrow: 'Apex Legends teammates',
  h1: 'Book an Apex Legends duo, a trio or a coach',
  lead: 'Free LFG Discords work for a casual squad. Duoly books a reviewed Diamond, Master or Predator teammate by the hour, fills your trio and sells a movement course when you want to learn.',
  cta: 'Book an Apex teammate',
  facts: [
    'Diamond+ to Apex Predator teammates',
    'Ranked, Duos playlist and Mixtape',
    'Priced per hour, your own account',
  ],
  related: ['overwatch-2', 'fortnite', 'call-of-duty'],
  intent:
    'Want the squad-finding page rather than the whole catalog? It sets the free Discords and in-game tools next to the paid Ranked sessions.',
  format: {
    heading: 'What can you book for Apex Legends on Duoly?',
    text: 'Duoly sells Apex Legends by the hour, because a battle royale match has no fixed length. One booked hour buys a reviewed higher-rank player in your squad on your own account: Duo Plus names a Diamond+ teammate for Ranked and Duo Pro a Master or Apex Predator who reads the ring and picks the right fights. Ranked follows your own rank, from {{p_duo2_low}} to {{p_duo2_high}} per hour on Duo Pro, while Mixtape keeps one flat price of {{p_mix}} per hour at every rank. Bundles cut the total, {{pct3}} off 3 hours up to {{pct10}} off 10. Full Trio hires two players on one order. Respawn Entertainment caps a premade Ranked squad at two ranks apart, so share your area and rank in the order chat before you queue.',
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
      'Teammate prices are per hour, because an Apex match can end on the first ring or go to the last squad. Ranked sessions read your own rank, so an Apex Predator lobby costs more than a Rookie one, while the Duos playlist, Mixtape and Pubs hold one price for everybody. Bundles are the only other discount, {{pct3}} off 3 hours and {{pct5}} off 5.',
    team: 'Full Trio is priced per seat, so the card covers {{seats_trio}} players and the two of them turn a solo queue into a real trio. It reads your own rank like the Ranked duos do, because Respawn Entertainment keeps a premade squad inside two ranks and a trio has to clear that too. Bundles take {{pct3}} off 3 hours and {{pct5}} off 5.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount, so the {{pct3}} and {{pct5}} savings on teammate hours stop here. Movement and Positioning drills tap strafes, zip rotations and wall bounces in the Firing Range, and Play and Learn is the live option where a Master coach talks through a real Ranked hour. Screen share runs on Discord.',
  },
  steps: {
    heading: 'How does booking an Apex Legends duo work?',
    items: [
      'Pick a service and the number of hours. Duo Pro is the Ranked tier with a Master or Predator teammate, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five hours take {{pct5}} off.',
      'Add your area, rank, platform and language at checkout. Name Europe, {{rank_duo2}} and your legend pool, so your teammate reads the real request before accepting the order.',
      'Meet your teammate in the order chat, agree a drop spot and check you are inside the two-rank squad limit, then invite each other with your EA ID. A single Duo Pro hour costs {{p_duo2}} at the same rank.',
    ],
    note: 'Duoly reviews every Apex teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Apex Legends session fits you?',
    intro:
      'The right Apex session is the one matching your goal for the hour, so pick the goal first and let the price follow. Ranked is priced by your own rank, from {{p_duo2_low}} per hour on Duo Pro, with {{pct3}} off 3 hours and {{pct5}} off 5. Casual playlists stay flat at every rank.',
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
        'Every Duoly Apex teammate applied for the game and showed a rank before taking orders. Duo Plus names a Diamond+ player and Duo Pro a Master or Apex Predator. The tier describes the teammate you are hiring and nothing about your own lobby, because Respawn Entertainment requires everybody in a premade Ranked squad to be within two ranks of each other. A {{rank_duo2}} player and a Master teammate sit exactly on that limit, while Apex Predator sits one rank beyond it, so agree the pairing in the order chat before the first queue.',
        'What the rank actually buys you is a squad that moves together. A Master teammate calls the drop and the first rotation instead of chasing a fight across two zones. Voice runs on Discord, so a knocked call lands before the push rather than after the trade. Rank also sets the price: Duo Pro runs {{p_duo2_low}} per hour at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}, because higher lobbies need stronger teammates. You keep your legend and your account.',
      ],
    },
    {
      heading: 'Should you book Ranked, Duos or Mixtape?',
      paragraphs: [
        'Ranked is the mode where an hour of calm rotations is worth paying for, so Duo Plus and Duo Pro are priced by your own rank. The Duos playlist is the two-player mode at a flat {{p_duos}} per hour, with shorter games and more fights per hour. Mixtape is the fast playlist of Team Deathmatch, Control and Gun Run at {{p_mix}} per hour, which suits a warm-up or a first look at a legend.',
        'Pick by how much time you have: one free hour gains more from Mixtape or Duos than from a Ranked session that ends after two games. Agree the legend pair before you drop, because a recon and a controller legend want very different fights, then agree who takes the first engage. Keep comms short on Discord, since a late call costs the fight. Bundles still apply, so 3 hours get {{pct3}} off and 5 get {{pct5}} off.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro hours in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} player in Europe books 3 Duo Pro hours of Ranked with a Master teammate, which is the two-rank gap Respawn Entertainment allows in a premade squad. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one hour. The order chat opens straight after payment, and the first message names the area, the rank and the legend pool: Europe, {{rank_duo2}}, Bloodhound or Bangalore, looking for a partner who scans before the push.',
        'From there the evening runs on a short plan. You agree a drop spot and a backup, voice goes on, and the invite goes out with the EA ID. After each game you pick one adjustment, such as rotating a zone earlier instead of holding the edge. An hour usually covers two or three Ranked games at that rank, and 5 hours take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Apex coaching the better booking?',
      paragraphs: [
        'Apex coaching is the better booking when the goal is a repeatable fix rather than company for the next hour. A duo teammate answers a quick question between games; a coach drills one skill in the Firing Range and leaves you with homework. The Movement Course costs {{p_move}} per hour, and coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'A player who cannot escape a bad fight gains more from one movement hour than from another Ranked game. A player who wants a relaxed evening gains more from Mixtape at {{p_mix}} per hour. Play and Learn is one live Ranked hour with a Master coach at {{p_learn}}. The full service list, preparation tips and lesson formats live on the [Apex Legends coaching page](/games/apex-legends/coaching), and screen share runs on Discord.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Apex Legends sessions?',
    items: [
      [
        'Is Duoly a free Apex Legends teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game social features from Respawn Entertainment stay the free routes to a squad.',
      ],
      [
        'How much does an Apex duo cost?',
        'Duo Pro is {{p_duo2}} per hour at {{rank_duo2}}, from {{p_duo2_low}} at the lowest rank. Bundles take {{pct3}} off 3 hours, and 10 hours cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Why per hour instead of per match?',
        'A battle royale match has no fixed length, so an hour prices the real session honestly. One booked hour usually covers several Ranked games with the same teammate.',
      ],
      [
        'Can every rank queue Ranked together?',
        'No. Respawn Entertainment keeps a premade Ranked squad within two ranks, so {{rank_duo2}} works with a Master teammate and stops short of Apex Predator. Casual playlists carry no such limit.',
      ],
      [
        'Can we play the Duos playlist instead of trios?',
        'Yes. The Duos playlist is its own service at a flat price, with just the two of you, shorter games and more fights for each booked hour.',
      ],
      [
        'Where do I book an Apex Legends coach?',
        'On the Apex Legends coaching page, with the Firing Range Movement Course by the hour and one live Ranked hour in Play and Learn, with screen share on Discord.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to drop into Apex Legends?',
    text: 'Duo Pro is the Ranked tier with a Master or Predator teammate from Duoly, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off. Mixtape stays {{p_mix}} per hour at any rank. Agree your drop on Discord, then invite each other in game.',
  },
};
