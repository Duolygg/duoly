import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_RETRY_DELAYS_MS,
  BackgroundSwitchSchema,
  FIRE_RETRY_DELAYS_MS,
  MAX_FIRE_ATTEMPTS,
  MAX_SIGNED_BODY_BYTES,
  MIN_SECRET_LENGTH,
  ORDER_EXPIRE_DELAY_MS,
  ORDER_POST_DELAY_MS,
  PRESENCE_CHECK_INTERVAL_MS,
  REGISTER_BACKDATE_MS,
  REGISTER_HORIZON_MS,
  SETTLE_RETRY_DELAYS_MS,
  SIGNATURE_HEADER,
  SIGNATURE_WINDOW_MS,
  SWITCH_KINDS,
  SWITCH_MODES,
  TIMER_KINDS,
  TIMER_KIND_SWITCH,
  TIMESTAMP_HEADER,
  TimerDispositionSchema,
  TimerFireSchema,
  TimerRequestResultSchema,
  TimerRequestSchema,
  TimersHealthSchema,
  bearerAuthorized,
  dispositionOutcome,
  nextFireRetryAt,
  normalizeTimerRequest,
  parseTimerKey,
  registrationAcceptable,
  signBackgroundBody,
  signedRequestHeaders,
  timerKey,
  verifyBackgroundBody,
} from '../../src/contracts/background';

/** 2026-11-12T09:00:00Z, inside the schemas' allowed instant range. */
const now = 1_793_005_200_000;
const order = 'b1a77e3c-0f2a-4a6e-9c21-9e4f0a1d3b55';
const secret = 'duoly-background-test-secret-0123456789';

describe('background switches', () => {
  it('names one switch per legacy dispatcher kind, with the same kinds as the database', () => {
    expect([...SWITCH_KINDS]).toEqual([
      'orders',
      'payments',
      'analytics',
      'roles',
    ]);
    expect([...SWITCH_MODES]).toEqual(['legacy', 'shadow', 'live']);
    expect(
      BackgroundSwitchSchema.parse({
        kind: 'orders',
        mode: 'shadow',
        updated_at: '2026-11-12T09:00:00Z',
      }).mode,
    ).toBe('shadow');
  });

  it('refuses an unknown mode rather than treating it as off', () => {
    for (const mode of ['off', 'LIVE', 'on', ''])
      expect(
        BackgroundSwitchSchema.safeParse({
          kind: 'orders',
          mode,
          updated_at: '2026-11-12T09:00:00Z',
        }).success,
      ).toBe(false);
  });

  it('maps every timer kind to the dispatcher kind that owns the same work', () => {
    expect(Object.keys(TIMER_KIND_SWITCH).sort()).toEqual(
      [...TIMER_KINDS].sort(),
    );
    for (const kind of TIMER_KINDS)
      expect(SWITCH_KINDS).toContain(TIMER_KIND_SWITCH[kind]);
    // Expiry and settlement are both the payments tick today (order_sweep, settlePending).
    expect(TIMER_KIND_SWITCH['order-expire']).toBe('payments');
    expect(TIMER_KIND_SWITCH['settle-retry']).toBe('payments');
    expect(TIMER_KIND_SWITCH['order-post']).toBe('orders');
    expect(TIMER_KIND_SWITCH['analytics-retry']).toBe('analytics');
    expect(TIMER_KIND_SWITCH['presence-check']).toBe('roles');
  });

  it('keeps the delays the owner agreed', () => {
    expect(ORDER_POST_DELAY_MS).toBe(100_000);
    expect(ORDER_EXPIRE_DELAY_MS).toBe(300_000);
    expect([...SETTLE_RETRY_DELAYS_MS]).toEqual([30_000, 120_000, 600_000]);
    expect([...ANALYTICS_RETRY_DELAYS_MS]).toEqual([30_000, 120_000, 600_000]);
    expect(PRESENCE_CHECK_INTERVAL_MS).toBe(20_000);
  });
});

describe('timer keys', () => {
  it('round-trips `<kind>:<ref>:<epoch>`', () => {
    const identity = { kind: 'order-post', ref: order, epoch: now } as const;
    const key = timerKey(identity);
    expect(key).toBe(`order-post:${order}:${now}`);
    expect(parseTimerKey(key)).toEqual(identity);
  });

  it('gives a singleton timer epoch 0, so re-arming reuses one row', () => {
    expect(timerKey({ kind: 'presence-check', ref: 'desk', epoch: 0 })).toBe(
      'presence-check:desk:0',
    );
    expect(parseTimerKey('presence-check:desk:0')).toEqual({
      kind: 'presence-check',
      ref: 'desk',
      epoch: 0,
    });
  });

  it('refuses keys this build could not have written', () => {
    for (const key of [
      'order-post:abc',
      'order-post:abc:1:2',
      'order-boom:abc:1',
      'order-post::1',
      'order-post:a b:1',
      'order-post:abc:-1',
      'order-post:abc:1.5',
      'order-post:abc:nope',
      'order-post:abc:99999999999999999',
      `order-post:${'a'.repeat(90)}:1`,
      'ORDER-POST:abc:1',
    ])
      expect(parseTimerKey(key)).toBeNull();
  });
});

describe('registration body', () => {
  const body = {
    kind: 'order-post',
    ref: order,
    epoch: now,
    at: now + ORDER_POST_DELAY_MS,
  } as const;

  it('accepts the database trigger shape without a key and fills it in', () => {
    const parsed = TimerRequestSchema.parse(body);
    expect(parsed.key).toBeUndefined();
    expect(normalizeTimerRequest(parsed)).toEqual({
      key: `order-post:${order}:${now}`,
      kind: 'order-post',
      ref: order,
      epoch: now,
      at: now + ORDER_POST_DELAY_MS,
    });
  });

  it('accepts a key that agrees with the fields and rejects one that does not', () => {
    expect(
      TimerRequestSchema.safeParse({ ...body, key: timerKey(body) }).success,
    ).toBe(true);
    for (const key of [
      `order-expire:${order}:${now}`,
      `order-post:${order}:${now - 1}`,
      `order-post:other:${now}`,
      '',
    ])
      expect(TimerRequestSchema.safeParse({ ...body, key }).success).toBe(
        false,
      );
  });

  it('rejects unknown fields, non-integer times and times outside the contract range', () => {
    for (const patch of [
      { url: 'https://example.invalid' },
      { at: now + 0.5 },
      { at: '1793005200000' },
      { at: 1_700_000_000 },
      { at: 4_200_000_000_000 },
      { epoch: -1 },
      { kind: 'order-boom' },
      { ref: `${order}:extra` },
    ])
      expect(TimerRequestSchema.safeParse({ ...body, ...patch }).success).toBe(
        false,
      );
  });

  it('bounds how far a registration may reach, in both directions', () => {
    expect(registrationAcceptable(now, now)).toBe(true);
    expect(registrationAcceptable(now - REGISTER_BACKDATE_MS, now)).toBe(true);
    expect(registrationAcceptable(now - REGISTER_BACKDATE_MS - 1, now)).toBe(
      false,
    );
    expect(registrationAcceptable(now + REGISTER_HORIZON_MS, now)).toBe(true);
    expect(registrationAcceptable(now + REGISTER_HORIZON_MS + 1, now)).toBe(
      false,
    );
  });

  it('reports whether the earliest due time was kept', () => {
    for (const stored of ['stored', 'kept', 'refused'])
      expect(
        TimerRequestResultSchema.safeParse({
          key: timerKey(body),
          at: body.at,
          stored,
        }).success,
      ).toBe(true);
    expect(
      TimerRequestResultSchema.safeParse({
        key: timerKey(body),
        at: body.at,
        stored: 'queued',
      }).success,
    ).toBe(false);
  });
});

describe('fire body', () => {
  const fire = {
    key: `order-expire:${order}:${now}`,
    kind: 'order-expire',
    ref: order,
    epoch: now,
    at: now + ORDER_EXPIRE_DELAY_MS,
    attempt: 1,
    firedAt: now + ORDER_EXPIRE_DELAY_MS + 40,
  } as const;

  it('carries the claimed key, the due time it fired for and the attempt', () => {
    expect(TimerFireSchema.parse(fire).attempt).toBe(1);
  });

  it('requires the key and keeps it consistent with the fields', () => {
    const withoutKey: Record<string, unknown> = { ...fire };
    delete withoutKey.key;
    expect(TimerFireSchema.safeParse(withoutKey).success).toBe(false);
    expect(
      TimerFireSchema.safeParse({ ...fire, kind: 'order-post' }).success,
    ).toBe(false);
  });

  it('allows the first attempt plus one per retry delay, and no more', () => {
    expect(MAX_FIRE_ATTEMPTS).toBe(FIRE_RETRY_DELAYS_MS.length + 1);
    expect(
      TimerFireSchema.safeParse({ ...fire, attempt: MAX_FIRE_ATTEMPTS })
        .success,
    ).toBe(true);
    for (const attempt of [0, -1, 1.5, MAX_FIRE_ATTEMPTS + 1])
      expect(TimerFireSchema.safeParse({ ...fire, attempt }).success).toBe(
        false,
      );
  });
});

describe('dispositions', () => {
  it('forgets the timer only when the handler says the key is finished', () => {
    for (const disposition of [
      { status: 'done' as const },
      { status: 'stale' as const, note: 'newer queue epoch' },
      { status: 'disabled' as const, mode: 'shadow' as const },
    ]) {
      const parsed = TimerDispositionSchema.parse(disposition);
      expect(dispositionOutcome(parsed)).toEqual({
        forget: true,
        rearmAt: null,
      });
    }
  });

  it('re-arms at the time the handler asked for', () => {
    for (const status of ['retry', 'pending'] as const) {
      const parsed = TimerDispositionSchema.parse({
        status,
        at: now + 60_000,
        note: 'earlier seat owns the team post',
      });
      expect(dispositionOutcome(parsed)).toEqual({
        forget: false,
        rearmAt: now + 60_000,
      });
    }
  });

  it('refuses a re-arm without a time, a disabled answer without a mode and unknown statuses', () => {
    for (const disposition of [
      { status: 'retry' },
      { status: 'pending' },
      { status: 'disabled' },
      { status: 'disabled', mode: 'off' },
      { status: 'ok' },
      { status: 'done', at: now },
      { status: 'retry', at: now + 60_000, extra: true },
    ])
      expect(TimerDispositionSchema.safeParse(disposition).success).toBe(false);
  });

  it('never treats a shadow answer as live completion', () => {
    const parsed = TimerDispositionSchema.parse({
      status: 'disabled',
      mode: 'shadow',
    });
    expect(parsed.status).toBe('disabled');
    expect(parsed.status === 'disabled' && parsed.mode).toBe('shadow');
  });
});

describe('fire retries', () => {
  it('backs off 30 s, 2 min then 10 min and gives up after the last one', () => {
    expect(nextFireRetryAt(1, now, 0.5)).toBe(now + 30_000);
    expect(nextFireRetryAt(2, now, 0.5)).toBe(now + 120_000);
    expect(nextFireRetryAt(3, now, 0.5)).toBe(now + 600_000);
    expect(nextFireRetryAt(MAX_FIRE_ATTEMPTS, now, 0.5)).toBeNull();
    expect(nextFireRetryAt(99, now, 0.5)).toBeNull();
  });

  it('spreads retries by a tenth either side, clamped for odd jitter input', () => {
    expect(nextFireRetryAt(1, now, 0)).toBe(now + 27_000);
    expect(nextFireRetryAt(1, now, 1)).toBe(now + 33_000);
    expect(nextFireRetryAt(1, now, -5)).toBe(now + 27_000);
    expect(nextFireRetryAt(1, now, 5)).toBe(now + 33_000);
    const random = nextFireRetryAt(1, now);
    expect(random).toBeGreaterThanOrEqual(now + 27_000);
    expect(random).toBeLessThanOrEqual(now + 33_000);
  });
});

describe('health answer', () => {
  const health = {
    now,
    pending: 3,
    due: 1,
    byKind: {
      'order-post': 1,
      'order-expire': 2,
      'settle-retry': 0,
      'analytics-retry': 0,
      'presence-check': 0,
    },
    oldestDueAt: now - 2_000,
    lastFireAt: now - 1_000,
    lastErrorAt: null,
    lastError: null,
    dropped: 0,
    keepAliveAt: now - 3_600_000,
  };

  it('reports counts, the oldest due timer and the keep-alive read', () => {
    expect(TimersHealthSchema.parse(health).due).toBe(1);
  });

  it('refuses an unknown kind bucket or a negative count', () => {
    expect(
      TimersHealthSchema.safeParse({
        ...health,
        byKind: { ...health.byKind, 'order-boom': 1 },
      }).success,
    ).toBe(false);
    expect(
      TimersHealthSchema.safeParse({ ...health, pending: -1 }).success,
    ).toBe(false);
  });
});

describe('signed requests', () => {
  it('signs `<timestamp>.<body>` exactly like HMAC-SHA-256 elsewhere', async () => {
    // Same vector as `openssl dgst -sha256 -hmac` and SQL `extensions.hmac(...,'sha256')`,
    // so the database, the worker and the app all produce this string.
    expect(
      await signBackgroundBody(secret, 1_767_225_600_000, '{"ok":true}'),
    ).toBe(
      'v1=bf92eb9d79efdbab3e9ee0e2cf0f78376423e844585117b0f990ed22679defd4',
    );
  });

  it('accepts its own headers', async () => {
    const body = JSON.stringify({ kind: 'order-post', ref: order });
    const headers = await signedRequestHeaders(secret, body, now);
    expect(headers[TIMESTAMP_HEADER]).toBe(String(now));
    expect(headers[SIGNATURE_HEADER]).toMatch(/^v1=[0-9a-f]{64}$/);
    expect(headers['content-type']).toBe('application/json');
    await expect(
      verifyBackgroundBody({
        secret,
        signature: headers[SIGNATURE_HEADER] ?? null,
        timestamp: headers[TIMESTAMP_HEADER] ?? null,
        body,
        now,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it('rejects a body changed by one character, a different secret and a different timestamp', async () => {
    const body = '{"ok":true}';
    const signature = await signBackgroundBody(secret, now, body);
    for (const attempt of [
      { body: '{"ok":false}' },
      { body: '{"ok":true} ' },
      { secret: `${secret}x` },
      { timestamp: String(now + 1) },
      { signature: signature.replace(/.$/, '0') },
    ]) {
      const result = await verifyBackgroundBody({
        secret,
        signature,
        timestamp: String(now),
        body,
        now,
        ...attempt,
      });
      expect(result).toEqual({ ok: false, reason: 'signature' });
    }
  });

  it('refuses anything outside the five minute window, in either direction', async () => {
    const body = '{"ok":true}';
    const stamp = now - SIGNATURE_WINDOW_MS - 1;
    for (const timestamp of [stamp, now + SIGNATURE_WINDOW_MS + 1]) {
      const result = await verifyBackgroundBody({
        secret,
        signature: await signBackgroundBody(secret, timestamp, body),
        timestamp: String(timestamp),
        body,
        now,
      });
      expect(result).toEqual({ ok: false, reason: 'window' });
    }
    // The edge of the window still verifies, so ordinary clock skew is not an outage.
    for (const timestamp of [
      now - SIGNATURE_WINDOW_MS,
      now + SIGNATURE_WINDOW_MS,
    ]) {
      const result = await verifyBackgroundBody({
        secret,
        signature: await signBackgroundBody(secret, timestamp, body),
        timestamp: String(timestamp),
        body,
        now,
      });
      expect(result).toEqual({ ok: true });
    }
  });

  it('treats a missing, blank or short secret as refuse everything', async () => {
    const body = '{"ok":true}';
    const signature = await signBackgroundBody(secret, now, body);
    for (const broken of [
      undefined,
      '',
      '   ',
      'a'.repeat(MIN_SECRET_LENGTH - 1),
    ])
      await expect(
        verifyBackgroundBody({
          secret: broken,
          signature,
          timestamp: String(now),
          body,
          now,
        }),
      ).resolves.toEqual({ ok: false, reason: 'secret' });
    await expect(signBackgroundBody('short', now, body)).rejects.toThrow(
      /32 characters/,
    );
  });

  it('refuses malformed headers and oversized bodies before any crypto work', async () => {
    const body = '{"ok":true}';
    const signature = await signBackgroundBody(secret, now, body);
    const cases: [
      { signature: string | null; timestamp: string | null; body?: string },
      string,
    ][] = [
      [{ signature, timestamp: null }, 'timestamp'],
      [{ signature, timestamp: '' }, 'timestamp'],
      [{ signature, timestamp: 'now' }, 'timestamp'],
      [{ signature, timestamp: `${now}.0` }, 'timestamp'],
      [{ signature: null, timestamp: String(now) }, 'signature'],
      [{ signature: 'v2=abc', timestamp: String(now) }, 'signature'],
      [{ signature: signature.slice(3), timestamp: String(now) }, 'signature'],
      [
        {
          signature,
          timestamp: String(now),
          body: `{"pad":"${'a'.repeat(MAX_SIGNED_BODY_BYTES)}"}`,
        },
        'body-too-large',
      ],
    ];
    for (const [input, reason] of cases)
      await expect(
        verifyBackgroundBody({ secret, body, now, ...input }),
      ).resolves.toEqual({ ok: false, reason });
  });
});

describe('bearer callers', () => {
  it('accepts the exact header and nothing else', () => {
    expect(bearerAuthorized(`Bearer ${secret}`, secret)).toBe(true);
    for (const header of [
      null,
      '',
      secret,
      `bearer ${secret}`,
      `Bearer ${secret} `,
      `Bearer ${secret}x`,
      'Bearer',
    ])
      expect(bearerAuthorized(header, secret)).toBe(false);
  });

  it('refuses every call when the secret is unset or too short', () => {
    for (const broken of [undefined, '', 'a'.repeat(MIN_SECRET_LENGTH - 1)])
      expect(bearerAuthorized(`Bearer ${broken}`, broken)).toBe(false);
  });
});
