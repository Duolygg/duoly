import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
const env = (name: string): string => {
  const value = process.env[name] ?? import.meta.env?.[name];
  return typeof value === 'string' ? value : '';
};
export type LimitResult = { allowed: boolean; retryAfter: number };
type Rpc = (
  name: string,
  args: { p_key: string },
) => PromiseLike<{ data: unknown; error: unknown }>;
const result = z.strictObject({
  allowed: z.boolean(),
  retry_after: z.number().int().min(0).max(86400),
});
// A process-wide outage budget avoids retaining IPs or unbounded per-address maps.
let fallbackWindow = -1;
let fallbackCalls = 0;
function outageLimit(): LimitResult {
  const now = Date.now();
  const window = Math.floor(now / 60000);
  if (fallbackWindow !== window) {
    fallbackWindow = window;
    fallbackCalls = 0;
    console.warn(
      'MCP limiter RPC unavailable; using process cap of 30 requests per minute.',
    );
  }
  return ++fallbackCalls <= 30
    ? { allowed: true, retryAfter: 0 }
    : {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil(((window + 1) * 60000 - now) / 1000)),
      };
}
export async function rateLimit(
  ip: string,
  rpc?: Rpc,
  secret = env('MCP_IP_HASH_SECRET'),
): Promise<LimitResult> {
  if (secret.length < 32 || !isIP(ip))
    throw new Error('MCP limiter configuration unavailable');
  if (!rpc) {
    const url = env('SUPABASE_URL'),
      key = env('SUPABASE_SECRET_KEY');
    if (!url || !key) throw new Error('MCP limiter storage unavailable');
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(5000) }),
      },
    });
    rpc = (name, args) => db.rpc(name, args);
  }
  const key = createHmac('sha256', secret)
    .update('mcp-v1:' + ip)
    .digest('hex');
  try {
    const response = await rpc('mcp_take_rate_limit', { p_key: key });
    if (response.error) return outageLimit();
    const value = result.parse(response.data);
    return { allowed: value.allowed, retryAfter: value.retry_after };
  } catch {
    return outageLimit();
  }
}
