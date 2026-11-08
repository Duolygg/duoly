import type { HubPageCopy } from '../hub-pages';

export const callOfDuty: HubPageCopy = {
  gameSlug: 'call-of-duty',
  title: 'Call of Duty LFG: Find a Warzone Duo | Duoly',
  description:
    'Book a Call of Duty duo, a Warzone quad fill or a coach on Duoly, {{from_lower}}. Compare Ranked Play, Resurgence and Zombies hour prices.',
  eyebrow: 'Call of Duty teammates',
  h1: 'Call of Duty LFG: find a Warzone duo tonight',
  lead: 'Free LFG Discords work for a casual lobby. Duoly books a reviewed Crimson or Iridescent teammate by the hour, fills a quad and sells loadout coaching when you want to learn.',
  cta: 'Book a Call of Duty teammate',
  facts: [
    'Crimson+ to Iridescent teammates',
    'Warzone, Ranked Play and Resurgence',
    'Priced per hour, your own account',
  ],
  related: ['fortnite', 'apex-legends', 'counter-strike-2', 'arc-raiders'],
  format: {
    heading: 'What can you book for Call of Duty on Duoly?',
    text: 'A Duoly Call of Duty booking is a paid hour where reviewed higher-rank players queue with you on your own account. Call of Duty sells by the hour, because a Warzone match has no fixed length. Duo Plus covers multiplayer Ranked Play with a Crimson+ teammate, Duo Pro covers Warzone duos and Warzone Ranked brings an Iridescent player. A {{rank_duo1}} player pays {{p_duo1}} per hour for Duo Plus in November 2026, while Duo Pro keeps one flat price of {{p_duo2}}. For example, Party Modes costs {{p_party}} per hour and Zombies Run costs {{p_zombies}}. Bundles cut the total: 3 hours get {{pct3}} off, 5 get {{pct5}} off and 10 get {{pct10}} off. Quad fills cover Warzone and Ranked Play, and the skill-based matchmaking from Activision still decides your lobbies. Finally, every booking opens an order chat, where you agree drops and voice using Discord.',
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
      'One teammate joins your games on your own account, from Warzone and Ranked Play to Zombies.',
    team: 'Quad and team fills add several Crimson+ players at once, priced for the seats you need.',
    coaching:
      'Both lessons run for one hour, one live in Warzone and one on loadouts and movement.',
  },
  steps: {
    heading: 'How does booking a Call of Duty duo work?',
    items: [
      'First, pick a service and the number of hours. Duo Pro is the Warzone option at a flat {{p_duo2}} per hour, and 3 hours cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five hours get {{pct5}} off.',
      'Second, add your area, rank, platform and language at checkout. For example, name Europe, {{rank_duo1}} and controller or keyboard, so your teammate reads the real request before accepting the order.',
      'Third, meet your teammate in the order chat, agree a drop and voice using Discord, then add each other with your Activision ID. A single Warzone Ranked hour costs {{p_duo3}} at {{rank_duo3}} in 2026. Ten hours get {{pct10}} off.',
    ],
    note: 'Duoly reviews every Call of Duty teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Call of Duty session fits you?',
    intro:
      'The right Call of Duty session is the one matching your goal for the hour. For example, a Warzone duo costs {{p_duo2}} per hour at every rank in 2026. Pick the goal first, because the matchmaking from Activision decides the rest. Voice runs using Discord, and {{pct5}} off applies to 5 hours.',
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
        'Warzone and multiplayer need different teammates, so Duoly prices the two separately. Duo Pro is the Warzone service at a flat {{p_duo2}} per hour, with a player who knows the current loot pool, the gulag and when a rotation beats a fight. Duo Plus is the multiplayer Ranked Play service, priced by your own rank, so a {{rank_duo1}} player pays {{p_duo1}} per hour and a {{rank_duo1_high}} player pays {{p_duo1_high}} in 2026.',
        'Resurgence sits between the two. Rebirth Duo costs {{p_rebirth}} per hour on the small island, where respawns keep a session moving and a wipe is rarely the end. For example, a player with one free hour gains more from Resurgence than from a full Warzone game. First, agree the landing spot. Second, agree who takes the loadout drop. Finally, keep comms short using Discord, because a late call is worse than no call. Bundles take {{pct3}} off 3 hours and {{pct5}} off 5.',
      ],
    },
    {
      heading: 'How do quad and Ranked Play fills work?',
      paragraphs: [
        'A fill is a single order hiring several players at once, so a duo becomes a full squad. Warzone Quad Fill covers up to {{seats_quads}} seats at {{p_quads}} per hour with Crimson+ players who play for the win. Ranked 4-Stack fills your multiplayer team with players who know the maps and the spawns, at {{p_mp4}} per hour at {{rank_mp4}} in 2026, and the lobby rules from Activision still apply. Every seat is priced separately, so set the seats to the gaps you actually have.',
        'For example, a trio short one player sets Warzone Quad Fill to one seat instead of three. First, agree the drop and the rotation plan before the lobby loads. Second, agree who buys back whom, because a wasted buy station trip loses the circle. Finally, keep everybody on one call using Discord so the endgame calls reach the whole squad. Bundles still apply, so 3 hours get {{pct3}} off and 5 get {{pct5}} off.',
      ],
    },
    {
      heading: 'Example evening: three Warzone duo hours',
      paragraphs: [
        'For example, here is a real booking, priced with the Duoly checkout calculator on {{checked}}. A player in Europe books 3 Duo Pro hours of Warzone. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one hour. The order chat opens straight after payment, and the first message from Duoly names the area, the platform and the goal: Europe, controller, looking for a partner who calls rotations and plays the edge of the circle.',
        'The evening then runs on a short plan. First, both players agree a landing spot and a contract route. Second, voice goes on using Discord and the invite goes out with the Activision ID. Third, after each game you agree one adjustment, such as buying back earlier. We found the rank spread by running the same calculator for Ranked Play, so a {{rank_duo1_low}} player pays {{p_duo1_low}} per hour for Duo Plus. Five hours take {{pct5}} off.',
      ],
    },
    {
      heading: 'When is Call of Duty coaching the better booking?',
      paragraphs: [
        'Call of Duty coaching is the better booking when the goal is a repeatable fix rather than company for the next hour. A duo teammate answers a quick question between games. A coach watches one hour of your play, names the pattern and leaves you with homework. Loadouts and Movement costs {{p_loadout}} per hour in 2026. Finally, coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'For example, a player who always loses the first gunfight gains more from one movement lesson than from another Warzone drop. A player who only wants fun gains more from Party Modes at {{p_party}} per hour. Play and Learn is one live Warzone hour with an Iridescent coach at {{p_learn}}. Call of Duty has no separate Duoly coaching page yet, so every lesson is booked from the prices above, with screen share using Discord.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Call of Duty sessions?',
    items: [
      [
        'Is Duoly a free Call of Duty teammate finder?',
        'Duoly is a paid marketplace with reviewed players. For example, Discord LFG channels and the in-game friend list from Activision stay the free routes to a squad.',
      ],
      [
        'How much does a Warzone duo cost?',
        'Duo Pro is a flat {{p_duo2}} per hour at every rank. Warzone Ranked is {{p_duo3}} per hour at {{rank_duo3}}, because placement points need a stronger player.',
      ],
      [
        'Why per hour instead of per match?',
        'A Warzone match has no fixed length, so an hour prices the real session honestly in 2026. First, 3 hours get {{pct3}} off, and 5 hours get {{pct5}} off.',
      ],
      [
        'Can we play Zombies or party modes?',
        'Yes. Zombies Run costs {{p_zombies}} per hour and Party Modes costs {{p_party}}, both with nothing at stake and no rank picker.',
      ],
      [
        'Do you play on my account?',
        'No. You play on your own account and add each other with your Activision ID. Never send login details to anyone, including a teammate or a coach.',
      ],
      [
        'Can a fill cover fewer than three seats?',
        'Yes. Set the seats to what you actually need, using Discord to agree roles first. Warzone Quad Fill opens at {{seats_quads}} seats and goes down to one.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to drop into Warzone?',
    text: 'Duo Pro is the Warzone session with a Crimson+ teammate at a flat {{p_duo2}} per hour from Duoly. For example, 3 hours cost {{p_duo2_x3}} with {{pct3}} off in 2026. Five hours get {{pct5}} off. Finally, agree your drop using Discord.',
  },
};
