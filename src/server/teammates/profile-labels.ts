/*
 * Stored values in, readable names out (DESIGN decision 2).
 *
 * Picks are stored as catalog ids, because the official names contain punctuation the database
 * label check rejects ("D.Va", "KAY/O", "Soldier: 76", "Dr. Mundo", "Mr. Mime"). Every public
 * read path goes through loadPublicProfile(), which calls this before the profile reaches a page,
 * the generated prose, the preview endpoint or the directory quick view, so there is one place
 * that can turn an id into a name and no second place that can forget to.
 *
 * Anything the catalog does not know keeps its stored text, which is what these pages showed
 * before the catalog existed; the escaping around it is unchanged.
 */
import type { PublicTeammateProfile } from '../../contracts/teammate-profile';
import {
  pickDisplayNames,
  resolveRole,
} from '../../contracts/game-picks-resolve';

/** The same profile with every role and pick spelled the way a visitor should read it. */
export function withDisplayLabels(
  profile: PublicTeammateProfile,
): PublicTeammateProfile {
  return {
    ...profile,
    games: profile.games.map((entry) => ({
      ...entry,
      /* Roles are stored as names already, so this only tidies the spelling of a role saved
         before the game had a role list. */
      roles: entry.roles.map((role) => resolveRole(entry.game, role) ?? role),
      picks: pickDisplayNames(entry.game, entry.picks),
    })),
  };
}
