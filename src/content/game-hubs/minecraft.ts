import type { HubPageCopy } from '../hub-pages';

export const minecraft: HubPageCopy = {
  gameSlug: 'minecraft',
  title: 'Minecraft LFG: Find a PvP or Survival Partner | Duoly',
  description:
    'Book a Minecraft PvP partner, a survival buddy, a Manhunt run or Bedwars coaching on Duoly, {{from_lower}}. Compare every price.',
  eyebrow: 'Minecraft teammates',
  h1: 'Minecraft LFG: find a PvP or survival partner',
  lead: 'Free LFG Discords work for finding a server group. Duoly books a reviewed PvPer or survival expert by the hour, fills a Bedwars four and sells Bedwars and PvP coaching.',
  cta: 'Book a Minecraft teammate',
  facts: [
    'Skilled and top-tier PvPers',
    'Bedwars, SkyWars, SMP and Manhunt',
    'Java or Bedrock, your own account',
  ],
  related: ['arc-raiders', 'rocket-league', 'ea-sports-fc-27'],
  format: {
    heading: 'What can you book for Minecraft on Duoly?',
    text: 'A Duoly Minecraft booking is a paid hour where a reviewed player joins your server or your world on your own account. Minecraft has no ranked ladder, so every service keeps one flat price. PvP Duo costs {{p_duo1}} per hour and PvP Duo Pro {{p_duo2}} with a top player from servers like Hypixel. Survival Partner covers SMP progress at {{p_smp}}, and Minigames Night covers Bedwars, SkyWars and Build Battle at {{p_mini}}. Manhunt is the exception, priced per run rather than per hour in 2026. One flat {{p_manhunt}} covers a speedrun against a hunter, however long the chase takes. For example, 3 hours of PvP Duo Pro get {{pct3}} off, 5 get {{pct5}} off and 10 get {{pct10}} off. The server rules from Mojang Studios and your server owner still apply. Finally, every booking opens an order chat, where you agree the server, the edition and voice using Discord.',
  },
  services: {
    duo1: 'An hour of PvP on the server and mode you pick: Bedwars, SkyWars, Duels or UHC.',
    duo2: 'An hour with a top PvPer from servers like Hypixel who takes the hard fights.',
    smp: 'Gear up fast, set up farms, build a safe base and handle the fights on your SMP.',
    surv: 'Start a world or join yours: build, mine and explore together at your own pace.',
    dragon:
      'From a fresh world to the Ender Dragon: gear, stronghold and the fight itself.',
    manhunt:
      'You speedrun with one life while your teammate hunts you with a tracking compass.',
    hard: 'One life, together. See how far the two of you get before it goes wrong.',
    mini: 'Bedwars, SkyWars, Build Battle, Murder Mystery and parkour on your favourite server.',
    gg1v1: 'PvP duels against a verified Gamer Girl with sword, bow and rod.',
    ggbuddy:
      'A patient Gamer Girl builds, mines or plays minigames and explains the basics.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and keeps the mood up after a loss.',
    squad:
      'We fill your team for Bedwars fours, SkyWars teams, Hunger Games or UHC events.',
    pvp: 'One hour of aim, combos, strafing, rod and bow play, drilled in practice duels.',
    bw: 'One hour of rush timing, bridging, bed defence and endgame clutches in real games.',
  },
  intros: {
    teammate:
      'One teammate joins your server or your world, from ranked-style PvP to relaxed survival.',
    team: 'A Server Squad adds several skilled PvPers at once, priced for the seats you need covered.',
    coaching:
      'Both lessons run for one hour, one on PvP mechanics and one on Bedwars.',
  },
  steps: {
    heading: 'How does booking a Minecraft session work?',
    items: [
      'First, pick a service and the number of hours. PvP Duo Pro is the top-tier option at {{p_duo2}} per hour, and 3 hours cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five hours get {{pct5}} off.',
      'Second, add your server or world, the edition and your language at checkout. For example, name Hypixel, Java and Bedwars, so your teammate reads the real request from Duoly before accepting the order.',
      'Third, meet your teammate in the order chat, agree the mode and voice using Discord, then add each other by Minecraft name. One Manhunt run costs {{p_manhunt}} however long the chase takes in 2026. Ten hours get {{pct10}} off.',
    ],
    note: 'Duoly reviews every Minecraft teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Minecraft session fits you?',
    intro:
      'The right Minecraft session is the one matching your goal for the evening, so pick the goal first and let the price follow. For example, a PvP Duo Pro hour costs {{p_duo2}} in 2026, with {{pct3}} off 3 hours and {{pct5}} off 5. There is no rank picker, and voice runs using Discord.',
    picks: [
      {
        goal: 'Losing every Bedwars fight?',
        service: 'duo2',
        answer:
          'PvP Duo Pro brings a top PvPer at {{p_duo2}} per hour who takes the clutches and shows the combos.',
      },
      {
        goal: 'Starting or rescuing an SMP?',
        service: 'smp',
        answer:
          'Survival Partner costs {{p_smp}} per hour for gear, farms, a safe base and the fights.',
      },
      {
        goal: 'Want the funniest possible night?',
        service: 'manhunt',
        answer:
          'Manhunt is one flat {{p_manhunt}} per run: you speedrun with one life, a hunter chases you.',
      },
      {
        goal: 'Short of players for Bedwars fours?',
        service: 'squad',
        answer:
          'A Server Squad covers up to {{seats_squad}} seats with players who know the mode.',
      },
      {
        goal: 'Want to be taught properly?',
        service: 'bw',
        answer:
          'Bedwars Coaching is one hour on rush timing, bridging, bed defence and endgame clutches.',
      },
    ],
  },
  sections: [
    {
      heading: 'Why does Minecraft have no rank picker?',
      paragraphs: [
        'A Minecraft booking is a flat-price session, because the game has no ranked ladder and no matchmaking region from Mojang Studios. Instead of a rank, you give the server or world and the edition, because a Hypixel Bedwars booking and a private SMP booking need different people. PvP Duo costs {{p_duo1}} per hour, PvP Duo Pro {{p_duo2}} with a top PvPer, and Minigames Night {{p_mini}} for a relaxed evening across several modes.',
        'Flat pricing keeps the maths simple. For example, 3 hours of PvP Duo Pro cost {{p_duo2_x3}} with {{pct3}} off and 5 cost {{p_duo2_x5}} with {{pct5}} off in 2026. First, say Java or Bedrock, because the two editions do not play together. Second, name the server, since every server has its own rules from the owner. Finally, agree the mode using Discord before anybody logs in, and never share an account password.',
      ],
    },
    {
      heading: 'PvP, survival or Manhunt: which night do you want?',
      paragraphs: [
        'A PvP session is a booking for servers with real competition: Bedwars, SkyWars, Duels, UHC and box PvP. PvP Duo Pro brings a top player from servers like Hypixel who takes the hard fights and explains the clutch afterwards. Survival sessions are the opposite shape. Survival Partner at {{p_smp}} per hour gets you geared, builds farms and defends a base in 2026, while Survival Together at {{p_surv}} is slower and friendlier. Bundles take {{pct3}} off 3 hours and {{pct5}} off 5, with voice using Discord.',
        'Manhunt is its own thing, and the only Minecraft service priced per run at {{p_manhunt}} in 2026. You speedrun with one life and have to beat the Ender Dragon while your teammate hunts you with a tracking compass. Most runs last 30 to 90 minutes, and your teammate brings the setup. For example, a group wanting one memorable evening books Manhunt instead of three PvP hours. First, pick the shape. Second, agree who hunts, since the roles can swap. Finally, {{pct3}} off applies to 3 runs.',
      ],
    },
    {
      heading: 'Example evening: three PvP Duo Pro hours on Hypixel',
      paragraphs: [
        'For example, here is a real booking, priced with the Duoly checkout calculator on {{checked}}. A Java player books 3 PvP Duo Pro hours on Hypixel. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one hour. The order chat opens straight after payment, and the first message names the server, the edition and the mode: Hypixel, Java, Bedwars doubles, losing most bed defences in the endgame.',
        'The evening then runs on a short plan. First, both players agree the mode and a practice target. Second, voice goes on using Discord and the teammate adds you by Minecraft name. Third, after each game you agree one adjustment, such as placing wool before the first rush instead of after. We found these numbers by running the price tool from Duoly for every service in 2026. Five hours take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Minecraft coaching the better booking?',
      paragraphs: [
        'Minecraft coaching is the better booking when the goal is a repeatable fix rather than company for the evening. PvP Coaching and Bedwars Coaching each cost {{p_pvp}} per hour in 2026, one on aim, combos, strafing, rod and bow play, the other on rush timing, bridging and bed defence. Coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'For example, a player who loses every 1v1 in Duels gains more from one coaching hour than from three more Bedwars games. Finally, a player who only wants a calm evening gains more from Minigames Night at {{p_mini}} per hour in 2026. Minecraft has no separate Duoly coaching page yet, so lessons are booked from the prices above, and screen share runs using Discord so the coach sees your real clicks.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Minecraft sessions?',
    items: [
      [
        'Is Duoly a free Minecraft teammate finder?',
        'Duoly is a paid marketplace with reviewed players. For example, server Discords and in-game friend lists stay the free routes to a regular group.',
      ],
      [
        'How much does a Minecraft teammate cost?',
        'PvP Duo Pro is {{p_duo2}} per hour in 2026. First, bundles take {{pct3}} off 3 hours, and 10 hours cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Java or Bedrock?',
        'Both. Pick the edition at checkout, because Java and Bedrock players cannot join the same world, and most competitive servers run on Java.',
      ],
      [
        'Why is Manhunt priced per run?',
        'A Manhunt has no fixed length, and most runs last 30 to 90 minutes. One flat {{p_manhunt}} covers the whole run however long the chase goes on.',
      ],
      [
        'Can a teammate join my private SMP?',
        'Yes. Give the server address or world details at checkout, agree the mode using Discord, and remember the rules from your server owner still apply.',
      ],
      [
        'Do you need my account?',
        'No. You play on your own account and add each other by Minecraft name. Never send login details to anyone, including a teammate or a coach.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next Minecraft night?',
    text: 'PvP Duo Pro is the hour with a top PvPer from servers like Hypixel from Duoly. For example, 3 hours cost {{p_duo2_x3}} with {{pct3}} off in 2026. Five hours get {{pct5}} off. Finally, name your server and edition using Discord before you log in.',
  },
};
