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
import { analyticsConfig } from './config';
import { createController, type AnalyticsSdk } from './controller';
import { filterEvent, type SanitizeContext } from './sanitize';

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
    config: () => analyticsConfig(boot, beforeSend) as Record<string, unknown>,
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
  addEventListener('pageshow', (event) => {
    if (event.persisted) controller.sync();
  });
}

start();
