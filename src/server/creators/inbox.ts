import type { APIContext } from 'astro';
import type { AccountContext } from '../auth/context';
import { identify } from '../support/handlers';
import {
  notifySupportAdmins,
  notifySupportDiscordHook,
} from '../support/notify';
import {
  addMessage,
  currentConversation,
  refreshPerson,
  startConversation,
  updateConversation,
  type ConversationRow,
} from '../support/store';

/**
 * A creator application still lands in the support inbox, the way the old /creators form did
 * through /api/contact. The application itself lives in the database now, so this only writes the
 * message a human reads and pings the admins; it never decides anything and never fails the
 * application (the caller swallows errors).
 *
 * No rate limit here, unlike the contact form: the database already allows one open application
 * per account.
 */
export type CreatorApplicationNote = {
  name: string;
  email: string;
  code: string;
  platform: string;
  channel: string;
  audience: string;
  game: string;
  country: string;
  message: string;
};

export function creatorApplicationBody(form: CreatorApplicationNote): string {
  return [
    'Creator application',
    `Code: ${form.code}`,
    `Platform: ${form.platform}`,
    `Channel: ${form.channel}`,
    `Audience: ${form.audience}`,
    `Main game: ${form.game}`,
    `Country: ${form.country}`,
    form.message ? `\n${form.message}` : '',
    '\nDecide it in Admin, Creators.',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 2000);
}

export async function notifyCreatorApplication(
  context: APIContext,
  account: AccountContext,
  form: CreatorApplicationNote,
): Promise<void> {
  const identified = await identify(context, account);
  if (!identified.service || !identified.person) return;
  const { service, person, guestHash } = identified;
  let conversation: ConversationRow | null = await currentConversation(
    service,
    person,
    guestHash,
  );
  if (conversation) await refreshPerson(service, conversation, person);
  else conversation = await startConversation(service, person, guestHash);
  const body = creatorApplicationBody(form);
  await service.from('support_messages').insert({
    conversation_id: conversation.id,
    sender: 'user',
    body,
    metadata: { source: 'creator_application', topic: 'creator' },
  });
  await addMessage(
    service,
    conversation.id,
    'bot',
    `Thanks, ${form.name.split(' ')[0]}! Your creator application is with the team. You can follow it on your creator dashboard, and we reply by email to ${form.email}.`,
  );
  const now = new Date().toISOString();
  await updateConversation(service, conversation.id, {
    status: conversation.status === 'human' ? 'human' : 'waiting',
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
      `Creator application: ${body}`,
      now.replace(/[^0-9]/g, '').slice(0, 14),
    ),
    notifySupportDiscordHook(person, `Creator application: ${body}`),
  ]);
}
