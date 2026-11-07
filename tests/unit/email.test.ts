import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  authEmails,
  renderAuth,
  renderTransactional,
  transactionalEmails,
  type AuthEmailId,
  type TransactionalEmailId,
} from '../../src/server/email/catalog';
import { escapeHtml, markup, safeUrl } from '../../src/server/email/html';
import { samples } from '../../src/server/email/samples';
import {
  emailConfig,
  sendEmail,
  type EmailConfig,
} from '../../src/server/email/send';
import { formatMoney } from '../../src/server/email/templates/transactional';

const ctx = { siteUrl: 'https://duoly.gg', assetOrigin: 'https://duoly.gg' };
const transactionalIds = Object.keys(
  transactionalEmails,
) as TransactionalEmailId[];
const authIds = Object.keys(authEmails) as AuthEmailId[];

function allRendered() {
  return [
    ...transactionalIds.map((id) => ({
      id,
      ...renderTransactional(id, samples[id] as never, ctx),
    })),
    ...authIds.map((id) => ({ id, ...renderAuth(id, ctx) })),
  ];
}

describe('email html builder', () => {
  it('escapes interpolated values', () => {
    expect(markup`<p>${'<script>"x"&'}</p>`.value).toBe(
      '<p>&lt;script&gt;&quot;x&quot;&amp;</p>',
    );
    expect(escapeHtml("'")).toBe('&#39;');
  });

  it('allows only http(s), mailto and Supabase placeholders as links', () => {
    expect(safeUrl('https://duoly.gg/x')).toBe('https://duoly.gg/x');
    expect(safeUrl('{{ .ConfirmationURL }}')).toBe('{{ .ConfirmationURL }}');
    expect(safeUrl('{{ .SiteURL }}/login')).toBe('{{ .SiteURL }}/login');
    expect(() => safeUrl('javascript:alert(1)')).toThrow();
    expect(() => safeUrl('{{ .SiteURL }}"><script>')).toThrow();
  });

  it('escapes user-controlled template data', () => {
    const rendered = renderTransactional(
      'support_reply',
      { ...samples.support_reply, message: '<img src=x onerror=alert(1)>' },
      ctx,
    );
    expect(rendered.html).not.toContain('<img src=x');
    expect(rendered.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('email templates', () => {
  it.each(['order_confirmed', 'teammate_found', 'order_completed'] as const)(
    '%s links to the UUID room and displays the public reference',
    (id) => {
      const rendered = renderTransactional(id, samples[id] as never, ctx);
      const room = `https://duoly.gg/queue/${samples[id].order.roomId}`;
      expect(rendered.html).toContain(
        `href="${room}${id === 'order_completed' ? '#review' : ''}"`,
      );
      expect(rendered.text).toContain(room);
      expect(rendered.html).toContain('Order DL-1042');
      expect(rendered.html).not.toContain('/queue/DL-1042');
    },
  );
  it.each(allRendered())(
    '$id renders a complete, safe document',
    ({ subject, html: markup, text }) => {
      expect(subject.length).toBeGreaterThan(5);
      expect(markup).toMatch(/^<!doctype html>/);
      expect(markup).toContain('<meta name="color-scheme" content="dark">');
      expect(markup).toContain('https://duoly.gg/email/wordmark.png');
      expect(markup).toContain('prefers-reduced-motion');
      expect(markup).not.toMatch(/undefined|NaN|\[object Object\]/);
      expect(markup).not.toContain('fonts.googleapis.com');
      expect(text).not.toMatch(/undefined|NaN|\[object Object\]/);
      // Gmail clips messages above 102 KB.
      expect(Buffer.byteLength(markup)).toBeLessThan(90_000);
    },
  );

  it.each(allRendered())(
    '$id copy follows the house style',
    ({ subject, text }) => {
      for (const copy of [subject, text]) {
        expect(copy).not.toMatch(/[\u2013\u2014]/);
        expect(copy).not.toContain('&');
      }
    },
  );

  it('auth templates keep the Supabase placeholders they need', () => {
    for (const id of ['confirmation', 'recovery', 'email_change'] as const) {
      expect(renderAuth(id, ctx).html).toContain(
        'href="{{ .ConfirmationURL }}"',
      );
    }
    expect(renderAuth('reauthentication', ctx).html).toContain('{{ .Token }}');
    expect(renderAuth('email_change', ctx).html).toContain('{{ .NewEmail }}');
    expect(renderAuth('email_changed', ctx).html).toContain('{{ .OldEmail }}');
  });

  it('committed Supabase templates match the source', () => {
    for (const id of authIds) {
      const committed = readFileSync(`supabase/templates/${id}.html`, 'utf8');
      const fresh = renderAuth(id, {
        siteUrl: '{{ .SiteURL }}',
        assetOrigin: 'https://duoly.gg',
      }).html;
      expect(committed, `run: node scripts/emails.ts supabase`).toBe(fresh);
    }
  });

  it('config.toml wires every auth template', () => {
    const config = readFileSync('supabase/config.toml', 'utf8');
    for (const [id, entry] of Object.entries(authEmails)) {
      expect(config).toContain(`[auth.email.${entry.kind}.${id}]`);
      expect(config).toContain(
        `content_path = "./supabase/templates/${id}.html"`,
      );
    }
  });

  it('keeps the dark design in Gmail dark mode', () => {
    const { html: markup } = renderTransactional(
      'order_confirmed',
      samples.order_confirmed,
      ctx,
    );
    const head = markup.slice(0, markup.indexOf('<body'));
    expect(head).toContain(
      'u + .body .gm-s{background:#000;mix-blend-mode:screen}',
    );
    expect(markup).toContain('<body class="body"');
    // Every solid surface also carries a same-colour gradient, which Gmail does not invert.
    const solid = [
      ...markup.matchAll(
        /style="([^"]*background(?:-color)?:#[0-9A-Fa-f]{6}[^"]*)"/g,
      ),
    ];
    expect(solid.length).toBeGreaterThan(10);
    for (const [, style] of solid)
      expect(style).toMatch(/background-image|gradient/);
    // Visible text is wrapped; Outlook conditional comments are untouched.
    expect(markup).toContain(
      '<span class="gm-s"><span class="gm-d">You’re in the queue.</span></span>',
    );
    expect(markup).toMatch(
      /<!--\[if mso\]><v:roundrect[^]*?<center[^>]*>Open order room &#8594;<\/center>/,
    );
  });

  it('formats money from minor units', () => {
    expect(formatMoney({ cents: 1617, currency: 'EUR' })).toBe('€16.17');
    expect(formatMoney({ cents: -180, currency: 'EUR' })).toBe('\u2212€1.80');
    expect(formatMoney({ cents: 500, currency: 'EUR' }, { sign: true })).toBe(
      '+€5.00',
    );
    expect(formatMoney({ cents: 42036, currency: 'USD' })).toBe('$420.36');
  });
});

describe('email sending gate', () => {
  const base = {
    RESEND_API_KEY: 're_testkey_123456',
    EMAIL_FROM: 'Duoly <hello@duoly.gg>',
    EMAIL_SITE_URL: 'https://duoly.gg',
  };

  it('is off unless explicitly enabled and fully configured', () => {
    expect(emailConfig({})).toBeNull();
    expect(emailConfig({ ...base })).toBeNull();
    expect(emailConfig({ ...base, EMAIL_MODE: 'yes' })).toBeNull();
    expect(emailConfig({ ...base, EMAIL_MODE: 'test' })).toBeNull();
    expect(
      emailConfig({ ...base, EMAIL_MODE: 'live', RESEND_API_KEY: 'nope' }),
    ).toBeNull();
    expect(
      emailConfig({
        ...base,
        EMAIL_MODE: 'live',
        EMAIL_FROM: 'hello@duoly.gg',
      }),
    ).toBeNull();
    expect(
      emailConfig({
        ...base,
        EMAIL_MODE: 'live',
        EMAIL_SITE_URL: 'http://duoly.gg',
      }),
    ).toBeNull();
    expect(emailConfig({ ...base, EMAIL_MODE: 'live' })?.mode).toBe('live');
  });

  it('skips without calling the provider when off', async () => {
    let calls = 0;
    const result = await sendEmail(
      {
        template: 'welcome',
        to: 'a@b.co',
        data: samples.welcome,
        idempotencyKey: 'welcome:1',
      },
      { config: null, fetchImpl: async () => (calls++, new Response('{}')) },
    );
    expect(result).toEqual({ status: 'skipped', reason: 'disabled' });
    expect(calls).toBe(0);
  });

  it('redirects test sends and sends an idempotent, tagged request', async () => {
    const config = emailConfig({
      ...base,
      EMAIL_MODE: 'test',
      EMAIL_TEST_RECIPIENT: 'owner@example.com',
      EMAIL_REPLY_TO: 'support@duoly.gg',
    }) as EmailConfig;
    let request: { url: string; init: RequestInit } | undefined;
    const result = await sendEmail(
      {
        template: 'order_confirmed',
        to: 'customer@example.com',
        data: samples.order_confirmed,
        idempotencyKey: 'order_confirmed:DL-1042',
      },
      {
        config,
        fetchImpl: async (url, init) => {
          request = { url: String(url), init: init as RequestInit };
          return new Response(JSON.stringify({ id: 'email_123' }), {
            status: 200,
          });
        },
      },
    );
    expect(result).toEqual({
      status: 'sent',
      id: 'email_123',
      to: 'owner@example.com',
      mode: 'test',
    });
    expect(request?.url).toBe('https://api.resend.com/emails');
    const headers = request?.init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('test:order_confirmed:DL-1042');
    expect(headers.Authorization).toBe('Bearer re_testkey_123456');
    const body = JSON.parse(String(request?.init.body));
    expect(body.to).toEqual(['owner@example.com']);
    expect(body.subject).toMatch(/^\[TEST\] /);
    expect(body.reply_to).toBe('support@duoly.gg');
    expect(body.text).toContain('Total paid: €16.17');
    expect(body.tags).toContainEqual({
      name: 'template',
      value: 'order_confirmed',
    });
    expect(JSON.stringify(body)).not.toContain('customer@example.com');
  });

  it('classifies provider failures for retry', async () => {
    const config = emailConfig({ ...base, EMAIL_MODE: 'live' });
    const send = (status: number) =>
      sendEmail(
        {
          template: 'welcome',
          to: 'a@b.co',
          data: samples.welcome,
          idempotencyKey: 'welcome:2',
        },
        {
          config,
          fetchImpl: async () =>
            new Response(JSON.stringify({ name: 'x' }), { status }),
        },
      );
    expect(await send(429)).toMatchObject({
      status: 'failed',
      retryable: true,
    });
    expect(await send(500)).toMatchObject({
      status: 'failed',
      retryable: true,
    });
    expect(await send(422)).toMatchObject({
      status: 'failed',
      retryable: false,
    });
    const network = await sendEmail(
      {
        template: 'welcome',
        to: 'a@b.co',
        data: samples.welcome,
        idempotencyKey: 'welcome:3',
      },
      {
        config,
        fetchImpl: async () => {
          throw new Error('down');
        },
      },
    );
    expect(network).toMatchObject({
      status: 'failed',
      error: 'network_error',
      retryable: true,
    });
  });

  it('rejects malformed recipients and idempotency keys before sending', async () => {
    const config = emailConfig({ ...base, EMAIL_MODE: 'live' });
    const fetchImpl = async () => new Response('{}');
    expect(
      await sendEmail(
        {
          template: 'welcome',
          to: 'not-an-email',
          data: samples.welcome,
          idempotencyKey: 'k',
        },
        { config, fetchImpl },
      ),
    ).toMatchObject({ error: 'invalid_recipient' });
    expect(
      await sendEmail(
        {
          template: 'welcome',
          to: 'a@b.co',
          data: samples.welcome,
          idempotencyKey: 'bad key\n',
        },
        { config, fetchImpl },
      ),
    ).toMatchObject({ error: 'invalid_idempotency_key' });
  });
});
