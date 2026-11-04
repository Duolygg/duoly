/**
 * posthog-js options for slice A1 (pageviews, page leave with scroll depth, web vitals,
 * identity). Autocapture, replay, heatmaps, surveys and exception capture stay off until
 * slice A2 ships them together with the privacy markers.
 */
import type { BeforeSendFn, PostHogConfig } from 'posthog-js';
import type { AnalyticsBoot } from '../../contracts/analytics';

export function analyticsConfig(
  boot: AnalyticsBoot,
  beforeSend: BeforeSendFn,
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
    autocapture: false,
    rageclick: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_exceptions: false,
    capture_performance: { web_vitals: true, network_timing: false },
    disable_session_recording: true,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    advanced_disable_flags: true,
    disable_capture_url_hashes: true,
    mask_personal_data_properties: true,
    save_campaign_params: true,
    disableDeviceModel: true,
    // Our own hostname list decides where analytics runs; never auto-flag localhost.
    internal_or_test_user_hostname: null,
    before_send: beforeSend,
  };
}
