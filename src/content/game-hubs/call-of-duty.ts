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
  related: ['pubg', 'apex-legends', 'fortnite', 'valorant', 'counter-strike-2'],
  intent:
    'Just after a squad for tonight, free or paid? The dedicated page sets the free Discords next to Warzone and Ranked Play sessions you can book.',
  format: {
    heading: 'What can you book for Call of Duty on Duoly?',
    text: 'A Call of Duty booking on Duoly is an hour of play, because a Warzone match has no fixed length. First, Duo Plus covers multiplayer Ranked Play with a Crimson+ teammate, Duo Pro covers Warzone duos at {{p_duo2}} per hour at {{rank_duo2}}, and Warzone Ranked brings an Iridescent player. All 3 duo tiers follow your own rank, from {{p_duo1_low}} to {{p_duo1_high}} per hour on Duo Plus. Party Modes stays {{p_party}} and Zombies Run {{p_zombies}} at every rank. Bundles cut the total, {{pct3}} off 3 hours up to {{pct10}} off 10. Second, the fills: Warzone Quad Fill hires Crimson+ players for {{seats_quads}} seats at {{p_quads}} per hour, and Ranked 4-Stack covers multiplayer at {{p_mp4}}. Third, the lessons, from {{p_loadout}} per hour on loadouts and movement. For example, share your rank using Discord first.',
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
      'Teammate prices are per hour, because a Warzone match can end in four minutes or run twenty. Ranked Play reads your own skill division: Duo Plus costs {{p_duo1_low}} per hour at {{rank_duo1_low}} and {{p_duo1_high}} at {{rank_duo1_high}}. Warzone Duo, Rebirth Duo, Zombies and Party Games hold one price for everybody. First, pick the mode, because the mode decides whether the rank list on a card matters. Second, read the teammate tier beside the price: Duo Plus names a Crimson+ multiplayer player, Duo Pro a Crimson+ Warzone player and Warzone Ranked an Iridescent player at {{p_duo3}} per hour. Bundles take {{pct3}} off 3 hours and {{pct5}} off 5. For example, agree the drop using Discord before hour 1.',
    team: 'A Call of Duty fill is one order that hires several players at once, so a duo becomes a full squad. Warzone Quad Fill covers up to {{seats_quads}} seats at {{p_quads}} per hour, and Ranked 4-Stack fills your multiplayer team at {{p_mp4}}. A four-player Ranked Play party may mix any ranks only while every player sits at Diamond or below, a rule from Activision read in November 2026. Above that a Crimson or Iridescent player is capped at a party of 2, so the bigger lobby does not widen the gap at the top. First, count the seats you actually need, because every seat is priced on its own. Bundles take {{pct3}} off 3 hours and {{pct5}} off 5. For example, a trio short one player books 1 seat rather than 3, agreed using Discord.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount at all, so the {{pct3}} and {{pct5}} savings on teammate hours stop here. Loadouts and Movement costs {{p_loadout}} per hour, covering guns, attachments, slide cancels and the rotations that keep you off open ground. Play and Learn is the live option where an Iridescent coach calls one real Warzone hour at {{p_learn}}. First, pick the problem rather than the format. For example, a player who always loses the first gunfight books the movement hour instead of a fourth drop. Screen share runs using Discord, and no lesson from Duoly promises a rank.',
  },
  steps: {
    heading: 'How does booking a Call of Duty duo work?',
    items: [
      'Pick a service and the number of hours first. Duo Pro is the Warzone tier at {{p_duo2}} per hour at {{rank_duo2}}, and 3 hours cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five hours take {{pct5}} off.',
      'Second, add your area, rank, platform and language at checkout. For example, name Europe, {{rank_duo1}} and controller or keyboard, so your teammate reads the real request before accepting.',
      'Finally, meet your teammate in the order chat using Discord. Agree a drop and a loadout plan, then add each other with your Activision ID. One Warzone Ranked hour costs {{p_duo3}}.',
    ],
    note: 'Duoly reviews every Call of Duty teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Call of Duty session fits you?',
    intro:
      'The right Call of Duty session is the one matching your goal for the hour. First, the party playlists and Zombies stay flat at every rank, {{p_party}} and {{p_zombies}} per hour. All 3 duo tiers are priced by your own rank, from {{p_duo1_low}} on Duo Plus, and a fill is priced per seat instead. For example, 3 hours take {{pct3}} off and 5 hours take {{pct5}} off, so a bundle beats booking 1. Voice runs using Discord.',
    picks: [
      {
        goal: 'Dropping into Warzone?',
        service: 'duo2',
        answer:
          'Duo Pro adds a Crimson+ teammate from {{p_duo2_low}} per hour, loadouts and rotations included.',
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
        'Warzone and multiplayer need different teammates, so Duoly prices the two separately. Duo Pro is the Warzone tier at {{p_duo2}} per hour at {{rank_duo2}}, with a player who knows the current loot pool, the gulag and when a rotation beats a fight. Duo Plus is the multiplayer Ranked Play tier, priced by your own rank: {{p_duo1}} per hour at {{rank_duo1}} and {{p_duo1_high}} at {{rank_duo1_high}}. First, pick the mode, because the two teammates train very different habits.',
        'Warzone Ranked is the third duo tier at {{p_duo3}} per hour at {{rank_duo3}}, with an Iridescent player for the nights when placement points decide the session. Zombies Run at {{p_zombies}} per hour is the co-op shape instead, with a partner who knows the map and the wonder weapon steps. For example, Rebirth Duo costs {{p_rebirth}} per hour on the small island, where respawns keep a session moving and a wipe is rarely the end. Bundles take {{pct3}} off 3 hours and {{pct5}} off 5, agreed using Discord.',
      ],
    },
    {
      heading: 'What does a Call of Duty squad fill include?',
      paragraphs: [
        'A Call of Duty squad fill is one order that hires several Crimson+ players at once. First, Warzone Quad Fill covers {{seats_quads}} seats at {{p_quads}} per hour, so a solo or a duo drops as a full quad with one loadout plan. Second, Ranked 4-Stack is the multiplayer version at {{p_mp4}} per hour, for a 4v4 night on Hardpoint and Search. For example, a duo short two players books 2 seats rather than 3, because each seat is priced on its own.',
        'Both fills start the same way. Pick the service, pick the seat count, pay once, then meet the squad in the order chat. Name your platform, your input and the drop you like, so nobody lands on the far side of the map. Voice runs using Discord or the in-game party, invites go out with your Activision ID, and nobody needs your login. Bundles still take {{pct3}} off 3 hours and {{pct5}} off 5, read from Duoly checkout in 2026.',
      ],
    },
    {
      heading: 'Example evening: three Warzone duo hours',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A player in Europe books 3 Duo Pro hours of Warzone. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one hour. A Warzone duo is 2 of the 4 seats, so the other 2 come from your friends or from Squad Fill in the lobby. The order chat opens straight after payment, and the first message names the area, the platform and the goal: Europe, controller, looking for a partner who calls rotations and plays the edge of the circle.',
        'From there the evening runs on a short plan. You agree a landing spot and a contract route, voice goes on, and the invite goes out with the Activision ID. After each game you pick one adjustment, for example buying back earlier instead of saving for a loadout, agreed using Discord. An hour usually covers 2 Warzone games plus the gulag time between them, and 5 hours take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Call of Duty coaching the better booking?',
      paragraphs: [
        'Call of Duty coaching is the better booking when the goal is a repeatable fix rather than company for the next hour. A duo teammate answers a quick question between games. A coach watches an hour of your play, names the pattern and leaves you with homework. Loadouts and Movement costs {{p_loadout}} per hour, and coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate hours only.',
        'First, name the pattern you keep repeating. For example, a player who always loses the first gunfight gains more from one movement lesson at {{p_loadout}} than from a fourth Warzone drop. A player who only wants fun gains more from Party Modes at {{p_party}} per hour in 2026. Play and Learn is one live Warzone hour with an Iridescent coach at {{p_learn}}, and screen share runs using Discord. Call of Duty has no separate Duoly coaching page yet, so every lesson is booked from the prices above. The [Call of Duty LFG page](/games/call-of-duty/lfg) sets the free Discords beside the paid hours, and [Fortnite teammates](/games/fortnite) and [Apex Legends teammates](/games/apex-legends) cover the other battle royales.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Call of Duty sessions?',
    items: [
      [
        'Is Duoly a free Call of Duty teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game friend list from Activision are the free routes, so try those first.',
      ],
      [
        'How much does a Warzone duo cost?',
        'Duo Pro is {{p_duo2}} per hour at {{rank_duo2}}, and {{p_duo2_low}} at the lowest rank. Warzone Ranked is {{p_duo3}} per hour at {{rank_duo3}} in 2026, because placement points need a stronger player.',
      ],
      [
        'How do I book a full Call of Duty quad?',
        'Warzone Quad Fill hires Crimson+ players for {{seats_quads}} seats at {{p_quads}} per hour, and Ranked 4-Stack is the multiplayer version at {{p_mp4}}.',
      ],
      [
        'Why per hour instead of per match?',
        'A Warzone match has no fixed length, so an hour prices the real session honestly. Three hours get {{pct3}} off and 5 hours get {{pct5}} off.',
      ],
      [
        'Do you play on my account?',
        'No: you play on your own account and add each other with your Activision ID, for example before the first drop. Never send login details to anyone.',
      ],
      [
        'Can a fill cover fewer than three seats?',
        'Yes: set the seats to what you actually need, and agree roles using Discord first. Warzone Quad Fill opens at {{seats_quads}} seats and goes down to one.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to drop into Warzone?',
    text: 'Duo Pro is the Warzone tier with a Crimson+ teammate from Duoly, {{p_duo2}} per hour at {{rank_duo2}}. Three hours cost {{p_duo2_x3}} with {{pct3}} off, and 5 hours take {{pct5}} off. Zombies Run stays {{p_zombies}} per hour, and Party Modes costs {{p_party}}. Warzone Quad Fill hires Crimson+ players for {{seats_quads}} seats at {{p_quads}} per hour when you want the whole squad in 2026. For example, agree your drop using Discord, then add each other in game.',
  },
};
