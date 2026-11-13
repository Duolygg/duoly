import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';
import type { SupportPerson, SupportRole } from './sparky';
import { readTicket } from './booking-ticket';

let cached: { key: string; client: SupabaseClient } | null = null;
const env = (name: string) => {
  const value: unknown = process.env[name] ?? import.meta.env?.[name];
  return typeof value === 'string' && value ? value : undefined;
};

export function supportService(): SupabaseClient | null {
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SECRET_KEY');
  if (!url || !key) return null;
  if (cached?.key !== key)
    cached = {
      key,
      client: createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    };
  return cached.client;
}

export const newGuestToken = () => randomBytes(24).toString('base64url');
export const guestTokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export type ConversationRow = {
  id: string;
  reference: string;
  user_id: string | null;
  guest_token_hash: string | null;
  role: SupportRole;
  name: string;
  email: string;
  image: string;
  status: 'bot' | 'waiting' | 'human' | 'closed';
  claimed_by: string | null;
  waiting_since: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  sender: 'user' | 'bot' | 'admin' | 'system';
  body: string;
  admin_name: string;
  admin_image: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

export async function currentConversation(
  service: SupabaseClient,
  person: SupportPerson,
  guestHash?: string,
): Promise<ConversationRow | null> {
  let query = service
    .from('support_conversations')
    .select('*')
    .neq('status', 'closed')
    .order('updated_at', { ascending: false })
    .limit(1);
  query = person.userId
    ? query.eq('user_id', person.userId)
    : query.eq('guest_token_hash', guestHash ?? '');
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as ConversationRow | null;
}

export async function startConversation(
  service: SupabaseClient,
  person: SupportPerson,
  guestHash?: string,
): Promise<ConversationRow> {
  const { data, error } = await service
    .from('support_conversations')
    .insert({
      user_id: person.userId ?? null,
      guest_token_hash: person.userId ? null : guestHash,
      role: person.role,
      name: person.name || 'Guest',
      email: person.email ?? '',
      image: person.image ?? '',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ConversationRow;
}

export async function updateConversation(
  service: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
) {
  const { error } = await service
    .from('support_conversations')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function addMessage(
  service: SupabaseClient,
  conversationId: string,
  sender: 'bot' | 'system',
  body: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await service.from('support_messages').insert({
    conversation_id: conversationId,
    sender,
    body: body.trim().slice(0, 2000),
    metadata,
  });
  if (error) throw error;
  await updateConversation(service, conversationId, {});
}

export async function appendUserMessage(
  service: SupabaseClient,
  conversationId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data, error } = await service.rpc('support_add_user_message', {
    p_conversation_id: conversationId,
    p_body: body,
    p_limit: 12,
  });
  if (error || !data || typeof data !== 'object')
    return { ok: false, status: 503, error: 'Support is unavailable.' };
  const refusal = (data as { error?: { code?: number; message?: string } })
    .error;
  if (refusal)
    return {
      ok: false,
      status: refusal.code ?? 400,
      error: refusal.message ?? 'That message could not be sent.',
    };
  return { ok: true };
}

export async function takeAiSlot(
  service: SupabaseClient,
  limit: number,
  identityKey: string,
  identityLimit: number,
) {
  const { data, error } = await service.rpc('support_take_ai_slot', {
    p_limit: limit,
    p_identity_key: identityKey,
    p_identity_limit: identityLimit,
  });
  return !error && data === true;
}

export async function messages(
  service: SupabaseClient,
  conversationId: string,
): Promise<MessageRow[]> {
  const { data, error } = await service
    .from('support_messages')
    .select('id,sender,body,admin_name,admin_image,created_at,metadata')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

export async function supportTeam(service: SupabaseClient) {
  const [{ data: roles, error }, onlineResult] = await Promise.all([
    service.from('account_roles').select('user_id').eq('role', 'admin'),
    service.rpc('support_online_admins'),
  ]);
  if (error || onlineResult.error) throw error ?? onlineResult.error;
  const online = new Set(
    ((onlineResult.data as { ids?: unknown } | null)?.ids as
      string[] | undefined) ?? [],
  );
  const ids = (roles ?? []).map((row) => row.user_id as string);
  if (!ids.length) return [];
  const { data: profiles, error: profileError } = await service
    .from('profiles')
    .select('id,name,image')
    .in('id', ids);
  if (profileError) throw profileError;
  return (profiles ?? []).map((profile) => ({
    id: profile.id,
    name: firstName(profile.name || 'Duoly team'),
    image: profile.image || '',
    online: online.has(profile.id),
  }));
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'Duoly team';

export async function conversationView(
  service: SupabaseClient,
  conversation: ConversationRow | null,
) {
  if (!conversation) return null;
  const [rows, team] = await Promise.all([
    messages(service, conversation.id),
    supportTeam(service),
  ]);
  const agent =
    team.find((member) => member.id === conversation.claimed_by) ?? null;
  return {
    id: conversation.id,
    status: conversation.status === 'human' ? 'open' : conversation.status,
    agent,
    messages: rows.map((message) => ({
      id: message.id,
      from: message.sender,
      text: message.body,
      at: Date.parse(message.created_at),
      by:
        message.sender === 'admin'
          ? { name: message.admin_name, image: message.admin_image }
          : null,
      // Only a re-validated ticket leaves the server; tool logs and other metadata stay here.
      booking:
        message.sender === 'bot' ? readTicket(message.metadata?.booking) : null,
    })),
  };
}

export async function refreshPerson(
  service: SupabaseClient,
  conversation: ConversationRow,
  person: SupportPerson,
) {
  // Guests have no account: their name and email come only from the contact
  // form, so the widget must never overwrite them with the "Guest" defaults.
  if (!person.userId) return;
  if (
    conversation.role !== person.role ||
    conversation.name !== person.name ||
    conversation.email !== (person.email ?? '') ||
    conversation.image !== (person.image ?? '')
  )
    await updateConversation(service, conversation.id, {
      role: person.role,
      name: person.name,
      email: person.email ?? '',
      image: person.image ?? '',
    });
}
