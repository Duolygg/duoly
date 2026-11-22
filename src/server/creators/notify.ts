import { sendEmail } from '../email/send';

/**
 * "You're in" after an admin approved a creator application: the code, both links and the way to
 * the dashboard. Never blocks or fails the decision (the caller swallows errors), and the
 * idempotency key is the code, so an approval mail is never sent twice.
 */
export async function sendCreatorApproved(creator: {
  email: string;
  name: string;
  code: string;
}): Promise<void> {
  await sendEmail({
    template: 'creator_approved',
    to: creator.email,
    idempotencyKey: `creator_approved:${creator.code}`,
    data: {
      firstName: creator.name.trim().split(/\s+/)[0] || 'there',
      code: creator.code,
    },
  });
}
