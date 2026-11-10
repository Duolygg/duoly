import type { HubPageCopy } from '../hub-pages';

export const wildRift: HubPageCopy = {
  gameSlug: 'wild-rift',
  title: 'Wild Rift Duo Partners: Ranked and Coaching | Duoly',
  description:
    'Book a Wild Rift duo partner for ranked, a full five or champion coaching on Duoly, {{from_lower}}. Compare ranked and ARAM prices.',
  eyebrow: 'Wild Rift teammates',
  h1: 'Wild Rift teammates for ranked, ARAM and coaching',
  lead: 'Discord LFG channels work for meeting a regular duo. Duoly books a reviewed Diamond, Master or Grandmaster player for your next ranked games, fills a full five and sells champion coaching.',
  cta: 'Book a Wild Rift teammate',
  facts: [
    'Diamond+ to Grandmaster+ teammates',
    'Ranked, ARAM and normal matches',
    'Voice on Discord, your own account',
  ],
  related: [
    'dota-2',
    'deadlock',
    'marvel-rivals',
    'league-of-legends',
    'teamfight-tactics',
  ],
  format: {
    heading: 'What can you book for Wild Rift on Duoly?',
    text: 'A Wild Rift booking on Duoly is one of three things: one teammate who joins your lobby on your own account, a Ranked 5-Stack fill for the seats you are missing, or a coaching hour. First, the teammate tiers are Duo Plus with a Diamond+ player in the lane you need, Duo Pro with a Master player who calls dragons and Baron, and Duo Apex with a Grandmaster+ player from {{p_duo3_low}} per game. Ranked follows your own rank, from {{p_duo2_low}} to {{p_duo2_high}} per game on Duo Pro, while ARAM and a normal match stay {{p_aram}} and {{p_norm}} at every rank. Second, the fill: Ranked 5-Stack covers up to {{seats_five}} seats from {{p_five_low}} per game. Third, Champion Mastery is one hour on a single champion at {{p_champ}}. Games are short, so bundles matter: {{pct3}} off 3 games up to {{pct10}} off 10. For example, name your lane using Discord first.',
  },
  services: {
    duo1: 'Ranked with a Diamond player who tracks the jungler and calls dragons.',
    duo2: 'Ranked with a Master player who shot-calls fights and the next objective.',
    duo3: 'Ranked with a Grandmaster or higher player who can take over a match.',
    aram: 'ARAM with a strong teammate: random champions, one lane, nonstop fights.',
    norm: 'Normal matches to try a new champion or lane with backup.',
    gg1v1:
      'A mid lane 1v1 against a verified Gamer Girl, rematches encouraged.',
    ggbuddy:
      'A patient Gamer Girl plays with you and explains the basics as you go.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and cheers every play.',
    five: 'Fill your five with Master+ players on the lanes you need, on voice.',
    learn:
      'One live ranked game with a Master coach explaining every decision out loud.',
    champ:
      'One hour on one champion: combos, builds, matchups and power spikes.',
  },
  intros: {
    teammate:
      'Teammate prices are per game, and the ranked tiers read your own rank, so a Sovereign lobby costs more than an Iron one. ARAM and normal matches hold one price for everybody, because neither moves your rank. One teammate joins your lobby on your own account and takes the lane you ask for, and bundles take {{pct3}} off 3 games or {{pct5}} off 5. First, pick the mode, because only the ranked cards carry a rank list. Second, read the tier beside the price: Duo Plus is a Diamond+ player, Duo Pro a Master player and Duo Apex a Grandmaster+ one from {{p_duo3_low}} per game. For example, name Baron Lane, Jungle, Mid, Dragon Lane or Support in the order chat using Discord before the draft.',
    team: 'Ranked 5-Stack is priced per seat, so the card covers up to {{seats_five}} seats from {{p_five_low}} per game and falls when your group is only one player short. First, count the seats you actually need, because a trio short two players books 2 rather than 4. Second, name the lanes, because a five wants Baron Lane, Jungle, Mid, Dragon Lane and Support covered rather than three junglers. The fill reads your rank like the duo tiers do, from {{p_five_low}} per game, and bundles take {{pct3}} off 3 games and {{pct5}} off 5. For example, a duo that never finds a jungler books 3 seats and keeps the bot pairing using Discord.',
    coaching:
      'Lessons get no bundle discount, so the {{pct3}} and {{pct5}} savings on teammate sessions do not apply. Champion Mastery costs {{p_champ}} per hour with a Grandmaster+ coach and spends the hour on one champion: combos, builds, matchups and power spikes. Play and Learn is the exception that covers one live ranked game at {{p_learn}} rather than a clock hour. First, pick the problem rather than the format. For example, a player who loses the same lane matchup every game books Champion Mastery instead of a fourth ranked game. Finally, screen share runs using Discord, the coach never logs into your account, and no lesson from Duoly promises a rank.',
  },
  steps: {
    heading: 'How does booking a Wild Rift teammate work?',
    items: [
      'First, pick a service and the number of games. Duo Pro is the ranked tier with a Master teammate, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five games take {{pct5}} off.',
      'Second, add your area, rank, lane and language at checkout. For example, name Europe, {{rank_duo2}} and Dragon Lane, so your teammate reads the real request before accepting the order.',
      'Finally, meet your teammate in the order chat using Discord. Add each other by Riot ID and agree who plays which lane. A single Duo Pro game costs {{p_duo2}} at the same rank, and ARAM stays {{p_aram}}.',
    ],
    note: 'Duoly reviews every Wild Rift teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Wild Rift session fits you?',
    intro:
      'The right Wild Rift session is the one matching your goal for the evening, so pick the goal first and let the price follow. First, ARAM and a normal match hold one price at every rank, {{p_aram}} and {{p_norm}} per game. Ranked is priced by your own rank instead, from {{p_duo2_low}} per game on Duo Pro, and a five-stack fill is priced per seat. For example, 3 games take {{pct3}} off and 5 games take {{pct5}} off, so a bundle beats booking 1. Voice runs using Discord.',
    picks: [
      {
        goal: 'Climbing ranked this season?',
        service: 'duo2',
        answer:
          'Duo Pro adds a Master teammate from {{p_duo2_low}} per game, priced by your own rank.',
      },
      {
        goal: 'Pushing for Grandmaster or higher?',
        service: 'duo3',
        answer:
          'Duo Apex brings a Grandmaster or higher player, {{p_duo3}} per game at {{rank_duo3}}.',
      },
      {
        goal: 'Just want quick fun games?',
        service: 'aram',
        answer:
          'ARAM costs {{p_aram}} per game at every rank, with nonstop teamfights.',
      },
      {
        goal: 'Want a full five on voice?',
        service: 'five',
        answer:
          'Ranked 5-Stack covers up to {{seats_five}} seats with Master+ players on the lanes you name.',
      },
      {
        goal: 'Learning a new main?',
        service: 'champ',
        answer:
          'Champion Mastery is one hour with a Grandmaster+ coach on one champion, at {{p_champ}}.',
      },
    ],
  },
  sections: [
    {
      heading: 'Who is the teammate you queue with?',
      paragraphs: [
        'The teammate you queue with is a reviewed Wild Rift player who applied for the game and showed a rank before taking orders. First, the tiers: Duo Plus names a Diamond+ player, Duo Pro a Master player and Duo Apex a Grandmaster+ player from {{p_duo3_low}} per game, which is the top tier Duoly sells for the game. Second, orders are not auto-assigned, because a teammate picks yours up from the queue, so the person who accepts chose your request. For example, tell them your rank and your lane in the order chat using Discord before the first draft.',
        'What the rank buys you is objective calls. A Master teammate tracks the enemy jungler, calls the dragon before it spawns and says when Baron is safe to start. Voice runs using Discord, so the call lands while the fight is still winnable. Your rank also sets the price: Duo Pro runs {{p_duo2_low}} per game at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}, because higher lobbies need stronger teammates. Bundles cut that total by {{pct3}} on 3 games and {{pct5}} on 5. For example, you keep your champions, your decisions and your account in all 3 games.',
      ],
    },
    {
      heading: 'How does a Wild Rift 5-Stack fill work?',
      paragraphs: [
        'A Ranked 5-Stack is one order that hires several players at once, so a part-full group becomes a complete five. First, the fill covers up to {{seats_five}} empty seats with Master+ players at {{p_five}} per game at {{rank_five}}, and 5 games cost {{p_five_x5}} with {{pick5}} off. Second, every seat is priced separately, so a duo short three players books 3 seats instead of 4. For example, a pair who always lose the jungle book one seat and keep their own bot lane.',
        'Agree the lanes before the draft: Baron Lane, Jungle, Mid, Dragon Lane and Support. Then agree one shotcaller, because five people calling Baron on voice is how a won game gets thrown. Keep everybody on one call using Discord, and nobody ever needs your Riot login. Finally, bundles still apply, {{pct3}} off 3 games and {{pct5}} off 5, read from Duoly checkout in 2026.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro games in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A player at {{rank_duo2}} in Europe books 3 Duo Pro games with a Master teammate. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one game. The order chat opens straight after payment, and the first message names the area, the rank and the lane: Europe, {{rank_duo2}}, Dragon Lane, looking for a support who roams.',
        'From there the evening runs on a short plan. You agree a lane pairing and two champions each, voice goes on, and the invite goes out by Riot ID. After each game you pick one change, for example grouping for the second dragon instead of farming the side lane, agreed using Discord. Five games take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Wild Rift coaching the better booking?',
      paragraphs: [
        'Wild Rift coaching is the better booking when the goal is a fix you can repeat rather than company for the next game. First, Champion Mastery is one hour with a Grandmaster+ coach on one champion, covering combos, builds, matchups and power spikes, at {{p_champ}} per hour. Second, Play and Learn is one live ranked game with a Master+ coach at {{p_learn}} instead of a clock hour. Coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate games only.',
        'For example, a player who loses lane to the same matchup every game gains more from one mastery hour at {{p_champ}} than from three more ranked games. A player who wants to relax gains more from ARAM at {{p_aram}} per game, where the champions are random and nothing is on the line. Screen share runs using Discord, and the coach never logs into your account. Finally, Duoly reviews every Wild Rift coach before any order goes live. The nearest neighbours here are [League of Legends teammates](/games/league-of-legends) on PC and [Dota 2 teammates](/games/dota-2).',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Wild Rift sessions?',
    items: [
      [
        'Is Duoly a free Wild Rift duo finder?',
        'No: Duoly is a paid marketplace with reviewed players, so Discord LFG channels and your friends list stay the free routes to a regular duo.',
      ],
      [
        'How much does a Wild Rift teammate cost?',
        'Duo Pro is {{p_duo2}} per game at {{rank_duo2}}, from {{p_duo2_low}} at the lowest rank. Bundles take {{pct3}} off 3 games, and 10 games cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Is this Wild Rift or League of Legends on PC?',
        'This page is Wild Rift, the mobile game, and Duoly sells [League of Legends on PC](/games/league-of-legends) separately with its own teammates and its own prices.',
      ],
      [
        'Can I choose my lane?',
        'Yes: pick Baron Lane, Jungle, Mid, Dragon Lane or Support at checkout, or leave it on Fill, and your teammate drafts around the lane you name using Discord.',
      ],
      [
        'Does my teammate play on my account?',
        'No: your teammate plays on their own account in your lobby while you play on yours, and nobody from Duoly ever asks for your Riot login.',
      ],
      [
        'Does a teammate booking fill my whole team?',
        'No: a duo adds one teammate and the other seats come from your friends or the queue, so book a Ranked 5-Stack at {{p_five}} per game when you want several at once.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next Wild Rift game?',
    text: 'Duo Pro is the ranked tier with a Master teammate from Duoly, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off. Five games take {{pct5}} off and 10 games take {{pct10}} off. ARAM stays {{p_aram}} per game at any rank, and a normal match costs {{p_norm}}. Ranked 5-Stack hires Master+ players for up to {{seats_five}} seats from {{p_five_low}} per game when you want the whole lobby in 2026. For example, pick your rank and lane, then agree the draft in the order chat using Discord.',
  },
};
