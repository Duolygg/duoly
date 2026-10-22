import type { APIRoute } from 'astro';
import {
  forwardReceivedEmail,
  inboundConfig,
  verifyWebhook,
} from '../../../server/email/inbound';

export const prerender = false;

const MAX_BODY_BYTES = 256 * 1024;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

/** Resend webhook: forwards inbound duoly.gg mail to the team inbox. */
export const POST: APIRoute = async ({ request }) => {
  const config = inboundConfig();
  if (!config) return json(404, { error: 'not_found' });

  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_BODY_BYTES) return json(413, { error: 'too_large' });
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return json(413, { error: 'too_large' });

  const valid = verifyWebhook(
    config.webhookSecret,
    {
      id: request.headers.get('svix-id'),
      timestamp: request.headers.get('svix-timestamp'),
      signature: request.headers.get('svix-signature'),
    },
    body,
  );
  if (!valid) return json(401, { error: 'invalid_signature' });

  let event: { type?: unknown; data?: { email_id?: unknown; to?: unknown } };
  try {
    event = JSON.parse(body);
  } catch {
    return json(400, { error: 'invalid_json' });
  }
  if (event.type !== 'email.received') return json(200, { ignored: true });
  const emailId = event.data?.email_id;
  if (typeof emailId !== 'string')
    return json(400, { error: 'missing_email_id' });

  const result = await forwardReceivedEmail(emailId, config);
  if (result.status === 'failed') {
    // 5xx makes Resend retry; the idempotency key prevents duplicate forwards.
    console.error('inbound forward failed', {
      step: result.step,
      httpStatus: result.httpStatus,
    });
    return json(502, { error: 'forward_failed' });
  }
  return json(200, { status: result.status });
};
