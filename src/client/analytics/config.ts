/**
 * posthog-js options (POSTHOG-SPEC section 4). Interaction capture (autocapture, rage and
 * dead clicks, heatmaps, exceptions) runs only with Analytics consent; `featureConfig` is
 * applied again by the controller whenever consent changes, and before_send drops these
 * events for refusers regardless. Session replay is never auto-started: the controller
 * starts it where the page policy allows.
 */
import type { BeforeSendFn, PostHogConfig } from 'posthog-js';
import type { AnalyticsBoot } from '../../contracts/analytics';
import { templateUrl, type SanitizeContext } from './sanitize';

/** Elements whose clicks and text are never captured (privacy markers, spec 5.2). */
export const PRIVATE_SELECTORS = [
  '.ph-no-autocapture',
  '[data-ph-no-autocapture]',
  '[data-private]',
  '[data-private-block]',
];

/** Requests never shown in replay network timings: secrets, auth and support content. */
const HIDDEN_REQUESTS =
  /\/(api\/claim|claim|auth|api\/auth|api\/support|api\/proofs|reset-password)(\/|$|\?)/;

export function featureConfig(full: boolean): Partial<PostHogConfig> {
  return {
    autocapture: full
      ? {
          dom_event_allowlist: ['click', 'change', 'submit'],
          css_selector_ignorelist: PRIVATE_SELECTORS,
          capture_copied_text: false,
        }
      : false,
    rageclick: full,
    capture_dead_clicks: full,
    capture_heatmaps: full,
    capture_exceptions: full
      ? {
          capture_unhandled_errors: true,
          capture_unhandled_rejections: true,
          capture_console_errors: false,
        }
      : false,
  };
}

/** Replay network entries: secret routes hidden, every other URL templated. */
export function maskNetworkName(
  name: string,
  ctx: SanitizeContext,
): string | null {
  let path: string;
  try {
    path = new URL(name, 'https://duoly.gg').pathname;
  } catch {
    return null;
  }
  if (HIDDEN_REQUESTS.test(path)) return null;
  return templateUrl(name, ctx);
}

export function analyticsConfig(
  boot: AnalyticsBoot,
  beforeSend: BeforeSendFn,
  options: { full: boolean; sanitizeContext: () => SanitizeContext },
): Partial<PostHogConfig> {
  return {
    api_host: boot.host,
    ui_host: 'https://eu.posthog.com',
    defaults: '2026-08-30',
    person_profiles: 'identified_only',
    cookieless_mode: 'on_reject',
    persistence: 'localStorage+cookie',
    cross_subdomain_cookie: true,
    secure_cookie: true,
    cookie_expiration: 180,
    // reconcile() sends the first pageview after identity is settled.
    capture_pageview: false,
    capture_pageleave: true,
    ...featureConfig(options.full),
    capture_performance: { web_vitals: true, network_timing: true },
    disable_session_recording: true,
    enable_recording_console_log: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-private], [data-private] *',
      blockSelector: '[data-private-block], iframe, astro-dev-toolbar',
      // Astro serializes Viewer and booking data in an attribute outside marked DOM.
      maskAttributeFn: (name, value, element) =>
        element?.tagName.toLowerCase() === 'astro-island' && name === 'props'
          ? ''
          : value,
      recordHeaders: false,
      recordBody: false,
      maskCapturedNetworkRequestFn: (request) => {
        const name = maskNetworkName(request.name, options.sanitizeContext());
        return name ? { ...request, name } : null;
      },
    },
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    // Remote config enables the recorder. Refusers must never request it.
    advanced_disable_flags: !options.full,
    disable_capture_url_hashes: true,
    mask_personal_data_properties: true,
    save_campaign_params: true,
    disableDeviceModel: true,
    // Our own hostname list decides where analytics runs; never auto-flag localhost.
    internal_or_test_user_hostname: null,
    before_send: beforeSend,
  };
}
