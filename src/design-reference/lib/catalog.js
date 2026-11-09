// What customers can book, per game. The homepage "Pick a mode" section reads this.
//
// Tabs (cat): duo (one teammate joins you), other = "Teams" (we fill several seats), social (time with a
// Gamer Girl beyond a duo), gg (Gamer Girls), training (coaching). Bundles are built from the game's `main` service.
// `fun: true` marks a casual mode (Swiftplay, ARAM, Unrated, Manhunt…): it lives in the Duo tab with any
// approved teammate since 2026-11-06 (owner decision), and the FAQ still quotes it as a "fun mode".
// unit: 'game' for match-based games, 'hour' for battle royale / sandbox games where a "game" has no fixed length.
// Prices are EUR per unit (the homepage converts to USD). Descriptions say exactly what happens in the session.
//
// Entry: [id, tab, title, tier line, description, price, { badge, unit, was }]

// Coaching costs one fixed price in every game, per game or per hour, with no first-session
// discount (owner decisions 2026-11-06). The price passed to playLearn is ignored.
const COACHING_PRICE = 12.99;
const playLearn = (coach, price, what) => ['learn', 'training', 'Play & Learn', coach + ' coach · live', 'Play a real ' + what + ' together while your coach explains every decision out loud, with a quick review after.', COACHING_PRICE];
const gg = (unit, casual, rank, ranked, prices, game, duel) => [
  ['gg1', 'gg', 'Gamer Girl Duo', 'Verified Gamer Girl · voice', 'A verified Gamer Girl joins you for ' + casual + ' on voice. Relaxed games, good conversation, no pressure.', prices[0], { badge: 'New', unit }],
  ['gg2', 'gg', 'Gamer Girl Ranked', 'Gamer Girl · ' + rank, 'Climb ' + ranked + ' with a ' + rank + ' Gamer Girl who plays to win and keeps comms friendly.', prices[1], { unit }],
  // The Social tab: Gamer Girl only (owner decisions 2026-11-06). All priced like Gamer Girl Duo.
  // 1v1 Challenge only where the game has a real 1v1 (`duel` says how); ARC Raiders has none.
  ...(duel ? [['gg1v1', 'social', '1v1 Challenge', 'Verified Gamer Girl · you vs her', 'Take on a Gamer Girl in ' + duel + '. Trash talk welcome, rematches encouraged.', prices[0], { unit, badge: 'New' }]] : []),
  ['ggbuddy', 'social', 'New Player Buddy', 'Patient Gamer Girl · voice', 'New to ' + game + '? A patient Gamer Girl plays with you and explains the basics as you go. No judgement, no pressure.', prices[0], { unit }],
  ['gghype', 'social', 'Hype Squad', 'Verified Gamer Girl · watches you play', 'She doesn’t play: she watches you play ' + game + ' on your Discord stream, cheers every play, celebrates the wins and keeps you calm after a loss.', prices[0], { unit }]
];

export const CATALOG = {
  lol: {
    unit: 'game', main: 'duo2', bundles: ['Lane Phase', 'Baron Call', 'Elder Soul'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Diamond 4+ teammate', 'Ranked Solo/Duo with a Diamond player in the role you need. They play around your lane, ping objectives and keep the game calm.', 5.49],
      ['duo2', 'duo', 'Duo Pro', 'Master+ teammate', 'Ranked Solo/Duo with a Master player who shot-calls: when to fight, which objective is next, when to back off. Ask anything between games.', 6.49, { badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Grandmaster+ teammate', 'A Grandmaster or Challenger player for Diamond and Master lobbies, when you need a partner who can take over games.', 8.99],
      ['arena', 'duo', 'Arena Partner', 'Master+ teammate · Arena', 'Team up in Arena while it’s in rotation. Your partner picks augments that combo with yours and talks through every round.', 4.49, { badge: 'Duo mode' }],
      ['ranked5', 'other', 'Ranked 5s', 'Full five · Master+ players', 'Play Ranked Flex as a real five-stack: Master+ players on every role you need, a planned draft, one shotcaller and voice comms the whole game.', 8.99, { badge: 'Popular' }],
      ['flex', 'other', 'Flex Squad', 'Master+ players · Ranked Flex', 'Bring one to three friends to Ranked Flex and we fill the empty seats with Master+ players, so your five finally has a jungler.', 7.99],
      ['clash', 'other', 'Clash Roster', 'Master+ players · Clash', 'Short a player (or three) for Clash weekend? We fill your roster with Master+ players who know draft and scouting.', 9.99],
      ['swift', 'duo', 'Swiftplay', 'Master+ teammate · fast games', 'Quick Summoner’s Rift games of about 15 to 20 minutes. Same map, no LP on the line, just fun.', 3.49, { badge: 'Fast', fun: true }],
      ['aram', 'duo', 'ARAM Night', 'High-elo teammate · Howling Abyss', 'Random champions, one lane, nonstop teamfights. A great way to play with someone good, without the tryhard.', 3.49, { fun: true }],
      ['norm', 'duo', 'Normal Draft', 'Master+ teammate', 'A full normal game to try a new champion or role with a strong player covering for you.', 3.49, { fun: true }],
      ...gg('game', 'ARAM, Swiftplay or normals', 'Diamond+', 'Solo/Duo', [4.99, 5.49], 'League', 'custom 1v1s in mid lane: first blood, 100 CS or first tower wins'),
      playLearn('Master+', 10.99, 'ranked game'),
      ['vod', 'training', 'VOD Review', 'Grandmaster+ coach · 1 hour', 'Send a recent game. Your coach goes through it with you on Discord (laning, waves, map moves) and leaves you with three things to fix.', COACHING_PRICE, { unit: 'hour' }],
      ['champ', 'training', 'Champion Mastery', 'Grandmaster+ coach · 1 hour', 'One champion, properly: matchups, combos, builds and power spikes, practised in a live game.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },
  val: {
    unit: 'game', main: 'duo2', bundles: ['Spike Plant', 'Retake', 'Ace'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Ascendant+ teammate', 'Competitive with an Ascendant player who plays a role that fits your agent, calls rotations and trades for you.', 5.99],
      ['duo2', 'duo', 'Duo Pro', 'Immortal+ teammate', 'Competitive with an Immortal player who calls the round: where to play, when to rotate, what the enemy is doing.', 7.99, { badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Radiant teammate', 'A Radiant-level player for high-elo lobbies who can hold a site alone and win rounds when it gets messy.', 8.49],
      ['skirm', 'duo', 'Skirmish 2v2', 'Immortal+ teammate · 2v2', 'Short 2v2 Skirmish games. Pure aim and trading with a strong partner, perfect between ranked sessions.', 1.99, { badge: 'Duo mode' }],
      ['stack', 'other', 'Stack Fill', 'Immortal+ players · Competitive', 'Queue Competitive with your friends and we fill the empty seats with Immortal+ players who call utility.', 7.49],
      ['premier', 'other', 'Premier Roster', 'Immortal+ players · Premier', 'Missing players for your Premier team? We fill the roster for your weekly matches with players who run real strats.', 8.99],
      ['swift', 'duo', 'Swiftplay', 'Strong teammate · short games', 'Short games of about 15 minutes with the full buy system. Great for a fun session or a warm-up.', 3.99, { badge: 'Fast', fun: true }],
      ['unrated', 'duo', 'Unrated', 'Strong teammate', 'Full games without rank pressure. Try a new agent or practise a role with backup.', 4.49, { fun: true }],
      ['dm', 'duo', 'Deathmatch Warm-Up', 'Aim partner', 'Warm up together in Deathmatch and Team Deathmatch before you queue ranked.', 2.49, { fun: true }],
      ...gg('game', 'Swiftplay, Unrated or Spike Rush', 'Ascendant+', 'Competitive', [4.99, 5.49], 'Valorant', 'custom 1v1 duels and aim battles'),
      playLearn('Immortal+', 10.99, 'Competitive game'),
      ['vod', 'training', 'VOD Review', 'Immortal+ coach · 1 hour', 'Your coach reviews a recent match with you round by round: positioning, utility and decision-making.', COACHING_PRICE, { unit: 'hour' }],
      ['aim', 'training', 'Aim & Crosshair', 'Immortal+ coach · 1 hour', 'Crosshair placement, peeking and counter-strafing, plus a training routine made for you.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },
  cs2: {
    unit: 'game', main: 'duo2', bundles: ['Eco Round', 'Force Buy', 'Major Run'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Premier 15,000+ teammate', 'Competitive or Premier with a 15k+ player who trades you, throws the right utility and keeps the economy on track.', 6.99],
      ['duo2', 'duo', 'Duo Pro', 'Premier 20,000+ teammate', 'Premier with a 20k+ player who calls rounds, buys and rotations, and explains the why between halves.', 7.49, { badge: 'Most picked' }],
      ['duo3', 'duo', 'FACEIT Duo', 'FACEIT Level 10 teammate', 'Queue FACEIT with a Level 10 player for serious matches, sharper calls and better teammates.', 9.49],
      ['wing', 'duo', 'Wingman Duo', 'Global Elite teammate · 2v2', 'The real 2v2 with a Global Elite Wingman player. Short matches on small maps where every round depends on the two of you.', 4.99, { badge: 'Duo mode' }],
      ['five', 'other', '5-Stack Premier', 'Premier 20,000+ players', 'Bring your friends and we fill your five with players who know their positions and their smokes.', 7.99],
      ['faceit5', 'other', 'FACEIT Stack', 'FACEIT 8+ players', 'Queue FACEIT as a full stack with level 8+ players who call and support.', 9.49],
      ['casual', 'duo', 'Casual & Deathmatch', 'Strong teammate', 'Warm up your aim in Deathmatch or play casual games, no stakes.', 2.99, { fun: true }],
      ['retake', 'duo', 'Retake Servers', 'Strong teammate', 'Play community retake servers together: the fastest way to practise site executes and clutches.', 2.99, { fun: true }],
      ...gg('game', 'Casual, Wingman or Deathmatch', 'Premier 15,000+', 'Premier', [4.99, 5.49], 'CS2', '1v1 aim maps and arena duels'),
      playLearn('FACEIT 10', 12.99, 'Premier match'),
      ['demo', 'training', 'Demo Review', 'FACEIT 10 coach · 1 hour', 'Your coach watches your demo with you: positioning, crosshair placement, utility usage and mid-round decisions.', COACHING_PRICE, { unit: 'hour' }],
      ['util', 'training', 'Utility & Lineups', 'FACEIT 10 coach · 1 hour', 'Smokes, flashes and molotovs for your map pool, with lineups you can keep using.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },
  fn: {
    unit: 'hour', main: 'duo2', bundles: ['Hot Drop', 'Storm Surge', 'Final Circle'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Champion+ teammate', 'An hour of Ranked Duos with a Champion player who calls drops and rotations and gets you into endgame alive.', 12.99, { unit: 'hour' }],
      ['duo2', 'duo', 'Duo Pro', 'Unreal teammate', 'An hour of Ranked Duos or Zero Build with an Unreal player who handles fights while you play your game.', 15.99, { unit: 'hour', badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Unreal · high Power Ranking', 'An hour with a tournament-level player for high Unreal lobbies and endgames full of pros.', 17.49, { unit: 'hour' }],
      ['cup', 'other', 'Tournament Teammate', 'Tournament player · cups & FNCS', 'Compete in Cash Cups, Victory Cups or FNCS qualifiers with a teammate who has tournament earnings. You play together, start to finish.', 15.99, { unit: 'hour', badge: 'Competitive' }],
      ['squad', 'other', 'Squad Fill', 'Unreal players', 'Bring a friend or two and we fill your trio or squad with Unreal players who call rotations.', 14.99, { unit: 'hour' }],
      ['zb', 'duo', 'Zero Build', 'Strong teammate', 'Battle royale without building: positioning, cover and aim, at a relaxed pace.', 8.49, { unit: 'hour', fun: true }],
      ['reload', 'duo', 'Reload', 'Strong teammate', 'Fast games on a small map with respawns. Constant action, almost no waiting.', 8.49, { unit: 'hour', badge: 'Fun', fun: true }],
      ['box', 'duo', 'Creative Box Fights', 'Unreal teammate', 'Box fights and build fights in Creative with someone who’ll push you, and show you how they did it.', 8.99, { unit: 'hour', fun: true }],
      ...gg('hour', 'Zero Build, Reload or Creative', 'Champion+', 'Ranked Duos', [10.49, 10.99], 'Fortnite', '1v1 box fights and build battles in Creative'),
      playLearn('Unreal', 14.99, 'hour of Ranked'),
      ['build', 'training', 'Build & Edit Course', 'Unreal coach · 1 hour', 'Piece control, edits and box fights, drilled in Creative with exercises to keep practising.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },
  cod: {
    unit: 'hour', main: 'duo2', bundles: ['Drop Zone', 'Loadout Drop', 'Nuke'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Crimson+ teammate · Multiplayer', 'An hour of multiplayer Ranked Play with a Crimson player who holds lanes and plays the objective with you.', 12.99, { unit: 'hour' }],
      ['duo2', 'duo', 'Duo Pro', 'Crimson+ teammate · Warzone', 'An hour of Warzone duos with a player who knows the loadouts, the rotations and when to take the fight.', 14.49, { unit: 'hour', badge: 'Most picked' }],
      ['duo3', 'duo', 'Warzone Ranked', 'Iridescent teammate', 'An hour of Warzone Ranked with an Iridescent player, for when every placement point counts.', 19.49, { unit: 'hour' }],
      ['rebirth', 'duo', 'Rebirth Duo', 'Crimson+ teammate · Resurgence', 'Fast Resurgence games on the small island, where respawns keep the action going. Great for quick sessions.', 10.49, { unit: 'hour', badge: 'Fast' }],
      ['quads', 'other', 'Warzone Quad Fill', 'Crimson+ players', 'Bring a friend or two and we fill your quad with players who play for the win.', 14.99, { unit: 'hour' }],
      ['mp4', 'other', 'Ranked 4-Stack', 'Crimson+ players · Multiplayer', 'Fill your multiplayer Ranked Play team with players who know the maps and the spawns.', 13.99, { unit: 'hour' }],
      ['zombies', 'duo', 'Zombies Run', 'Experienced co-op partner', 'Round-based Zombies with someone who knows the map, the wonder weapon and the Easter egg steps.', 8.99, { unit: 'hour', badge: 'Fun', fun: true }],
      ['party', 'duo', 'Party Modes', 'Strong teammate', 'Unranked multiplayer and party playlists, just for fun.', 7.99, { unit: 'hour', fun: true }],
      ...gg('hour', 'Zombies, party modes or Resurgence', 'Crimson+', 'Warzone', [11.49, 12.99], 'Call of Duty', '1v1 gunfights in private matches'),
      playLearn('Iridescent', 16.99, 'hour of Warzone'),
      ['loadout', 'training', 'Loadouts & Movement', 'Iridescent coach · 1 hour', 'Builds that suit how you play, plus slide-cancels, mantles and positioning, practised live.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },
  apex: {
    unit: 'hour', main: 'duo2', bundles: ['Hot Zone', 'Ring Closing', 'Champion Squad'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Diamond+ teammate · Ranked', 'An hour of Ranked with a Diamond player: you two plus one more, with clear calls on drops, rotations and fights.', 14.49, { unit: 'hour' }],
      ['duo2', 'duo', 'Duo Pro', 'Master / Predator teammate · Ranked', 'An hour of Ranked with a Master or Apex Predator who reads the ring and takes the right fights.', 17.49, { unit: 'hour', badge: 'Most picked' }],
      ['duos', 'duo', 'Duos Playlist', 'Master teammate · 2-player squads', 'The Duos mode: just the two of you, more fights and quicker games.', 10.49, { unit: 'hour', badge: 'Duo mode' }],
      ['trio', 'other', 'Full Trio', 'Two Master+ players', 'Two high-rank players fill your trio. You play your legend, they handle the rest.', 17.99, { unit: 'hour' }],
      ['mix', 'duo', 'Mixtape', 'Strong teammate', 'Team Deathmatch, Control and Gun Run. Fast, fun modes to warm up or learn a new legend.', 7.99, { unit: 'hour', badge: 'Fun', fun: true }],
      ['pubs', 'duo', 'Pubs & Legend Practice', 'Strong teammate', 'Unranked battle royale to try a new legend or weapon with a partner who covers you.', 8.49, { unit: 'hour', fun: true }],
      ...gg('hour', 'Mixtape or pubs', 'Diamond+', 'Ranked', [11.49, 12.99], 'Apex', '1v1 fights in the Firing Range'),
      playLearn('Master', 14.99, 'hour of Ranked'),
      ['move', 'training', 'Movement Course', 'Master coach · 1 hour', 'Tap-strafes, slide jumps, wall bounces and positioning, practised in the Firing Range.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },
  r6: {
    unit: 'game', main: 'duo2', bundles: ['Breach', 'Plant', 'Ace Round'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Emerald+ teammate', 'Ranked with an Emerald player who drones, calls and takes anchor or entry, whichever your team needs.', 4.99],
      ['duo2', 'duo', 'Duo Pro', 'Diamond+ teammate', 'Ranked with a Diamond player who calls the round: drones, rotations, where the defenders are.', 5.99, { badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Champion teammate', 'A Champion-level player for high-elo lobbies who can win rounds on their own.', 8.49],
      ['stack', 'other', '5-Stack Fill', 'Diamond+ players', 'Bring your friends and we fill your five with players who run real strats and utility.', 6.49],
      ['quick', 'duo', 'Quick Match', 'Strong teammate', 'Unranked games to learn maps and operators with someone who explains as you play.', 2.49, { fun: true }],
      ['arcade', 'duo', 'Arcade & Deathmatch', 'Strong teammate', 'Warm-up modes and arcade playlists between ranked games.', 2.49, { fun: true }],
      ...gg('game', 'Quick Match or Arcade', 'Emerald+', 'Ranked', [2.99, 5.99], 'Rainbow Six', '1v1 custom games, one clutch at a time'),
      playLearn('Champion', 9.99, 'Ranked match'),
      ['ops', 'training', 'Operator Lab', 'Champion coach · 1 hour', 'One attacker and one defender, properly: gadgets, setups and timings.', COACHING_PRICE, { unit: 'hour' }],
      ['maps', 'training', 'Map & Callouts', 'Champion coach · 1 hour', 'Your weakest map, room by room: callouts, rotations and setups for every site.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },
  mr: {
    unit: 'game', main: 'duo2', bundles: ['Assemble', 'Heroic Run', 'Infinity Grind'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Diamond+ teammate', 'Competitive with a Diamond player who fills the role your team is missing and keeps the fights together.', 3.49],
      ['duo2', 'duo', 'Duo Pro', 'Grandmaster+ teammate', 'Competitive with a Grandmaster player who tracks ults, calls dives and knows when to reset.', 4.49, { badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Celestial+ teammate', 'A Celestial or higher player for high-rank lobbies who can carry fights on any role.', 4.99],
      ['teamup', 'duo', 'Team-Up Duo', 'Grandmaster+ teammate', 'Pick a hero pair with a Team-Up ability and learn to pull it off together, in Quick Match or Competitive.', 3.99, { badge: 'Fun' }],
      ['six', 'other', '6-Stack Fill', 'Grandmaster+ players', 'Bring your friends and we fill your six with players on the roles you need, on voice.', 5.99],
      ['quick', 'duo', 'Quick Match & Arcade', 'Strong teammate', 'No-pressure games to try new heroes or just have fun.', 2.49, { fun: true }],
      ...gg('game', 'Quick Match or Arcade', 'Diamond+', 'Competitive', [3.99, 4.49], 'Marvel Rivals', '1v1 hero duels in custom games'),
      playLearn('Grandmaster+', 7.99, 'Competitive match'),
      ['hero', 'training', 'Hero Coaching', 'Grandmaster+ coach · 1 hour', 'One hero, done right: abilities, ult timing, positioning and matchups.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },
  ow: {
    unit: 'game', main: 'duo2', bundles: ['Push', 'Payload', 'Ult Charged'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Diamond+ teammate', 'Role Queue Competitive with a Diamond player who complements your role and plays around you.', 3.49],
      ['duo2', 'duo', 'Duo Pro', 'Master+ teammate', 'Competitive with a Master player who tracks cooldowns, calls engages and explains fights between rounds.', 4.99, { badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Grandmaster+ teammate', 'A Grandmaster or Champion player for high-rank lobbies who can swing fights on their own.', 5.49],
      ['stadium', 'duo', 'Stadium Duo', 'Master+ teammate · Stadium', 'Stadium runs together: plan your builds round by round and close out the best of seven.', 4.99, { badge: 'Fun' }],
      ['five', 'other', '5-Stack Role Queue', 'Master+ players', 'Bring your friends and we fill your five on the roles you need, for a real comp night.', 5.99],
      ['qp', 'duo', 'Quick Play & Arcade', 'Strong teammate', 'Casual games and arcade modes with someone fun and good.', 2.49, { fun: true }],
      ...gg('game', 'Quick Play or Arcade', 'Diamond+', 'Competitive', [3.99, 4.49], 'Overwatch', '1v1 hero duels in custom games'),
      playLearn('Grandmaster+', 7.99, 'Competitive match'),
      ['role', 'training', 'Role Coaching', 'Grandmaster+ coach · 1 hour', 'Tank, damage or support: positioning, cooldowns and when to take space.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },
  rl: {
    // per hour: a match is only ~7 minutes (pricing review 2026-11); the Teams fill stays per game
    unit: 'hour', main: 'duo2', bundles: ['Boost Pad', 'Aerial', 'Supersonic Run'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Champion+ teammate · 2v2', 'An hour of Ranked Doubles with a Champion player who rotates properly, so you’re never both chasing the ball.', 9.99, { unit: 'hour' }],
      ['duo2', 'duo', 'Duo Pro', 'Grand Champion teammate · 2v2', 'An hour of Ranked Doubles with a Grand Champion who sets you up, covers back post and calls boost.', 11.99, { unit: 'hour', badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Supersonic Legend · 2v2', 'An hour of high-rank Doubles with a Supersonic Legend who wins kickoffs and plays like a pro.', 15.99, { unit: 'hour' }],
      ['three', 'other', '3v3 Standard', 'Grand Champion players', 'Ranked Standard with your friend and one or two Grand Champions filling the team.', 5.99, { unit: 'game' }],
      ['casual', 'duo', 'Casual 3v3', 'Strong teammate', 'An hour of relaxed casual matches with someone who actually passes.', 6.49, { unit: 'hour', fun: true }],
      ['extra', 'duo', 'Extra Modes', 'Strong teammate', 'An hour of Rumble, Hoops, Snow Day, Dropshot and Heatseeker. Pure fun.', 6.49, { unit: 'hour', badge: 'Fun', fun: true }],
      ...gg('hour', 'casual or extra modes', 'Champion+', 'Doubles', [10.49, 11.49], 'Rocket League', '1v1 Duels'),
      playLearn('Grand Champion', 13.99, 'hour of Doubles'),
      ['mech', 'training', 'Mechanics Training', 'Grand Champion coach · 1 hour', 'Aerials, flicks and recoveries, with training packs to keep practising.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },
  tft: {
    unit: 'game', main: 'duo2', bundles: ['Early Augment', 'Top Four', 'Three-Star Run'],
    services: [
      ['duo1', 'duo', 'Double Up', 'Master+ partner · team of two', 'Play Double Up with a Master player: you plan the boards together and send help at the right moments.', 7.99, { badge: 'Duo mode' }],
      ['duo2', 'duo', 'Board Coach', 'Master+ player · live', 'You play your ranked game; a Master player watches your screen on Discord and tells you what to buy, roll and position, live.', 10.49, { badge: 'Most picked' }],
      ['norm', 'duo', 'Normals & Hyper Roll', 'Strong teammate', 'Fast, casual lobbies together, with good chat and no LP on the line.', 3.99, { fun: true }],
      ...gg('game', 'Normals or Hyper Roll', 'Diamond+', 'Double Up', [4.99, 5.49], 'TFT', 'a head-to-head in the same lobby: whoever places higher wins'),
      ['econ', 'training', 'Comp & Econ Review', 'Master+ coach · 1 hour', 'Find comps that suit you, when to roll or level, and how to manage gold from stage two.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },
  fc: {
    unit: 'game', main: 'duo2', bundles: ['Kick-Off', 'Hat Trick', 'Title Race'],
    services: [
      ['duo2', 'duo', 'Co-op Rivals', 'Division 1+ partner · 2v2', 'Play Co-op Rivals with a Division 1 partner who links up, tracks back and talks you through it.', 3.49, { badge: 'Most picked' }],
      ['duo3', 'duo', 'Co-op Elite', 'Elite partner · 2v2', 'Co-op Rivals with an Elite-level player for the top divisions.', 5.49],
      ['clubs', 'other', 'Clubs Lineup', 'Division 1+ players', 'Fill your Clubs team with players who hold their position and actually pass.', 5.49],
      ['friendly', 'duo', 'Practice Match', 'Elite opponent', 'Play an online friendly against an Elite player who tells you what to fix after the match.', 3.99, { fun: true }],
      ['kickoff', 'duo', 'Kick-Off & Friendlies', 'Fun partner', 'Couch-style friendlies on the same team, just for fun.', 2.49, { fun: true }],
      ...gg('game', 'Kick-Off or friendlies', 'Division 3+', 'Co-op Rivals', [2.99, 3.99], 'EA FC', 'online friendlies, you against her'),
      ['tactics', 'training', 'Tactics & Squad Builder', 'Elite coach · 1 hour', 'Formations, custom tactics and a squad that fits how you play.', COACHING_PRICE, { unit: 'hour' }],
      ['champs', 'training', 'Champions Prep', 'Elite coach · 1 hour', 'Get ready for your weekend-league games: mindset, defending and the meta, with live practice.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },
  arc: {
    unit: 'hour', main: 'duo2', bundles: ['Supply Run', 'Deep Raid', 'Full Expedition'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Experienced raider', 'An hour of raids with a player who knows the loot spots and the safe ways out.', 10.99, { unit: 'hour' }],
      ['duo2', 'duo', 'Duo Pro', 'Veteran raider', 'An hour with a Veteran who handles fights, picks the routes and gets you out with your loot.', 14.49, { unit: 'hour', badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Elite raider', 'An hour with one of the best raiders around, for high-risk maps and big extractions.', 19.49, { unit: 'hour' }],
      ['squad', 'other', 'Full Squad', 'Two Veteran raiders', 'Two Veterans join you as a full trio. You loot, they keep you alive.', 17.99, { unit: 'hour' }],
      ['escort', 'other', 'Escort Run', 'Elite squad', 'A squad escorts you to the big loot and back out, safely.', 15.99, { unit: 'hour', badge: 'Popular' }],
      ['learn', 'duo', 'Learn the Maps', 'Friendly raider', 'Relaxed runs to learn the maps, the best loot routes and where to extract.', 7.99, { unit: 'hour', fun: true }],
      ...gg('hour', 'relaxed loot runs', 'Veteran', 'raids', [11.49, 12.99], 'ARC Raiders'),
      ['pvp', 'training', 'PvP & Extraction', 'Elite coach · 1 hour', 'Fights, third parties and clean extractions on every map.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },
  mc: {
    unit: 'hour', main: 'duo2', bundles: ['Spawn Point', 'Diamond Hunt', 'Ender Run'],
    services: [
      ['duo1', 'duo', 'PvP Duo', 'Skilled PvPer', 'An hour of PvP on the server and mode you pick: Bedwars, SkyWars, Duels, UHC or Box PvP. Your teammate covers you, calls the fights and shares tips as you go.', 11.99, { unit: 'hour' }],
      ['duo2', 'duo', 'PvP Duo Pro', 'Top PvPer', 'An hour with a top PvPer from servers like Hypixel or Minemen. They take the hard fights, carry the clutches and show you how they win them.', 15.99, { unit: 'hour', badge: 'Most picked' }],
      ['smp', 'duo', 'Survival Partner', 'Survival & SMP expert', 'Get ahead on your SMP or a fresh world: gear up fast, set up farms, build a safe base and handle the fights when someone comes for your stuff.', 8.99, { unit: 'hour' }],
      ['squad', 'other', 'Server Squad', 'Skilled PvPers', 'We fill your team for Bedwars fours, SkyWars teams, Hunger Games or UHC events with players who know the mode.', 9.99, { unit: 'hour' }],
      ['surv', 'duo', 'Survival Together', 'Friendly builder', 'Start a world or join yours: build a base, go mining and explore together at your own pace.', 8.49, { unit: 'hour', fun: true }],
      ['dragon', 'duo', 'Beat the Game', 'Experienced partner', 'From a fresh world to the Ender Dragon: get gear, find a stronghold and take her down together.', 9.49, { unit: 'hour', badge: 'Popular', fun: true }],
      ['manhunt', 'duo', 'Manhunt', 'Top PvPer · speedrunner vs hunter', 'Speedrun to the Ender Dragon with one life while your teammate hunts you down. One price per run, however long it takes, and you can swap roles.', 16.99, { unit: 'game', badge: 'New', fun: true }],
      ['hard', 'duo', 'Hardcore Survival', 'Experienced partner', 'One life, together. See how far you get before it goes wrong.', 8.99, { unit: 'hour', badge: 'Fun', fun: true }],
      ['mini', 'duo', 'Minigames Night', 'Fun partner', 'Bedwars, SkyWars, Build Battle, Murder Mystery, parkour and more on your favourite server.', 7.99, { unit: 'hour', fun: true }],
      ...gg('hour', 'survival, building or minigames', 'PvP-main', 'your Bedwars and SkyWars stats', [10.49, 10.99], 'Minecraft', 'PvP duels with sword, bow and rod'),
      ['pvp', 'training', 'PvP Coaching', 'Top PvPer coach · 1 hour', 'Aim, combos, strafing, rod and bow play, drilled in duels on practice servers until it clicks.', COACHING_PRICE, { unit: 'hour' }],
      ['bw', 'training', 'Bedwars Coaching', 'Bedwars 1000★ coach · 1 hour', 'Rush timing, bridging, bed defence and endgame clutches, practised in real games.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },
  pu: {
    unit: 'game', main: 'duo2', bundles: ['Lane Push', 'Goal Rush', 'Zapdos Steal'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Ultra+ teammate', 'Ranked with an Ultra player who plays the lane next to yours and calls objectives.', 2.99],
      ['duo2', 'duo', 'Duo Pro', 'Master teammate', 'Ranked with a Master player who plans rotations around Drednaw, Rotom and Zapdos.', 3.49, { badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Legend teammate', 'A Legend player, the highest rank, for your top-rated games.', 4.99],
      ['squad', 'other', 'Full Squad', 'Master players', 'Fill your five with players on set roles, on voice.', 4.99],
      ['quick', 'duo', 'Standard & Quick Battle', 'Strong teammate', 'Relaxed games to practise new Pokémon with backup.', 2.49, { fun: true }],
      ...gg('game', 'Standard or Quick Battle', 'Ultra+', 'Ranked', [2.49, 2.99], 'Pokémon Unite', '1v1 custom matches'),
      playLearn('Master', 4.99, 'Ranked match'),
      ['draft', 'training', 'Draft & Macro', 'Master coach · 1 hour', 'Picks that work together, objective timing and when to rotate.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },

  // Added 2026-11-08. Matches run long in Dota 2 (about 40 minutes) and Deadlock (about 35), so a game
  // costs a little more than in League; Wild Rift games are short (15 to 20 minutes) and priced like
  // the other mobile MOBA, Pokémon Unite. PUBG and World of Warcraft have no fixed match length: hourly.
  dota: {
    unit: 'game', main: 'duo2', bundles: ['First Blood', 'Roshan Pit', 'Aegis Run'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Ancient+ teammate', 'Ranked with an Ancient player in the position you need. They lane with you, ward, stack and call when to group.', 5.49],
      ['duo2', 'duo', 'Duo Pro', 'Divine+ teammate', 'Ranked with a Divine player who calls the game: when to smoke, when to take Roshan, which tower is next. Ask anything between games.', 6.99, { badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Immortal teammate', 'An Immortal player for Ancient and Divine lobbies, when you need a partner who can take over games.', 9.99],
      ['party5', 'other', 'Ranked 5-Stack', 'Full five · Divine+ players', 'Queue ranked as a real five-stack: Divine+ players in every position you need, a planned draft, one shotcaller and voice comms all game.', 8.49, { badge: 'Popular' }],
      ['turbo', 'duo', 'Turbo', 'Strong teammate · fast games', 'Fast games of about 20 minutes with more gold and quicker respawns. Great to try a new hero.', 3.49, { badge: 'Fast', fun: true }],
      ['unranked', 'duo', 'Unranked All Pick', 'Strong teammate', 'A full unranked game to learn a hero or position with a strong player covering for you.', 3.99, { fun: true }],
      ...gg('game', 'Turbo or unranked games', 'Divine+', 'ranked', [4.99, 5.49], 'Dota 2', '1v1 mid duels: two kills or the first tower wins'),
      playLearn('Divine+', 0, 'ranked game'),
      ['replay', 'training', 'Replay Review', 'Immortal coach · 1 hour', 'Send a recent match. Your coach goes through the replay with you (laning, farm, map moves, item timings) and leaves you with three things to fix.', COACHING_PRICE, { unit: 'hour' }],
      ['hero', 'training', 'Hero & Position Coaching', 'Immortal coach · 1 hour', 'One hero or position, properly: matchups, item builds, farming patterns and when to fight, practised in a live game.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },
  wow: {
    // Retail World of Warcraft. Mythic+ keys and rated arena have their own rating ladders (lib/ranks.js).
    unit: 'hour', main: 'duo2', bundles: ['Timed Key', 'Great Vault', 'Keystone Hero'],
    services: [
      ['duo1', 'duo', 'Mythic+ Duo', '2,500+ rated teammate', 'An hour of Mythic+ keys with a 2,500+ rated player who knows the routes, the kicks and the pulls, so your keys get timed.', 12.99, { unit: 'hour' }],
      ['duo2', 'duo', 'Mythic+ Pro', '3,000+ rated teammate', 'An hour of high keys with a 3,000+ rated player who plans the route, calls interrupts and defensives, and explains every pull.', 15.99, { unit: 'hour', badge: 'Most picked' }],
      ['arena', 'duo', 'Arena 2v2', 'Duelist+ partner · 2v2', 'An hour of rated 2v2 with a Duelist-level partner who calls swaps, crowd control and cooldowns.', 12.99, { unit: 'hour', badge: 'Duo mode' }],
      ['keys', 'other', 'Key Group Fill', '2,500+ rated players · Mythic+', 'Short on players for your key? We fill your group with 2,500+ rated players on the roles you’re missing.', 10.99, { unit: 'hour' }],
      ['arena3', 'other', 'Arena 3v3 Team', 'Duelist+ players · 3v3', 'One or two Duelist-level players join you for rated 3v3, with a plan for every comp you meet.', 12.49, { unit: 'hour' }],
      ['delves', 'duo', 'Delves & World Content', 'Experienced partner', 'Delves, world quests and weekly chores together, done fast and with good company.', 7.99, { unit: 'hour', fun: true }],
      ['level', 'duo', 'Leveling Buddy', 'Friendly veteran', 'Level a new character together with someone who knows the fastest routes and explains your class as you go.', 7.99, { unit: 'hour', badge: 'Fun', fun: true }],
      ...gg('hour', 'Delves, leveling or world quests', '2,500+ rated', 'Mythic+', [10.49, 11.49], 'World of Warcraft', 'a classic duel outside the city gates'),
      playLearn('3,000+ rated', 0, 'hour of Mythic+'),
      ['class', 'training', 'Class & Rotation Coaching', 'Gladiator or 3,000+ coach · 1 hour', 'Your class and spec, properly: talents, rotation, cooldowns and positioning, checked on a target dummy and in a real key or arena.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },
  pubg: {
    unit: 'hour', main: 'duo2', bundles: ['Pochinki Drop', 'Blue Zone', 'Chicken Dinner'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Diamond+ teammate · Ranked', 'An hour of Ranked with a Diamond player who calls the drop, the rotations and the compound to hold.', 12.99, { unit: 'hour' }],
      ['duo2', 'duo', 'Duo Pro', 'Master teammate · Ranked', 'An hour of Ranked with a Master player who reads the zone, picks the fights worth taking and gets you to the final circle.', 15.99, { unit: 'hour', badge: 'Most picked' }],
      ['duos', 'duo', 'Normal Duos', 'Master teammate · 2-player squads', 'The Duos mode: just the two of you, more fights and quicker decisions, with no rank on the line.', 9.99, { unit: 'hour', badge: 'Duo mode' }],
      ['squad', 'other', 'Squad Fill', 'Master players', 'Bring a friend or two and we fill your squad with Master players who call rotations and trade properly.', 13.99, { unit: 'hour' }],
      ['arcade', 'duo', 'Arcade & TDM', 'Strong teammate', 'Team Deathmatch, Intense Battle Royale and Arcade modes. Fast, fun and great for warming up your spray.', 7.99, { unit: 'hour', badge: 'Fun', fun: true }],
      ...gg('hour', 'normal matches or Arcade', 'Diamond+', 'Ranked', [10.49, 10.99], 'PUBG', '1v1 gunfights in a custom match'),
      playLearn('Master', 0, 'hour of Ranked'),
      ['spray', 'training', 'Recoil & Positioning', 'Master coach · 1 hour', 'Spray control, attachments and where to stand in every circle, drilled in the Training Mode and practised live.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },
  wr: {
    unit: 'game', main: 'duo2', bundles: ['Turret Dive', 'Dragon Soul', 'Nexus Push'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Diamond+ teammate', 'Ranked with a Diamond player in the lane you need. They play around you, track the jungler and call dragons.', 2.99],
      ['duo2', 'duo', 'Duo Pro', 'Master+ teammate', 'Ranked with a Master player who shot-calls: when to fight, which objective is next, when to back off.', 3.49, { badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Grandmaster+ teammate', 'A Grandmaster, Challenger or Sovereign player for your highest-rated games, who can take over a match.', 4.99],
      ['five', 'other', 'Ranked 5-Stack', 'Master+ players', 'Bring your friends and we fill your five with Master+ players on the lanes you need, on voice.', 4.99],
      ['aram', 'duo', 'ARAM', 'Strong teammate · one lane', 'Random champions, one lane, nonstop teamfights. Fun games with someone good.', 2.49, { fun: true }],
      ['norm', 'duo', 'Normal Match', 'Strong teammate', 'Unranked games to try a new champion or lane with backup.', 2.49, { fun: true }],
      ...gg('game', 'ARAM or normal matches', 'Diamond+', 'ranked', [2.99, 3.49], 'Wild Rift', 'custom 1v1s in mid lane: first blood or the first tower wins'),
      playLearn('Master+', 0, 'ranked game'),
      ['champ', 'training', 'Champion Mastery', 'Grandmaster+ coach · 1 hour', 'One champion, properly: combos, builds, matchups and power spikes, practised in a live game.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },
  dl: {
    unit: 'game', main: 'duo2', bundles: ['Soul Urn', 'Mid Boss', 'Patron Down'],
    services: [
      ['duo1', 'duo', 'Duo Plus', 'Oracle+ teammate', 'Ranked with an Oracle player who lanes with you, secures souls and calls when to push or rotate.', 5.49],
      ['duo2', 'duo', 'Duo Pro', 'Phantom+ teammate', 'Ranked with a Phantom player who calls the map: Urn runs, Mid Boss timings and which lane to take next.', 6.99, { badge: 'Most picked' }],
      ['duo3', 'duo', 'Duo Apex', 'Ascendant+ teammate', 'An Ascendant or Eternus player for high-rank lobbies, who can win fights on their own.', 8.49],
      ['six', 'other', '6-Stack Fill', 'Phantom+ players', 'Bring your friends and we fill your six with Phantom+ players who know their heroes and their lanes.', 6.49],
      ['unranked', 'duo', 'Unranked Matches', 'Strong teammate', 'Full matches without rank pressure, to learn a new hero or the map with someone covering you.', 3.99, { fun: true }],
      ...gg('game', 'unranked matches', 'Phantom+', 'ranked', [4.99, 5.49], 'Deadlock', '1v1 lane duels in a private lobby'),
      playLearn('Phantom+', 0, 'ranked match'),
      ['macro', 'training', 'Macro & Souls', 'Ascendant coach · 1 hour', 'Farming patterns, soul economy, item timings and rotations, so every minute of the match counts.', COACHING_PRICE, { unit: 'hour' }]
    ]
  },

  // Social (Fabian 2026-10-29, after epal.gg): no game, only time with a verified Gamer Girl. Every service is
  // in the gg tab, so only Gamer Girl teammates can take it. Instant like every order, so no wake-up calls yet.
  social: {
    unit: 'hour', main: 'chat', bundles: ['Late Night Talk', 'Movie Marathon', 'Whole Evening'],
    services: [
      ['chat', 'gg', 'Just Chat', 'Verified Gamer Girl · voice', 'Talk about anything on voice: your day, games, music, whatever is on your mind. Relaxed and friendly, no game needed.', 12.99, { badge: 'Most picked', unit: 'hour' }],
      ['watch', 'gg', 'Watch Together', 'Verified Gamer Girl · Discord stream', 'Pick a movie, show or stream and watch it together on Discord, with commentary and reactions on voice.', 12.99, { unit: 'hour' }],
      ['sleep', 'gg', 'Sleep Call', 'Verified Gamer Girl · voice', 'Stay on a calm voice call while you wind down and fall asleep. Soft talk, then quiet company.', 12.99, { badge: 'Cozy', unit: 'hour' }],
      ['karaoke', 'gg', 'Karaoke', 'Verified Gamer Girl · voice', 'Sing together or request songs she sings for you on voice. Bring your playlist or pick from hers.', 12.99, { badge: 'Fun', unit: 'hour' }]
    ]
  }
};

// The game's services as the homepage uses them.
export function servicesFor(id) {
  const c = CATALOG[id];
  if (!c) return { unit: 'game', main: 'duo2', bundles: [], modes: [] };
  const modes = c.services.map(([sid, cat, title, tier, desc, price, o = {}]) => ({
    id: sid, cat, title, tier, desc, price, badge: o.badge, unit: o.unit || (cat === 'training' && sid !== 'learn' ? 'hour' : c.unit), was: o.was,
    ...(o.fun ? { fun: true } : {})
  }));
  return { unit: c.unit, main: c.main, bundles: c.bundles, modes };
}
