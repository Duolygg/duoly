import type { APIContext, APIRoute } from 'astro';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import { SupportPostSchema } from '../../contracts/support';
import { answerMetadata, answerWithAi } from './ai';
import { trackRequest, requestAnalyticsContext } from '../analytics/client';
import { sparkyLookup } from './lookup';
import { sparkyAdminLookup } from './admin-lookup';
import {
  notifySupportAdmins,
  notifySupportDiscord,
  supportWho,
} from './notify';
import { sendSupportPush } from './push';
import { supportPerson } from './person';
import { CHIPS, greeting, preparedReply, type SupportPerson } from './sparky';
import {
  addMessage,
  appendUserMessage,
  conversationView,
  currentConversation,
  messages,
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
import { dailyAiLimit, perUserDailyAiLimit } from './limits';

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

export async function identify(
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
    notifySupportDiscord(service, conversation.id, person, message),
  ]);
  return {
    ...conversation,
    status: 'waiting',
    waiting_since: now,
  } as ConversationRow;
}

type UserClient = ReturnType<typeof accountContext>['client'];

/** Admin tools need the session role admin and the asker's own signed-in client. */
export function adminLookupFor(person: SupportPerson, client: UserClient) {
  if (person.accountRole !== 'admin' || !person.userId || !client) return null;
  return sparkyAdminLookup((fn, args) => client.rpc(fn, args as never));
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
        await addMessage(
          service,
          conversation.id,
          'system',
          'You ended this chat.',
        );
        await updateConversation(service, conversation.id, {
          status: 'closed',
          claimed_by: null,
          waiting_since: null,
        });
      }
      return prepared.account.json(
        await payload(prepared.account, service, person, null),
      );
    }
    if (!conversation) {
      try {
        conversation = await startConversation(service, person, guestHash);
        await addMessage(service, conversation.id, 'bot', greeting(person));
      } catch (err) {
        // Unique-index violation: another request already created the open
        // conversation for this user/guest. Re-select it and continue.
        // Supabase errors are plain objects; 23505 is Postgres unique_violation.
        const code =
          err && typeof err === 'object' && 'code' in err ? err.code : null;
        if (code === '23505') {
          conversation = await currentConversation(service, person, guestHash);
          if (!conversation) throw err;
        } else {
          throw err;
        }
      }
    }
    await refreshPerson(service, conversation, person);
    const text = 'text' in parsed.data ? (parsed.data.text ?? '') : '';
    if (text) {
      const appended = await appendUserMessage(service, conversation.id, text);
      if (!appended.ok)
        return prepared.account.json(
          { error: appended.error },
          appended.status,
        );
      // The RPC may have changed the conversation (e.g. a closed chat reopens
      // with Sparky). Re-read so the status check below sees the real state.
      conversation =
        (await currentConversation(service, person, guestHash)) ?? conversation;
      // A human is (or will be) answering: tell the admin phones about the new message.
      if (conversation.status === 'waiting' || conversation.status === 'human')
        await sendSupportPush(service, {
          conversationId: conversation.id,
          title: `New message from ${supportWho(person)}`,
          body: text,
        });
    }
    if (conversation.status !== 'bot')
      return prepared.account.json(
        await payload(prepared.account, service, person, conversation),
      );

    if ('action' in parsed.data && parsed.data.action === 'human') {
      conversation = await handoff(service, person, conversation, text);
      if (person.accountRole !== 'admin')
        trackRequest(
          context,
          person.userId ?? null,
          'support_handoff_requested',
        );
      return prepared.account.json(
        await payload(prepared.account, service, person, conversation),
      );
    }

    if ('chip' in parsed.data && parsed.data.chip) {
      const reply = preparedReply(person, text);
      if (reply.handoff)
        conversation = await handoff(service, person, conversation, text);
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
      const identityKey = person.userId ?? guestHash;
      const canUseAi = await takeAiSlot(
        service,
        dailyAiLimit(),
        identityKey,
        perUserDailyAiLimit(),
      );
      const answer = canUseAi
        ? await answerWithAi({
            person,
            question: text,
            telemetry: {
              ...requestAnalyticsContext(context),
              conversationId: conversation.id,
            },
            // The new message is already stored; send only the turns before it.
            history: (await messages(service, conversation.id))
              .slice(0, -1)
              .filter((m) => m.sender !== 'system'),
            apiKey:
              process.env.OPENAI_API_KEY ?? import.meta.env?.OPENAI_API_KEY,
            // Bound to the session user id, never to anything the model sends.
            lookup: person.userId ? sparkyLookup(service, person.userId) : null,
            // Admin reads only for a session whose account role is admin, and
            // through the asker's own client so the admin RPCs re-check the role.
            adminLookup: adminLookupFor(person, prepared.account.client),
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
        await addMessage(
          service,
          conversation.id,
          'bot',
          answer.reply,
          answerMetadata(answer),
        );
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
    if (person.accountRole !== 'admin')
      trackRequest(context, person.userId ?? null, 'support_handoff_requested');
    return prepared.account.json(
      await payload(prepared.account, service, person, conversation),
    );
  } catch {
    return prepared.account.json({ error: 'Support is unavailable.' }, 503);
  }
};
