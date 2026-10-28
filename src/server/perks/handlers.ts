import type { APIRoute } from 'astro';
import { z } from 'zod';
import { accountContext } from '../auth/context';
import { decodeOrderRpcResult } from '../orders/results';
import { GAMES } from '../../design-reference/lib/games.js';
import type { CustomerPerks, PickableTeammates } from '../../contracts/orders';

type RpcAnswer = { data: unknown; error: unknown; status?: number };
type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<RpcAnswer>;

const GAME_IDS = (GAMES as { id: string }[]).map((game) => game.id);

/**
 * Pure: the perks RPCs answer 404 (PostgREST PGRST202, function not found) until migration
 * 20261026160000 is applied. The UI treats that as "no perk".
 */
export function isMissingRpc(answer: RpcAnswer): boolean {
  const code = (answer.error as { code?: unknown } | null | undefined)?.code;
  return answer.status === 404 || code === 'PGRST202' || code === '42883';
}

const Flag = z.enum(['true', 'false']).transform((value) => value === 'true');
export const PickableQuerySchema = z.strictObject({
  game: z.string().refine((id) => GAME_IDS.includes(id)),
  gg: Flag.default(false),
  voice: Flag.default(false),
});

/** Strict query string: known keys only, each at most once. */
function readQuery(url: URL, keys: readonly string[]) {
  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    if (!keys.includes(key) || Object.hasOwn(query, key)) return null;
    query[key] = value;
  }
  return query;
}

function getOnly(
  context: Parameters<APIRoute>[0],
  account: ReturnType<typeof accountContext>,
) {
  if (context.request.method === 'GET') return null;
  const response = account.json({ error: 'Method not allowed.' }, 405);
  response.headers.set('Allow', 'GET');
  return response;
}

/** GET /api/orders/perks -> { perks: CustomerPerks | null } (null before the migration). */
export const perks: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  try {
    const wrongMethod = getOnly(context, account);
    if (wrongMethod) return wrongMethod;
    if ([...context.url.searchParams].length)
      return account.json({ error: 'Invalid order request.' }, 400);
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'customer')
      return account.json({ error: 'Order access denied.' }, 403);
    const rpc = account.client.rpc.bind(account.client) as unknown as Rpc;
    const answer = await rpc('customer_perks');
    if (isMissingRpc(answer))
      return account.json({ perks: null satisfies CustomerPerks | null });
    const result = decodeOrderRpcResult(
      'customerPerks',
      answer.data,
      answer.error,
    );
    if (!result.ok) return account.json(result.payload, result.status);
    return account.json({ perks: result.payload });
  } catch {
    return account.json({ error: 'Order service unavailable.' }, 503);
  }
};

const NONE: PickableTeammates = { eligible: false, teammates: [] };

/**
 * GET /api/orders/pickable-teammates?game=lol&gg=false&voice=true
 * -> { eligible, teammates: [{ handle, name, image, country, orders }] }. Diamond only (the
 * database answers eligible false and an empty list below Diamond). A handle is the
 * customer's own completed order id; teammate user ids never leave the database.
 */
export const pickable: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  try {
    const wrongMethod = getOnly(context, account);
    if (wrongMethod) return wrongMethod;
    const raw = readQuery(context.url, ['game', 'gg', 'voice']);
    const query = raw ? PickableQuerySchema.safeParse(raw) : null;
    if (!query?.success)
      return account.json({ error: 'Invalid order request.' }, 400);
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'customer')
      return account.json({ error: 'Order access denied.' }, 403);
    const rpc = account.client.rpc.bind(account.client) as unknown as Rpc;
    const answer = await rpc('customer_pickable_teammates', {
      p_game: query.data.game,
      p_gg: query.data.gg,
      p_voice: query.data.voice,
    });
    if (isMissingRpc(answer)) return account.json(NONE);
    const result = decodeOrderRpcResult(
      'pickableTeammates',
      answer.data,
      answer.error,
    );
    if (!result.ok) return account.json(result.payload, result.status);
    // Belt and braces: never more than the declared fields, and nothing when not eligible.
    if (!result.payload.eligible) return account.json(NONE);
    return account.json({
      eligible: true,
      teammates: result.payload.teammates.map((t) => ({
        handle: t.handle,
        name: t.name,
        image: t.image,
        country: t.country,
        orders: t.orders,
      })),
    } satisfies PickableTeammates);
  } catch {
    return account.json({ error: 'Order service unavailable.' }, 503);
  }
};
