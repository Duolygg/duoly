import { GAME } from '../../design-reference/lib/games.js';
import { sendEmail } from '../email/send';

const gameName = (id: string) =>
  (GAME as Record<string, { name: string } | undefined>)[id]?.name ?? id;
const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'there';

/** "We got your application" after /apply. Never blocks or fails the submission. */
export async function sendApplicationReceived(
  application: { name: string; email: string; game: string },
  reference: string,
) {
  await sendEmail({
    template: 'application_received',
    to: application.email,
    idempotencyKey: `application_received:${reference}`,
    data: {
      firstName: firstName(application.name),
      game: gameName(application.game),
    },
  });
}

type Decided = {
  reference: string;
  name: string;
  email: string;
  game: string;
  status: string;
};

/** Approval or decline email once an admin decided. Never blocks the decision. */
export async function sendApplicationDecision(application: Decided) {
  if (application.status === 'approved')
    await sendEmail({
      template: 'application_approved',
      to: application.email,
      idempotencyKey: `application_approved:${application.reference}`,
      data: {
        firstName: firstName(application.name),
        games: [gameName(application.game)],
      },
    });
  else if (application.status === 'rejected')
    await sendEmail({
      template: 'application_declined',
      to: application.email,
      idempotencyKey: `application_declined:${application.reference}`,
      data: {
        firstName: firstName(application.name),
        game: gameName(application.game),
      },
    });
}
