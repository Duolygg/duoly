// What customers can book, per game. The homepage "Pick a mode" section reads this.
//
// Tabs (cat): duo (one teammate joins you), other = "Teams" (we fill several seats), social (just for fun),
// gg (Gamer Girls), training (coaching). Bundles are built from the game's `main` service.
// unit: 'game' for match-based games, 'hour' for battle royale / sandbox games where a "game" has no fixed length.
// Prices are EUR per unit (the homepage converts to USD). Descriptions say exactly what happens in the session.
//
// Entry: [id, tab, title, tier line, description, price, { badge, unit, was }]

const playLearn = (coach, price, what) => ['learn', 'training', 'Play & Learn', coach + ' coach · live', 'Play a real ' + what + ' together while your coach explains every decision out loud, with a quick review after. Your first one is half price.', Math.floor(price / 2 * 100) / 100, { was: price, badge: '−50%' }];
const gg = (unit, casual, rank, ranked, prices) => [
  ['gg1', 'gg', 'Gamer Girl Duo', 'Verified Gamer Girl · voice', 'A verified Gamer Girl joins you for ' + casual + ' on voice. Relaxed games, good conversation, no pressure.', prices[0], { badge: 'New', unit }],
  ['gg2', 'gg', 'Gamer Girl Ranked', 'Gamer Girl · ' + rank, 'Climb ' + ranked + ' with a ' + rank + ' Gamer Girl who plays to win and keeps comms friendly.', prices[1], { unit }]
];

export const CATALOG = {
  lol: {
    unit: 'game', main: 'duo2', bundles: ['Lane Phase', 'Baron Call', 'Elder Soul'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Diamond 4+ teammate', 'Ranked Solo/Duo with a Diamond player in the role you need. They play around your lane, ping objectives and keep the game calm.', 4.49],
      ['duo2', 'duo', 'Duo Pro', 'Master+ teammate', 'Ranked Solo/Duo with a Master player who shot-calls: when to fight, which objective is next, when to back off. Ask anything between games.', 5.99, { badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Grandmaster+ teammate', 'A Grandmaster or Challenger player for Diamond and Master lobbies, when you need a partner who can take over games.', 8.99],
      ['arena', 'duo', 'Arena Partner', 'Master+ teammate · Arena', 'Team up in Arena while it’s in rotation. Your partner picks augments that combo with yours and talks through every round.', 3.49, { badge: 'Duo mode' }],
      ['ranked5', 'other', 'Ranked 5s', 'Full five · Master+ players', 'Play Ranked Flex as a real five-stack: Master+ players on every role you need, a planned draft, one shotcaller and voice comms the whole game.', 8.99, { badge: 'Popular' }],
      ['flex', 'other', 'Flex Squad', 'Master+ players · Ranked Flex', 'Bring one to three friends to Ranked Flex and we fill the empty seats with Master+ players, so your five finally has a jungler.', 7.99],
      ['clash', 'other', 'Clash Roster', 'Master+ players · Clash', 'Short a player (or three) for Clash weekend? We fill your roster with Master+ players who know draft and scouting.', 9.99],
      ['swift', 'social', 'Swiftplay', 'Master+ teammate · fast games', 'Quick Summoner’s Rift games of about 15 to 20 minutes. Same map, no LP on the line, just fun.', 2.99, { badge: 'Fast' }],
      ['aram', 'social', 'ARAM Night', 'High-elo teammate · Howling Abyss', 'Random champions, one lane, nonstop teamfights. A great way to play with someone good, without the tryhard.', 2.99],
      ['norm', 'social', 'Normal Draft', 'Master+ teammate', 'A full normal game to try a new champion or role with a strong player covering for you.', 3.49],
      ...gg('game', 'ARAM, Swiftplay or normals', 'Diamond+', 'Solo/Duo', [4.99, 5.99]),
      playLearn('Master+', 12.99, 'ranked game'),
      ['vod', 'training', 'VOD Review', 'Grandmaster+ coach · 1 hour', 'Send a recent game. Your coach goes through it with you on Discord (laning, waves, map moves) and leaves you with three things to fix.', 14.99, { unit: 'hour' }],
      ['champ', 'training', 'Champion Mastery', 'Grandmaster+ coach · 1 hour', 'One champion, properly: matchups, combos, builds and power spikes, practised in a live game.', 14.99, { unit: 'hour' }]
    ]
  },
  val: {
    unit: 'game', main: 'duo2', bundles: ['Spike Plant', 'Retake', 'Ace'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Ascendant+ teammate', 'Competitive with an Ascendant player who plays a role that fits your agent, calls rotations and trades for you.', 5.99],
      ['duo2', 'duo', 'Duo Pro', 'Immortal+ teammate', 'Competitive with an Immortal player who calls the round: where to play, when to rotate, what the enemy is doing.', 8.99, { badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Radiant teammate', 'A Radiant-level player for high-elo lobbies who can hold a site alone and win rounds when it gets messy.', 12.99],
      ['skirm', 'duo', 'Skirmish 2v2', 'Immortal+ teammate · 2v2', 'Short 2v2 Skirmish games. Pure aim and trading with a strong partner, perfect between ranked sessions.', 5.49, { badge: 'Duo mode' }],
      ['stack', 'other', 'Stack Fill', 'Immortal+ players · Competitive', 'Queue Competitive with your friends and we fill the empty seats with Immortal+ players who call utility.', 7.49],
      ['premier', 'other', 'Premier Roster', 'Immortal+ players · Premier', 'Missing players for your Premier team? We fill the roster for your weekly matches with players who run real strats.', 8.99],
      ['swift', 'social', 'Swiftplay', 'Strong teammate · short games', 'Short games of about 15 minutes with the full buy system. Great for a fun session or a warm-up.', 3.99, { badge: 'Fast' }],
      ['unrated', 'social', 'Unrated', 'Strong teammate', 'Full games without rank pressure. Try a new agent or practise a role with backup.', 4.49],
      ['dm', 'social', 'Deathmatch Warm-Up', 'Aim partner', 'Warm up together in Deathmatch and Team Deathmatch before you queue ranked.', 2.99],
      ...gg('game', 'Swiftplay, Unrated or Spike Rush', 'Ascendant+', 'Competitive', [6.99, 7.99]),
      playLearn('Immortal+', 14.99, 'Competitive game'),
      ['vod', 'training', 'VOD Review', 'Immortal+ coach · 1 hour', 'Your coach reviews a recent match with you round by round: positioning, utility and decision-making.', 17.99, { unit: 'hour' }],
      ['aim', 'training', 'Aim & Crosshair', 'Immortal+ coach · 1 hour', 'Crosshair placement, peeking and counter-strafing, plus a training routine made for you.', 17.99, { unit: 'hour' }]
    ]
  },
  cs2: {
    unit: 'game', main: 'duo2', bundles: ['Eco Round', 'Force Buy', 'Major Run'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Premier 15,000+ teammate', 'Competitive or Premier with a 15k+ player who trades you, throws the right utility and keeps the economy on track.', 5.99],
      ['duo2', 'duo', 'Duo Pro', 'Premier 20,000+ teammate', 'Premier with a 20k+ player who calls rounds, buys and rotations, and explains the why between halves.', 8.99, { badge: 'Most picked' }],
      ['duo3', 'duo', 'FACEIT Duo', 'FACEIT Level 10 teammate', 'Queue FACEIT with a Level 10 player for serious matches, sharper calls and better teammates.', 12.99],
      ['wing', 'duo', 'Wingman Duo', 'Global Elite teammate · 2v2', 'The real 2v2 with a Global Elite Wingman player. Short matches on small maps where every round depends on the two of you.', 6.99, { badge: 'Duo mode' }],
      ['five', 'other', '5-Stack Premier', 'Premier 20,000+ players', 'Bring your friends and we fill your five with players who know their positions and their smokes.', 7.99],
      ['faceit5', 'other', 'FACEIT Stack', 'FACEIT 8+ players', 'Queue FACEIT as a full stack with level 8+ players who call and support.', 9.49],
      ['casual', 'social', 'Casual & Deathmatch', 'Strong teammate', 'Warm up your aim in Deathmatch or play casual games, no stakes.', 3.99],
      ['retake', 'social', 'Retake Servers', 'Strong teammate', 'Play community retake servers together: the fastest way to practise site executes and clutches.', 3.49],
      ...gg('game', 'Casual, Wingman or Deathmatch', 'Premier 15,000+', 'Premier', [7.49, 7.99]),
      playLearn('FACEIT 10', 14.99, 'Premier match'),
      ['demo', 'training', 'Demo Review', 'FACEIT 10 coach · 1 hour', 'Your coach watches your demo with you: positioning, crosshair placement, utility usage and mid-round decisions.', 17.99, { unit: 'hour' }],
      ['util', 'training', 'Utility & Lineups', 'FACEIT 10 coach · 1 hour', 'Smokes, flashes and molotovs for your map pool, with lineups you can keep using.', 17.99, { unit: 'hour' }]
    ]
  },
  fn: {
    unit: 'hour', main: 'duo2', bundles: ['Hot Drop', 'Storm Surge', 'Final Circle'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Champion+ teammate', 'An hour of Ranked Duos with a Champion player who calls drops and rotations and gets you into endgame alive.', 9.99, { unit: 'hour' }],
      ['duo2', 'duo', 'Duo Pro', 'Unreal teammate', 'An hour of Ranked Duos or Zero Build with an Unreal player who handles fights while you play your game.', 12.99, { unit: 'hour', badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Unreal · high Power Ranking', 'An hour with a tournament-level player for high Unreal lobbies and endgames full of pros.', 14.99, { unit: 'hour' }],
      ['cup', 'other', 'Tournament Teammate', 'Tournament player · cups & FNCS', 'Compete in Cash Cups, Victory Cups or FNCS qualifiers with a teammate who has tournament earnings. You play together, start to finish.', 19.99, { unit: 'hour', badge: 'Competitive' }],
      ['squad', 'other', 'Squad Fill', 'Unreal players', 'Bring a friend or two and we fill your trio or squad with Unreal players who call rotations.', 14.99, { unit: 'hour' }],
      ['zb', 'social', 'Zero Build', 'Strong teammate', 'Battle royale without building: positioning, cover and aim, at a relaxed pace.', 7.99, { unit: 'hour' }],
      ['reload', 'social', 'Reload', 'Strong teammate', 'Fast games on a small map with respawns. Constant action, almost no waiting.', 7.99, { unit: 'hour', badge: 'Fun' }],
      ['box', 'social', 'Creative Box Fights', 'Unreal teammate', 'Box fights and build fights in Creative with someone who’ll push you, and show you how they did it.', 7.49, { unit: 'hour' }],
      ...gg('hour', 'Zero Build, Reload or Creative', 'Champion+', 'Ranked Duos', [9.49, 11.99]),
      playLearn('Unreal', 16.99, 'hour of Ranked'),
      ['build', 'training', 'Build & Edit Course', 'Unreal coach · 1 hour', 'Piece control, edits and box fights, drilled in Creative with exercises to keep practising.', 16.99, { unit: 'hour' }]
    ]
  },
  cod: {
    unit: 'hour', main: 'duo2', bundles: ['Drop Zone', 'Loadout Drop', 'Nuke'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Crimson+ teammate · Multiplayer', 'An hour of multiplayer Ranked Play with a Crimson player who holds lanes and plays the objective with you.', 10.99, { unit: 'hour' }],
      ['duo2', 'duo', 'Duo Pro', 'Crimson+ teammate · Warzone', 'An hour of Warzone duos with a player who knows the loadouts, the rotations and when to take the fight.', 11.99, { unit: 'hour', badge: 'Most picked' }],
      ['duo3', 'duo', 'Warzone Ranked', 'Iridescent teammate', 'An hour of Warzone Ranked with an Iridescent player, for when every placement point counts.', 13.99, { unit: 'hour' }],
      ['rebirth', 'duo', 'Rebirth Duo', 'Crimson+ teammate · Resurgence', 'Fast Resurgence games on the small island, where respawns keep the action going. Great for quick sessions.', 10.99, { unit: 'hour', badge: 'Fast' }],
      ['quads', 'other', 'Warzone Quad Fill', 'Crimson+ players', 'Bring a friend or two and we fill your quad with players who play for the win.', 14.99, { unit: 'hour' }],
      ['mp4', 'other', 'Ranked 4-Stack', 'Crimson+ players · Multiplayer', 'Fill your multiplayer Ranked Play team with players who know the maps and the spawns.', 13.99, { unit: 'hour' }],
      ['zombies', 'social', 'Zombies Run', 'Experienced co-op partner', 'Round-based Zombies with someone who knows the map, the wonder weapon and the Easter egg steps.', 8.99, { unit: 'hour', badge: 'Fun' }],
      ['party', 'social', 'Party Modes', 'Strong teammate', 'Unranked multiplayer and party playlists, just for fun.', 7.99, { unit: 'hour' }],
      ...gg('hour', 'Zombies, party modes or Resurgence', 'Crimson+', 'Warzone', [9.99, 12.49]),
      playLearn('Iridescent', 16.99, 'hour of Warzone'),
      ['loadout', 'training', 'Loadouts & Movement', 'Iridescent coach · 1 hour', 'Builds that suit how you play, plus slide-cancels, mantles and positioning, practised live.', 15.99, { unit: 'hour' }]
    ]
  },
  apex: {
    unit: 'hour', main: 'duo2', bundles: ['Hot Zone', 'Ring Closing', 'Champion Squad'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Diamond+ teammate · Ranked', 'An hour of Ranked with a Diamond player: you two plus one more, with clear calls on drops, rotations and fights.', 9.99, { unit: 'hour' }],
      ['duo2', 'duo', 'Duo Pro', 'Master / Predator teammate · Ranked', 'An hour of Ranked with a Master or Apex Predator who reads the ring and takes the right fights.', 12.99, { unit: 'hour', badge: 'Most picked' }],
      ['duos', 'duo', 'Duos Playlist', 'Master teammate · 2-player squads', 'The Duos mode: just the two of you, more fights and quicker games.', 9.99, { unit: 'hour', badge: 'Duo mode' }],
      ['trio', 'other', 'Full Trio', 'Two Master+ players', 'Two high-rank players fill your trio. You play your legend, they handle the rest.', 17.99, { unit: 'hour' }],
      ['mix', 'social', 'Mixtape', 'Strong teammate', 'Team Deathmatch, Control and Gun Run. Fast, fun modes to warm up or learn a new legend.', 7.49, { unit: 'hour', badge: 'Fun' }],
      ['pubs', 'social', 'Pubs & Legend Practice', 'Strong teammate', 'Unranked battle royale to try a new legend or weapon with a partner who covers you.', 7.99, { unit: 'hour' }],
      ...gg('hour', 'Mixtape or pubs', 'Diamond+', 'Ranked', [9.49, 11.99]),
      playLearn('Master', 16.99, 'hour of Ranked'),
      ['move', 'training', 'Movement Course', 'Master coach · 1 hour', 'Tap-strafes, slide jumps, wall bounces and positioning, practised in the Firing Range.', 15.99, { unit: 'hour' }]
    ]
  },
  r6: {
    unit: 'game', main: 'duo2', bundles: ['Breach', 'Plant', 'Ace Round'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Emerald+ teammate', 'Ranked with an Emerald player who drones, calls and takes anchor or entry, whichever your team needs.', 5.49],
      ['duo2', 'duo', 'Duo Pro', 'Diamond+ teammate', 'Ranked with a Diamond player who calls the round: drones, rotations, where the defenders are.', 8.49, { badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Champion teammate', 'A Champion-level player for high-elo lobbies who can win rounds on their own.', 11.99],
      ['stack', 'other', '5-Stack Fill', 'Diamond+ players', 'Bring your friends and we fill your five with players who run real strats and utility.', 6.49],
      ['quick', 'social', 'Quick Match', 'Strong teammate', 'Unranked games to learn maps and operators with someone who explains as you play.', 3.99],
      ['arcade', 'social', 'Arcade & Deathmatch', 'Strong teammate', 'Warm-up modes and arcade playlists between ranked games.', 3.49],
      ...gg('game', 'Quick Match or Arcade', 'Emerald+', 'Ranked', [6.49, 7.49]),
      playLearn('Champion', 13.99, 'Ranked match'),
      ['ops', 'training', 'Operator Lab', 'Champion coach · 1 hour', 'One attacker and one defender, properly: gadgets, setups and timings.', 16.99, { unit: 'hour' }],
      ['maps', 'training', 'Map & Callouts', 'Champion coach · 1 hour', 'Your weakest map, room by room: callouts, rotations and setups for every site.', 15.99, { unit: 'hour' }]
    ]
  },
  mr: {
    unit: 'game', main: 'duo2', bundles: ['Assemble', 'Heroic Run', 'Infinity Grind'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Diamond+ teammate', 'Competitive with a Diamond player who fills the role your team is missing and keeps the fights together.', 4.99],
      ['duo2', 'duo', 'Duo Pro', 'Grandmaster+ teammate', 'Competitive with a Grandmaster player who tracks ults, calls dives and knows when to reset.', 7.99, { badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Celestial+ teammate', 'A Celestial or higher player for high-rank lobbies who can carry fights on any role.', 10.99],
      ['teamup', 'duo', 'Team-Up Duo', 'Grandmaster+ teammate', 'Pick a hero pair with a Team-Up ability and learn to pull it off together, in Quick Match or Competitive.', 5.49, { badge: 'Fun' }],
      ['six', 'other', '6-Stack Fill', 'Grandmaster+ players', 'Bring your friends and we fill your six with players on the roles you need, on voice.', 5.99],
      ['quick', 'social', 'Quick Match & Arcade', 'Strong teammate', 'No-pressure games to try new heroes or just have fun.', 3.49],
      ...gg('game', 'Quick Match or Arcade', 'Diamond+', 'Competitive', [6.49, 6.99]),
      playLearn('Grandmaster+', 12.99, 'Competitive match'),
      ['hero', 'training', 'Hero Coaching', 'Grandmaster+ coach · 1 hour', 'One hero, done right: abilities, ult timing, positioning and matchups.', 15.99, { unit: 'hour' }]
    ]
  },
  ow: {
    unit: 'game', main: 'duo2', bundles: ['Push', 'Payload', 'Ult Charged'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Diamond+ teammate', 'Role Queue Competitive with a Diamond player who complements your role and plays around you.', 4.99],
      ['duo2', 'duo', 'Duo Pro', 'Master+ teammate', 'Competitive with a Master player who tracks cooldowns, calls engages and explains fights between rounds.', 7.99, { badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Grandmaster+ teammate', 'A Grandmaster or Champion player for high-rank lobbies who can swing fights on their own.', 10.99],
      ['stadium', 'duo', 'Stadium Duo', 'Master+ teammate · Stadium', 'Stadium runs together: plan your builds round by round and close out the best of seven.', 5.49, { badge: 'Fun' }],
      ['five', 'other', '5-Stack Role Queue', 'Master+ players', 'Bring your friends and we fill your five on the roles you need, for a real comp night.', 5.99],
      ['qp', 'social', 'Quick Play & Arcade', 'Strong teammate', 'Casual games and arcade modes with someone fun and good.', 3.49],
      ...gg('game', 'Quick Play or Arcade', 'Diamond+', 'Competitive', [6.49, 6.99]),
      playLearn('Grandmaster+', 12.99, 'Competitive match'),
      ['role', 'training', 'Role Coaching', 'Grandmaster+ coach · 1 hour', 'Tank, damage or support: positioning, cooldowns and when to take space.', 15.99, { unit: 'hour' }]
    ]
  },
  rl: {
    unit: 'game', main: 'duo2', bundles: ['Boost Pad', 'Aerial', 'Supersonic Run'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Champion+ teammate · 2v2', 'Ranked Doubles with a Champion player who rotates properly, so you’re never both chasing the ball.', 4.99],
      ['duo2', 'duo', 'Duo Pro', 'Grand Champion teammate · 2v2', 'Ranked Doubles with a Grand Champion who sets you up, covers back post and calls boost.', 7.99, { badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Supersonic Legend · 2v2', 'A Supersonic Legend for high-rank Doubles who wins kickoffs and plays like a pro.', 10.99],
      ['three', 'other', '3v3 Standard', 'Grand Champion players', 'Ranked Standard with your friend and one or two Grand Champions filling the team.', 5.99],
      ['casual', 'social', 'Casual 3v3', 'Strong teammate', 'Relaxed casual matches with someone who actually passes.', 3.49],
      ['extra', 'social', 'Extra Modes', 'Strong teammate', 'Rumble, Hoops, Snow Day, Dropshot and Heatseeker. Pure fun.', 3.49, { badge: 'Fun' }],
      ...gg('game', 'casual or extra modes', 'Champion+', 'Doubles', [6.49, 6.99]),
      playLearn('Grand Champion', 12.99, 'Doubles match'),
      ['mech', 'training', 'Mechanics Training', 'Grand Champion coach · 1 hour', 'Aerials, flicks and recoveries, with training packs to keep practising.', 15.99, { unit: 'hour' }]
    ]
  },
  tft: {
    unit: 'game', main: 'duo2', bundles: ['Early Augment', 'Top Four', 'Three-Star Run'],
    services: [
      ['duo1', 'duo', 'Double Up', 'Master+ partner · team of two', 'Play Double Up with a Master player: you plan the boards together and send help at the right moments.', 3.99, { badge: 'Duo mode' }],
      ['duo2', 'duo', 'Board Coach', 'Master+ player · live', 'You play your ranked game; a Master player watches your screen on Discord and tells you what to buy, roll and position, live.', 4.99, { badge: 'Most picked' }],
      ['norm', 'social', 'Normals & Hyper Roll', 'Strong teammate', 'Fast, casual lobbies together, with good chat and no LP on the line.', 2.99],
      ...gg('game', 'Normals or Hyper Roll', 'Diamond+', 'Double Up', [4.99, 5.49]),
      ['econ', 'training', 'Comp & Econ Review', 'Master+ coach · 1 hour', 'Find comps that suit you, when to roll or level, and how to manage gold from stage two.', 12.99, { unit: 'hour' }]
    ]
  },
  fc: {
    unit: 'game', main: 'duo2', bundles: ['Kick-Off', 'Hat Trick', 'Title Race'],
    services: [
      ['duo2', 'duo', 'Co-op Rivals', 'Division 1+ partner · 2v2', 'Play Co-op Rivals with a Division 1 partner who links up, tracks back and talks you through it.', 5.49, { badge: 'Most picked' }],
      ['duo3', 'duo', 'Co-op Elite', 'Elite partner · 2v2', 'Co-op Rivals with an Elite-level player for the top divisions.', 7.99],
      ['clubs', 'other', 'Clubs Lineup', 'Division 1+ players', 'Fill your Clubs team with players who hold their position and actually pass.', 5.49],
      ['friendly', 'social', 'Practice Match', 'Elite opponent', 'Play an online friendly against an Elite player who tells you what to fix after the match.', 3.99],
      ['kickoff', 'social', 'Kick-Off & Friendlies', 'Fun partner', 'Couch-style friendlies on the same team, just for fun.', 2.99],
      ...gg('game', 'Kick-Off or friendlies', 'Division 3+', 'Co-op Rivals', [5.99, 6.99]),
      ['tactics', 'training', 'Tactics & Squad Builder', 'Elite coach · 1 hour', 'Formations, custom tactics and a squad that fits how you play.', 14.99, { unit: 'hour' }],
      ['champs', 'training', 'Champions Prep', 'Elite coach · 1 hour', 'Get ready for your weekend-league games: mindset, defending and the meta, with live practice.', 14.99, { unit: 'hour' }]
    ]
  },
  arc: {
    unit: 'hour', main: 'duo2', bundles: ['Supply Run', 'Deep Raid', 'Full Expedition'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Experienced raider', 'An hour of raids with a player who knows the loot spots and the safe ways out.', 7.99, { unit: 'hour' }],
      ['duo2', 'duo', 'Duo Pro', 'Veteran raider', 'An hour with a Veteran who handles fights, picks the routes and gets you out with your loot.', 9.99, { unit: 'hour', badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Elite raider', 'An hour with one of the best raiders around, for high-risk maps and big extractions.', 13.99, { unit: 'hour' }],
      ['squad', 'other', 'Full Squad', 'Two Veteran raiders', 'Two Veterans join you as a full trio. You loot, they keep you alive.', 17.99, { unit: 'hour' }],
      ['escort', 'other', 'Escort Run', 'Elite squad', 'A squad escorts you to the big loot and back out, safely.', 15.99, { unit: 'hour', badge: 'Popular' }],
      ['learn', 'social', 'Learn the Maps', 'Friendly raider', 'Relaxed runs to learn the maps, the best loot routes and where to extract.', 6.99, { unit: 'hour' }],
      ...gg('hour', 'relaxed loot runs', 'Veteran', 'raids', [8.49, 9.99]),
      ['pvp', 'training', 'PvP & Extraction', 'Elite coach · 1 hour', 'Fights, third parties and clean extractions on every map.', 14.99, { unit: 'hour' }]
    ]
  },
  mc: {
    unit: 'hour', main: 'duo2', bundles: ['Spawn Point', 'Diamond Hunt', 'Ender Run'],
    services: [
      ['duo1', 'duo', 'PvP Duo', 'Skilled PvPer', 'An hour of PvP on the server and mode you pick: Bedwars, SkyWars, Duels, UHC or Box PvP. Your teammate covers you, calls the fights and shares tips as you go.', 6.99, { unit: 'hour' }],
      ['duo2', 'duo', 'PvP Duo Pro', 'Top PvPer', 'An hour with a top PvPer from servers like Hypixel or Minemen. They take the hard fights, carry the clutches and show you how they win them.', 8.99, { unit: 'hour', badge: 'Most picked' }],
      ['smp', 'duo', 'Survival Partner', 'Survival & SMP expert', 'Get ahead on your SMP or a fresh world: gear up fast, set up farms, build a safe base and handle the fights when someone comes for your stuff.', 6.49, { unit: 'hour' }],
      ['squad', 'other', 'Server Squad', 'Skilled PvPers', 'We fill your team for Bedwars fours, SkyWars teams, Hunger Games or UHC events with players who know the mode.', 9.99, { unit: 'hour' }],
      ['surv', 'social', 'Survival Together', 'Friendly builder', 'Start a world or join yours: build a base, go mining and explore together at your own pace.', 5.99, { unit: 'hour' }],
      ['dragon', 'social', 'Beat the Game', 'Experienced partner', 'From a fresh world to the Ender Dragon: get gear, find a stronghold and take her down together.', 6.99, { unit: 'hour', badge: 'Popular' }],
      ['hard', 'social', 'Hardcore Survival', 'Experienced partner', 'One life, together. See how far you get before it goes wrong.', 6.49, { unit: 'hour', badge: 'Fun' }],
      ['mini', 'social', 'Minigames Night', 'Fun partner', 'Bedwars, SkyWars, Build Battle, Murder Mystery, parkour and more on your favourite server.', 5.49, { unit: 'hour' }],
      ...gg('hour', 'survival, building or minigames', 'PvP-main', 'your Bedwars and SkyWars stats', [7.49, 8.49]),
      ['pvp', 'training', 'PvP Coaching', 'Top PvPer coach · 1 hour', 'Aim, combos, strafing, rod and bow play, drilled in duels on practice servers until it clicks.', 14.99, { unit: 'hour' }],
      ['bw', 'training', 'Bedwars Coaching', 'Bedwars 1000★ coach · 1 hour', 'Rush timing, bridging, bed defence and endgame clutches, practised in real games.', 14.99, { unit: 'hour' }]
    ]
  },
  pu: {
    unit: 'game', main: 'duo2', bundles: ['Lane Push', 'Goal Rush', 'Zapdos Steal'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Ultra+ teammate', 'Ranked with an Ultra player who plays the lane next to yours and calls objectives.', 3.99],
      ['duo2', 'duo', 'Duo Pro', 'Master teammate', 'Ranked with a Master player who plans rotations around Drednaw, Rotom and Zapdos.', 5.99, { badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Master 1600+ teammate', 'A top-rated Master player for high-rating games.', 9.99],
      ['squad', 'other', 'Full Squad', 'Master players', 'Fill your five with players on set roles, on voice.', 4.99],
      ['quick', 'social', 'Standard & Quick Battle', 'Strong teammate', 'Relaxed games to practise new Pokémon with backup.', 2.99],
      ...gg('game', 'Standard or Quick Battle', 'Ultra+', 'Ranked', [5.49, 5.99]),
      playLearn('Master', 9.99, 'Ranked match'),
      ['draft', 'training', 'Draft & Macro', 'Master coach · 1 hour', 'Picks that work together, objective timing and when to rotate.', 12.99, { unit: 'hour' }]
    ]
  },

  // Social (Fabian 2026-10-29, after epal.gg): no game, only time with a verified Gamer Girl. Every service is
  // in the gg tab, so only Gamer Girl teammates can take it. Instant like every order, so no wake-up calls yet.
  social: {
    unit: 'hour', main: 'chat', bundles: ['Late Night Talk', 'Movie Marathon', 'Whole Evening'],
    services: [
      ['chat', 'gg', 'Just Chat', 'Verified Gamer Girl · voice', 'Talk about anything on voice: your day, games, music, whatever is on your mind. Relaxed and friendly, no game needed.', 9.99, { badge: 'Most picked', unit: 'hour' }],
      ['watch', 'gg', 'Watch Together', 'Verified Gamer Girl · Discord stream', 'Pick a movie, show or stream and watch it together on Discord, with commentary and reactions on voice.', 9.99, { unit: 'hour' }],
      ['sleep', 'gg', 'Sleep Call', 'Verified Gamer Girl · voice', 'Stay on a calm voice call while you wind down and fall asleep. Soft talk, then quiet company.', 9.99, { badge: 'Cozy', unit: 'hour' }],
      ['karaoke', 'gg', 'Karaoke', 'Verified Gamer Girl · voice', 'Sing together or request songs she sings for you on voice. Bring your playlist or pick from hers.', 9.99, { badge: 'Fun', unit: 'hour' }]
    ]
  }
};

// The game's services as the homepage uses them.
export function servicesFor(id) {
  const c = CATALOG[id];
  if (!c) return { unit: 'game', main: 'duo2', bundles: [], modes: [] };
  const modes = c.services.map(([sid, cat, title, tier, desc, price, o = {}]) => ({
    id: sid, cat, title, tier, desc, price, badge: o.badge, unit: o.unit || (cat === 'training' && sid !== 'learn' ? 'hour' : c.unit), was: o.was
  }));
  return { unit: c.unit, main: c.main, bundles: c.bundles, modes };
}
