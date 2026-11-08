import type { HubPageCopy } from '../hub-pages';

export const callOfDuty: HubPageCopy = {
  gameSlug: 'call-of-duty',
  title: 'Call of Duty Duos, Warzone Squads and Coaching | Duoly',
  description:
    'Book a Call of Duty duo, a Warzone squad fill or a coach on Duoly, {{from_lower}}. Compare Ranked Play, Resurgence and Zombies hour prices.',
  eyebrow: 'Call of Duty teammates',
  h1: 'Book a Call of Duty duo, a Warzone squad or a coach',
  lead: 'Free LFG Discords work for a casual lobby. Duoly books a reviewed Crimson or Iridescent teammate by the hour, fills a quad and sells loadout coaching when you want to learn.',
  cta: 'Book a Call of Duty teammate',
  facts: [
    'Crimson+ to Iridescent teammates',
    'Warzone, Ranked Play and Resurgence',
    'Priced per hour, your own account',
  ],
  related: ['fortnite', 'apex-legends', 'counter-strike-2', 'arc-raiders'],
  intent:
    'Just after a squad for tonight, free or paid? The dedicated page sets the free Discords next to Warzone and Ranked Play sessions you can book.',
  format: {
    heading: 'What can you book for Call of Duty on Duoly?',
    text: 'Duoly sells Call of Duty by the hour, because a Warzone match has no fixed length. One booked hour buys a reviewed higher-rank player in your squad on your own account: Duo Plus covers multiplayer Ranked Play with a Crimson+ teammate, Duo Pro covers Warzone duos at a flat {{p_duo2}} per hour, and Warzone Ranked brings an Iridescent player. Ranked Play follows your own rank, from {{p_duo1_low}} to {{p_duo1_high}} per hour on Duo Plus, while Party Modes stays {{p_party}} and Zombies Run {{p_zombies}}. Bundles cut the total, {{pct3}} off 3 hours up to {{pct10}} off 10. Quad fills cover Warzone and Ranked Play. Activision keeps Crimson and above inside one skill division when they party, so share your rank in the order chat first.',
  },
  services: {
    duo1: 'An hour of multiplayer Ranked Play with a Crimson player who holds lanes and plays the objective.',
    duo2: 'An hour of Warzone duos with a player who knows loadouts, rotations and when to fight.',
    duo3: 'An hour of Warzone Ranked with an Iridescent player, for when placement points count.',
    rebirth:
      'Fast Resurgence games on the small island, where respawns keep the action going.',
    zombies:
      'Round-based Zombies with someone who knows the map, the wonder weapon and the steps.',
    party:
      'Unranked multiplayer and party playlists together, with nothing at stake.',
    gg1v1:
      'A private-match gunfight against a verified Gamer Girl, rematches encouraged.',
    ggbuddy:
      'A patient Gamer Girl plays Zombies, party modes or Resurgence and explains the basics.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and keeps the mood up after a loss.',
    quads:
      'Bring a friend or two and we fill your Warzone quad with players who play for the win.',
    mp4: 'Fill your multiplayer Ranked Play team with players who know the maps and the spawns.',
    learn:
      'One live hour of Warzone with an Iridescent coach explaining every decision out loud.',
    loadout:
      'One hour on builds that suit your play, plus slide cancels, mantles and positioning.',
  },
  intros: {
    teammate:
      'Teammate prices are per hour, because a Warzone match can end in four minutes or run twenty. Ranked Play sessions read your own skill division, so a Top 250 lobby costs more than a Gold one, while Warzone Duo, Rebirth Duo, Zombies and Party Games hold one price for everybody. Bundles are the only other discount, {{pct3}} off 3 hours and {{pct5}} off 5.',
    team: 'Team fills are priced per seat, so a card covers the default {{seats_quads}} seats and falls when your party already has bodies. Warzone Quads is a flat hourly price for the big lobby, while the Ranked Play fill reads your own skill division because the party restrictions bite hardest there. Both take {{pct3}} off 3 hours and {{pct5}} off 5.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount, so the {{pct3}} and {{pct5}} savings on teammate hours do not apply. Loadout and Movement covers guns, attachments, slide cancels and the rotations that keep you off the open ground, and Play and Learn is the live option where the coach calls a real Warzone hour as it happens. Screen share runs on Discord.',
  },
  steps: {
    heading: 'How does booking a Call of Duty duo work?',
    items: [
      'Pick a service and the number of hours. Duo Pro is the Warzone tier at a flat {{p_duo2}} per hour, and 3 hours cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five hours take {{pct5}} off.',
      'Add your area, rank, platform and language at checkout. Name Europe, {{rank_duo1}} and controller or keyboard, so your teammate reads the real request before accepting the order.',
      'Meet your teammate in the order chat, agree a drop and check the party limits if you are booking a Ranked tier, then add each other with your Activision ID. A Warzone Ranked hour costs {{p_duo3}} at {{rank_duo3}}.',
    ],
    note: 'Duoly reviews every Call of Duty teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Call of Duty session fits you?',
    intro:
      'The right Call of Duty session is the one matching your goal for the hour, so pick the goal first and let the price follow. Warzone duos stay flat at every rank, while the Ranked tiers are priced by your own rank and have party limits to check. Bundles take {{pct3}} off 3 hours and {{pct5}} off 5.',
    picks: [
      {
        goal: 'Dropping into Warzone?',
        service: 'duo2',
        answer:
          'Duo Pro adds a Crimson+ teammate at a flat {{p_duo2}} per hour, loadouts and rotations included.',
      },
      {
        goal: 'Climbing multiplayer Ranked Play?',
        service: 'duo1',
        answer:
          'Duo Plus adds a Crimson player from {{p_duo1_low}} per hour, priced by your own rank.',
      },
      {
        goal: 'Chasing placement points?',
        service: 'duo3',
        answer:
          'Warzone Ranked adds an Iridescent player, {{p_duo3}} per hour at {{rank_duo3}}.',
      },
      {
        goal: 'Just want a laugh?',
        service: 'zombies',
        answer:
          'Zombies Run costs {{p_zombies}} per hour with someone who knows the Easter egg steps.',
      },
      {
        goal: 'Loadouts never feel right?',
        service: 'loadout',
        answer:
          'Loadouts and Movement is one hour with an Iridescent coach for {{p_loadout}}.',
      },
    ],
  },
  sections: [
    {
      heading: 'Warzone or multiplayer: which duo should you book?',
      paragraphs: [
        'Warzone and multiplayer need different teammates, so Duoly prices the two separately. Duo Pro is the Warzone tier at a flat {{p_duo2}} per hour, with a player who knows the current loot pool, the gulag and when a rotation beats a fight. Duo Plus is the multiplayer Ranked Play tier, priced by your own rank: {{p_duo1}} per hour at {{rank_duo1}} and {{p_duo1_high}} at {{rank_duo1_high}}.',
        'Ranked Play is also where the party rules bite. Activision keeps Crimson, Iridescent and Top 250 players inside one skill division of whoever they queue with, so a {{rank_duo1}} account pairs with a Crimson teammate and stops short of Iridescent. Unranked Warzone and the party playlists carry no such limit, which is why the flat-price services are the easy ones to book. Resurgence sits between the two: Rebirth Duo costs {{p_rebirth}} per hour on the small island, where respawns keep a session moving and a wipe is rarely the end.',
      ],
    },
    {
      heading: 'How do quad and Ranked Play fills work?',
      paragraphs: [
        'A fill is one order that hires several players at once, so a duo becomes a full squad. Warzone Quad Fill covers up to {{seats_quads}} seats at {{p_quads}} per hour with Crimson+ players who play for the win. Ranked 4-Stack fills your multiplayer team with players who know the maps and the spawns, at {{p_mp4}} per hour at {{rank_mp4}}. Every seat is priced separately, so set the seats to the gaps you actually have: a trio short one player books one seat instead of three.',
        'Agree the drop and the rotation plan before the lobby loads, then agree who buys back whom, because a wasted trip to a buy station loses the circle. Keep everybody on one call so the endgame reads reach the whole squad rather than the one person who spotted the rotation. Bundles still apply, so 3 hours get {{pct3}} off and 5 get {{pct5}} off the total.',
      ],
    },
    {
      heading: 'Example evening: three Warzone duo hours',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A player in Europe books 3 Duo Pro hours of Warzone. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one hour. Unranked Warzone has no party rank limits, which is why this is the straightforward booking. The order chat opens straight after payment, and the first message names the area, the platform and the goal: Europe, controller, looking for a partner who calls rotations and plays the edge of the circle.',
        'From there the evening runs on a short plan. You agree a landing spot and a contract route, voice goes on, and the invite goes out with the Activision ID. After each game you pick one adjustment, such as buying back earlier instead of saving for a loadout. An hour usually covers two Warzone games plus the gulag time between them, and 5 hours take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Call of Duty coaching the better booking?',
      paragraphs: [
        'Call of Duty coaching is the better booking when the goal is a repeatable fix rather than company for the next hour. A duo teammate answers a quick question between games; a coach watches an hour of your play, names the pattern and leaves you with homework. Loadouts and Movement costs {{p_loadout}} per hour, and coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'A player who always loses the first gunfight gains more from one movement lesson than from another Warzone drop. A player who only wants fun gains more from Party Modes at {{p_party}} per hour. Play and Learn is one live Warzone hour with an Iridescent coach at {{p_learn}}. Call of Duty has no separate Duoly coaching page yet, so every lesson is booked from the prices above, with screen share on Discord.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Call of Duty sessions?',
    items: [
      [
        'Is Duoly a free Call of Duty teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game friend list from Activision stay the free routes to a squad.',
      ],
      [
        'How much does a Warzone duo cost?',
        'Duo Pro is a flat {{p_duo2}} per hour at every rank. Warzone Ranked is {{p_duo3}} per hour at {{rank_duo3}}, because placement points need a stronger player.',
      ],
      [
        'Why per hour instead of per match?',
        'A Warzone match has no fixed length, so an hour prices the real session honestly. Three hours get {{pct3}} off and 5 hours get {{pct5}} off.',
      ],
      [
        'Can every rank party in Ranked Play?',
        'No. Activision keeps Crimson, Iridescent and Top 250 players within one skill division of their party, so check both ranks in the order chat. Unranked Warzone and party playlists have no such limit.',
      ],
      [
        'Do you play on my account?',
        'No. You play on your own account and add each other with your Activision ID. Never send login details to anyone, including a teammate or a coach.',
      ],
      [
        'Can a fill cover fewer than three seats?',
        'Yes. Set the seats to what you actually need, and agree roles on Discord first. Warzone Quad Fill opens at {{seats_quads}} seats and goes down to one.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to drop into Warzone?',
    text: 'Duo Pro is the Warzone tier with a Crimson+ teammate at a flat {{p_duo2}} per hour from Duoly, and 3 hours cost {{p_duo2_x3}} with {{pct3}} off. Zombies Run stays {{p_zombies}} per hour. Agree your drop on Discord, then add each other in game.',
  },
};
