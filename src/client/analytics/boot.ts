/**
 * Browser entry, loaded on every SiteLayout page. Does nothing unless the server rendered
 * the analytics data island (configured, allowed page, not an admin) and the page runs on
 * an approved hostname. The SDK is initialised only after a cookie choice exists.
 */
import posthog from 'posthog-js';
import type { BeforeSendFn, CaptureResult } from 'posthog-js';
import {
  ANALYTICS_BOOT_ID,
  parseAnalyticsBoot,
} from '../../contracts/analytics';
import { CONSENT_COOKIE, parseConsent } from '../../contracts/consent';
import { catalogueProps } from '../../contracts/analytics-events';
import { analyticsConfig, featureConfig } from './config';
import { createController, type AnalyticsSdk } from './controller';
import { filterEvent, scrubText, type SanitizeContext } from './sanitize';
import {
  ERROR_EVENT,
  TRACK_EVENT,
  type ErrorDetail,
  type TrackDetail,
} from './track';

function readConsent() {
  const live = (window as { __duolyConsent?: unknown }).__duolyConsent;
  if (
    live &&
    typeof live === 'object' &&
    (live as { version?: unknown }).version === 2
  )
    return live as ReturnType<typeof parseConsent>;
  const cookie = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(CONSENT_COOKIE + '='));
  return parseConsent(cookie?.slice(CONSENT_COOKIE.length + 1));
}

function start() {
  const island = document.getElementById(ANALYTICS_BOOT_ID);
  if (!island?.textContent) return;
  let raw: unknown;
  try {
    raw = JSON.parse(island.textContent);
  } catch {
    return;
  }
  const boot = parseAnalyticsBoot(raw);
  if (!boot || !boot.hosts.includes(location.hostname)) return;

  const ctx = (): SanitizeContext => ({
    hosts: new Set(boot.hosts),
    currentPath: location.pathname,
    route: boot.route,
    marketing: readConsent()?.marketing === true,
  });
  // Reads the live choice on every event: withdrawing consent takes effect at once.
  const beforeSend: BeforeSendFn = (event: CaptureResult | null) => {
    const consent = readConsent();
    return filterEvent(event, consent ? consent.analytics : null, ctx());
  };

  const controller = createController({
    sdk: posthog as unknown as AnalyticsSdk,
    boot,
    readConsent,
    config: (full) =>
      analyticsConfig(boot, beforeSend, {
        full,
        sanitizeContext: ctx,
      }) as Record<string, unknown>,
    features: (full) => featureConfig(full) as Record<string, unknown>,
  });
  const syncConsent = () => {
    if (!boot.uid || !readConsent()) return;
    const csrf = island.dataset.csrf;
    if (!csrf) return;
    void fetch('/api/analytics/consent', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRF-Token': csrf },
    }).catch(() => {});
  };
  controller.sync();
  // One initial sync per document, not on bfcache restores.
  syncConsent();
  addEventListener('duoly:consent', () => {
    syncConsent();
    controller.sync();
  });
  // Product events and handled errors from islands (track.ts). Before a choice, or for
  // refusers, before_send drops them.
  addEventListener(TRACK_EVENT, (event) => {
    const { name, props } = (event as CustomEvent<TrackDetail>).detail ?? {};
    if (!name || controller.state().mode !== 'full') return;
    const clean = catalogueProps(name, props);
    if (clean) posthog.capture(name, clean);
  });
  addEventListener(ERROR_EVENT, (event) => {
    const { error, source } = (event as CustomEvent<ErrorDetail>).detail ?? {};
    if (controller.state().mode !== 'full') return;
    const err =
      error instanceof Error
        ? error
        : new Error(scrubText(String(error).slice(0, 200), ctx()));
    posthog.captureException(err, {
      source: /^[a-z0-9_-]{1,40}$/.test(source) ? source : 'other',
    });
  });
  addEventListener('pageshow', (event) => {
    if (event.persisted) controller.sync();
  });
}

start();
