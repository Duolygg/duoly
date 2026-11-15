import { SetPlusOnlyGamesSchema } from '../../contracts/admin';
import { adminRoute } from './handlers';

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
// Not in the generated database types until they are regenerated after the migration.
const rpc = (client: unknown) =>
  (client as { rpc: Rpc }).rpc.bind(client) as Rpc;

/**
 * /api/admin/duo-levels (migration 20261115140000). GET: the games each teammate is Plus only in,
 * as { plusOnly: { userId: string[] } }. POST { userId, plusOnly }: set one teammate's Plus only
 * games. The database re-checks the admin role, that the account is a teammate, and keeps only
 * games they are approved for.
 */
export const duoLevels = adminRoute(
  (client) => rpc(client)('admin_duo_levels'),
  [
    {
      schema: SetPlusOnlyGamesSchema,
      call: (client, body) =>
        rpc(client)('admin_set_plus_only_games', {
          p_user: body.userId,
          p_games: body.plusOnly,
        }),
    },
  ],
  ['users'],
);
