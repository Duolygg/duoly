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
    text: 'Duoly sells three things for Minecraft: one teammate who joins your server or your world on your own account, a Server Squad that fills several seats on one order, and coaching by the hour. Minecraft has no ranked ladder and no matchmaking region, so every service keeps one flat price for everybody: PvP Duo costs {{p_duo1}} per hour, PvP Duo Pro {{p_duo2}} with a top player from servers like Hypixel or Minemen, Survival Partner {{p_smp}} for SMP progress and Minigames Night {{p_mini}} for a relaxed evening across several modes. Manhunt is the exception, priced per run at {{p_manhunt}} however long the chase takes. Bundles cut the total, {{pct3}} off 3 up to {{pct10}} off 10. Name the server and the edition in the order chat, because Java and Bedrock cannot join the same world.',
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
      'Pick a service and the number of hours. PvP Duo Pro is the top-tier option at {{p_duo2}} per hour, and 3 hours cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five hours take {{pct5}} off.',
      'Add your server or world, the edition and your language at checkout. Name Hypixel, Java and Bedwars, so your teammate reads the real request before accepting the order.',
      'Meet your teammate in the order chat, agree the mode, a practice target and voice, then add each other by Minecraft name. One Manhunt run costs {{p_manhunt}} however long the chase takes.',
    ],
    note: 'Duoly reviews every Minecraft teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Minecraft session fits you?',
    intro:
      'The right Minecraft session is the one matching your goal for the evening, so pick the goal first and let the price follow. Nothing here asks for a rank, because the game has no ladder, and the only answers that change the booking are the server, the edition and the mode. Bundles cut totals by {{pct3}} on 3 and {{pct5}} on 5.',
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
        'Minecraft has no ranked ladder and no matchmaking region, so Duoly charges one flat price for everybody and the checkout asks for a server instead of a rank. That matters more than a rating would, because a Hypixel Bedwars booking and a private SMP booking need completely different people: one wants a duellist who wins the 1v1 at mid, the other wants somebody who can build a farm and defend a base. PvP Duo costs {{p_duo1}} per hour, PvP Duo Pro {{p_duo2}} with a top PvPer, and Minigames Night {{p_mini}} for a relaxed evening.',
        'Flat pricing keeps the maths simple too. Three hours of PvP Duo Pro cost {{p_duo2_x3}} with {{pct3}} off and 5 cost {{p_duo2_x5}} with {{pct5}} off. Say Java or Bedrock first, because the two editions cannot join the same world, then name the server, since every server runs its own rules. Agree the mode in the order chat before anybody logs in, and never share an account password with a teammate.',
      ],
    },
    {
      heading: 'PvP, survival or Manhunt: which night do you want?',
      paragraphs: [
        'A PvP session belongs on servers with real competition: Bedwars, SkyWars, Duels, UHC and box PvP. PvP Duo Pro brings a top player from servers like Hypixel or Minemen who takes the hard fights and explains the clutch afterwards. Survival sessions are the opposite shape, slower and built around progress: Survival Partner at {{p_smp}} per hour gets you geared, builds farms and defends the base, while Survival Together at {{p_surv}} is friendlier and has no target at all beyond the one you set.',
        'Manhunt is its own thing, and the only Minecraft service priced per run at {{p_manhunt}}. You speedrun with one life and have to kill the Ender Dragon while your teammate hunts you with a compass that always points at you. They respawn and you do not, most runs last 30 to 90 minutes, and your teammate brings the setup. Decide the shape first, then agree who hunts, since the roles can swap. Bundles take {{pct3}} off 3 and {{pct5}} off 5.',
      ],
    },
    {
      heading: 'Example evening: three PvP Duo Pro hours on Hypixel',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A Java player books 3 PvP Duo Pro hours on Hypixel. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for a single hour. The order chat opens straight after payment, and the first message names the server, the edition and the mode: Hypixel, Java, Bedwars doubles, losing most bed defences in the endgame.',
        'From there the evening runs on a short plan. You agree the mode and a practice target, voice goes on, and your teammate adds you by Minecraft name. After each game you pick one adjustment, such as placing wool before the first rush instead of after it. The same shape works for Minigames Night at {{p_mini}} per hour if the goal is a calm evening, and 5 hours of anything take {{pct5}} off.',
      ],
    },
    {
      heading: 'When is Minecraft coaching the better booking?',
      paragraphs: [
        'Minecraft coaching is the better booking when the goal is a repeatable fix rather than company for the evening. PvP Coaching and Bedwars Coaching each cost {{p_pvp}} per hour, one on aim, combos, strafing, rod and bow play, the other on rush timing, bridging and bed defence. Coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'A player who loses every 1v1 in Duels gains more from that hour than from three more Bedwars games, because a coach can name the habit and drill it in practice duels. A player who only wants a calm evening gains more from Minigames Night at {{p_mini}} per hour. Minecraft has no separate coaching page on Duoly yet, so lessons are booked from the prices above, and screen share runs on Discord so the coach watches your real clicks.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Minecraft sessions?',
    items: [
      [
        'Is Duoly a free Minecraft teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Server Discords and in-game friend lists stay the free routes to a regular group.',
      ],
      [
        'How much does a Minecraft teammate cost?',
        'PvP Duo Pro is {{p_duo2}} per hour and PvP Duo {{p_duo1}}. Bundles take {{pct3}} off 3 hours, and 10 hours cost {{p_duo2_x10}} with {{pct10}} off.',
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
        'Yes. Give the server address or world details at checkout, agree the mode on Discord, and remember the rules from your server owner still apply.',
      ],
      [
        'Do you need my account?',
        'No. You play on your own account and add each other by Minecraft name. Never send login details to anyone, including a teammate or a coach.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next Minecraft night?',
    text: 'PvP Duo Pro is the hour with a top PvPer from servers like Hypixel, and 3 hours cost {{p_duo2_x3}} with {{pct3}} off. Manhunt stays one flat {{p_manhunt}} per run. Name your server and edition, then agree the mode with your teammate in the order chat before you log in.',
  },
};
