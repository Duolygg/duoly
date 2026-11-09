import type { HubPageCopy } from '../hub-pages';

export const worldOfWarcraft: HubPageCopy = {
  gameSlug: 'world-of-warcraft',
  title: 'WoW Mythic+ and Arena Teammates | Duoly',
  description:
    'Book a World of Warcraft teammate for Mythic+ keys, rated arena or class coaching on Duoly, {{from_lower}}. Compare key and arena prices.',
  eyebrow: 'World of Warcraft teammates',
  h1: 'World of Warcraft teammates for Mythic+ and arena',
  lead: 'Group finder and guild Discords work for a regular key group. Duoly books a reviewed 2,500+ or 3,000+ rated player for your next keys, a Duelist partner for rated arena, and class coaching by the hour.',
  cta: 'Book a WoW teammate',
  facts: [
    '2,500+ and 3,000+ rated Mythic+ players',
    'Mythic+, rated arena, Delves and leveling',
    'Voice on Discord, your own account',
  ],
  related: ['overwatch-2', 'dota-2', 'minecraft'],
  format: {
    heading: 'What can you book for World of Warcraft on Duoly?',
    text: 'Duoly sells three things for World of Warcraft: one teammate who joins your group on your own account, group fills for Mythic+ keys and 3v3 arena, and class coaching. Everything is booked by the hour, because a key or an arena session has no fixed length. Mythic+ Duo brings a 2,500+ rated player, Mythic+ Pro a 3,000+ rated player who plans the route, and Arena 2v2 a Duelist partner. Mythic+ follows your own rating, from {{p_duo2_low}} to {{p_duo2_high}} per hour on Mythic+ Pro, while Delves and leveling stay {{p_delves}} per hour for everybody. Bundles take {{pct3}} off 3 hours up to {{pct10}} off 10.',
  },
  services: {
    duo1: 'Mythic+ keys with a 2,500+ rated player who knows the routes and kicks.',
    duo2: 'High keys with a 3,000+ rated player who plans every pull and calls defensives.',
    arena:
      'Rated 2v2 with a Duelist partner who calls swaps, crowd control and cooldowns.',
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
      'One or two Duelist players join you for rated 3v3 with a plan per comp.',
    learn:
      'One hour of live Mythic+ with a 3,000+ coach explaining every pull out loud.',
    class:
      'One hour on your class and spec: talents, rotation, cooldowns and positioning.',
  },
  intros: {
    teammate:
      'Teammate prices are per hour, and the rated tiers read your own Mythic+ or arena rating, so a 3,500+ key costs more than an easy one. Delves and leveling hold one price for everybody, because no rating is on the line. One teammate joins your group on your own account and plays the role you ask for, and bundles take {{pct3}} off 3 hours or {{pct5}} off 5. A tier name says who Duoly hires, never who may group with you: the rated-group rules come from Blizzard, so the teammate has to be eligible to queue with you under the rules of the game. Check the group in the client before the first key.',
    team: 'Key Group Fill and Arena 3v3 Team are priced per seat, so each card covers the seats your group is missing: up to {{seats_keys}} for a key and {{seats_arena3}} for 3v3. Both read your rating like the duo tiers, and bundles take {{pct3}} off 3 hours.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount, so the {{pct3}} and {{pct5}} savings on teammate sessions do not apply. Class and Rotation Coaching runs on Discord with screen share, and Play and Learn spends the hour in a real key.',
  },
  steps: {
    heading: 'How does booking a WoW teammate work?',
    items: [
      'Pick a service and the number of hours. Mythic+ Pro is the high key tier with a 3,000+ rated teammate, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five hours take {{pct5}} off.',
      'Add your region, rating, role and language at checkout. Name Europe, {{rank_duo2}} and Healer, so your teammate reads the real request before accepting the order.',
      'Meet your teammate in the order chat, add each other by BattleTag and agree the keys you want to run. A single hour of Mythic+ Pro costs {{p_duo2}} at the same rating.',
    ],
    note: 'Duoly reviews every World of Warcraft teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which World of Warcraft session fits you?',
    intro:
      'The right WoW session is the one that matches your goal for the week, so pick the goal first and let the price follow. Mythic+ and arena are priced by your own rating, from {{p_duo2_low}} per hour on Mythic+ Pro, with {{pct3}} off 3 hours and {{pct5}} off 5. Delves and leveling carry no rating.',
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
          'Arena 2v2 brings a Duelist partner, {{p_arena}} per hour at {{rank_arena}}.',
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
        'Every Duoly World of Warcraft teammate applied for the game and showed a Mythic+ or arena rating before taking orders. Mythic+ Duo names a 2,500+ rated player, Mythic+ Pro a 3,000+ rated player and Arena 2v2 a Duelist. Your teammate plays on their own character in your region, so pick the region your account lives in at checkout: Europe, Americas and Oceania, Korea or Taiwan.',
        'What the rating buys you is a timed key. A 3,000+ teammate knows the route, which pulls to chain, who kicks which cast and when to press a defensive. Voice runs on Discord, so the call lands before the wipe. Your rating also sets the price: Mythic+ Pro runs {{p_duo2_low}} per hour at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}, because harder keys need stronger players. You keep your account, your loot and your Great Vault.',
      ],
    },
    {
      heading: 'How do Mythic+ and arena group fills work?',
      paragraphs: [
        'Key Group Fill is one order that hires several players at once, so your key finally has a full five. It covers up to {{seats_keys}} seats with 2,500+ rated players at {{p_keys}} per hour at {{rank_keys}}, and every seat is priced separately, so a group short one healer books one seat. Name the roles you are missing, because a key without a tank does not start.',
        'Arena 3v3 Team works the same way for rated 3v3: one or two Duelist players join you, {{p_arena3}} per hour for two seats at {{rank_arena3}}. Agree the comp and the kill target before you queue, and keep everybody on one Discord call. Bundles still apply, {{pct3}} off 3 hours and {{pct5}} off 5.',
      ],
    },
    {
      heading: 'Example week: three hours of Mythic+ Pro in Europe',
      paragraphs: [
        'Here is an example week, priced with the Duoly checkout calculator on {{checked}}. A healer at {{rank_duo2}} in Europe books 3 hours of Mythic+ Pro with a 3,000+ rated teammate. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one hour. The order chat opens straight after payment, and the first message names the region, the rating and the role: Europe, {{rank_duo2}}, Restoration Druid, looking to time higher keys.',
        'From there the week runs on a short plan. You agree the dungeons and key levels, voice goes on, and your teammate joins your group by BattleTag. After each key you pick one change, such as saving a cooldown for the second boss instead of the first pack. Five hours take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is WoW coaching the better booking?',
      paragraphs: [
        'World of Warcraft coaching is the better booking when your numbers, not your group, are the problem. Class and Rotation Coaching is one hour with a Gladiator or 3,000+ coach on talents, rotation, cooldowns and positioning, at {{p_class}} per hour, checked on a target dummy and in a real key or arena. Coaching carries no bundle discount.',
        'A player who keeps depleting the same dungeon gains more from one coaching hour than from three more keys. A player who wants a relaxed evening gains more from Delves at {{p_delves}} per hour. Play and Learn is one hour of live Mythic+ with a 3,000+ coach at {{p_learn}}, and screen share runs on Discord.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about WoW sessions?',
    items: [
      [
        'Is Duoly a free WoW group finder?',
        'No. Duoly is a paid marketplace with reviewed players. The Group Finder, your guild and community Discords stay the free routes to a key group.',
      ],
      [
        'How much does a Mythic+ teammate cost?',
        'Mythic+ Pro is {{p_duo2}} per hour at {{rank_duo2}}, from {{p_duo2_low}} at the lowest rating. Bundles take {{pct3}} off 3 hours, and 10 hours cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Does my teammate need to be in my region?',
        'Yes. Groups only form inside one region, so you pick Europe, Americas and Oceania, Korea or Taiwan at checkout and your teammate plays there.',
      ],
      [
        'Does my teammate log into my account?',
        'No. Your teammate plays their own character in your group, and you play yours. Nobody asks for your Battle.net login, and the loot you win is yours.',
      ],
      [
        'Is this retail World of Warcraft?',
        'Yes, these services are for retail World of Warcraft, the current expansion. Ask in the order chat before booking if you play another version.',
      ],
      [
        'Does a teammate booking fill my whole group?',
        'No. A duo adds one teammate, and the other seats come from your friends or the Group Finder. Book Key Group Fill when you want several at once.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next key?',
    text: 'Mythic+ Pro brings a 3,000+ rated teammate from Duoly, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off. Delves and leveling stay {{p_delves}} per hour for everybody. Agree your keys on Discord before the first pull.',
  },
};
