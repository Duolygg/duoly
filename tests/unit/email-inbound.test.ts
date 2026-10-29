import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  forwardReceivedEmail,
  forwardTargets,
  inboundConfig,
  isForDomain,
  parseRoutes,
  verifyWebhook,
  type InboundConfig,
} from '../../src/server/email/inbound';

const secret = `whsec_${Buffer.from('duoly-test-signing-secret-32bytes!').toString('base64')}`;

function sign(body: string, id = 'msg_1', timestamp = 1_800_000_000) {
  const key = Buffer.from(secret.slice(6), 'base64');
  const sig = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');
  return { id, timestamp: String(timestamp), signature: `v1,${sig}` };
}

const config: InboundConfig = {
  apiKey: 're_inbound_123456',
  webhookSecret: secret,
  forwardTo: 'duolygg@proton.me',
  forwardFrom: 'Duoly Inbox <inbox@duoly.gg>',
};

describe('resend webhook signature', () => {
  const body = '{"type":"email.received","data":{"email_id":"abc12345"}}';

  it('accepts a valid signature inside the tolerance window', () => {
    expect(verifyWebhook(secret, sign(body), body, 1_800_000_100)).toBe(true);
    const h = sign(body);
    expect(
      verifyWebhook(
        secret,
        { ...h, signature: `v1,bogus ${h.signature}` },
        body,
        1_800_000_000,
      ),
    ).toBe(true);
  });

  it('rejects tampering, stale timestamps and missing headers', () => {
    expect(verifyWebhook(secret, sign(body), `${body} `, 1_800_000_000)).toBe(
      false,
    );
    expect(verifyWebhook(secret, sign(body), body, 1_800_000_000 + 301)).toBe(
      false,
    );
    expect(
      verifyWebhook(
        secret,
        { ...sign(body), signature: null },
        body,
        1_800_000_000,
      ),
    ).toBe(false);
    expect(
      verifyWebhook(
        secret,
        { ...sign(body), id: 'other' },
        body,
        1_800_000_000,
      ),
    ).toBe(false);
    const wrongKey = `whsec_${Buffer.from('another-secret-entirely-32-bytes').toString('base64')}`;
    expect(verifyWebhook(wrongKey, sign(body), body, 1_800_000_000)).toBe(
      false,
    );
  });

  it('needs complete configuration', () => {
    expect(inboundConfig({})).toBeNull();
    expect(
      inboundConfig({
        RESEND_INBOUND_API_KEY: config.apiKey,
        RESEND_WEBHOOK_SECRET: secret,
        INBOUND_FORWARD_TO: config.forwardTo,
        INBOUND_FORWARD_FROM: config.forwardFrom,
      }),
    ).toEqual({ ...config, routes: {} });
    expect(
      inboundConfig({
        RESEND_INBOUND_API_KEY: config.apiKey,
        RESEND_WEBHOOK_SECRET: secret,
        INBOUND_FORWARD_TO: 'nope',
        INBOUND_FORWARD_FROM: config.forwardFrom,
      }),
    ).toBeNull();
  });
});

describe('inbound forwarding', () => {
  const received = {
    id: 'abc12345',
    from: 'Player <player@example.com>',
    to: ['support@duoly.gg'],
    subject: 'Refund <question>',
    html: '<p>Hi</p>',
    text: 'Hi',
    raw: { download_url: 'https://inbound.example/raw.eml', size: 20 },
  };

  function fakeFetch(
    email: object,
    calls: { url: string; init?: RequestInit }[],
  ) {
    return (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).includes('/emails/receiving/'))
        return new Response(JSON.stringify(email));
      if (String(url).startsWith('https://inbound.example/'))
        return new Response('From: x\r\n\r\nHi');
      return new Response(JSON.stringify({ id: 'fwd_1' }));
    }) as typeof fetch;
  }

  it('forwards with reply-to, escaped header, eml attachment and a stable idempotency key', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const result = await forwardReceivedEmail(
      'abc12345',
      config,
      fakeFetch(received, calls),
    );
    expect(result).toEqual({ status: 'forwarded', id: 'fwd_1' });
    const send = calls.find((c) => c.url === 'https://api.resend.com/emails');
    const headers = send?.init?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('inbound-forward:abc12345');
    const body = JSON.parse(String(send?.init?.body));
    expect(body.to).toEqual(['duolygg@proton.me']);
    expect(body.from).toBe('Duoly Inbox <inbox@duoly.gg>');
    expect(body.reply_to).toBe('Player <player@example.com>');
    expect(body.subject).toBe('Fwd: Refund <question>');
    expect(body.html).toContain('Refund &#60;question&#62;');
    expect(body.attachments[0]).toMatchObject({
      filename: 'original-message.eml',
      content_type: 'message/rfc822',
    });
  });

  it('sends routed personal addresses to their own inbox only', async () => {
    const routed = {
      ...config,
      routes: parseRoutes(
        'Fabian@duoly.gg = Fab@Gmail.com, bad, x@other.com=y@gmail.com',
        config.forwardFrom,
      ),
    };
    expect(routed.routes).toEqual({ 'fabian@duoly.gg': 'fab@gmail.com' });
    expect(forwardTargets(['Fabian <fabian@duoly.gg>'], routed)).toEqual([
      'fab@gmail.com',
    ]);
    expect(forwardTargets(['hello@duoly.gg'], routed)).toEqual([
      'duolygg@proton.me',
    ]);
    expect(
      forwardTargets(['fabian@duoly.gg', 'hello@duoly.gg'], routed),
    ).toEqual(['fab@gmail.com', 'duolygg@proton.me']);
    const calls: { url: string; init?: RequestInit }[] = [];
    await forwardReceivedEmail(
      'abc12345',
      routed,
      fakeFetch({ ...received, to: ['fabian@duoly.gg'] }, calls),
    );
    const send = calls.find((c) => c.url === 'https://api.resend.com/emails');
    expect(JSON.parse(String(send?.init?.body)).to).toEqual(['fab@gmail.com']);
    expect(
      inboundConfig({
        RESEND_INBOUND_API_KEY: config.apiKey,
        RESEND_WEBHOOK_SECRET: secret,
        INBOUND_FORWARD_TO: config.forwardTo,
        INBOUND_FORWARD_FROM: config.forwardFrom,
      })?.routes,
    ).toEqual({});
  });

  it('does not loop on its own forwards', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const result = await forwardReceivedEmail(
      'abc12345',
      config,
      fakeFetch({ ...received, from: 'Duoly Inbox <inbox@duoly.gg>' }, calls),
    );
    expect(result).toEqual({ status: 'skipped', reason: 'loop' });
    expect(calls.some((c) => c.url === 'https://api.resend.com/emails')).toBe(
      false,
    );
  });

  it('leaves mail for other domains on the shared Resend account alone', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const result = await forwardReceivedEmail(
      'abc12345',
      config,
      fakeFetch({ ...received, to: ['hello@pettoportrait.art'] }, calls),
    );
    expect(result).toEqual({ status: 'skipped', reason: 'other_domain' });
    expect(calls.some((c) => c.url === 'https://api.resend.com/emails')).toBe(
      false,
    );
    expect(isForDomain(['Team <Support@Duoly.gg>'], config.forwardFrom)).toBe(
      true,
    );
    expect(isForDomain(['x@notduoly.gg'], config.forwardFrom)).toBe(false);
    expect(isForDomain('x@duoly.gg', config.forwardFrom)).toBe(false);
  });

  it('rejects malformed ids without calling the provider', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    expect(
      await forwardReceivedEmail('../x', config, fakeFetch(received, calls)),
    ).toMatchObject({
      status: 'failed',
    });
    expect(calls).toHaveLength(0);
  });
});

describe('resend webhook route', () => {
  it('rejects unsigned calls and acknowledges other domains without fetching', async () => {
    process.env.RESEND_INBOUND_API_KEY = config.apiKey;
    process.env.RESEND_WEBHOOK_SECRET = secret;
    process.env.INBOUND_FORWARD_TO = config.forwardTo;
    process.env.INBOUND_FORWARD_FROM = config.forwardFrom;
    const { POST } = await import('../../src/pages/api/webhooks/resend');
    const call = (body: string, headers: Record<string, string>) =>
      POST({
        request: new Request('https://duoly.gg/api/webhooks/resend', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body,
        }),
      } as never) as Promise<Response>;
    const body = JSON.stringify({
      type: 'email.received',
      data: { email_id: 'abc12345', to: ['hello@pettoportrait.art'] },
    });
    expect((await call(body, {})).status).toBe(401);
    const now = Math.floor(Date.now() / 1000);
    const h = sign(body, 'msg_route', now);
    const response = await call(body, {
      'svix-id': h.id,
      'svix-timestamp': h.timestamp,
      'svix-signature': h.signature,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ignored: 'other_domain' });
  });
});
