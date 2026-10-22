import { renderHtml, renderText } from './layout.ts';
import type { EmailContent, EmailContext } from './model.ts';
import * as auth from './templates/auth.ts';
import * as t from './templates/transactional.ts';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function render(
  content: EmailContent,
  ctx: EmailContext,
): RenderedEmail {
  return {
    subject: content.subject,
    html: renderHtml(content, ctx),
    text: renderText(content, ctx),
  };
}

/**
 * Supabase Auth templates. `kind` maps to supabase/config.toml:
 * template => [auth.email.template.<key>], notification => [auth.email.notification.<key>].
 * `api` is the hosted Management API field prefix (mailer_subjects_<api>, mailer_templates_<api>_content).
 */
export const authEmails = {
  confirmation: {
    kind: 'template',
    api: 'confirmation',
    build: auth.confirmSignup,
  },
  recovery: { kind: 'template', api: 'recovery', build: auth.resetPassword },
  email_change: {
    kind: 'template',
    api: 'email_change',
    build: auth.changeEmail,
  },
  reauthentication: {
    kind: 'template',
    api: 'reauthentication',
    build: auth.reauthentication,
  },
  password_changed: {
    kind: 'notification',
    api: 'password_changed_notification',
    build: auth.passwordChanged,
  },
  email_changed: {
    kind: 'notification',
    api: 'email_changed_notification',
    build: auth.emailChanged,
  },
} as const;

export type AuthEmailId = keyof typeof authEmails;

/** Transactional templates the application sends through Resend, with the event that triggers each. */
export const transactionalEmails = {
  welcome: {
    trigger: 'First sign-in after email confirmation',
    build: t.welcome,
  },
  order_confirmed: {
    trigger: 'Payment webhook created a paid order',
    build: t.orderConfirmed,
  },
  teammate_found: {
    trigger: 'A teammate accepted the order',
    build: t.teammateFound,
  },
  order_completed: {
    trigger: 'Teammate completed the order with proof',
    build: t.orderCompleted,
  },
  order_cancelled: {
    trigger: 'Order auto-cancelled, cancelled by customer or by support',
    build: t.orderCancelled,
  },
  level_up: {
    trigger: 'Customer reached a new loyalty level',
    build: t.levelUp,
  },
  application_received: {
    trigger: 'Teammate application submitted',
    build: t.applicationReceived,
  },
  application_approved: {
    trigger: 'Admin approved a teammate application',
    build: t.applicationApproved,
  },
  application_declined: {
    trigger: 'Admin declined a teammate application',
    build: t.applicationDeclined,
  },
  payout: {
    trigger: 'Weekly payout marked paid or put on hold',
    build: t.payout,
  },
  support_reply: {
    trigger: 'Support agent replied to a conversation',
    build: (data: t.SupportReplyData) => t.supportReply(data),
  },
} as const;

export type TransactionalEmailId = keyof typeof transactionalEmails;
export type TransactionalEmailData<K extends TransactionalEmailId> = Parameters<
  (typeof transactionalEmails)[K]['build']
>[0];

export function renderTransactional<K extends TransactionalEmailId>(
  id: K,
  data: TransactionalEmailData<K>,
  ctx: EmailContext,
): RenderedEmail {
  const build = transactionalEmails[id].build as (
    input: TransactionalEmailData<K>,
    site: string,
  ) => EmailContent;
  return render(build(data, ctx.siteUrl), ctx);
}

export function renderAuth(id: AuthEmailId, ctx: EmailContext): RenderedEmail {
  return render(authEmails[id].build(), ctx);
}
