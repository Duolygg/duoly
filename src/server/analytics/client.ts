import { createHash, randomUUID } from 'node:crypto';
import { PostHog } from 'posthog-node';
import { waitUntil } from '@vercel/functions';
import type { APIContext } from 'astro';
import {
  serverCatalogueProps,
  type ServerEventName,
} from '../../contracts/analytics-events';
import { consentFromCookies } from '../consent';
import { sanitizeAiProperties } from './ai';

type Consent = { analytics: boolean } | null;
const log = () => {
  console.warn('Server analytics delivery failed.');
};
const read = (name: string): string | undefined => {
  const value: unknown = process.env[name] ?? import.meta.env?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};
let client: PostHog | null = null;
function getClient() {
  if (
    read('PUBLIC_ANALYTICS_ENABLED') !== 'true' ||
    !read('PUBLIC_POSTHOG_KEY')
  )
    return null;
  if (!client) {
    client = new PostHog(read('PUBLIC_POSTHOG_KEY')!, {
      host: read('PUBLIC_POSTHOG_HOST') ?? 'https://eu.i.posthog.com',
      flushAt: 20,
      flushInterval: 0,
      disableGeoip: true,
      before_send: (event) => {
        const safe =
          serverCatalogueProps(event.event, event.properties) ??
          sanitizeAiProperties(event.event, event.properties);
        if (!safe) return null;
        const props = event.properties ?? {};
        return {
          ...event,
          properties: {
            ...safe,
            $geoip_disable: true,
            ...(props.$process_person_profile === false
              ? { $process_person_profile: false }
              : {}),
            ...(validSessionId(props.$session_id)
              ? { $session_id: props.$session_id }
              : {}),
          },
        };
      },
    });
    client.on('error', log);
  }
  return client;
}

/** RFC 9562 UUID v5 with the standard URL namespace. Server only. */
export function uuidv5(value: string): string {
  const namespace = Buffer.from('6ba7b8119dad11d180b400c04fd430c8', 'hex');
  const bytes = createHash('sha1')
    .update(namespace)
    .update(value)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const h = bytes.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export function validSessionId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
export function resolveIdentity(
  userId: string | null,
  consent: Consent,
  stableKey: string,
  sessionId?: string | null,
) {
  return consent?.analytics === true && userId
    ? {
        distinctId: userId,
        properties: validSessionId(sessionId) ? { $session_id: sessionId } : {},
      }
    : {
        distinctId: uuidv5('personless:' + stableKey),
        properties: { $process_person_profile: false },
      };
}
export type TrackInput = {
  event: ServerEventName | '$ai_generation' | '$ai_span';
  userId: string | null;
  consent: Consent;
  properties?: Record<string, unknown>;
  sessionId?: string | null;
  /** Per fact/turn, never a reusable account key. */
  stableKey?: string;
};
export function serverTrack(input: TrackInput): void {
  try {
    const sdk = getClient();
    if (!sdk) return;
    const properties =
      serverCatalogueProps(input.event, input.properties) ??
      sanitizeAiProperties(input.event, input.properties);
    if (!properties) return;
    if (!input.consent?.analytics) delete properties.$ai_session_id;
    const identity = resolveIdentity(
      input.userId,
      input.consent,
      input.stableKey ?? randomUUID(),
      input.sessionId,
    );
    sdk.capture({
      event: input.event,
      distinctId: identity.distinctId,
      properties: { ...properties, ...identity.properties },
    });
  } catch {
    log();
  }
}
export function flushAnalytics(): void {
  try {
    if (!client) return;
    const pending = client.flush().catch(log);
    try {
      waitUntil(pending);
    } catch {
      /* No Vercel request context locally. */
    }
  } catch {
    log();
  }
}
export function requestAnalyticsContext(
  context: Pick<APIContext, 'request' | 'cookies'>,
) {
  try {
    return {
      consent: consentFromCookies(context.cookies),
      sessionId: context.request.headers.get('X-POSTHOG-SESSION-ID'),
    };
  } catch {
    return { consent: null, sessionId: null };
  }
}

/** One business fact, followed by one serverless flush; cookie failures are best effort too. */
export function trackRequest(
  context: Pick<APIContext, 'request' | 'cookies'>,
  userId: string | null,
  event: ServerEventName,
  properties?: Record<string, unknown>,
): void {
  try {
    serverTrack({
      event,
      userId,
      properties,
      consent: consentFromCookies(context.cookies),
      sessionId: context.request.headers.get('X-POSTHOG-SESSION-ID'),
    });
  } catch {
    log();
  } finally {
    flushAnalytics();
  }
}
