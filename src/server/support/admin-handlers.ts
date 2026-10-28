import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AdminSupportSchema } from '../../contracts/support';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import { rpcResponse } from '../admin/handlers';
import { notifySupportReply, updateSupportDiscordNote } from './notify';

const idSchema = z.uuid();

/** Discord status line for the admin ping, matching the original support route. */
export function supportDiscordStatus(
  action: string,
  name: string,
  hadAgent: boolean,
): string | null {
  if ((action === 'reply' || action === 'claim') && !hadAgent)
    return `✅ **${name}** is on it`;
  if (action === 'close') return `✔️ Closed by **${name}**`;
  if (action === 'bot') return `↩️ **${name}** handed it back to Sparky`;
  return null;
}

export const getAdminSupport: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  try {
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'admin')
      return account.json({ error: 'Not found.' }, 404);
    const raw = context.url.searchParams.get('id');
    const parsed = raw ? idSchema.safeParse(raw) : null;
    if (raw && !parsed?.success)
      return account.json({ error: 'Chat not found.' }, 404);
    const { data, error } = await account.client.rpc('admin_support_inbox', {
      p_conversation_id: parsed?.success ? parsed.data : undefined,
    });
    return rpcResponse(account, data, error);
  } catch {
    return account.json({ error: 'Support inbox unavailable.' }, 503);
  }
};

export const postAdminSupport: APIRoute = async (context) => {
  const prepared = await mutation(context, 8192);
  if (prepared.failure || !prepared.body) return prepared.failure!;
  const parsed = AdminSupportSchema.safeParse(prepared.body);
  if (!parsed.success)
    return prepared.account.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid support request.' },
      400,
    );
  try {
    const identity = await prepared.account.identity();
    if (!identity || !prepared.account.client)
      return prepared.account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'admin')
      return prepared.account.json({ error: 'Not found.' }, 404);
    let hadAgent = false;
    if (parsed.data.action === 'reply' || parsed.data.action === 'claim') {
      const before = await prepared.account.client.rpc('admin_support_inbox', {
        p_conversation_id: parsed.data.id,
      });
      hadAgent = Boolean(
        (before.data as { open?: { agent?: unknown } } | null)?.open?.agent,
      );
    }
    const { data, error } = await prepared.account.client.rpc(
      'admin_support_command',
      {
        p_conversation_id: parsed.data.id,
        p_action: parsed.data.action,
        p_text: parsed.data.text ?? '',
      },
    );
    const response = rpcResponse(prepared.account, data, error);
    const open = (data as { open?: Record<string, unknown> }).open;
    const status = supportDiscordStatus(
      parsed.data.action,
      identity.viewer.name || 'Duoly team',
      hadAgent,
    );
    if (response.status === 200 && status) {
      const note = open?.discordNote;
      await updateSupportDiscordNote(
        note && typeof note === 'object'
          ? (note as { channelId: string; messageId: string; text: string })
          : null,
        status,
      );
    }
    if (response.status === 200 && parsed.data.action === 'reply') {
      const messages = Array.isArray(open?.messages) ? open.messages : [];
      const last = messages[messages.length - 1] as
        { id?: unknown; by?: { image?: unknown } } | undefined;
      await notifySupportReply({
        email: typeof open?.email === 'string' ? open.email : '',
        firstName: typeof open?.name === 'string' ? open.name : 'there',
        agentName: identity.viewer.name || 'Duoly team',
        agentAvatar:
          typeof last?.by?.image === 'string' ? last.by.image : undefined,
        message: parsed.data.text ?? '',
        conversationId: parsed.data.id,
        messageId: typeof last?.id === 'string' ? last.id : randomUUID(),
      });
    }
    return response;
  } catch {
    return prepared.account.json({ error: 'Support inbox unavailable.' }, 503);
  }
};
