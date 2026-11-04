import { describe, expect, it } from 'vitest';
import {
  parseAnalyticsBoot,
  type AnalyticsBoot,
} from '../../src/contracts/analytics';
import type { ConsentState } from '../../src/contracts/consent';
import {
  createController,
  type AnalyticsSdk,
} from '../../src/client/analytics/controller';
import {
  filterEvent,
  templatePath,
  templateUrl,
  type SanitizeContext,
} from '../../src/client/analytics/sanitize';
import { analyticsBoot, bootJson } from '../../src/server/analytics/boot';
import { analyticsConfig } from '../../src/client/analytics/config';

const UID = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-2222-4333-8444-555555555555';
const KEY = 'phc_abcdefghijklmnopqrstuvwxyz0123456789';

const ctx: SanitizeContext = {
  hosts: new Set(['duoly.gg', 'www.duoly.gg']),
  currentPath: '/queue/8b1e2c3d-1111-4222-8333-444455556666',
  route: '/queue/:id',
  marketing: false,
};

describe('templatePath', () => {
  it.each([
    ['/queue/8b1e2c3d-1111-4222-8333-444455556666', '/queue/:id'],
    ['/checkout/cs_test_a1B2c3', '/checkout/:id'],
    ['/checkout/return', '/checkout/return'],
    ['/claim/abc', '/claim/:token'],
    ['/api/claim/sometoken/accept', '/api/claim/:token'],
    [
      '/api/orders/8b1e2c3d-1111-4222-8333-444455556666/chat',
      '/api/orders/:id/chat',
    ],
    ['/api/checkout/xyz/status', '/api/checkout/:id/status'],
    ['/api/proofs/a/b.png', '/api/proofs/:id'],
    ['/auth/callback', '/auth/*'],
    ['/blog/hello', '/blog/:slug'],
    ['/games/valorant', '/games/valorant'],
    ['/games/', '/games'],
    ['/', '/'],
    ['/x/someone@example.com', '/x/:id'],
    ['/x/a1b2c3d4e5f6g7', '/x/:id'],
  ])('%s -> %s', (input, output) => expect(templatePath(input)).toBe(output));
});

describe('templateUrl', () => {
  it('keeps safe utm values, drops other query and hash', () => {
    expect(
      templateUrl(
        'https://duoly.gg/games/valorant?utm_source=tiktok&email=a@b.c&session_id=cs_1#x',
        ctx,
      ),
    ).toBe('https://duoly.gg/games/valorant?utm_source=tiktok');
  });
  it('rejects utm values outside the bounded charset', () => {
    expect(templateUrl('https://duoly.gg/?utm_term=me@mail.com', ctx)).toBe(
      'https://duoly.gg/',
    );
  });
  it('keeps click ids only with marketing consent', () => {
    expect(templateUrl('https://duoly.gg/?gclid=abc', ctx)).toBe(
      'https://duoly.gg/',
    );
    expect(
      templateUrl('https://duoly.gg/?gclid=abc', { ...ctx, marketing: true }),
    ).toBe('https://duoly.gg/?gclid=abc');
  });
  it('reduces external URLs to their origin', () => {
    expect(templateUrl('https://www.google.com/search?q=my+name', ctx)).toBe(
      'https://www.google.com',
    );
  });
  it('uses the server route for the current page', () => {
    expect(
      templateUrl(
        'https://duoly.gg/queue/8b1e2c3d-1111-4222-8333-444455556666?payment_intent_client_secret=pi_1_secret_2',
        ctx,
      ),
    ).toBe('https://duoly.gg/queue/:id');
  });
  it('drops non-http schemes', () => {
    expect(templateUrl('javascript:alert(1)', ctx)).toBeNull();
  });
});

describe('filterEvent', () => {
  type Ev = {
    uuid: string;
    event: string;
    properties: Record<string, unknown>;
    $set_once?: Record<string, unknown>;
  };
  const pageview = (): Ev => ({
    uuid: 'u',
    event: '$pageview',
    properties: {
      token: KEY,
      distinct_id: 'd',
      $session_id: 's',
      $current_url:
        'https://duoly.gg/queue/8b1e2c3d-1111-4222-8333-444455556666?session_id=cs_live_secret',
      $pathname: '/queue/8b1e2c3d-1111-4222-8333-444455556666',
      $referrer: 'https://duoly.gg/checkout/cs_live_abc?x=1',
      title: 'Order for Alice | Duoly',
      utm_source: 'tiktok',
      gclid: 'abc',
      $initial_person_info: {
        r: 'https://t.co/abc',
        u: 'https://duoly.gg/claim/ClaimTok9',
      },
      $web_vitals_LCP_event: { $current_url: 'https://duoly.gg/claim/secret' },
    },
    $set_once: { $initial_current_url: 'https://duoly.gg/checkout/cs_1?y=2' },
  });

  it('drops everything before a choice', () => {
    expect(filterEvent(pageview(), null, ctx)).toBeNull();
  });

  it('preserves SDK protocol fields and templates every URL channel', () => {
    const out = filterEvent(pageview(), true, ctx)!;
    expect(out.properties.token).toBe(KEY);
    expect(out.properties.distinct_id).toBe('d');
    expect(out.properties.$session_id).toBe('s');
    expect(out.properties.$current_url).toBe('https://duoly.gg/queue/:id');
    expect(out.properties.$pathname).toBe('/queue/:id');
    expect(out.properties.$referrer).toBe('https://duoly.gg/checkout/:id');
    expect(out.properties.title).toBe('/queue/:id');
    expect(out.properties.route).toBe('/queue/:id');
    expect(out.properties.utm_source).toBe('tiktok');
    expect(out.properties.gclid).toBeUndefined();
    expect(out.properties.$initial_person_info).toEqual({
      r: 'https://t.co',
      u: 'https://duoly.gg/claim/:token',
    });
    expect(out.properties.$web_vitals_LCP_event).toEqual({
      $current_url: 'https://duoly.gg/claim/:token',
    });
    expect(out.$set_once).toEqual({
      $initial_current_url: 'https://duoly.gg/checkout/:id',
    });
    expect(
      JSON.stringify(out).match(/secret|cs_live|Alice|ClaimTok9/)?.[0] ?? null,
    ).toBeNull();
  });

  it('refusers: pageview and pageleave only, no campaign data, no person updates', () => {
    const out = filterEvent(pageview(), false, ctx)!;
    expect(out.properties.utm_source).toBeUndefined();
    expect(out.$set_once).toBeUndefined();
    expect(out.properties.token).toBe(KEY);
    for (const event of [
      '$web_vitals',
      '$identify',
      '$set',
      '$autocapture',
      '$snapshot',
    ])
      expect(filterEvent({ ...pageview(), event }, false, ctx)).toBeNull();
  });

  it('accepted: unknown events are dropped (fail closed)', () => {
    for (const event of [
      '$autocapture',
      '$snapshot',
      '$$heatmap',
      '$exception',
      'custom',
    ])
      expect(filterEvent({ ...pageview(), event }, true, ctx)).toBeNull();
    expect(
      filterEvent({ ...pageview(), event: '$web_vitals' }, true, ctx),
    ).not.toBeNull();
  });
});

const boot = (over: Partial<AnalyticsBoot> = {}): AnalyticsBoot => ({
  v: 1,
  key: KEY,
  host: 'https://eu.i.posthog.com',
  hosts: ['duoly.gg'],
  route: '/',
  policy: 'full',
  uid: null,
  role: null,
  internal: false,
  release: null,
  ...over,
});

function fakeSdk(stored: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const props = { ...stored };
  const sdk: AnalyticsSdk = {
    init: () => calls.push('init'),
    opt_in_capturing: (o) =>
      calls.push(`opt_in:${String(o?.captureEventName)}`),
    opt_out_capturing: () => calls.push('opt_out'),
    reset: () => {
      calls.push('reset');
      for (const k of Object.keys(props)) delete props[k];
    },
    identify: (id) => calls.push(`identify:${id}`),
    register: (p) => {
      Object.assign(props, p);
      calls.push(`register:${Object.keys(p).join(',')}`);
    },
    get_property: (k) => props[k],
    capture: (e) => calls.push(`capture:${e}`),
    setInternalOrTestUser: () => calls.push('internal'),
  };
  return { sdk, calls };
}

const consent = (analytics: boolean): ConsentState => ({
  version: 2,
  analytics,
  marketing: false,
  referral: false,
});

describe('controller', () => {
  it('no choice: never initialises', () => {
    const { sdk, calls } = fakeSdk();
    const c = createController({
      sdk,
      boot: boot(),
      readConsent: () => null,
      config: () => ({}),
    });
    c.sync();
    c.sync();
    expect(calls).toEqual([]);
  });

  it('refused: cookieless pageview, no identity', () => {
    const { sdk, calls } = fakeSdk();
    const c = createController({
      sdk,
      boot: boot({ uid: UID, role: 'customer' }),
      readConsent: () => consent(false),
      config: () => ({}),
    });
    c.sync();
    expect(calls).toEqual(['init', 'reset', 'opt_out', 'capture:$pageview']);
  });

  it('accepted and signed in: identify before the first pageview', () => {
    const { sdk, calls } = fakeSdk();
    const c = createController({
      sdk,
      boot: boot({ uid: UID, role: 'customer' }),
      readConsent: () => consent(true),
      config: () => ({}),
    });
    c.sync();
    expect(calls).toEqual([
      'init',
      'opt_in:false',
      `identify:${UID}`,
      'register:duoly_uid',
      'register:viewer_role',
      'capture:$pageview',
    ]);
    c.sync();
    expect(calls.filter((x) => x === 'capture:$pageview')).toHaveLength(1);
  });

  it('account switch and logout reset, then opt in again', () => {
    const switched = fakeSdk({ duoly_uid: OTHER });
    createController({
      sdk: switched.sdk,
      boot: boot({ uid: UID, role: 'customer' }),
      readConsent: () => consent(true),
      config: () => ({}),
    }).sync();
    expect(switched.calls.slice(0, 4)).toEqual([
      'init',
      'reset',
      'opt_in:false',
      `identify:${UID}`,
    ]);
    const loggedOut = fakeSdk({ duoly_uid: UID });
    createController({
      sdk: loggedOut.sdk,
      boot: boot(),
      readConsent: () => consent(true),
      config: () => ({}),
    }).sync();
    expect(loggedOut.calls).toEqual([
      'init',
      'reset',
      'opt_in:false',
      'register:viewer_role',
      'capture:$pageview',
    ]);
  });

  it('same account on a later page: no reset, no second identify', () => {
    const { sdk, calls } = fakeSdk({ duoly_uid: UID });
    createController({
      sdk,
      boot: boot({ uid: UID, role: 'customer' }),
      readConsent: () => consent(true),
      config: () => ({}),
    }).sync();
    expect(calls).not.toContain('reset');
    expect(calls).not.toContain(`identify:${UID}`);
  });

  it('internal accounts are marked', () => {
    const { sdk, calls } = fakeSdk();
    createController({
      sdk,
      boot: boot({ uid: UID, role: 'teammate', internal: true }),
      readConsent: () => consent(true),
      config: () => ({}),
    }).sync();
    expect(calls).toContain('internal');
  });

  it('withdrawal resets identity and opts out; re-grant opts in again', () => {
    let state: ConsentState | null = consent(true);
    const { sdk, calls } = fakeSdk();
    const c = createController({
      sdk,
      boot: boot({ uid: UID, role: 'customer' }),
      readConsent: () => state,
      config: () => ({}),
    });
    c.sync();
    calls.length = 0;
    state = consent(false);
    c.sync();
    expect(calls).toEqual(['reset', 'opt_out']);
    calls.length = 0;
    state = consent(true);
    c.sync();
    expect(calls).toEqual([
      'opt_in:false',
      `identify:${UID}`,
      'register:duoly_uid',
      'register:viewer_role',
    ]);
  });
});

describe('analyticsBoot (server)', () => {
  const env = {
    PUBLIC_ANALYTICS_ENABLED: 'true',
    PUBLIC_POSTHOG_KEY: KEY,
    PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com/',
    ANALYTICS_INTERNAL_USER_IDS: UID.toUpperCase(),
    VERCEL_GIT_COMMIT_SHA: 'abcdef1234567890abcdef',
  };
  it('is off unless enabled and configured', () => {
    expect(analyticsBoot({ path: '/', env: {} })).toBeNull();
    expect(
      analyticsBoot({
        path: '/',
        env: { ...env, PUBLIC_ANALYTICS_ENABLED: 'false' },
      }),
    ).toBeNull();
    expect(
      analyticsBoot({ path: '/', env: { ...env, PUBLIC_POSTHOG_KEY: 'nope' } }),
    ).toBeNull();
  });
  it('is off on private routes and for admins', () => {
    for (const path of [
      '/admin',
      '/admin/orders',
      '/claim/ClaimTok9',
      '/reset-password',
      '/auth/x',
    ])
      expect(analyticsBoot({ path, env })).toBeNull();
    expect(
      analyticsBoot({ path: '/', env, viewer: { id: UID, role: 'admin' } }),
    ).toBeNull();
  });
  it('builds a minimal context', () => {
    expect(
      analyticsBoot({
        path: '/queue/8b1e2c3d-1111-4222-8333-444455556666',
        env,
        viewer: { id: UID, role: 'customer' },
      }),
    ).toEqual({
      v: 1,
      key: KEY,
      host: 'https://eu.i.posthog.com',
      hosts: ['duoly.gg', 'www.duoly.gg'],
      route: '/queue/:id',
      policy: 'full',
      uid: UID,
      role: 'customer',
      internal: true,
      release: 'abcdef123456',
    });
  });
  it('no replay on desk, profile, dashboard and checkout; 404 hides the path', () => {
    for (const path of ['/teammate', '/profile', '/dashboard', '/checkout/abc'])
      expect(analyticsBoot({ path, env })?.policy).toBe('no-replay');
    expect(
      analyticsBoot({ path: '/some/secret/path', notFound: true, env })?.route,
    ).toBe('/404');
  });
  it('teammates are internal', () => {
    expect(
      analyticsBoot({ path: '/', env, viewer: { id: OTHER, role: 'teammate' } })
        ?.internal,
    ).toBe(true);
    expect(
      analyticsBoot({ path: '/', env, viewer: { id: OTHER, role: 'customer' } })
        ?.internal,
    ).toBe(false);
  });
  it('the island round-trips through the strict browser parser and cannot close its tag', () => {
    const b = analyticsBoot({ path: '/', env })!;
    expect(parseAnalyticsBoot(JSON.parse(bootJson(b)))).toEqual(b);
    expect(bootJson({ ...b, route: '/</script>' })).not.toContain('</script>');
    expect(parseAnalyticsBoot({ ...b, uid: 'not-a-uuid' })).toBeNull();
    expect(parseAnalyticsBoot({ ...b, role: 'admin' })).toBeNull();
  });
});

describe('analyticsConfig', () => {
  it('keeps every A1-deferred feature off and the first pageview manual', () => {
    const cfg = analyticsConfig(boot(), (e) => e);
    expect(cfg).toMatchObject({
      api_host: 'https://eu.i.posthog.com',
      cookieless_mode: 'on_reject',
      person_profiles: 'identified_only',
      capture_pageview: false,
      autocapture: false,
      disable_session_recording: true,
      capture_heatmaps: false,
      capture_exceptions: false,
      disable_surveys: true,
      advanced_disable_flags: true,
    });
    expect(cfg).not.toHaveProperty('opt_out_capturing_by_default');
    expect(cfg).not.toHaveProperty('respect_dnt');
  });
});
