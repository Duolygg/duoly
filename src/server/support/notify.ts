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

/**
 * Posts a "chat needs a human" alert to the Discord support channel webhook
 * (SUPPORT_DISCORD_WEBHOOK_URL). Mentions are disabled, except an optional
 * admin role ping (SUPPORT_DISCORD_ADMIN_ROLE_ID). Never throws; no email or
 * other personal data beyond a first name is posted.
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
