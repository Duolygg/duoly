import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '../email/send';
import type { SupportPerson } from './sparky';

const siteOrigin = () => {
  const value =
    process.env.EMAIL_SITE_URL ??
    process.env.AUTH_ORIGIN ??
    import.meta.env?.EMAIL_SITE_URL ??
    import.meta.env?.AUTH_ORIGIN;
  try {
    return new URL(value ?? '').origin;
  } catch {
    return 'https://duoly.gg';
  }
};

export async function notifySupportAdmins(
  service: SupabaseClient,
  person: SupportPerson,
  conversationId: string,
  message: string,
  eventKey: string,
) {
  const { data: roles, error } = await service
    .from('account_roles')
    .select('user_id')
    .eq('role', 'admin');
  if (error) return;
  const ids = new Set((roles ?? []).map((row) => row.user_id as string));
  if (!ids.size) return;
  const users = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) return;
  await Promise.all(
    users.data.users
      .filter((user) => ids.has(user.id) && user.email)
      .map((user) =>
        sendEmail({
          template: 'support_handoff',
          to: user.email!,
          idempotencyKey: `support_handoff:${conversationId}:${eventKey}`,
          data: {
            requesterName: person.name || 'Guest',
            requesterRole: person.role,
            message,
            inboxUrl: `${siteOrigin()}/admin/support`,
          },
        }).catch(() => undefined),
      ),
  );
}

export async function notifySupportReply({
  email,
  firstName,
  agentName,
  agentAvatar,
  message,
  conversationId,
  messageId,
}: {
  email: string;
  firstName: string;
  agentName: string;
  agentAvatar?: string;
  message: string;
  conversationId: string;
  messageId: string;
}) {
  if (!email) return;
  await sendEmail({
    template: 'support_reply',
    to: email,
    idempotencyKey: `support_reply:${conversationId}:${messageId}`,
    data: {
      firstName: firstName.trim().split(/\s+/)[0] || 'there',
      agentName,
      agentAvatar,
      message,
      conversationUrl: siteOrigin(),
    },
  }).catch(() => undefined);
}

/** Discord notification hook. Intentionally empty until the Discord support slice is built. */
const WEBHOOK =
  /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/;

const plain = (value: string, max: number) =>
  Array.from(value, (ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return code < 32 || (code >= 127 && code <= 159) ? ' ' : ch;
  })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_ID = /^\d{5,25}$/;
let supportTargetCache: {
  guildId: string;
  channelId: string | null;
  roleId: string | null;
  at: number;
} | null = null;

const envValue = (name: string) =>
  process.env[name] ?? (import.meta.env?.[name] as string | undefined);

async function discordBotFetch(
  token: string,
  path: string,
  method: 'GET' | 'POST' | 'PATCH',
  body: unknown,
  fetcher: typeof fetch,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    return await fetcher(DISCORD_API + path, {
      method,
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://duoly.gg, 1.0)',
      },
      ...(body == null ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function adminPingTarget(
  token: string,
  guildId: string,
  fetcher: typeof fetch,
  now = Date.now(),
) {
  if (
    supportTargetCache?.guildId === guildId &&
    now - supportTargetCache.at < 10 * 60_000
  )
    return supportTargetCache;
  const [channelsResponse, rolesResponse] = await Promise.all([
    discordBotFetch(token, `/guilds/${guildId}/channels`, 'GET', null, fetcher),
    discordBotFetch(token, `/guilds/${guildId}/roles`, 'GET', null, fetcher),
  ]);
  const channels = channelsResponse.ok
    ? ((await channelsResponse.json()) as {
        id?: string;
        name?: string;
        type?: number;
      }[])
    : [];
  const roles = rolesResponse.ok
    ? ((await rolesResponse.json()) as {
        id?: string;
        name?: string;
        managed?: boolean;
      }[])
    : [];
  const channel = channels.find(
    (entry) =>
      entry.type === 0 &&
      typeof entry.name === 'string' &&
      /admin/i.test(entry.name),
  );
  const role =
    roles.find(
      (entry) => entry.name?.trim().toLowerCase() === 'admin' && !entry.managed,
    ) ??
    roles.find(
      (entry) =>
        typeof entry.name === 'string' &&
        /admin/i.test(entry.name) &&
        !entry.managed,
    );
  supportTargetCache = {
    guildId,
    channelId: DISCORD_ID.test(channel?.id ?? '') ? channel!.id! : null,
    roleId: DISCORD_ID.test(role?.id ?? '') ? role!.id! : null,
    at: now,
  };
  return supportTargetCache;
}

export type SupportDiscordNote = {
  channelId: string;
  messageId: string;
  text: string;
};

export async function notifySupportDiscord(
  service: SupabaseClient,
  conversationId: string,
  person: SupportPerson,
  message: string,
  {
    token = envValue('DISCORD_BOT_TOKEN'),
    guildId = envValue('DISCORD_GUILD_ID'),
    fetcher = fetch,
  }: { token?: string; guildId?: string; fetcher?: typeof fetch } = {},
): Promise<boolean> {
  if (!token) return notifySupportDiscordHook(person, message, { fetcher });
  if (!guildId || !DISCORD_ID.test(guildId)) return false;
  try {
    const target = await adminPingTarget(token, guildId, fetcher);
    if (!target.channelId) return false;
    const who =
      person.role === 'guest'
        ? 'A guest'
        : `${person.role === 'teammate' ? 'Teammate' : 'Customer'} ${plain(person.name ?? '', 32).split(' ')[0] || 'Player'}`;
    const text = [
      `**Support chat waiting.** ${who} asked for a human.`,
      `> ${plain(message, 160) || 'Asked to talk to a person.'}`,
      `Reply in the admin dashboard: ${siteOrigin()}/admin/support`,
    ].join('\n');
    const response = await discordBotFetch(
      token,
      `/channels/${target.channelId}/messages`,
      'POST',
      {
        content: `${target.roleId ? `<@&${target.roleId}> ` : ''}${text}`.slice(
          0,
          1900,
        ),
        allowed_mentions: {
          parse: [],
          roles: target.roleId ? [target.roleId] : [],
        },
      },
      fetcher,
    );
    if (!response.ok) return false;
    const result = (await response.json()) as { id?: unknown };
    if (typeof result.id !== 'string' || !DISCORD_ID.test(result.id))
      return false;
    const update = await service
      .from('support_conversations')
      .update({
        discord_channel_id: target.channelId,
        discord_message_id: result.id,
        discord_message_text: text,
      })
      .eq('id', conversationId);
    return !update.error;
  } catch {
    return false;
  }
}

export async function updateSupportDiscordNote(
  note: SupportDiscordNote | null | undefined,
  status: string,
  {
    token = envValue('DISCORD_BOT_TOKEN'),
    fetcher = fetch,
  }: { token?: string; fetcher?: typeof fetch } = {},
): Promise<boolean> {
  if (!note || !token) return false;
  if (!DISCORD_ID.test(note.channelId) || !DISCORD_ID.test(note.messageId))
    return false;
  try {
    const original = note.text
      .replace(/\nReply in the admin dashboard[^\n]*/i, '')
      .trim();
    const response = await discordBotFetch(
      token,
      `/channels/${note.channelId}/messages/${note.messageId}`,
      'PATCH',
      {
        content: `${plain(status, 120)}\n${original}`.slice(0, 1900),
        allowed_mentions: { parse: [] },
      },
      fetcher,
    );
    return response.ok;
  } catch {
    return false;
  }
}

export function resetSupportDiscordCache() {
  supportTargetCache = null;
}

/**
 * Webhook fallback used only when no bot token is configured.
 */
export async function notifySupportDiscordHook(
  person: SupportPerson,
  message: string,
  {
    url = process.env.SUPPORT_DISCORD_WEBHOOK_URL ??
      import.meta.env?.SUPPORT_DISCORD_WEBHOOK_URL,
    roleId = process.env.SUPPORT_DISCORD_ADMIN_ROLE_ID ??
      import.meta.env?.SUPPORT_DISCORD_ADMIN_ROLE_ID,
    fetcher = fetch,
  }: { url?: string; roleId?: string; fetcher?: typeof fetch } = {},
): Promise<boolean> {
  if (!url || !WEBHOOK.test(url)) return false;
  const role = roleId && /^\d{5,25}$/.test(roleId) ? roleId : null;
  const who =
    person.role === 'guest'
      ? 'A guest'
      : `${person.role === 'teammate' ? 'Teammate' : 'Customer'} ${plain(person.name ?? '', 32).split(' ')[0] || 'Player'}`;
  const content = [
    `${role ? `<@&${role}> ` : ''}**Support chat waiting.** ${who} asked for a human.`,
    `> ${plain(message, 160) || 'Asked to talk to a person.'}`,
    `Answer in ${siteOrigin()}/admin/support`,
  ].join('\n');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Sparky',
        content,
        allowed_mentions: { parse: [], roles: role ? [role] : [] },
      }),
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
