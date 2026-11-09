import type { HubPageCopy } from '../hub-pages';

export const fortnite: HubPageCopy = {
  gameSlug: 'fortnite',
  title: 'Fortnite Teammates, Squads and Coaching | Duoly',
  description:
    'Book a Fortnite teammate, a squad fill or a coach on Duoly, {{from_lower}}. Compare Ranked, Zero Build, Reload and tournament cup prices.',
  eyebrow: 'Fortnite teammates',
  h1: 'Book a Fortnite teammate or a squad fill by the hour',
  lead: 'Free LFG Discords work for a casual squad. Duoly books a reviewed Champion or Unreal teammate by the hour, fills a trio or squad and sells build coaching when you want to learn.',
  cta: 'Book a Fortnite teammate',
  facts: [
    'Champion+ to Unreal teammates',
    'Ranked Duos, Zero Build and Reload',
    'Priced per hour, your own account',
  ],
  related: [
    'rocket-league',
    'ea-sports-fc-27',
    'minecraft',
    'apex-legends',
    'pubg',
  ],
  intent:
    'After the two-player page rather than every Fortnite service? It covers partner picks, drop spots and prices for the pair of you on their own.',
  format: {
    heading: 'What can you book for Fortnite on Duoly?',
    text: 'A Fortnite booking on Duoly is an hour of play, because a battle royale match has no fixed length. First, the tiers are Duo Plus with a Champion+ teammate, Duo Pro with an Unreal teammate and Duo Apex with a tournament-level player. Ranked prices follow your own rank, from {{p_duo2_low}} to {{p_duo2_high}} per hour on Duo Pro. Zero Build and Reload stay {{p_zb}} per hour at every rank, and Creative box fights cost {{p_box}}. Bundles cut the total, {{pct3}} off 3 hours up to {{pct10}} off 10. Second, the fills: Squad Fill hires Unreal players for the empty seats of a Trio or Squad at {{p_squad}} per hour, and Tournament Teammate covers {{seats_cup}} seats for a Cash Cup or FNCS night at {{p_cup}}. Third, the lessons, from {{p_build}} per hour in Creative. For example, name your region using Discord first.',
  },
  services: {
    duo1: 'An hour of Ranked Duos with a Champion player who calls drops, rotations and endgame.',
    duo2: 'An hour of Ranked Duos or Zero Build with an Unreal player who takes the hard fights.',
    duo3: 'An hour with a tournament-level player for high Unreal lobbies and pro-heavy endgames.',
    zb: 'An hour of Zero Build: positioning, cover and aim, at a relaxed pace.',
    reload:
      'An hour of Reload on the small map with respawns. Constant action, almost no waiting.',
    box: 'An hour of box fights and build fights in Creative with someone who will push you.',
    gg1v1:
      'A Creative 1v1 against a verified Gamer Girl: box fights and build battles.',
    ggbuddy:
      'A patient Gamer Girl plays Zero Build, Reload or Creative and explains the basics.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and keeps the mood up after a loss.',
    cup: 'Cash Cups, Victory Cups or FNCS qualifiers with a teammate who has tournament earnings.',
    squad:
      'Bring a friend or two and we fill your trio or squad with Unreal players who call rotations.',
    learn:
      'One live hour of Ranked with an Unreal coach explaining every decision out loud.',
    build:
      'One hour of piece control, edits and box fights in Creative, with drills to keep going.',
  },
  intros: {
    teammate:
      'Teammate prices are per hour, because a battle royale match has no fixed length. Ranked services read your own rank: Duo Pro costs {{p_duo2_low}} per hour at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. Zero Build, Reload and Box Fight Practice hold one price for everybody. First, pick the mode, because the mode decides whether the rank list on a card matters. Second, read the teammate tier beside the price: Duo Plus names a Champion+ player, Duo Pro an Unreal player and Duo Apex an Unreal player with a high Power Ranking at {{p_duo3}} per hour. Bundles take {{pct3}} off 3 hours and {{pct5}} off 5. For example, agree the drop spot using Discord before hour 1.',
    team: 'A Fortnite squad fill is one order that hires several players at once, so a part-full party becomes a trio or a squad. Squad Fill covers up to {{seats_squad}} seats at {{p_squad}} per hour, and Tournament Teammate covers {{seats_cup}} seats at {{p_cup}}. Both are flat hourly prices rather than rank-priced, because a cup lobby is set by the bracket rather than by your rank. First, count the seats you actually need, because every seat is priced on its own. Matchmaking still reads the highest rank in the party, a rule from Epic Games read in November 2026, so expect harder lobbies. Bundles take {{pct3}} off 3 hours and {{pct5}} off 5. For example, a duo short one player books 1 seat rather than 3, agreed using Discord.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount at all, so the {{pct3}} and {{pct5}} savings on teammate hours stop here. Build and Edit Course costs {{p_build}} per hour, drilling edits, ramp rushes and box fights in Creative. Play and Learn is the live option where an Unreal coach talks through one real Ranked hour at {{p_learn}}. First, pick the problem rather than the format. For example, a player who loses every box fight books the Creative hour instead of a fourth Ranked hour. Screen share runs using Discord, and no lesson from Duoly promises a rank.',
  },
  steps: {
    heading: 'How does booking a Fortnite duo work?',
    items: [
      'Pick a service and the number of hours first. Duo Pro is the Ranked Duos tier with an Unreal teammate, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five hours take {{pct5}} off.',
      'Second, add your region, rank, input and language at checkout. For example, name Europe, {{rank_duo2}} and controller or keyboard, so your teammate reads the real request before accepting.',
      'Finally, meet your teammate in the order chat using Discord. Agree a drop spot and a rotation route, then add each other with your Epic name. One Duo Pro hour costs {{p_duo2}}.',
    ],
    note: 'Duoly reviews every Fortnite teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Fortnite session fits you?',
    intro:
      'The right Fortnite session is the one matching your goal for the hour. First, the casual hours stay flat at every rank: Zero Build and Reload are each {{p_zb}} and Creative box fights {{p_box}}. Ranked hours are priced by your own rank, from {{p_duo2_low}} on Duo Pro, and a squad fill is priced per seat instead. For example, 3 hours take {{pct3}} off and 5 hours take {{pct5}} off, so a bundle beats booking 1. Voice runs using Discord.',
    picks: [
      {
        goal: 'Climbing Ranked Duos?',
        service: 'duo2',
        answer:
          'Duo Pro adds an Unreal teammate from {{p_duo2_low}} per hour, priced by your own rank.',
      },
      {
        goal: 'Hate building?',
        service: 'zb',
        answer:
          'Zero Build costs {{p_zb}} per hour at every rank, with no building and a calmer pace.',
      },
      {
        goal: 'Want nonstop fights?',
        service: 'reload',
        answer:
          'Reload costs {{p_reload}} per hour on the small map, where respawns keep the action going.',
      },
      {
        goal: 'Entering a Cash Cup or FNCS?',
        service: 'cup',
        answer:
          'Tournament Teammate covers {{seats_cup}} seats for {{p_cup}} per hour, with earnings on record.',
      },
      {
        goal: 'Losing every build fight?',
        service: 'build',
        answer:
          'Build and Edit Course is one Creative hour with an Unreal coach for {{p_build}}.',
      },
    ],
  },
  sections: [
    {
      heading: 'Why is Fortnite priced by the hour?',
      paragraphs: [
        'An hour is the honest unit for Fortnite, because a battle royale match from Epic Games has no fixed length. One Ranked Duos game can end in the first zone or run twenty minutes into a pro endgame, so a per-match price would charge the same for both. An hour of Duo Pro costs {{p_duo2}} at {{rank_duo2}} and usually covers 3 or 4 games. First, agree a drop spot. Then agree whether the hour is for points or for practice, so neither player fights the wrong battle.',
        'Ranked prices follow your own rank: {{rank_duo2_low}} players pay {{p_duo2_low}} per hour and {{rank_duo2_high}} players pay {{p_duo2_high}}. Casual hours keep one flat price, so Zero Build and Reload each cost {{p_zb}} and Creative box fights cost {{p_box}}. Bundles take {{pct3}} off 3 hours or {{pct5}} off 5. For example, voice runs using Discord and the invite goes out with your Epic name, both agreed before the bus moves.',
      ],
    },
    {
      heading: 'What does a Fortnite squad fill include?',
      paragraphs: [
        'A Fortnite squad fill is Squad Fill: Duoly hires Unreal players for the empty seats of your Trio or Squad at {{p_squad}} per hour. First, count the seats, because every seat is priced on its own, so a duo short two players books 2 rather than 3. Second, agree the drop, since a squad landing in two spots loses the first minute. For example, a {{rank_duo2}} player books Duo Pro at {{p_duo2}} per hour instead when only the second seat is open.',
        'Tournament Teammate is the other group booking at {{p_cup}} per hour for {{seats_cup}} seats, for a Cash Cup or an FNCS night. Tournament entry rules are set by Epic Games and change between events, so check the in-game compete tab before you book the hour. Voice runs using Discord, invites go out with your Epic name, and nobody needs your login. Bundles still take {{pct3}} off 3 hours and {{pct5}} off 5, read from Duoly checkout in 2026.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro hours in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} controller player in Europe books 3 Duo Pro hours. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one hour. Matchmaking reads the highest rank in the party, so the pair plays at the Unreal teammate level. The order chat opens straight after payment, and the first message names the region, the rank and the input: Europe, {{rank_duo2}}, controller, looking for a partner who calls rotations early.',
        'From there the evening runs on a short plan. You agree a drop spot and a rotation route, voice goes on, and the invite goes out with the Epic name. After each game you pick one adjustment, for example leaving the zone edge ten seconds earlier instead of fighting for high ground twice, agreed using Discord. An hour usually covers 3 or 4 Ranked games, and 5 hours take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Fortnite coaching the better booking?',
      paragraphs: [
        'Fortnite coaching is the better booking when the goal is a repeatable fix rather than company for the next hour. A duo teammate answers a quick question between games. A coach drills one skill in Creative and leaves you with homework. Build and Edit Course costs {{p_build}} per hour, and coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate hours only.',
        'First, name the pattern you keep repeating. For example, a player who loses every box fight gains more from one Creative hour at {{p_build}} than from a fourth Ranked game. A player who only wants fun gains more from Reload at {{p_reload}} per hour in 2026. Play and Learn is one live Ranked hour with an Unreal coach at {{p_learn}}, and screen share runs using Discord. The full service list, preparation tips and lesson formats live on the [Fortnite coaching page](/games/fortnite/coaching). The [Fortnite duos page](/games/fortnite/duos) sets the free Discords and the Fill button beside the paid hours, and [Apex Legends teammates](/games/apex-legends) and [PUBG teammates](/games/pubg) cover the other battle royales.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Fortnite sessions?',
    items: [
      [
        'Is Duoly a free Fortnite teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game friend list from Epic Games are the free routes, so try those first.',
      ],
      [
        'How much does a Fortnite duo cost?',
        'Duo Pro is {{p_duo2}} per hour at {{rank_duo2}}, and {{p_duo2_low}} at the lowest rank. Zero Build and Reload each cost {{p_zb}} per hour in 2026.',
      ],
      [
        'How do I book a full Fortnite squad?',
        'Squad Fill hires Unreal players for the empty seats of a Trio or Squad at {{p_squad}} per hour, and Tournament Teammate covers {{seats_cup}} seats for a cup night at {{p_cup}}.',
      ],
      [
        'Why per hour instead of per match?',
        'A battle royale match has no fixed length, so an hour prices the real session honestly. Three hours get {{pct3}} off, and 5 hours get {{pct5}} off.',
      ],
      [
        'Can a teammate join a Cash Cup with me?',
        'Yes: Tournament Teammate is built for cups and FNCS qualifiers, for example an FNCS duo qualifier, and the eligibility rules from Epic Games apply to both accounts.',
      ],
      [
        'Where do I book a Fortnite coach?',
        'The Fortnite coaching page sells the Build and Edit Course by the hour, plus one live Ranked hour in Play and Learn, with screen share using Discord.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to drop into Fortnite?',
    text: 'Duo Pro is the Ranked Duos tier with an Unreal teammate from Duoly. Three hours at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off, and 5 hours take {{pct5}} off. Zero Build stays {{p_zb}} per hour at any rank, and Creative box fights cost {{p_box}}. Squad Fill hires Unreal players for the empty seats of a Trio or Squad at {{p_squad}} per hour in 2026. For example, pick your rank and input, then agree the drop using Discord.',
  },
};
