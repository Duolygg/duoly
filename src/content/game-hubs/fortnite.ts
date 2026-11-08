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
    'apex-legends',
    'call-of-duty',
    'rocket-league',
    'counter-strike-2',
    'pubg',
  ],
  intent:
    'After the two-player page rather than the whole catalog? It covers partner picks, drop spots and prices for the pair of you on their own.',
  format: {
    heading: 'What can you book for Fortnite on Duoly?',
    text: 'Duoly sells Fortnite by the hour, because a battle royale match has no fixed length. One booked hour buys a reviewed higher-rank player in your lobby on your own account: Duo Plus brings a Champion+ teammate, Duo Pro an Unreal teammate and Duo Apex a tournament-level player for high Unreal endgames. Ranked follows your own rank, from {{p_duo2_low}} to {{p_duo2_high}} per hour on Duo Pro, while Zero Build and Reload stay {{p_zb}} per hour at every rank. Bundles cut the total, {{pct3}} off 3 hours up to {{pct10}} off 10. Squad fills and Tournament Teammate cover cups and FNCS qualifiers run by Epic Games. Ranked parties carry no rank gate: Epic Games matches you at the highest rank in the party, so expect harder lobbies rather than a block.',
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
      'Teammate prices are per hour, because a battle royale match has no fixed length. Ranked services read your own rank, so an Unreal lobby costs more than a Bronze one, while Zero Build, Reload and Box Fight Practice hold one price for everybody. Bundles are the only other discount, {{pct3}} off 3 hours and {{pct5}} off 5, and you keep your own account and your own skin.',
    team: 'Squad fills are priced per seat, so a card covers the default seats and falls when you only need one more body: Squad Fill covers up to {{seats_squad}} seats and Tournament Teammate {{seats_cup}}. Both are flat hourly prices rather than rank-priced, because a cup lobby is set by the bracket rather than by your rank. Bundles take {{pct3}} off 3 hours and {{pct5}} off 5.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount, so the {{pct3}} and {{pct5}} savings on teammate hours stop at the coaching grid. Build Battle Coaching drills edits, ramp rushes and box fights in Creative, and Play and Learn is the live option where a coach talks through a real Ranked hour as it happens. Screen share runs on Discord.',
  },
  steps: {
    heading: 'How does booking a Fortnite duo work?',
    items: [
      'Pick a service and the number of hours. Duo Pro is the Ranked Duos tier with an Unreal teammate, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five hours take {{pct5}} off.',
      'Add your region, rank, input and language at checkout. Name Europe, {{rank_duo2}} and controller or keyboard, so your teammate reads the real request before accepting the order.',
      'Meet your teammate in the order chat, agree a drop spot and a rotation route, then add each other with your Epic name. A single Duo Pro hour costs {{p_duo2}} at the same rank.',
    ],
    note: 'Duoly reviews every Fortnite teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Fortnite session fits you?',
    intro:
      'The right Fortnite session is the one matching your goal for the hour, so pick the goal first and let the price follow. Ranked hours are priced by your own rank, from {{p_duo2_low}} on Duo Pro, while casual hours stay flat. Bundles take {{pct3}} off 3 hours and {{pct5}} off 5, and cup entry still follows the rules from Epic Games.',
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
          'Reload costs {{p_zb}} per hour on the small map, where respawns keep the action going.',
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
        'An hour is the honest unit for Fortnite, because a battle royale match from Epic Games has no fixed length. One Ranked Duos game can end in the first zone or run twenty minutes into a pro endgame, so a per-match price would charge the same for both. An hour of Duo Pro costs {{p_duo2}} at {{rank_duo2}} and usually covers several games, which is also long enough to fix something: agree a drop spot, then agree whether the hour is for points or for practice.',
        'Ranked prices follow your own rank, so {{rank_duo2_low}} players pay {{p_duo2_low}} per hour and {{rank_duo2_high}} players pay {{p_duo2_high}}, because high Unreal lobbies need stronger teammates. Casual hours keep one flat price: Zero Build and Reload each cost {{p_zb}}, and Creative Box Fights costs {{p_box}}. Bundles take {{pct3}} off 3 hours or {{pct5}} off 5. Voice runs on Discord, and the invite goes out with your Epic name.',
      ],
    },
    {
      heading: 'Should you book a duo, a squad fill or a cup teammate?',
      paragraphs: [
        'A duo booking adds one teammate to your games. A squad fill is one order hiring several players at once, so Squad Fill covers up to {{seats_squad}} seats with Unreal players at {{p_squad}} per hour. Tournament Teammate is the competitive option for Cash Cups and FNCS qualifiers run by Epic Games, at {{p_cup}} per hour for {{seats_cup}} seats. Every cup has its own eligibility rules, so check the in-game compete tab before booking.',
        'Pick the seats you actually need, because every seat is priced separately: a duo short one player for a trio books one seat instead of three. Agree the drop and the rotation plan, then agree who carries the mats and who takes the first fight. Keep comms on one call so the endgame reads reach everybody. Ranked matches at the highest rank in your party, so a Bronze player with an Unreal teammate should expect Unreal lobbies. Bundles still apply, {{pct3}} off 3 hours and {{pct5}} off 5.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro hours in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} controller player in Europe books 3 Duo Pro hours. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one hour. Fortnite puts no rank gate on a Ranked party, so this pairing queues straight away and simply plays at the Unreal teammate level. The order chat opens straight after payment, and the first message names the region, the rank and the input: Europe, {{rank_duo2}}, controller, looking for a partner who calls rotations early.',
        'From there the evening runs on a short plan. You agree a drop spot and a rotation route, voice goes on, and the invite goes out with the Epic name. After each game you pick one adjustment, such as leaving the zone edge ten seconds earlier instead of fighting for the high ground twice. An hour usually covers three or four Ranked games, and 5 hours take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Fortnite coaching the better booking?',
      paragraphs: [
        'Fortnite coaching is the better booking when the goal is a repeatable fix rather than company for the next hour. A duo teammate answers a quick question between games; a coach drills one skill in Creative and leaves you with homework. Build and Edit Course costs {{p_build}} per hour, and coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'A player who loses every box fight gains more from one Creative hour than from another Ranked game. A player who only wants fun gains more from Reload at {{p_zb}} per hour. Play and Learn is one live Ranked hour with an Unreal coach at {{p_learn}}. The full service list, preparation tips and lesson formats live on the [Fortnite coaching page](/games/fortnite/coaching), and screen share runs on Discord.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Fortnite sessions?',
    items: [
      [
        'Is Duoly a free Fortnite teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game friend list from Epic Games stay the free routes to a squad.',
      ],
      [
        'How much does a Fortnite duo cost?',
        'Duo Pro is {{p_duo2}} per hour at {{rank_duo2}}, from {{p_duo2_low}} at the lowest rank. Zero Build and Reload each cost {{p_zb}} per hour.',
      ],
      [
        'Why per hour instead of per match?',
        'A battle royale match has no fixed length, so an hour prices the real session honestly. Three hours get {{pct3}} off, and 5 hours get {{pct5}} off.',
      ],
      [
        'Can any rank queue Ranked together?',
        'Yes. Epic Games sets no rank gap limit on a Ranked party and matches you at the highest rank in it, so a lower-ranked player should expect tougher lobbies for the hour.',
      ],
      [
        'Can a teammate join a Cash Cup with me?',
        'Yes. Tournament Teammate is built for cups and FNCS qualifiers, and the eligibility rules from Epic Games still apply to both accounts.',
      ],
      [
        'Where do I book a Fortnite coach?',
        'On the Fortnite coaching page, with the Build and Edit Course by the hour and one live Ranked hour in Play and Learn, with screen share on Discord.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to drop into Fortnite?',
    text: 'Duo Pro is the Ranked Duos tier with an Unreal teammate from Duoly, and 3 hours at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off. Zero Build stays {{p_zb}} per hour at any rank. Pick your rank and input, then meet your teammate in the order chat.',
  },
};
