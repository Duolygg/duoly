import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Inbound mail for duoly.gg: Resend receives every address on the domain (catch-all) and
 * posts an `email.received` webhook. We verify the Svix signature, fetch the message and
 * forward it to the team inbox with the original message attached as .eml.
 */

const envNames = [
  'RESEND_INBOUND_API_KEY',
  'RESEND_WEBHOOK_SECRET',
  'INBOUND_FORWARD_TO',
  'INBOUND_FORWARD_FROM',
] as const;

const ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const FROM = /^[^<>\r\n]{1,64} <[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$/;
/** Resend's attachment limit is 40 MB after base64; keep a margin for the wrapper body. */
const MAX_RAW_BYTES = 28 * 1024 * 1024;
const TOLERANCE_SECONDS = 5 * 60;

export interface InboundConfig {
  apiKey: string;
  webhookSecret: string;
  forwardTo: string;
  forwardFrom: string;
}

function serverEnvironment(): Record<string, string | undefined> {
  return Object.fromEntries(
    envNames.map((name) => {
      const value: unknown = process.env[name] ?? import.meta.env?.[name];
      return [name, typeof value === 'string' ? value : undefined];
    }),
  );
}

export function inboundConfig(
  env: Record<string, string | undefined> = serverEnvironment(),
): InboundConfig | null {
  const apiKey = env.RESEND_INBOUND_API_KEY ?? '';
  const webhookSecret = env.RESEND_WEBHOOK_SECRET ?? '';
  const forwardTo = env.INBOUND_FORWARD_TO ?? '';
  const forwardFrom = env.INBOUND_FORWARD_FROM ?? '';
  if (!/^re_[A-Za-z0-9_]{8,}$/.test(apiKey)) return null;
  if (!/^whsec_[A-Za-z0-9+/=]{16,}$/.test(webhookSecret)) return null;
  if (!ADDRESS.test(forwardTo) || !FROM.test(forwardFrom)) return null;
  return { apiKey, webhookSecret, forwardTo, forwardFrom };
}

/**
 * Resend webhooks are account-wide, so this endpoint also sees mail for other domains on the
 * same Resend account. Only mail addressed to the forwarder's own domain is handled.
 */
export function isForDomain(recipients: unknown, forwardFrom: string): boolean {
  const domain = addressOf(forwardFrom).split('@')[1];
  if (!domain || !Array.isArray(recipients)) return false;
  return recipients.some(
    (recipient) =>
      typeof recipient === 'string' &&
      addressOf(recipient).endsWith(`@${domain}`),
  );
}

/** Svix signature check: HMAC-SHA256 over `${id}.${timestamp}.${body}` with the decoded secret. */
export function verifyWebhook(
  secret: string,
  headers: {
    id: string | null;
    timestamp: string | null;
    signature: string | null;
  },
  body: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !/^\d{1,12}$/.test(timestamp))
    return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS)
    return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  if (key.length === 0) return false;
  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest();
  return signature.split(' ').some((part) => {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value) return false;
    const given = Buffer.from(value, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

interface ReceivedEmail {
  id: string;
  from: string;
  to: string[];
  subject: string | null;
  html: string | null;
  text: string | null;
  raw?: { download_url?: string; size?: number } | null;
}

function addressOf(value: string): string {
  const match = /<([^>]+)>/.exec(value);
  return (match?.[1] ?? value).trim().toLowerCase();
}

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export type ForwardResult =
  | { status: 'forwarded'; id: string }
  | { status: 'skipped'; reason: 'loop' | 'other_domain' }
  | { status: 'failed'; step: 'fetch' | 'raw' | 'send'; httpStatus: number };

export async function forwardReceivedEmail(
  emailId: string,
  config: InboundConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<ForwardResult> {
  if (!/^[A-Za-z0-9-]{8,64}$/.test(emailId))
    return { status: 'failed', step: 'fetch', httpStatus: 0 };
  const auth = { Authorization: `Bearer ${config.apiKey}` };
  const fetched = await fetchImpl(
    `https://api.resend.com/emails/receiving/${emailId}`,
    { headers: auth },
  );
  if (!fetched.ok)
    return { status: 'failed', step: 'fetch', httpStatus: fetched.status };
  const email = (await fetched.json()) as ReceivedEmail;
  if (!isForDomain(email.to, config.forwardFrom))
    return { status: 'skipped', reason: 'other_domain' };

  // Never re-forward our own forwards or mail from the team inbox back to itself.
  const sender = addressOf(email.from ?? '');
  if (
    sender === addressOf(config.forwardFrom) ||
    sender === addressOf(config.forwardTo)
  ) {
    return { status: 'skipped', reason: 'loop' };
  }

  const attachments: {
    filename: string;
    content: string;
    content_type: string;
  }[] = [];
  const rawUrl = email.raw?.download_url;
  if (
    rawUrl &&
    /^https:\/\//.test(rawUrl) &&
    (email.raw?.size ?? 0) <= MAX_RAW_BYTES
  ) {
    const raw = await fetchImpl(rawUrl);
    if (!raw.ok)
      return { status: 'failed', step: 'raw', httpStatus: raw.status };
    const bytes = Buffer.from(await raw.arrayBuffer());
    if (bytes.length <= MAX_RAW_BYTES) {
      attachments.push({
        filename: 'original-message.eml',
        content: bytes.toString('base64'),
        content_type: 'message/rfc822',
      });
    }
  }

  const subject = email.subject?.trim() || '(no subject)';
  const to = (email.to ?? []).join(', ');
  const header = `From: ${email.from}\nTo: ${to}\nSubject: ${subject}`;
  const htmlHeader = `<div style="font:13px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#555;border-bottom:1px solid #ddd;padding:0 0 10px;margin:0 0 14px;"><strong>Forwarded from duoly.gg</strong><br>From: ${escape(email.from ?? '')}<br>To: ${escape(to)}<br>Subject: ${escape(subject)}</div>`;
  const body = {
    from: config.forwardFrom,
    to: [config.forwardTo],
    reply_to: email.from,
    subject: subject.toLowerCase().startsWith('fwd:')
      ? subject
      : `Fwd: ${subject}`,
    html: `${htmlHeader}${email.html ?? `<pre style="white-space:pre-wrap">${escape(email.text ?? '')}</pre>`}`,
    text: `${header}\n\n${email.text ?? ''}`,
    ...(attachments.length ? { attachments } : {}),
    tags: [{ name: 'template', value: 'inbound_forward' }],
  };
  const sent = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      ...auth,
      'Content-Type': 'application/json',
      // Webhook retries reuse the same key, so a message is forwarded at most once per 24 h.
      'Idempotency-Key': `inbound-forward:${emailId}`,
    },
    body: JSON.stringify(body),
  });
  const payload = (await sent.json().catch(() => null)) as {
    id?: unknown;
  } | null;
  if (sent.ok && typeof payload?.id === 'string')
    return { status: 'forwarded', id: payload.id };
  return { status: 'failed', step: 'send', httpStatus: sent.status };
}
