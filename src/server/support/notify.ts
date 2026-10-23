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
export async function notifySupportDiscordHook(conversationId: string) {
  void conversationId; // Ledger #40/#42: post the waiting conversation to the Discord support channel here.
  return false;
}
