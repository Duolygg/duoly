import type { PublicTrophy } from '../../contracts/trophies';
import {
  byRarity,
  trophyView as display,
  type TrophyView,
} from '../../contracts/trophy-display';
import { profileGame } from './profile-page';

export {
  trophyCrest,
  trophyOffset,
  type TrophyView,
} from '../../contracts/trophy-display';

/** One approved trophy as the public case shows it. */
export const trophyView = (t: PublicTrophy): TrophyView =>
  display(t, profileGame(t.game).name);

/** The case in display order: rarest first, then the most recently verified. */
export function trophyCase(trophies: PublicTrophy[]): TrophyView[] {
  return [...trophies].sort(byRarity).map(trophyView);
}
