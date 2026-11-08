/**
 * The customer's in-game role, asked at booking, and the character they want coaching on (owner
 * decisions 2026-11-06). Teammates see both before they accept, so they can plan around them.
 *
 * - Only games with real roles ask, and not on modes without roles (League Arena and ARAM,
 *   Valorant Skirmish and Deathmatch, CS2 Wingman, Casual and Retakes).
 * - Optional: the last role of each list (Fill, Flex or Any) is preselected and means "no
 *   preference"; it is never stored, so the order simply has no role.
 * - Coaching in games with characters also offers an optional free-text field ("Champion, e.g.
 *   Ahri"). Free text on purpose: nothing to update when a game adds a character.
 */
const ROLES: Readonly<Record<string, readonly string[]>> = {
  lol: ['Top', 'Jungle', 'Mid', 'ADC', 'Support', 'Fill'],
  val: ['Duelist', 'Initiator', 'Controller', 'Sentinel', 'Fill'],
  cs2: ['Entry', 'AWPer', 'Support', 'Lurker', 'IGL', 'Fill'],
  r6: ['Entry', 'Support', 'Flex', 'Anchor', 'Roamer', 'Fill'],
  ow: ['Tank', 'Damage', 'Support', 'Flex'],
  mr: ['Vanguard', 'Duelist', 'Strategist', 'Flex'],
  apex: ['Assault', 'Skirmisher', 'Recon', 'Support', 'Controller', 'Flex'],
  pu: ['Attacker', 'All-Rounder', 'Speedster', 'Defender', 'Supporter', 'Flex'],
  fc: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Any'],
  dota: ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support', 'Fill'],
  wr: ['Baron Lane', 'Jungle', 'Mid', 'Dragon Lane', 'Support', 'Fill'],
  wow: ['Tank', 'Healer', 'DPS', 'Any'],
};

/** Modes where roles don't exist (no lanes, 1v1 or 2v2, warm-up servers). */
const NO_ROLES: Readonly<Record<string, readonly string[]>> = {
  lol: ['arena', 'aram'],
  val: ['skirm', 'dm'],
  cs2: ['wing', 'casual', 'retake'],
  wr: ['aram'],
  // Open-world content and leveling have no group roles
  wow: ['delves', 'level'],
};

/** What the game calls the character a customer wants coaching on. */
const CHARACTER: Readonly<Record<string, string>> = {
  lol: 'Champion',
  val: 'Agent',
  ow: 'Hero',
  mr: 'Hero',
  apex: 'Legend',
  r6: 'Operator',
  pu: 'Pokémon',
  dota: 'Hero',
  wr: 'Champion',
  dl: 'Hero',
  wow: 'Class & spec',
};

export const ROLE_MAX = 24;
export const CHARACTER_MAX = 40;

/** The roles a customer can pick for this service, the "no preference" one last; [] = none. */
export function rolesFor(gameId: string, serviceId: string): readonly string[] {
  if (NO_ROLES[gameId]?.includes(serviceId)) return [];
  return ROLES[gameId] ?? [];
}

/** True for the preselected "no preference" role (Fill, Flex or Any) of that service. */
export function isNoPreference(
  gameId: string,
  serviceId: string,
  role: string,
): boolean {
  const roles = rolesFor(gameId, serviceId);
  return roles.length > 0 && roles[roles.length - 1] === role;
}

/**
 * The label of the character field ("Champion", "Agent"…) for a coaching service in a game with
 * characters; '' when the service doesn't ask.
 */
export function characterLabel(gameId: string, cat: string): string {
  return cat === 'training' ? (CHARACTER[gameId] ?? '') : '';
}

/** Throws unless the role and character are allowed for the service; returns what to store. */
export function checkRoleAndCharacter(
  gameId: string,
  serviceId: string,
  cat: string,
  role: string | undefined,
  character: string | undefined,
): { role: string | null; character: string | null } {
  let storedRole: string | null = null;
  if (role !== undefined) {
    if (!rolesFor(gameId, serviceId).includes(role))
      throw new Error('Invalid role');
    storedRole = isNoPreference(gameId, serviceId, role) ? null : role;
  }
  let storedCharacter: string | null = null;
  const name = character?.trim() ?? '';
  if (name) {
    if (!characterLabel(gameId, cat)) throw new Error('Invalid character');
    if (name.length > CHARACTER_MAX) throw new Error('Invalid character');
    storedCharacter = name;
  }
  return { role: storedRole, character: storedCharacter };
}
