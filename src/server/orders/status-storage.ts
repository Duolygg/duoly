import { createClient } from '@supabase/supabase-js';
export type StatusRpc = (name: string, args: Record<string, unknown>) => PromiseLike<{data: unknown; error: unknown}>;
export function statusRpc(): StatusRpc {
  const url = process.env.SUPABASE_URL ?? import.meta.env?.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? import.meta.env?.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Status storage unavailable');
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, {...init, signal: AbortSignal.timeout(5000)}) },
  });
  return (name, args) => db.rpc(name, args);
}
