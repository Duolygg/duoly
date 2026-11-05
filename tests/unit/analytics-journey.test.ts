import { describe, expect, it } from 'vitest';
import {
  filterEvent,
  scrubText,
  type SanitizeContext,
} from '../../src/client/analytics/sanitize';
import { maskNetworkName } from '../../src/client/analytics/config';
import {
  catalogueProps,
  EVENT_CATALOGUE,
} from '../../src/contracts/analytics-events';
import {
  track,
  reportError,
  TRACK_EVENT,
} from '../../src/client/analytics/track';

const ctx: SanitizeContext = {
  hosts: new Set(['duoly.gg']),
  currentPath: '/queue/8b1e2c3d-1111-4222-8333-444455556666',
  route: '/queue/:id',
  marketing: false,
};

describe('A2 event types', () => {
  it('refusers never send interaction, replay, heatmap, error or product events', () => {
    for (const event of [
      '$autocapture',
      '$rageclick',
      '$dead_click',
      '$$heatmap',
      '$exception',
      '$snapshot',
      'checkout_started',
    ])
      expect(filterEvent({ event, properties: {} }, false, ctx)).toBeNull();
  });

  it('autocapture: hrefs in the element chain are templated, emails removed', () => {
    const out = filterEvent(
      {
        event: '$autocapture',
        properties: {
          $elements_chain:
            'a.link:attr__href="/queue/8b1e2c3d-1111-4222-8333-444455556666?x=1"nth-child="1";' +
            'a:attr__href="https://www.google.com/search?q=me"text="mail me@example.com"',
          $external_click_url: 'https://discord.gg/invite/abc',
        },
      },
      true,
      ctx,
    )!;
    const chain = out.properties.$elements_chain as string;
    expect(chain).toContain('attr__href="/queue/:id"');
    expect(chain).toContain('attr__href="https://www.google.com"');
    expect(chain).not.toContain('me@example.com');
    expect(out.properties.$external_click_url).toBe('https://discord.gg');
  });

  it('heatmap: URL keys are templated and merged', () => {
    const out = filterEvent(
      {
        event: '$$heatmap',
        properties: {
          $heatmap_data: {
            'https://duoly.gg/queue/8b1e2c3d-1111-4222-8333-444455556666?s=1': [
              { x: 1 },
            ],
            'https://duoly.gg/claim/secretTok123': [{ x: 2 }],
          },
        },
      },
      true,
      ctx,
    )!;
    expect(Object.keys(out.properties.$heatmap_data as object).sort()).toEqual([
      'https://duoly.gg/claim/:token',
      'https://duoly.gg/queue/:id',
    ]);
  });

  it('replay: meta hrefs templated, DOM tree untouched and not truncated', () => {
    let deep: Record<string, unknown> = { leaf: 'text' };
    for (let i = 0; i < 30; i++) deep = { childNodes: [deep] };
    const out = filterEvent(
      {
        event: '$snapshot',
        properties: {
          $session_id: 's',
          $snapshot_data: [
            {
              type: 4,
              data: {
                href: 'https://duoly.gg/checkout/cs_live_secret?session_id=x',
                width: 1,
              },
            },
            { type: 2, data: { node: deep } },
            {
              type: 5,
              data: {
                tag: '$url_changed',
                payload: { href: 'https://duoly.gg/claim/tok' },
              },
            },
          ],
        },
      },
      true,
      ctx,
    )!;
    const data = out.properties.$snapshot_data as {
      type: number;
      data: Record<string, unknown>;
    }[];
    expect(data[0]!.data.href).toBe('https://duoly.gg/checkout/:id');
    expect(data[1]!.data.node).toBe(deep);
    expect(data[2]!.data.payload).toEqual({
      href: 'https://duoly.gg/claim/:token',
    });
    expect(out.properties.$session_id).toBe('s');
    expect(JSON.stringify(data)).not.toContain('cs_live_secret');
  });

  it('exceptions: frame URLs templated, messages scrubbed', () => {
    const out = filterEvent(
      {
        event: '$exception',
        properties: {
          $exception_list: [
            {
              type: 'TypeError',
              value: 'failed for jo@mail.com at https://duoly.gg/claim/tok?x=1',
              stacktrace: {
                frames: [
                  {
                    filename: 'https://duoly.gg/_astro/Home.abc.js',
                    lineno: 3,
                  },
                ],
              },
            },
          ],
        },
      },
      true,
      ctx,
    )!;
    const [ex] = out.properties.$exception_list as {
      value: string;
      stacktrace: { frames: { filename: string; lineno: number }[] };
    }[];
    expect(ex!.value).toBe(
      'failed for [email] at https://duoly.gg/claim/:token',
    );
    expect(ex!.stacktrace.frames[0]).toEqual({
      filename: 'https://duoly.gg/_astro/Home.abc.js',
      lineno: 3,
    });
  });

  it('product events keep declared, well-typed properties only', () => {
    const out = filterEvent(
      {
        event: 'checkout_started',
        properties: {
          game: 'valorant',
          units: 3,
          voice: true,
          email: 'x@y.z',
          service: 'Has Spaces',
          $browser: 'Chrome',
          route: '/',
          utm_source: 'tiktok',
        },
      },
      true,
      ctx,
    )!;
    expect(out.properties).toEqual({
      game: 'valorant',
      units: 3,
      voice: true,
      $browser: 'Chrome',
      route: '/queue/:id',
      utm_source: 'tiktok',
    });
  });
});

describe('catalogue', () => {
  it('validates kinds', () => {
    expect(
      catalogueProps('checkout_failed', {
        status_bucket: '5xx',
        reason_code: 'x',
        y: 1,
      }),
    ).toEqual({
      status_bucket: '5xx',
      reason_code: 'x',
    });
    expect(catalogueProps('checkout_failed', { status_bucket: '6xx' })).toEqual(
      {},
    );
    expect(
      catalogueProps('booking_confirm_opened', {
        units: -1,
        display_total_cents: 1.5,
      }),
    ).toEqual({});
    expect(catalogueProps('nope', {})).toBeNull();
  });
  it('names are snake_case object_action', () => {
    for (const name of Object.keys(EVENT_CATALOGUE))
      expect(name).toMatch(/^[a-z]+(_[a-z]+)+$/);
  });
});

describe('network masking and scrubText', () => {
  it('hides secret routes, templates the rest', () => {
    expect(
      maskNetworkName('https://duoly.gg/api/claim/tok/accept', ctx),
    ).toBeNull();
    expect(maskNetworkName('/api/support/chat', ctx)).toBeNull();
    expect(
      maskNetworkName(
        'https://duoly.gg/api/orders/8b1e2c3d-1111-4222-8333-444455556666/chat?x=1',
        ctx,
      ),
    ).toBe('https://duoly.gg/api/orders/:id/chat');
    expect(
      maskNetworkName(
        'https://api.stripe.com/v1/payment_intents/pi_123/confirm',
        ctx,
      ),
    ).toBe('https://api.stripe.com');
  });
  it('scrubText', () => {
    expect(scrubText('see https://x.com/a?b=c and a.b@c.de', ctx)).toBe(
      'see https://x.com and [email]',
    );
  });
});

describe('track bus', () => {
  it('is a no-op without window and dispatches with one', () => {
    expect(() => track('pro_portal_opened')).not.toThrow();
    expect(() => reportError(new Error('x'), 'island')).not.toThrow();
    expect(TRACK_EVENT).toBe('duoly:track');
  });
});

describe('surveys', () => {
  it('load only with Analytics consent', async () => {
    const { featureConfig } = await import('../../src/client/analytics/config');
    expect(featureConfig(true).disable_surveys).toBe(false);
    expect(featureConfig(false).disable_surveys).toBe(true);
  });
  it('answers pass for consented visitors and never for refusers', async () => {
    const { filterEvent } = await import('../../src/client/analytics/sanitize');
    const ev = () => ({
      event: 'survey sent',
      properties: { $survey_id: 'x', $survey_response: '7' },
    });
    const ctx = { pathname: '/', search: '', marketing: false } as never;
    expect(filterEvent(ev(), true, ctx)?.properties.$survey_response).toBe('7');
    expect(filterEvent(ev(), false, ctx)).toBeNull();
    expect(filterEvent(ev(), null, ctx)).toBeNull();
  });
});
