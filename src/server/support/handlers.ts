import type { APIContext, APIRoute } from 'astro';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import { SupportPostSchema } from '../../contracts/support';
import { answerWithAi } from './ai';
import { dailyAiLimit } from './limits';
import { notifySupportAdmins, notifySupportDiscordHook } from './notify';
import { supportPerson } from './person';
import { CHIPS, greeting, preparedReply, type SupportPerson } from './sparky';
import {
  addMessage,
  appendUserMessage,
  conversationView,
  currentConversation,
  guestTokenHash,
  newGuestToken,
  refreshPerson,
  startConversation,
  supportService,
  supportTeam,
  takeAiSlot,
  updateConversation,
  type ConversationRow,
} from './store';

const validGuestToken = (value: string | undefined) =>
  value && /^[A-Za-z0-9_-]{32}$/.test(value) ? value : null;

function guestCookie(context: APIContext, secure: boolean) {
  const name = secure ? '__Host-duoly-support' : 'duoly-support';
  const existing = validGuestToken(context.cookies.get(name)?.value);
  const token = existing ?? newGuestToken();
  if (!existing)
    context.cookies.set(name, token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 365 * 86400,
    });
  return token;
}

async function identify(
  context: APIContext,
  account = accountContext(context.request, context.cookies),
) {
  const service = supportService();
  if (!service) return { account, service: null, person: null, guestHash: '' };
  const identity = await account.identity();
  const person = await supportPerson(service, identity);
  const secure = account.config
    ? account.config.origin.startsWith('https:')
    : context.url.protocol === 'https:';
  const guestHash = person.userId
    ? ''
    : guestTokenHash(guestCookie(context, secure));
  return { account, service, person, guestHash };
}

async function payload(
  account: ReturnType<typeof accountContext>,
  service: NonNullable<ReturnType<typeof supportService>>,
  person: SupportPerson,
  conversation: ConversationRow | null,
  suggest?: string[],
) {
  const [view, team] = await Promise.all([
    conversationView(service, conversation),
    supportTeam(service),
  ]);
  return {
    csrf: account.csrf(),
    role: person.role,
    chips: [...CHIPS[person.role]],
    greeting: greeting(person),
    team,
    conversation: view,
    ...(suggest?.length ? { suggest } : {}),
  };
}

export const getSupport: APIRoute = async (context) => {
  try {
    const identified = await identify(context);
    if (!identified.service || !identified.person)
      return identified.account.json({ error: 'Support is unavailable.' }, 503);
    const conversation = await currentConversation(
      identified.service,
      identified.person,
      identified.guestHash,
    );
    if (conversation)
      await refreshPerson(identified.service, conversation, identified.person);
    return identified.account.json(
      await payload(
        identified.account,
        identified.service,
        identified.person,
        conversation,
      ),
    );
  } catch {
    const account = accountContext(context.request, context.cookies);
    return account.json({ error: 'Support is unavailable.' }, 503);
  }
};

async function handoff(
  service: NonNullable<ReturnType<typeof supportService>>,
  person: SupportPerson,
  conversation: ConversationRow,
  message: string,
) {
  await addMessage(
    service,
    conversation.id,
    'bot',
    'Got it! I’ve asked the Duoly team. Your chat is saved and they’ll reply right here as soon as they can.',
  );
  const now = new Date().toISOString();
  await updateConversation(service, conversation.id, {
    status: 'waiting',
    waiting_since: now,
    claimed_by: null,
  });
  await Promise.all([
    notifySupportAdmins(
      service,
      person,
      conversation.id,
      message || 'Asked to talk to a person.',
      now.replace(/[^0-9]/g, '').slice(0, 14),
    ),
    notifySupportDiscordHook(conversation.id),
  ]);
  return { ...conversation, status: 'waiting', waiting_since: now } as ConversationRow;
}

export const postSupport: APIRoute = async (context) => {
  const prepared = await mutation(context, 4096);
  if (prepared.failure || !prepared.body) return prepared.failure!;
  const parsed = SupportPostSchema.safeParse(prepared.body);
  if (!parsed.success)
    return prepared.account.json(
      { error: 'Write a message up to 500 characters.' },
      400,
    );
  try {
    const identified = await identify(context, prepared.account);
    if (!identified.service || !identified.person)
      return prepared.account.json({ error: 'Support is unavailable.' }, 503);
    const { service, person, guestHash } = identified;
    let conversation = await currentConversation(service, person, guestHash);
    if ('action' in parsed.data && parsed.data.action === 'close') {
      if (conversation) {
        await addMessage(service, conversation.id, 'system', 'You ended this chat.');
        await updateConversation(service, conversation.id, { status: 'closed' });
      }
      return prepared.account.json(
        await payload(prepared.account, service, person, null),
      );
    }
    if (!conversation) {
      conversation = await startConversation(service, person, guestHash);
      await addMessage(service, conversation.id, 'bot', greeting(person));
    }
    await refreshPerson(service, conversation, person);
    const text = 'text' in parsed.data ? (parsed.data.text ?? '') : '';
    if (text) {
      const appended = await appendUserMessage(service, conversation.id, text);
      if (!appended.ok)
        return prepared.account.json({ error: appended.error }, appended.status);
    }
    if (conversation.status !== 'bot')
      return prepared.account.json(
        await payload(prepared.account, service, person, conversation),
      );

    if ('action' in parsed.data && parsed.data.action === 'human') {
      conversation = await handoff(service, person, conversation, text);
      return prepared.account.json(
        await payload(prepared.account, service, person, conversation),
      );
    }

    if ('chip' in parsed.data && parsed.data.chip) {
      const reply = preparedReply(person, text);
      if (reply.handoff) conversation = await handoff(service, person, conversation, text);
      else {
        await addMessage(service, conversation.id, 'bot', reply.text);
        return prepared.account.json(
          await payload(
            prepared.account,
            service,
            person,
            conversation,
            reply.chips,
          ),
        );
      }
    } else {
      const canUseAi = await takeAiSlot(service, dailyAiLimit());
      const answer = canUseAi
        ? await answerWithAi({
            person,
            question: text,
            apiKey:
              process.env.OPENAI_API_KEY ?? import.meta.env?.OPENAI_API_KEY,
          })
        : (() => {
            const routed = preparedReply(person, text);
            return {
              reply: routed.text,
              handoff: !!routed.handoff,
              source: 'fallback' as const,
              chips: routed.chips,
            };
          })();
      if (answer.reply)
        await addMessage(service, conversation.id, 'bot', answer.reply, {
          source: answer.source,
        });
      if (answer.handoff)
        conversation = await handoff(service, person, conversation, text);
      else
        return prepared.account.json(
          await payload(
            prepared.account,
            service,
            person,
            conversation,
            answer.chips,
          ),
        );
    }
    return prepared.account.json(
      await payload(prepared.account, service, person, conversation),
    );
  } catch {
    return prepared.account.json({ error: 'Support is unavailable.' }, 503);
  }
};
