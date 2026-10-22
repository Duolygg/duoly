import {
  renderTransactional,
  type TransactionalEmailData,
  type TransactionalEmailId,
} from './catalog.ts';
import type { EmailContext } from './model.ts';

/**
 * Resend sender for application emails.
 *
 * EMAIL_MODE=off   nothing is sent (default).
 * EMAIL_MODE=test  every send is redirected to EMAIL_TEST_RECIPIENT with a [TEST] subject.
 * EMAIL_MODE=live  real recipients. Requires explicit owner approval per environment.
 *
 * Open and click tracking stay disabled on the Resend domain: tracking rewrites links, which
 * breaks Supabase auth links and marks transactional mail as marketing-like.
 */

const envNames = [
  'EMAIL_MODE',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'EMAIL_REPLY_TO',
  'EMAIL_TEST_RECIPIENT',
  'EMAIL_SITE_URL',
  'EMAIL_ASSET_ORIGIN',
] as const;

export type EmailMode = 'off' | 'test' | 'live';

export interface EmailConfig {
  mode: EmailMode;
  apiKey: string;
  from: string;
  replyTo?: string;
  testRecipient?: string;
  context: EmailContext;
}

const ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const FROM = /^[^<>\r\n]{1,64} <[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$/;

function serverEnvironment(): Record<string, string | undefined> {
  return Object.fromEntries(
    envNames.map((name) => {
      const value: unknown = process.env[name] ?? import.meta.env?.[name];
      return [name, typeof value === 'string' ? value : undefined];
    }),
  );
}

function httpsOrigin(value: string | undefined): string | null {
  try {
    const url = new URL(value ?? '');
    const local =
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname);
    if (
      (url.protocol !== 'https:' && !local) ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Returns null when sending is off or misconfigured. Never throws, never logs secrets. */
export function emailConfig(
  env: Record<string, string | undefined> = serverEnvironment(),
): EmailConfig | null {
  const mode = env.EMAIL_MODE;
  if (mode !== 'test' && mode !== 'live') return null;
  const apiKey = env.RESEND_API_KEY ?? '';
  if (!/^re_[A-Za-z0-9_]{8,}$/.test(apiKey)) return null;
  const from = env.EMAIL_FROM ?? '';
  if (!FROM.test(from)) return null;
  const replyTo = env.EMAIL_REPLY_TO || undefined;
  if (replyTo && !ADDRESS.test(replyTo)) return null;
  const testRecipient = env.EMAIL_TEST_RECIPIENT || undefined;
  if (mode === 'test' && !(testRecipient && ADDRESS.test(testRecipient)))
    return null;
  const siteUrl = httpsOrigin(env.EMAIL_SITE_URL);
  if (!siteUrl) return null;
  const assetOrigin =
    httpsOrigin(env.EMAIL_ASSET_ORIGIN ?? env.EMAIL_SITE_URL) ?? siteUrl;
  return {
    mode,
    apiKey,
    from,
    replyTo,
    testRecipient,
    context: { siteUrl, assetOrigin },
  };
}

export type SendResult =
  | { status: 'skipped'; reason: 'disabled' }
  | { status: 'sent'; id: string; to: string; mode: EmailMode }
  | { status: 'failed'; httpStatus: number; error: string; retryable: boolean };

export interface SendRequest<K extends TransactionalEmailId> {
  template: K;
  to: string;
  data: TransactionalEmailData<K>;
  /**
   * Stable per logical message, for example `order_confirmed:DL-1042`. Resend deduplicates for
   * 24 hours; the application must also persist sends for permanent deduplication.
   */
  idempotencyKey: string;
}

export async function sendEmail<K extends TransactionalEmailId>(
  request: SendRequest<K>,
  options: { config?: EmailConfig | null; fetchImpl?: typeof fetch } = {},
): Promise<SendResult> {
  const config = options.config === undefined ? emailConfig() : options.config;
  if (!config) return { status: 'skipped', reason: 'disabled' };
  if (!ADDRESS.test(request.to)) {
    return {
      status: 'failed',
      httpStatus: 0,
      error: 'invalid_recipient',
      retryable: false,
    };
  }
  if (!/^[A-Za-z0-9_:.-]{1,256}$/.test(request.idempotencyKey)) {
    return {
      status: 'failed',
      httpStatus: 0,
      error: 'invalid_idempotency_key',
      retryable: false,
    };
  }
  const rendered = renderTransactional(
    request.template,
    request.data,
    config.context,
  );
  const isTest = config.mode === 'test';
  const to = isTest ? (config.testRecipient as string) : request.to;
  const body = {
    from: config.from,
    to: [to],
    subject: isTest ? `[TEST] ${rendered.subject}` : rendered.subject,
    html: rendered.html,
    text: rendered.text,
    ...(config.replyTo ? { reply_to: config.replyTo } : {}),
    tags: [
      { name: 'template', value: request.template },
      { name: 'mode', value: config.mode },
    ],
  };
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `${config.mode}:${request.idempotencyKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Network failure: the provider may or may not have accepted it. Retry with the same key.
    return {
      status: 'failed',
      httpStatus: 0,
      error: 'network_error',
      retryable: true,
    };
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const id = (payload as { id?: unknown } | null)?.id;
  if (response.ok && typeof id === 'string')
    return { status: 'sent', id, to, mode: config.mode };
  const name = (payload as { name?: unknown } | null)?.name;
  return {
    status: 'failed',
    httpStatus: response.status,
    error: typeof name === 'string' ? name : 'provider_error',
    retryable: response.status === 429 || response.status >= 500,
  };
}
