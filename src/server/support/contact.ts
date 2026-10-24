import type { APIRoute } from 'astro';
import { mutation } from '../auth/handlers';
import { CONTACT_TOPICS, ContactSchema } from '../../contracts/support';
import { identify } from './handlers';
import { notifySupportAdmins, notifySupportDiscordHook } from './notify';
import {
  addMessage,
  currentConversation,
  refreshPerson,
  startConversation,
  updateConversation,
  type ConversationRow,
} from './store';
import type { SupportPerson } from './sparky';

// Original app/api/contact/route.js: 3 messages per person per 10 minutes.
export const CONTACT_LIMIT = 3;
export const CONTACT_WINDOW_MS = 10 * 60_000;

type Topic = keyof typeof CONTACT_TOPICS;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const oneLine = (value: string, max: number) =>
  Array.from(value, (ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return code < 32 || (code >= 127 && code <= 159) ? ' ' : ch;
  })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

export type ContactInput = {
  name: string;
  email: string;
  topic: string;
  order: string;
  message: string;
};

/** Validates the form like the original and builds the inbox message. */
export function contactMessage(
  input: ContactInput,
  signedIn: { name?: string; email?: string | null } | null,
):
  | { ok: false; error: string; field: string }
  | {
      ok: true;
      name: string;
      email: string;
      topic: Topic;
      body: string;
      label: string;
    } {
  const name = oneLine(input.name, 60) || oneLine(signedIn?.name ?? '', 60);
  const email = (
    oneLine(input.email, 120) ||
    signedIn?.email ||
    ''
  ).toLowerCase();
  const topic: Topic =
    input.topic in CONTACT_TOPICS ? (input.topic as Topic) : 'other';
  const order = oneLine(input.order, 20).toUpperCase();
  const message = input.message.trim().slice(0, 2000);
  if (name.length < 2)
    return { ok: false, error: 'Tell us your name.', field: 'name' };
  if (!EMAIL.test(email))
    return {
      ok: false,
      error: 'That email doesn’t look right.',
      field: 'email',
    };
  if (message.length < 10)
    return {
      ok: false,
      error: 'Write a little more so we can help (at least 10 characters).',
      field: 'message',
    };
  const label = CONTACT_TOPICS[topic];
  const head = `Contact form · ${label}${order ? ` · Order ${order}` : ''}`;
  const body = `${head}\n${message}${signedIn ? '' : `\n${name} · ${email}`}`;
  return { ok: true, name, email, topic, body: body.slice(0, 2000), label };
}

export const postContact: APIRoute = async (context) => {
  const prepared = await mutation(context, 8192);
  if (prepared.failure || !prepared.body) return prepared.failure!;
  const json = prepared.account.json.bind(prepared.account);
  const parsed = ContactSchema.safeParse(prepared.body);
  if (!parsed.success)
    return json({ error: 'Couldn’t send that. Please try again.' }, 400);
  // Honeypot: bots fill every field. Pretend it worked.
  if (parsed.data.website) return json({ ok: true });
  try {
    const identified = await identify(context, prepared.account);
    if (!identified.service || !identified.person)
      return json({ error: 'Contact is unavailable right now.' }, 503);
    const { service, guestHash } = identified;
    const signedIn = identified.person.userId
      ? {
          name: identified.person.name,
          email: identified.person.email ?? null,
        }
      : null;
    const checked = contactMessage(parsed.data, signedIn);
    if (!checked.ok)
      return json({ error: checked.error, field: checked.field }, 400);
    // Guests are named by the form; signed-in people keep their account identity.
    const person: SupportPerson = signedIn
      ? identified.person
      : { ...identified.person, name: checked.name, email: checked.email };

    let conversation: ConversationRow | null = await currentConversation(
      service,
      person,
      guestHash,
    );
    if (conversation) {
      const since = new Date(Date.now() - CONTACT_WINDOW_MS).toISOString();
      const { count, error } = await service
        .from('support_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversation.id)
        .eq('sender', 'user')
        .eq('metadata->>source', 'contact')
        .gt('created_at', since);
      if (error) throw error;
      if ((count ?? 0) >= CONTACT_LIMIT)
        return json(
          {
            error:
              'You’ve sent a few messages already. We’ll get back to you, or try again in a few minutes.',
          },
          429,
        );
      if (signedIn) await refreshPerson(service, conversation, person);
      else
        await updateConversation(service, conversation.id, {
          name: checked.name,
          email: checked.email,
        });
    } else {
      try {
        conversation = await startConversation(service, person, guestHash);
      } catch (err) {
        const code =
          err && typeof err === 'object' && 'code' in err ? err.code : null;
        if (code !== '23505') throw err;
        conversation = await currentConversation(service, person, guestHash);
        if (!conversation) throw err;
      }
    }

    const { error: insertError } = await service
      .from('support_messages')
      .insert({
        conversation_id: conversation.id,
        sender: 'user',
        body: checked.body,
        metadata: { source: 'contact', topic: checked.topic },
      });
    if (insertError) throw insertError;
    await addMessage(
      service,
      conversation.id,
      'bot',
      `Thanks, ${checked.name.split(' ')[0]}! Your message is with the team. They’ll answer right here in this chat, and they have your email (${checked.email}) if you’re not around.`,
    );
    const now = new Date().toISOString();
    const keepOpen = conversation.status === 'human';
    await updateConversation(service, conversation.id, {
      status: keepOpen ? 'human' : 'waiting',
      waiting_since:
        conversation.status === 'waiting' && conversation.waiting_since
          ? conversation.waiting_since
          : now,
    });
    await Promise.all([
      notifySupportAdmins(
        service,
        person,
        conversation.id,
        `${checked.label}: ${checked.body}`,
        now.replace(/[^0-9]/g, '').slice(0, 14),
      ),
      notifySupportDiscordHook(
        person,
        `${checked.topic === 'creator' ? 'Creator application' : `Contact form (${checked.label})`}: ${parsed.data.message}`,
      ),
    ]);
    return json({ ok: true, id: conversation.id });
  } catch {
    return json({ error: 'Contact is unavailable right now.' }, 503);
  }
};
