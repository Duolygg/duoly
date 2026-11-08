import type { HubPageCopy } from '../hub-pages';
import { valorant } from './valorant';
import { leagueOfLegends } from './league-of-legends';
import { counterStrike2 } from './counter-strike-2';
import { fortnite } from './fortnite';
import { callOfDuty } from './call-of-duty';
import { apexLegends } from './apex-legends';
import { rainbowSixSiege } from './rainbow-six-siege';
import { marvelRivals } from './marvel-rivals';
import { overwatch2 } from './overwatch-2';
import { rocketLeague } from './rocket-league';
import { teamfightTactics } from './teamfight-tactics';
import { eaSportsFc27 } from './ea-sports-fc-27';
import { arcRaiders } from './arc-raiders';
import { minecraft } from './minecraft';
import { pokemonUnite } from './pokemon-unite';
import { dota2 } from './dota-2';
import { worldOfWarcraft } from './world-of-warcraft';
import { pubg } from './pubg';
import { wildRift } from './wild-rift';
import { deadlock } from './deadlock';

/** Finished game hubs, in the order the sitemap lists them (catalog demand order). */
export const GAME_HUBS: HubPageCopy[] = [
  valorant,
  leagueOfLegends,
  counterStrike2,
  fortnite,
  callOfDuty,
  apexLegends,
  rainbowSixSiege,
  marvelRivals,
  overwatch2,
  dota2,
  rocketLeague,
  worldOfWarcraft,
  pubg,
  teamfightTactics,
  eaSportsFc27,
  arcRaiders,
  wildRift,
  minecraft,
  deadlock,
  pokemonUnite,
];
