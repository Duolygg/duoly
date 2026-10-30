// The servers / matchmaking regions of each game, as the game itself names them (checked Oct 2026):
// League & TFT: Riot's server list (Riot support "League of Legends Servers"); Valorant: its six shards;
// Fortnite: Epic's 8 matchmaking regions; Rocket League: Epic's 12 regions; R6: Ubisoft's data centres;
// Marvel Rivals: its region nodes; Overwatch: Battle.net's 3 regions. Games that only match by ping
// (CoD, Apex, EA FC, ARC Raiders, Pokémon Unite) list the broad areas you'd play in.
// Minecraft has no regions: you tell the teammate the server (or your own world) and the edition instead.
//
// SERVERS[game] = [[value, label, group, zones]] · value is stored on the order and shown to the teammate,
// label is the full name in the picker, group sorts the picker, zones decide which one is preselected
// for someone (from their time zone, see zoneOf).

const EU = 'Europe', AM = 'Americas', AP = 'Asia-Pacific', ME = 'Middle East & Africa';

const RIOT = [
  ['EUW', 'Europe West', EU, ['eu-w', 'af']], ['EUNE', 'Europe Nordic & East', EU, ['eu-e']], ['TR', 'Turkey', EU, ['tr']], ['RU', 'Russia', EU, ['ru']],
  ['NA', 'North America', AM, ['na']], ['LAN', 'Latin America North', AM, ['latam-n']], ['LAS', 'Latin America South', AM, ['latam-s', 'latam']], ['BR', 'Brazil', AM, ['br']],
  ['KR', 'Korea', AP, ['kr']], ['JP', 'Japan', AP, ['jp']], ['OCE', 'Oceania', AP, ['oce']], ['SG', 'Singapore, Malaysia & Indonesia', AP, ['sea-sg', 'sea', 'in']],
  ['PH', 'Philippines', AP, ['sea-ph']], ['TH', 'Thailand', AP, ['sea-th']], ['TW', 'Taiwan, Hong Kong & Macau', AP, ['sea-tw']], ['VN', 'Vietnam', AP, ['sea-vn']],
  ['ME', 'Middle East', ME, ['me']]
];
// matchmaking by ping only: the broad area you play in
const AREAS = [
  ['Europe', 'Europe', EU, ['eu', 'tr', 'ru', 'af']], ['North America', 'North America', AM, ['na']], ['South America', 'South America', AM, ['br', 'latam']],
  ['Asia', 'Asia', AP, ['kr', 'jp', 'sea', 'in']], ['Oceania', 'Oceania', AP, ['oce']], ['Middle East', 'Middle East', ME, ['me']]
];

export const SERVERS = {
  lol: RIOT,
  tft: RIOT,
  val: [
    ['EU', 'Europe & Middle East', EU, ['eu', 'tr', 'ru', 'me', 'af']], ['NA', 'North America', AM, ['na']], ['LATAM', 'Latin America', AM, ['latam']],
    ['BR', 'Brazil', AM, ['br']], ['KR', 'Korea', AP, ['kr']], ['AP', 'Asia-Pacific', AP, ['jp', 'sea', 'oce', 'in']]
  ],
  cs2: [
    ['EU West', 'Europe West', EU, ['eu-w', 'eu']], ['EU East', 'Europe East', EU, ['eu-e', 'tr', 'ru']], ['NA East', 'North America East', AM, ['na-e', 'na-c', 'na']],
    ['NA West', 'North America West', AM, ['na-w']], ['South America', 'South America', AM, ['br', 'latam']], ['Asia', 'Asia', AP, ['kr', 'jp', 'sea', 'in']],
    ['Oceania', 'Oceania', AP, ['oce']], ['Middle East', 'Middle East', ME, ['me']], ['South Africa', 'South Africa', ME, ['af']]
  ],
  fn: [
    ['Europe', 'Europe', EU, ['eu', 'tr', 'ru', 'af']], ['NA-East', 'NA-East', AM, ['na-e']], ['NA-Central', 'NA-Central (US & Mexico)', AM, ['na-c', 'na', 'latam-n']],
    ['NA-West', 'NA-West', AM, ['na-w']], ['Brazil', 'Brazil', AM, ['br', 'latam']], ['Asia', 'Asia', AP, ['kr', 'jp', 'sea', 'in']],
    ['Oceania', 'Oceania', AP, ['oce']], ['Middle East', 'Middle East', ME, ['me']]
  ],
  cod: AREAS,
  apex: AREAS,
  r6: [
    ['EU West', 'Europe West', EU, ['eu-w', 'eu']], ['EU North', 'Europe North', EU, ['eu-e', 'tr', 'ru']], ['US East', 'US East', AM, ['na-e', 'na']],
    ['US Central', 'US Central', AM, ['na-c']], ['US South Central', 'US South Central', AM, ['latam-n']], ['US West', 'US West', AM, ['na-w']],
    ['Brazil South', 'Brazil South', AM, ['br', 'latam']], ['Asia East', 'Asia East', AP, ['kr', 'sea-tw']], ['Asia South East', 'Asia South East', AP, ['sea', 'in']],
    ['Japan East', 'Japan East', AP, ['jp']], ['Australia East', 'Australia East', AP, ['oce']], ['UAE North', 'UAE North (Middle East)', ME, ['me']],
    ['South Africa North', 'South Africa North', ME, ['af']]
  ],
  mr: [
    ['Europe', 'Europe', EU, ['eu', 'tr', 'ru', 'af']], ['North America', 'North America', AM, ['na']], ['South America', 'South America', AM, ['br', 'latam']],
    ['Asia', 'Asia (Tokyo)', AP, ['jp', 'kr']], ['Southeast Asia', 'Southeast Asia (Singapore)', AP, ['sea', 'in']], ['Oceania', 'Oceania (Sydney)', AP, ['oce']],
    ['Middle East', 'Middle East', ME, ['me']]
  ],
  ow: [
    ['Europe', 'Europe', EU, ['eu', 'tr', 'ru', 'me', 'af']], ['Americas', 'Americas', AM, ['na', 'br', 'latam']], ['Asia', 'Asia', AP, ['kr', 'jp', 'sea', 'oce', 'in']]
  ],
  rl: [
    ['Europe', 'Europe', EU, ['eu', 'tr', 'ru']], ['US-East', 'US-East', AM, ['na-e', 'na']], ['US-Central', 'US-Central', AM, ['na-c', 'latam-n']], ['US-West', 'US-West', AM, ['na-w']],
    ['South America', 'South America', AM, ['br', 'latam']], ['Asia-East', 'Asia-East (Japan)', AP, ['jp', 'kr']], ['Asia-SE Mainland', 'Asia-SE Mainland', AP, ['sea-th', 'sea-vn']],
    ['Asia-SE Maritime', 'Asia-SE Maritime', AP, ['sea', 'sea-ph', 'sea-sg']], ['India', 'India', AP, ['in']], ['Oceania', 'Oceania', AP, ['oce']],
    ['Middle East', 'Middle East', ME, ['me']], ['South Africa', 'South Africa', ME, ['af']]
  ],
  fc: AREAS,
  arc: AREAS,
  pu: AREAS.filter((a) => a[0] !== 'Middle East'),
  // Social has no game server: the area tells the Gamer Girl your time zone
  social: AREAS
};

// The flag shown for each server (lib/countries.js flagSrc → /assets/flags/svg). Every server has one:
// a country server its country, European regions the EU flag, and wider regions the country their
// game servers mostly run in (Asia → Singapore, Americas → US; per game where that differs).
const FLAG = {
  EUW: 'eu', EUNE: 'eu', EU: 'eu', 'EU West': 'eu', 'EU East': 'eu', 'EU North': 'eu', Europe: 'eu',
  Asia: 'sg', AP: 'sg', Americas: 'us',
  TR: 'tr', RU: 'ru', BR: 'br', Brazil: 'br', 'Brazil South': 'br', 'South America': 'br', KR: 'kr', JP: 'jp', 'Japan East': 'jp', 'Asia-East': 'jp',
  OCE: 'au', Oceania: 'au', 'Australia East': 'au', SG: 'sg', 'Southeast Asia': 'sg', 'Asia-SE Maritime': 'sg', 'Asia South East': 'sg', 'Asia-SE Mainland': 'th',
  PH: 'ph', TH: 'th', TW: 'tw', 'Asia East': 'tw', VN: 'vn', NA: 'us', 'North America': 'us', 'NA East': 'us', 'NA West': 'us', 'NA-East': 'us', 'NA-Central': 'us',
  'NA-West': 'us', 'US East': 'us', 'US Central': 'us', 'US South Central': 'us', 'US West': 'us', 'US-East': 'us', 'US-Central': 'us', 'US-West': 'us',
  LAN: 'mx', LAS: 'cl', LATAM: 'mx', ME: 'ae', 'Middle East': 'ae', 'UAE North': 'ae', 'South Africa': 'za', 'South Africa North': 'za', India: 'in'
};
// where a game's broad region really sits somewhere else (Overwatch Asia → Korea, Marvel Rivals Asia → Tokyo)
const GAME_FLAG = { ow: { Asia: 'kr' }, mr: { Asia: 'jp' } };
export const serverFlag = (value, game) => ((GAME_FLAG[game] || {})[value]) || FLAG[value] || 'eu';

// Minecraft: no regions, the teammate needs the server address (or "my own world") and the edition
export const MC_EDITIONS = ['Java', 'Bedrock'];
export const usesServerName = (game) => game === 'mc';
export const serversFor = (game) => SERVERS[game] || AREAS;
export const isServer = (game, value) => serversFor(game).some((s) => s[0] === value);

// Where someone probably plays from, out of their browser's time zone: most precise first.
export function zoneOf(tz) {
  const t = String(tz || '');
  const z = (...list) => list;
  if (/Sao_Paulo|Fortaleza|Recife|Bahia|Belem|Manaus|Cuiaba|Porto_Velho/.test(t)) return z('br', 'latam');
  if (/New_York|Toronto|Detroit|Montreal|Halifax|Indiana|Kentucky|Nassau/.test(t)) return z('na-e', 'na');
  if (/Chicago|Winnipeg|Denver|Edmonton|Phoenix|Boise|Regina/.test(t)) return z('na-c', 'na');
  if (/Los_Angeles|Vancouver|Anchorage|Tijuana|Honolulu/.test(t)) return z('na-w', 'na');
  if (/Mexico_City|Monterrey|Guatemala|Costa_Rica|Panama|Bogota|Caracas|El_Salvador|Tegucigalpa|Managua|Havana|Santo_Domingo|Puerto_Rico/.test(t)) return z('latam-n', 'latam', 'na');
  if (/Santiago|Buenos_Aires|Argentina|Montevideo|Lima|Asuncion|La_Paz|Guayaquil/.test(t)) return z('latam-s', 'latam', 'br');
  if (t.indexOf('America/') === 0) return z('latam', 'na');
  if (/Istanbul/.test(t)) return z('tr', 'eu-e', 'eu');
  if (/Moscow|Samara|Volgograd|Yekaterinburg|Novosibirsk|Minsk/.test(t)) return z('ru', 'eu-e', 'eu');
  if (/Stockholm|Oslo|Helsinki|Copenhagen|Warsaw|Prague|Budapest|Bucharest|Sofia|Athens|Riga|Tallinn|Vilnius|Kiev|Kyiv|Belgrade|Zagreb|Ljubljana|Bratislava|Chisinau/.test(t)) return z('eu-e', 'eu');
  if (t.indexOf('Europe/') === 0 || /Atlantic\/(Reykjavik|Canary|Madeira)/.test(t)) return z('eu-w', 'eu');
  if (/Seoul/.test(t)) return z('kr');
  if (/Tokyo/.test(t)) return z('jp');
  if (/Manila/.test(t)) return z('sea-ph', 'sea');
  if (/Bangkok/.test(t)) return z('sea-th', 'sea');
  if (/Taipei|Hong_Kong|Macau/.test(t)) return z('sea-tw', 'sea');
  if (/Ho_Chi_Minh|Saigon|Hanoi/.test(t)) return z('sea-vn', 'sea');
  if (/Singapore|Kuala_Lumpur|Jakarta|Makassar|Jayapura|Brunei/.test(t)) return z('sea-sg', 'sea');
  if (/Kolkata|Calcutta|Dhaka|Karachi|Colombo|Kathmandu/.test(t)) return z('in', 'sea');
  if (/Dubai|Riyadh|Qatar|Bahrain|Kuwait|Muscat|Baghdad|Amman|Beirut|Jerusalem|Tel_Aviv|Cairo|Tehran/.test(t)) return z('me');
  if (/Johannesburg|Africa\//.test(t)) return z('af', 'eu');
  if (/^Australia|Pacific\/Auckland/.test(t)) return z('oce');
  if (t.indexOf('Asia/') === 0) return z('sea', 'jp');
  return z('eu-w', 'eu');
}

// The server to preselect for this game and time zone.
export function guessServer(game, tz) {
  const list = serversFor(game);
  for (const zone of zoneOf(tz)) {
    const hit = list.find((s) => s[3].includes(zone));
    if (hit) return hit[0];
  }
  return list[0][0];
}
