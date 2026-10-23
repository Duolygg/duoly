import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Owners: the emails in ADMIN_EMAILS (comma separated). They are always admin and nobody can
 * change that (spec, original lib/admin.js). The database mirrors the flag through the
 * service-only `sync_account_owner` RPC so it can refuse to demote an owner on its own.
 */
export function ownerEmails(raw = env('ADMIN_EMAILS')): string[] {
  return String(raw ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => /^[^@\s]+@[^@\s]+$/.test(entry));
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && ownerEmails().includes(email.trim().toLowerCase());
}

function env(name: string): string | undefined {
  const value = process.env[name] ?? import.meta.env?.[name];
  return typeof value === 'string' ? value : undefined;
}

let service: { key: string; client: SupabaseClient } | null = null;
function serviceClient(): SupabaseClient | null {
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SECRET_KEY');
  if (!url || !key) return null;
  if (service?.key !== key)
    service = {
      key,
      client: createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    };
  return service.client;
}

/**
 * Brings the stored owner flag in line with ADMIN_EMAILS. Returns true when the database now
 * matches; false when it could not be updated (no service key or a failed call), in which
 * case the caller keeps the stored role.
 */
export async function syncOwner(
  userId: string,
  owner: boolean,
  sync: (userId: string, owner: boolean) => Promise<boolean> = rpcSync,
): Promise<boolean> {
  try {
    return await sync(userId, owner);
  } catch {
    return false;
  }
}

async function rpcSync(userId: string, owner: boolean): Promise<boolean> {
  const client = serviceClient();
  if (!client) return false;
  const { error } = await client.rpc('sync_account_owner', {
    p_user_id: userId,
    p_owner: owner,
  });
  return !error;
}
