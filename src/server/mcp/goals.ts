import { ToolInputError } from './catalog';

export const GOALS = [
  'climb',
  'learn',
  'learn_role',
  'learn_character',
  'review',
  'mechanics',
  'friends',
  'casual',
  'have_fun',
  'play_tonight',
] as const;
export type Goal = (typeof GOALS)[number];
// Ordered service IDs, intersected with public, bookable services by the caller.
const rules: Record<string, [string[], string[], string[]]> = {
  lol: [
    ['duo1', 'duo2', 'duo3'],
    ['learn', 'vod', 'champ'],
    ['flex', 'ranked5', 'clash'],
  ],
  val: [
    ['duo1', 'duo2', 'duo3'],
    ['learn', 'vod', 'aim'],
    ['stack', 'premier'],
  ],
  cs2: [
    ['duo1', 'duo2', 'duo3'],
    ['learn', 'demo', 'util'],
    ['five', 'faceit5'],
  ],
  fn: [['duo1', 'duo2', 'duo3'], ['learn', 'build'], ['squad']],
  cod: [
    ['duo1', 'duo3'],
    ['learn', 'loadout'],
    ['mp4', 'quads'],
  ],
  apex: [['duo1', 'duo2'], ['learn', 'move'], ['trio']],
  r6: [['duo1', 'duo2', 'duo3'], ['learn', 'ops', 'maps'], ['stack']],
  mr: [['duo1', 'duo2', 'duo3'], ['learn', 'hero'], ['six']],
  ow: [['duo1', 'duo2', 'duo3'], ['learn', 'role'], ['five']],
  rl: [['duo1', 'duo2', 'duo3'], ['learn', 'mech'], ['three']],
  tft: [['duo2'], ['econ'], ['duo1']],
  fc: [['duo2', 'duo3'], ['tactics', 'champs'], ['clubs']],
  arc: [[], ['learn', 'pvp'], ['squad', 'escort']],
  mc: [[], ['pvp', 'bw'], ['squad', 'mini']],
  pu: [['duo1', 'duo2', 'duo3'], ['learn', 'draft'], ['squad']],
  dota: [['duo1', 'duo2', 'duo3'], ['learn', 'replay', 'hero'], ['party5']],
  wow: [
    ['duo1', 'duo2', 'arena'],
    ['learn', 'class'],
    ['keys', 'arena3'],
  ],
  pubg: [['duo1', 'duo2'], ['learn', 'spray'], ['squad']],
  wr: [['duo1', 'duo2', 'duo3'], ['learn', 'champ'], ['five']],
  dl: [['duo1', 'duo2', 'duo3'], ['learn', 'macro'], ['six']],
};
export function goalOf(text?: string, explicit?: Goal): Goal | undefined {
  if (explicit) return explicit;
  if (!text) return undefined;
  if ((GOALS as readonly string[]).includes(text)) return text as Goal;
  // Whole words only. Multiple intents require clarification rather than a guessed priority.
  const hits = (
    [
      ['climb', /\b(climb|rank up)\b/i],
      ['learn', /\b(learn|improve)\b/i],
      ['review', /\b(review|vod|demo)\b/i],
      ['mechanics', /\b(mechanics|aim|movement)\b/i],
      ['friends', /\b(friends|team)\b/i],
      ['have_fun', /\b(fun|relax|chill)\b/i],
      ['play_tonight', /\btonight\b/i],
    ] as const
  ).filter(([, pattern]) => pattern.test(text));
  if (hits.length === 1) return hits[0]![0];
  if (
    ['duo', 'coaching', 'training', 'ranked', 'teams', 'other'].includes(text)
  )
    return undefined;
  throw new ToolInputError(
    'Clarify goal with goalType: climb, learn, learn_role, learn_character, review, mechanics, friends, casual, have_fun or play_tonight. Legacy goals: duo, coaching, ranked, teams.',
  );
}
export function goalServices(game: string, goal: Goal): string[] | undefined {
  const rule = rules[game]!;
  if (goal === 'climb') return rule[0];
  if (goal === 'friends') return rule[2];
  if (['casual', 'have_fun', 'play_tonight'].includes(goal)) return undefined;
  const specialist: Partial<Record<Goal, string[]>> = {
    review: ['vod', 'demo', 'econ'],
    learn_character: ['champ', 'ops', 'hero'],
    learn_role: ['role', 'learn'],
    mechanics: ['aim', 'build', 'util', 'move', 'loadout', 'mech', 'pvp', 'bw'],
  };
  return specialist[goal]
    ? specialist[goal]!.filter((id) => rule[1].includes(id))
    : rule[1];
}
