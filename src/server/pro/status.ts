import type { SupabaseClient } from '@supabase/supabase-js';
import { PRO_OFFER, toProView, type ProView } from '../../contracts/pro';
import { proEnabled } from './config';

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
// bound: supabase-js rpc reads `this`, so a detached `client.rpc` throws before any request
const rpcOf = (client: SupabaseClient) =>
  client.rpc.bind(client) as unknown as Rpc;

/**
 * The page-side PRO state. null while PRO is off (the UI then keeps today's markup); the
 * offer for signed-out visitors and non-customers; otherwise the viewer's own row via the
 * authenticated pro_my_status() RPC.
 */
export async function loadProView(
  client: SupabaseClient | null | undefined,
  role: string | null | undefined,
): Promise<ProView | null> {
  if (!proEnabled()) return null;
  if (!client || role !== 'customer') return PRO_OFFER;
  try {
    const { data, error } = await rpcOf(client)('pro_my_status');
    if (error) return null;
    return toProView(data);
  } catch {
    return null;
  }
}

/** Service-role check used by checkout pricing. Throws on lookup failure (checkout then 503s). */
export async function isProMember(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await rpcOf(admin)('is_pro', { p_user: userId });
  if (error) throw new Error('is_pro failed');
  return data === true;
}
