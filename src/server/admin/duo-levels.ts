import { SetDuoLevelSchema } from '../../contracts/admin';
import { adminRoute } from './handlers';

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
// Not in the generated database types until they are regenerated after the migration.
const rpc = (client: unknown) =>
  (client as { rpc: Rpc }).rpc.bind(client) as Rpc;

/**
 * /api/admin/duo-levels (migration 20261030140000). GET: every teammate's level as { levels: {
 * userId: 'standard' | 'plus_only' } }. POST: set one teammate's level. The database re-checks the
 * admin role and that the account is a teammate.
 */
export const duoLevels = adminRoute(
  (client) => rpc(client)('admin_duo_levels'),
  [
    {
      schema: SetDuoLevelSchema,
      call: (client, body) =>
        rpc(client)('admin_set_duo_level', {
          p_user: body.userId,
          p_level: body.level,
        }),
    },
  ],
  ['users'],
);
