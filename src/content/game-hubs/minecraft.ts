import type { HubPageCopy } from '../hub-pages';

export const minecraft: HubPageCopy = {
  gameSlug: 'minecraft',
  title: 'Minecraft Player Finder: PvP and Survival Partners | Duoly',
  description:
    'Find a Minecraft PvP partner, a survival buddy, a Manhunt run or Bedwars coaching on Duoly, {{from_lower}}. Compare every price.',
  eyebrow: 'Minecraft teammates',
  h1: 'Minecraft player finder: PvP and survival partners',
  lead: 'Free LFG Discords work for finding a server group. Duoly books a reviewed PvPer or survival expert by the hour, fills a Bedwars four and sells Bedwars and PvP coaching.',
  cta: 'Book a Minecraft teammate',
  facts: [
    'Skilled and top-tier PvPers',
    'Bedwars, SkyWars, SMP and Manhunt',
    'Java or Bedrock, your own account',
  ],
  related: [
    'arc-raiders',
    'world-of-warcraft',
    'pokemon-unite',
    'ea-sports-fc-27',
    'rocket-league',
  ],
  intent:
    'After the LFG page rather than every Minecraft service? It covers Bedwars and SkyWars practice, SMP sessions and the Java or Bedrock choice.',
  format: {
    heading: 'What can you book for Minecraft on Duoly?',
    text: 'A Minecraft booking on Duoly is a single reviewed teammate, a Server Squad or a coaching hour. Minecraft has no universal ranked queue, so every service keeps one flat price: PvP Duo costs {{p_duo1}} per hour, PvP Duo Pro {{p_duo2}} with a top player from servers like Hypixel, Survival Partner {{p_smp}} for SMP progress and Minigames Night {{p_mini}} for a calm evening. Manhunt is the exception, priced per run at {{p_manhunt}} however long the chase takes. Bundles of {{main}} cut the total, {{bundles}}. The servers page from Mojang describes community servers setting their own rules, read in November 2026, so a server rank is the only rank anybody here can gate on. Name the server and edition using Discord first.',
  },
  services: {
    duo1: 'An hour of PvP on the server and mode you pick: Bedwars, SkyWars, Duels or UHC.',
    duo2: 'An hour with a top PvPer from servers like Hypixel who carries the clutch fights.',
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
      'Session prices are per hour and flat for everybody, because Minecraft has no universal ranked queue and nothing here asks for a rank. PvP Duo costs {{p_duo1}} per hour and PvP Duo Pro {{p_duo2}}, with Manhunt the one exception at {{p_manhunt}} per run. Pick the service, because a Bedwars duellist and a farm builder are different people. Name Java or Bedrock, since the two editions cannot join one world. Each community server sets its own ranks and rules under the pages from Mojang, read in November 2026, so check the server before booking. Only {{main}} is sold in bundles, {{bundles}}, and every other service books {{picker}}. Agree the mode using Discord before hour 1.',
    team: 'A Server Squad is one order that hires several players at once, so a part-full team becomes a real four. The card covers up to {{seats_squad}} seats at {{p_squad}} per hour, and 5 hours cost {{p_squad_x5}} with {{pick5}} off. Count the seats you actually need, because every seat is priced on its own: a trio short 1 player books 1 seat rather than 3. The price is flat, because no universal ranked queue exists to read. Hired players are picked for the mode you name, for example Bedwars fours, SkyWars teams, Hunger Games or UHC events, and server rules still apply. Bundles of {{main}} take {{bundles}}, agreed using Discord.',
    coaching:
      'Lessons are priced by the hour and get no quantity or bundle discount at all, so the {{pct3}} to {{pct10}} bundle savings on teammate hours stop here. PvP Coaching and Bedwars Coaching each cost {{p_pvp}} per hour, one on aim, combos, strafing, rod and bow play, the other on rush timing, bridging, bed defence and endgame clutches. Pick the problem rather than the format. For example, a player who loses every 1v1 at mid books the duels hour instead of a fourth Bedwars hour at {{p_duo2}}. Screen share runs using Discord so the coach watches your real clicks, and no lesson from Duoly promises a server rank.',
  },
  steps: {
    heading: 'How does booking a Minecraft session work?',
    items: [
      'Pick a service and the number of hours first. PvP Duo Pro is the top-tier option at {{p_duo2}} per hour, and 3 hours cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five hours take {{pct5}} off.',
      'Add your server or world, the edition and your language at checkout. Name Hypixel, Java and Bedwars, so your teammate reads the real request before accepting.',
      'Meet your teammate in the order chat using Discord. Agree the mode, a practice target and voice, then add each other by Minecraft name. One Manhunt run costs {{p_manhunt}}.',
    ],
    note: 'Duoly reviews every Minecraft teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Minecraft session fits you?',
    intro:
      'The right Minecraft session is the one matching your goal for the evening. Nothing here asks for a rank, because Minecraft has no universal ranked queue. PvP Duo Pro costs {{p_duo2}} per hour and Minigames Night {{p_mini}}, so the server, the edition and the mode are the only answers that change the booking. A {{main}} bundle takes {{bundles}}, so a bundle beats booking 1 at a time. Voice runs using Discord.',
    picks: [
      {
        goal: 'Losing every Bedwars fight?',
        service: 'duo2',
        answer:
          'PvP Duo Pro brings a top PvPer at {{p_duo2}} per hour who takes the clutches.',
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
          'A Server Squad covers up to {{seats_squad}} seats for {{p_squad}} per hour.',
      },
      {
        goal: 'Want to be taught properly?',
        service: 'bw',
        answer:
          'Bedwars Coaching is one hour on rush timing, bridging and bed defence, for {{p_bw}}.',
      },
    ],
  },
  sections: [
    {
      heading: 'Why does Minecraft have no rank picker?',
      paragraphs: [
        'Minecraft has no universal ranked queue, so Duoly charges one flat price for everybody and the checkout asks for a server instead of a rank. The servers page from Mojang describes community-created multiplayer worlds, each with its own experience and its own rules, read in November 2026. A server rank on Hypixel is therefore a server rank, never a game-wide ladder. For example, a Hypixel Bedwars booking and a private SMP booking need completely different people.',
        'What changes the price is the service. PvP Duo costs {{p_duo1}} per hour, PvP Duo Pro {{p_duo2}} with a top PvPer, and Minigames Night {{p_mini}} for a calm evening. Three hours of PvP Duo Pro cost {{p_duo2_x3}} with {{pct3}} off and 5 cost {{p_duo2_x5}} with {{pct5}} off. Say Java or Bedrock first, because the two editions cannot join one world, then name the server, since every server runs separate rules. Agree the mode using Discord before anybody logs in, and never share a password.',
      ],
    },
    {
      heading: 'PvP, survival or Manhunt: which night do you want?',
      paragraphs: [
        'A PvP session belongs on servers with real competition: Bedwars, SkyWars, Duels, UHC and box PvP. PvP Duo Pro at {{p_duo2}} per hour brings a top player from servers like Hypixel or Minemen who takes the hard fights and explains the clutch afterwards. Survival sessions are the opposite shape, slower and built around progress: Survival Partner at {{p_smp}} per hour gets you geared, builds farms and defends the base, while Survival Together at {{p_surv}} sets no target beyond your own.',
        'Manhunt is its own thing, and the one Minecraft service priced per run at {{p_manhunt}}. You speedrun with a single life and have to kill the Ender Dragon while a teammate hunts you with a compass pointing straight at you. The hunter respawns and you do not, most runs last 30 to 90 minutes, and your teammate brings the setup. Agree who runs and who hunts in the order chat, because the roles can swap. Bundles of {{main}} take {{bundles}}, agreed using Discord.',
      ],
    },
    {
      heading: 'Example evening: three PvP Duo Pro hours on Hypixel',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A Java player books 3 PvP Duo Pro hours on Hypixel. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one hour. Minecraft has no universal ranked queue, so nothing at checkout asks for a rank and the server sets its own rules. The order chat opens straight after payment, and the first message names the server, the edition and the mode: Hypixel, Java, Bedwars doubles, losing most bed defences in the endgame.',
        'From there the evening runs on a short plan. You agree the mode and a practice target, voice goes on, and your teammate adds you by Minecraft name. After each game you pick one adjustment, for example placing wool before the first rush instead of after, agreed using Discord. The same shape works for Minigames Night at {{p_mini}} per hour, and 5 hours take {{pick5}} off.',
      ],
    },
    {
      heading: 'When is Minecraft coaching the better booking?',
      paragraphs: [
        'Minecraft coaching is the better booking when the goal is a repeatable fix rather than company for the evening. PvP Coaching and Bedwars Coaching each cost {{p_pvp}} per hour, one on aim, combos, strafing, rod and bow play, the other on rush timing, bridging and bed defence. Coaching carries no quantity or bundle discount, so the {{pct3}} to {{pct10}} bundle savings apply to teammate hours only.',
        'Name the fight you keep losing. For example, a player who loses every 1v1 in Duels gains more from one practice hour at {{p_pvp}} than from a fourth Bedwars hour, because a coach can name the habit and drill it. A player who only wants a calm evening gains more from Minigames Night at {{p_mini}} per hour in 2026. Minecraft has no separate coaching page on Duoly yet, so lessons are booked from the prices above, and screen share runs using Discord so the coach watches your real clicks. The nearest neighbours here are [ARC Raiders teammates](/games/arc-raiders) for a tenser evening and [Rocket League teammates](/games/rocket-league) for something quicker.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Minecraft sessions?',
    items: [
      [
        'Is Duoly a free Minecraft teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Server Discords and in-game friend lists are the free routes, so try those first.',
      ],
      [
        'How much does a Minecraft teammate cost?',
        'PvP Duo Pro is {{p_duo2}} per hour and PvP Duo {{p_duo1}}. Ten hours cost {{p_duo2_x10}} with {{pct10}} off in 2026, and 3 hours take {{pct3}} off.',
      ],
      [
        'Is there a rank limit on who can play with me?',
        'No: Minecraft has no universal ranked queue, so no rank gate exists. Each community server sets its own ranks and rules, so check the server first.',
      ],
      [
        'Java or Bedrock?',
        'Both: pick the edition at checkout, because Java and Bedrock players cannot join the same world, and most competitive servers run on Java.',
      ],
      [
        'Why is Manhunt priced per run?',
        'A Manhunt has no fixed length, and most runs last 30 to 90 minutes. One flat {{p_manhunt}} covers the whole run however long the chase goes on.',
      ],
      [
        'Can a teammate join my private SMP?',
        'Yes: give the server address or world details at checkout, agree the mode using Discord, and remember the rules from your server owner still apply.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next Minecraft night?',
    text: 'PvP Duo Pro is the hour with a top PvPer from servers like Hypixel, from Duoly. Three hours cost {{p_duo2_x3}} with {{pct3}} off, and 5 hours take {{pct5}} off. Manhunt stays one flat {{p_manhunt}} per run, and Minigames Night costs {{p_mini}} per hour. Minecraft has no universal ranked queue, so no rank gate applies in 2026 and each community server keeps its own rules. Name your server and edition, then agree the mode using Discord before you log in.',
  },
};
