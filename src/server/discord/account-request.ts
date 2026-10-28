// Is this Discord message someone asking for a game account? ("need euw account", "need pokemon unite acc",
// "anyone has an acc?") Port of Fabian's lib/accountRequest.js, unchanged in behavior.
// Strict on the ask, broad on the words in between: it has to be a request for an account (need, anyone has,
// can someone lend, looking for), but anything can describe the account ("need a lvl 30 pokemon unite acc").
// Words that turn it into talk about an account stop it ("need help with my account", "need to make an acc"),
// and talking about accounts ("my account got banned", "connected my discord account", "I have an account",
// "you need an account to book") never counts.
// accountRequest(text) returns null, or { region, game } (region like "EUW", game like "Pokémon Unite", '' when not named).

const REGIONS: Record<string, string> = {
  euw: 'EUW',
  eune: 'EUNE',
  na: 'NA',
  eu: 'EU',
  kr: 'KR',
  oce: 'OCE',
  br: 'BR',
  lan: 'LAN',
  las: 'LAS',
  tr: 'TR',
  ru: 'RU',
  jp: 'JP',
  asia: 'Asia',
  sea: 'SEA',
};
// game names people write (after the clean-up below: lowercase, no accents or symbols), longest first
const GAME_NAMES: [alias: string, name: string][] = [
  ['league of legends', 'League of Legends'],
  ['pokemon unite', 'Pokémon Unite'],
  ['counter strike 2', 'Counter-Strike 2'],
  ['counter strike', 'Counter-Strike 2'],
  ['teamfight tactics', 'Teamfight Tactics'],
  ['rainbow six siege', 'Rainbow Six Siege'],
  ['rainbow six', 'Rainbow Six Siege'],
  ['marvel rivals', 'Marvel Rivals'],
  ['rocket league', 'Rocket League'],
  ['call of duty', 'Call of Duty'],
  ['apex legends', 'Apex Legends'],
  ['arc raiders', 'ARC Raiders'],
  ['ea fc', 'EA SPORTS FC'],
  ['overwatch 2', 'Overwatch 2'],
  ['league', 'League of Legends'],
  ['lol', 'League of Legends'],
  ['valorant', 'Valorant'],
  ['valo', 'Valorant'],
  ['val', 'Valorant'],
  ['cs2', 'Counter-Strike 2'],
  ['csgo', 'Counter-Strike 2'],
  ['cs', 'Counter-Strike 2'],
  ['fortnite', 'Fortnite'],
  ['fn', 'Fortnite'],
  ['warzone', 'Call of Duty'],
  ['wz', 'Call of Duty'],
  ['cod', 'Call of Duty'],
  ['apex', 'Apex Legends'],
  ['siege', 'Rainbow Six Siege'],
  ['r6', 'Rainbow Six Siege'],
  ['rivals', 'Marvel Rivals'],
  ['overwatch', 'Overwatch 2'],
  ['ow2', 'Overwatch 2'],
  ['ow', 'Overwatch 2'],
  ['rl', 'Rocket League'],
  ['tft', 'Teamfight Tactics'],
  ['fifa', 'EA SPORTS FC'],
  ['fc', 'EA SPORTS FC'],
  ['arc', 'ARC Raiders'],
  ['minecraft', 'Minecraft'],
  ['mc', 'Minecraft'],
  ['unite', 'Pokémon Unite'],
  ['pokemon', 'Pokémon Unite'],
];
const ACC = '(?:acc|accs|account|accounts|smurf|smurfs|acct|accnt)';
const REG = '(?:' + Object.keys(REGIONS).join('|') + ')';
// words that can't sit between the ask and "account" in a real request: they make it about an account
// ("need help with my account", "need to create an account", "need the account details")
const BREAK =
  '(?:my|your|ur|his|her|their|our|the|this|that|to|with|for|about|on|in|from|when|if|and|but|or|help|log|login|make|create|delete|recover|reset)';
// up to 5 words describing the account: "a", "spare", "lvl 30", "pokemon unite", "euw", …
const WORDS = '(?:(?!' + BREAK + '\\b)[a-z0-9]+\\s+){0,5}';

// the ways people ask (checked on the cleaned-up message)
const ASKS = [
  // need / needs / i really need … acc
  new RegExp(
    '\\b(?:i|we|me)?\\s*(?:really\\s+)?(?:need|needs|needing|neeed|nd|want|wanna)\\s+' +
      WORDS +
      ACC +
      '\\b',
  ),
  // anyone has / got / can lend … acc
  new RegExp(
    '\\b(?:anyone|any1|anybody|someone|some1|somebody|who|ppl|people)\\s+(?:here\\s+)?(?:has|have|got|gt|with|own|owns|can\\s+(?:lend|give|share)|could\\s+(?:lend|give|share)|wanna\\s+(?:lend|share|give))\\s+(?:me\\s+)?' +
      WORDS +
      ACC +
      '\\b',
  ),
  // anyone pokemon unite acc?
  new RegExp(
    '\\b(?:anyone|any1|anybody|someone|somebody)\\s+' + WORDS + ACC + '\\s*\\?',
  ),
  // can i borrow / can someone give me … acc
  new RegExp(
    '\\b(?:can|could|may)\\s+(?:i|someone|anyone|somebody|anybody|u|you)\\s+(?:please\\s+|pls\\s+)?(?:borrow|get|have|use|lend|give|share)\\s+(?:me\\s+)?' +
      WORDS +
      ACC +
      '\\b',
  ),
  // need someone to lend me an acc
  new RegExp(
    '\\b(?:need|want)\\s+(?:someone|somebody|anyone)\\s+(?:to\\s+)?(?:lend|give|share)\\s+(?:me\\s+)?' +
      WORDS +
      ACC +
      '\\b',
  ),
  // looking for / lf / searching … acc
  new RegExp(
    '\\b(?:looking\\s+for|lookin\\s+for|lf|lfa|searching(?:\\s+for)?|in\\s+need\\s+of)\\s+' +
      WORDS +
      ACC +
      '\\b',
  ),
  // any / got any … acc?
  new RegExp('\\b(?:any|got\\s+(?:a|an|any))\\s+' + WORDS + ACC + '\\s*\\?'),
  // … acc pls / acc needed / acc asap
  new RegExp('\\b' + ACC + '\\s+(?:pls|plz|please|needed|anyone|any1|asap)\\b'),
  // lend me / borrow … acc
  new RegExp('\\b(?:lend|borrow)\\s+(?:me\\s+)?' + WORDS + ACC + '\\b'),
];

// talking about accounts, not asking for one
const NOT = [
  /\b(?:my|your|ur|his|her|their|our)\s+(?:\w+\s+){0,2}acc(?:ount)?s?\b(?!\s+(?:pls|please|needed))/, // "my account got banned"
  /\b(?:discord|duoly|riot|google|email|paypal|bank|stripe|twitter|insta(?:gram)?|tiktok|twitch|steam|epic|microsoft|xbox|psn|playstation|nintendo|ea|ubisoft|battle\s?net|blizzard)\s+acc(?:ount)?s?\b/,
  /\b(?:banned|ban|hacked|suspended|locked|deleted|verify|verified|password|passwort|pw|login|log\s?in|sign\s?(?:in|up)|2fa|recovery|support\s+ticket)\b/,
  /\b(?:you|u|they|customers?)\s+(?:need|needs)\s+(?:an?\s+)?acc(?:ount)?/, // "you need an account to book"
  /\b(?:don'?t|dont|do\s+not|no|never)\s+(?:need|have|want)\b/,
  /\b(?:i|we)\s+(?:have|got|own)\s+(?:an?\s+|\d+\s+|some\s+)?(?:\w+\s+){0,2}acc(?:ount)?s?\b/, // offering, not asking
  /\b(?:sell|selling|buy|buying|trade|trading|boost|boosting|boosted)\b/,
];

const clean = (raw: unknown) =>
  String(raw || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // é → e (Pokémon → pokemon)
    .toLowerCase()
    .replace(/<a?:\w+:\d+>|<[@#][!&]?\d+>/g, ' ') // custom emojis, mentions
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9?\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export type AccountRequest = { region: string; game: string };

export function accountRequest(raw: unknown): AccountRequest | null {
  const text = clean(raw);
  if (!text || text.length > 240) return null; // long messages are conversations, not quick requests
  if (!ASKS.some((re) => re.test(text))) return null;
  if (NOT.some((re) => re.test(text))) return null;
  const r = text.match(new RegExp('\\b' + REG + '\\b'));
  const g = GAME_NAMES.find(([alias]) =>
    new RegExp('\\b' + alias + '\\b').test(text),
  );
  return { region: r ? (REGIONS[r[0]] ?? '') : '', game: g ? g[1] : '' };
}
