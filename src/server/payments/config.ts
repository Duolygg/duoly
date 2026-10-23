import Stripe from 'stripe';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only payment configuration. Never import from browser code: the secret
 * key, webhook secret and Supabase secret key must not reach a client bundle.
 */
const env = (name: string): string | undefined => {
  const value: unknown = process.env[name] ?? import.meta.env?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

export interface PaymentsConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string | undefined;
  tickSecret: string | undefined;
  supabaseUrl: string;
  supabaseSecretKey: string;
  origin: string;
}

export function paymentsConfig(): PaymentsConfig | null {
  const secretKey = env('STRIPE_SECRET_KEY');
  const publishableKey = env('STRIPE_PUBLISHABLE_KEY');
  const supabaseUrl = env('SUPABASE_URL');
  const supabaseSecretKey = env('SUPABASE_SECRET_KEY');
  const origin = env('AUTH_ORIGIN');
  if (
    !secretKey?.match(/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/) ||
    !publishableKey?.match(/^pk_(test|live)_[A-Za-z0-9]+$/) ||
    !supabaseUrl ||
    !supabaseSecretKey ||
    !origin
  )
    return null;
  // Never mix modes: a live secret with a test publishable key fails closed.
  if (secretKey.includes('_live_') !== publishableKey.includes('_live_'))
    return null;
  return {
    secretKey,
    publishableKey,
    webhookSecret: env('STRIPE_WEBHOOK_SECRET'),
    tickSecret: env('PAYMENTS_TICK_SECRET'),
    supabaseUrl,
    supabaseSecretKey,
    origin: origin.replace(/\/$/, ''),
  };
}

let stripeClient: { key: string; client: Stripe } | null = null;
export function stripeFor(config: PaymentsConfig): Stripe {
  if (stripeClient?.key !== config.secretKey)
    stripeClient = {
      key: config.secretKey,
      client: new Stripe(config.secretKey, {
        maxNetworkRetries: 2,
        timeout: 15000,
        appInfo: { name: 'duoly', url: 'https://duoly.gg' },
      }),
    };
  return stripeClient.client;
}

let adminClient: { key: string; client: SupabaseClient } | null = null;
/** Service-role database client for trusted payment functions only. */
export function adminFor(config: PaymentsConfig): SupabaseClient {
  if (adminClient?.key !== config.supabaseSecretKey)
    adminClient = {
      key: config.supabaseSecretKey,
      client: createClient(config.supabaseUrl, config.supabaseSecretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    };
  return adminClient.client;
}

/**
 * Payment methods that can be authorized now and captured when a teammate accepts.
 * Everything else Stripe offers is captured at checkout and refunded only on cancel.
 */
export const AUTHORIZE_ONLY_METHODS = [
  'card',
  'link',
  'paypal',
  'klarna',
  'amazon_pay',
  'revolut_pay',
] as const;
