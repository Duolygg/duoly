import type { HubPageCopy } from '../hub-pages';

export const worldOfWarcraft: HubPageCopy = {
  gameSlug: 'world-of-warcraft',
  title: 'WoW Mythic+ and Arena Teammates | Duoly',
  description:
    'Book a World of Warcraft teammate for Mythic+ keys, rated arena or class coaching on Duoly, {{from_lower}}. Compare key and arena prices.',
  eyebrow: 'World of Warcraft teammates',
  h1: 'World of Warcraft teammates for Mythic+ and arena',
  lead: 'Group finder and guild Discords work for a regular key group. Duoly books a reviewed 2,500+ or 3,000+ rated player for your next keys, a Duelist+ partner for rated arena, and class coaching by the hour.',
  cta: 'Book a WoW teammate',
  facts: [
    '2,500+ and 3,000+ rated Mythic+ players',
    'Mythic+, rated arena, Delves and leveling',
    'Voice on Discord, your own account',
  ],
  related: [
    'pokemon-unite',
    'teamfight-tactics',
    'league-of-legends',
    'arc-raiders',
    'minecraft',
  ],
  intent:
    'After the LFG page rather than every WoW service? It compares Mythic+ keys, rated arena and Delves, with a route and interrupt checklist.',
  format: {
    heading: 'What can you book for World of Warcraft on Duoly?',
    text: 'Duoly sells three things for World of Warcraft: one teammate who joins your group on your own account, group fills for Mythic+ keys and 3v3 arena, and class coaching. Everything is booked by the hour, because a key or an arena session has no fixed length. Mythic+ Duo brings a 2,500+ rated player, Mythic+ Pro a 3,000+ rated player who plans the route, and Arena 2v2 a Duelist+ partner. Mythic+ follows your own rating, from {{p_duo2_low}} to {{p_duo2_high}} per hour on Mythic+ Pro, while Delves and leveling stay {{p_delves}} and {{p_level}} per hour for everybody. The fills: Key Group Fill covers up to {{seats_keys}} seats from {{p_keys_low}} per hour and Arena 3v3 Team covers {{seats_arena3}} at {{p_arena3}}. Class and Rotation Coaching is one hour at {{p_class}}. Bundles of {{main}} take {{bundles}}. Name your region and role using Discord first.',
  },
  services: {
    duo1: 'Mythic+ keys with a 2,500+ rated player who knows the routes and kicks.',
    duo2: 'High keys with a 3,000+ rated player who plans every pull and calls defensives.',
    arena:
      'Rated 2v2 with a Duelist+ partner who calls swaps, crowd control and cooldowns.',
    delves:
      'Delves, world quests and weekly chores together, done fast and with company.',
    level: 'Level a new character with someone who knows the fastest routes.',
    gg1v1:
      'A classic duel against a verified Gamer Girl outside the city gates.',
    ggbuddy:
      'A patient Gamer Girl plays with you and explains the basics as you go.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and cheers every timed key.',
    keys: 'Fill your Mythic+ group with 2,500+ rated players on the roles you miss.',
    arena3:
      'One or two Duelist+ players join you for rated 3v3 with a plan per comp.',
    learn:
      'One hour of live Mythic+ with a 3,000+ coach explaining every pull out loud.',
    class:
      'One hour on your class and spec: talents, rotation, cooldowns and positioning.',
  },
  intros: {
    teammate:
      'Teammate prices are per hour, and the rated tiers read your own Mythic+ or arena rating, so a 3,500+ rating costs more than a rating under 1,500. Delves, leveling and the Gamer Girl sessions hold one price for everybody, because no rating is on the line. One teammate joins your group on your own account and plays the role you ask for. Only {{main}} is sold in bundles, {{bundles}}, and every other service books {{picker}}. Pick the format, because only the rated cards carry a rating list. Read the tier beside the price: Mythic+ Duo is a 2,500+ rated player, Mythic+ Pro a 3,000+ rated one and Arena 2v2 a Duelist+ partner from {{p_arena_low}} per hour. Name tank, healer or damage in the order chat using Discord.',
    team: 'Key Group Fill and Arena 3v3 Team are priced per seat, so each card covers the seats your group is missing: up to {{seats_keys}} for a key from {{p_keys_low}} per hour and {{seats_arena3}} for 3v3 at {{p_arena3}}. Count the seats you actually need, because a group short one healer books 1 rather than 4. Name the roles, because a key without a tank does not start. Both read your rating like the duo tiers do, from {{p_keys_low}} per hour, and 5 hours take {{pick5}} off. For example, a pair pushing keys books 3 seats using Discord.',
    coaching:
      'Lessons are priced by the hour and get no quantity or bundle discount, so the {{pct3}} to {{pct10}} bundle savings on teammate sessions do not apply. Class and Rotation Coaching costs {{p_class}} per hour with a Gladiator or 3,000+ coach and covers talents, rotation, cooldowns and positioning. Play and Learn spends the hour in a real key at {{p_learn}} instead of on a target dummy. Pick the problem rather than the format. For example, a player who keeps depleting the same dungeon books the class hour at {{p_class}} instead of three more keys. Screen share runs using Discord, the coach never logs into your account, and no lesson from Duoly promises a rating.',
  },
  steps: {
    heading: 'How does booking a WoW teammate work?',
    items: [
      'Pick a service and the number of hours. Mythic+ Pro is the high key tier with a 3,000+ rated teammate, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five hours take {{pct5}} off.',
      'Add your region, rating, role and language at checkout. For example, a healer in Europe at {{rank_duo2}} can ask for a tank who plans the route, then agree which dungeon to run in the order chat.',
      'Meet your teammate in the order chat using Discord. Add each other by BattleTag and agree the keys you want to run. A single hour of Mythic+ Pro costs {{p_duo2}} at the same rating, and Delves stay {{p_delves}}.',
    ],
    note: 'Duoly reviews every World of Warcraft teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which World of Warcraft session fits you?',
    intro:
      'Mythic+ Pro is the key-running option, Arena 2v2 pairs you for rated PvP, and Class and Rotation Coaching works on your own play. Delves and leveling keep one price at every rating, while Mythic+ and rated arena follow your own rating. For example, a player at {{rank_duo2}} who wants three hours of keys can book a Mythic+ Pro bundle at {{p_duo2_x3}}, with {{pct3}} off. A player who wants to understand their rotation can choose Class and Rotation Coaching at {{p_class}} per hour instead. Agree the dungeon, roles and route using Discord before starting.',
    picks: [
      {
        goal: 'Pushing your Mythic+ rating?',
        service: 'duo2',
        answer:
          'Mythic+ Pro adds a 3,000+ rated teammate from {{p_duo2_low}} per hour, priced by your own rating.',
      },
      {
        goal: 'Short on players for your key?',
        service: 'keys',
        answer:
          'Key Group Fill covers up to {{seats_keys}} seats with 2,500+ rated players on the roles you need.',
      },
      {
        goal: 'Climbing rated 2v2?',
        service: 'arena',
        answer:
          'Arena 2v2 brings a Duelist+ partner, {{p_arena}} per hour at {{rank_arena}}.',
      },
      {
        goal: 'Just want good company this week?',
        service: 'delves',
        answer:
          'Delves and World Content costs {{p_delves}} per hour, with no rating on the line.',
      },
      {
        goal: 'Unsure your rotation is right?',
        service: 'class',
        answer:
          'Class and Rotation Coaching is one hour with a Gladiator or 3,000+ coach, at {{p_class}}.',
      },
    ],
  },
  sections: [
    {
      heading: 'Who is the teammate you play with?',
      paragraphs: [
        'The teammate you play with is a reviewed World of Warcraft player who applied for the game and showed a Mythic+ or arena rating before taking orders. The tiers: Mythic+ Duo names a 2,500+ rated player, Mythic+ Pro a 3,000+ rated player from {{p_duo2_low}} per hour and Arena 2v2 a Duelist+ partner. Orders are not auto-assigned, because a teammate picks yours up from the queue, so the person who accepts chose your request. Pick your region at checkout: Europe, Americas and Oceania, Korea or Taiwan.',
        'What the rating buys you is a timed key. A 3,000+ teammate knows the route, which pulls to chain, who kicks which cast and when to press a defensive. Voice runs using Discord, so the call lands before the wipe. Your rating also sets the price: Mythic+ Pro runs {{p_duo2_low}} per hour at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}, because harder keys need stronger players. Bundles of {{main}} cut that total: {{bundles}}. You keep your account, your loot and your Great Vault across all 3 hours.',
      ],
    },
    {
      heading: 'How do Mythic+ and arena group fills work?',
      paragraphs: [
        'Key Group Fill is one order that hires several players at once, so your key finally has a full five. It covers up to {{seats_keys}} seats with 2,500+ rated players at {{p_keys}} per hour at {{rank_keys}}, and every seat is priced separately, so a group short one healer books 1 seat. Name the roles you are missing, because a key without a tank does not start. For example, a duo pushing keys books 3 seats and keeps its own healer.',
        'Arena 3v3 Team works the same way for rated 3v3: one or two Duelist+ players join you, at {{p_arena3}} per hour for {{seats_arena3}} seats at {{rank_arena3}}. Agree the comp and the kill target before you queue, and keep everybody on one call using Discord. Nobody ever needs your Battle.net login. Bundles of {{main}} still apply, {{bundles}}, read from Duoly checkout in 2026.',
      ],
    },
    {
      heading: 'Example week: three hours of Mythic+ Pro in Europe',
      paragraphs: [
        'Here is an example week, priced with the Duoly checkout calculator on {{checked}}. A healer at {{rank_duo2}} in Europe books 3 hours of Mythic+ Pro with a 3,000+ rated teammate. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one hour. The order chat opens straight after payment, and the first message names the region, the rating and the role: Europe, {{rank_duo2}}, Restoration Druid, looking to time higher keys.',
        'From there the week runs on a short plan. You agree the dungeons and key levels, voice goes on, and your teammate joins your group by BattleTag. After each key you pick one change, for example saving a cooldown for the second boss instead of the first pack, agreed using Discord. Five hours take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is WoW coaching the better booking?',
      paragraphs: [
        'World of Warcraft coaching is the better booking when your own numbers are the problem rather than your group. Class and Rotation Coaching is one hour with a Gladiator or 3,000+ coach on talents, rotation, cooldowns and positioning, at {{p_class}} per hour, checked on a target dummy and in a real key. Play and Learn spends the hour inside live Mythic+ with a 3,000+ coach at {{p_learn}}. Coaching carries no quantity or bundle discount, so the {{pct3}} to {{pct10}} bundle savings apply to teammate hours only.',
        'For example, a player who keeps depleting the same dungeon gains more from one coaching hour at {{p_class}} than from three more keys. A player who wants a relaxed evening gains more from Delves and World Content at {{p_delves}} per hour, where no rating is on the line. Screen share runs using Discord, and the coach never logs into your account. Duoly reviews every World of Warcraft coach before any order goes live. The nearest neighbours here are [Overwatch 2 teammates](/games/overwatch-2), from the same publisher, and [Dota 2 teammates](/games/dota-2) for another objective-driven five.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about WoW sessions?',
    items: [
      [
        'Is Duoly a free WoW group finder?',
        'No: Duoly is a paid marketplace with reviewed players, so the Group Finder, your guild and community Discords stay the free routes to a key group.',
      ],
      [
        'How much does a Mythic+ teammate cost?',
        'Mythic+ Pro is {{p_duo2}} per hour at {{rank_duo2}}, from {{p_duo2_low}} at the lowest rating. Bundles of {{main}} take {{bundles}}, so 10 hours cost {{p_duo2_x10}}.',
      ],
      [
        'Does my teammate need to be in my region?',
        'Yes: groups only form inside one region, so you pick Europe, Americas and Oceania, Korea or Taiwan at checkout and your teammate plays on a character there.',
      ],
      [
        'Does my teammate log into my account?',
        'No: your teammate plays their own character in your group while you play yours, so nobody asks for your Battle.net login and the loot you win stays yours.',
      ],
      [
        'Is this retail World of Warcraft?',
        'Yes: every service here is for retail World of Warcraft on the current expansion, so ask in the order chat before booking if you play another version.',
      ],
      [
        'Does a teammate booking fill my whole group?',
        'No: a duo adds one teammate and the other seats come from your friends or the Group Finder, so book Key Group Fill at {{p_keys}} per hour when you want several at once.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next key?',
    text: 'Mythic+ Pro brings a 3,000+ rated teammate from Duoly, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off. Five hours take {{pct5}} off and 10 hours take {{pct10}} off. Delves stay {{p_delves}} per hour for everybody, and a Leveling Buddy costs {{p_level}}. Key Group Fill hires 2,500+ rated players for up to {{seats_keys}} seats from {{p_keys_low}} per hour when your key needs a full five in 2026. Pick your rating and role, then agree the keys in the order chat using Discord.',
  },
};
