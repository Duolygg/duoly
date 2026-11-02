// Creates the Duoly PRO catalog in Stripe (ledger #39): test mode by default, live mode only with
// --live. Safe to re-run: every create uses an idempotency key, and existing objects are found by
// lookup key or metadata first.
//
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe/setup-pro.mjs
//   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe/setup-pro.mjs --live
//
// Prints only object ids, never the key.
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY ?? '';
// Live mode only on purpose: `node scripts/stripe/setup-pro.mjs --live` with the live key.
const live = process.argv.includes('--live');
if (!key.startsWith(live ? 'sk_live_' : 'sk_test_')) {
  process.stderr.write(
    live
      ? 'Refusing to run: --live needs a live-mode STRIPE_SECRET_KEY.\n'
      : 'Refusing to run: STRIPE_SECRET_KEY must be a test-mode key (or pass --live with a live key).\n',
  );
  process.exit(1);
}
const stripe = new Stripe(key, { maxNetworkRetries: 2 });
const LOOKUP_KEY = 'duoly_pro_monthly';

async function product() {
  const found = await stripe.products.search({
    query: "metadata['duoly_kind']:'duoly_pro' AND active:'true'",
    limit: 1,
  });
  if (found.data[0]) return found.data[0];
  return stripe.products.create(
    {
      name: 'Duoly PRO',
      description:
        '10% off every game, priority matching and unlimited re-rolls. 7 days free, no card needed.',
      metadata: { duoly_kind: 'duoly_pro' },
    },
    { idempotencyKey: 'duoly-pro-product-v1' },
  );
}

// €9.99 a month (owner 2026-11-02). USD customers see $9.99 and pay its euro equivalent, set per
// subscription by the app on the same product. The lookup key moves to this price from the old
// €4.99 one, which is then archived; the app accepts only this price.
async function price(productId) {
  const found = await stripe.prices.list({
    lookup_keys: [LOOKUP_KEY],
    active: true,
    limit: 1,
  });
  const current = found.data[0];
  if (current && current.unit_amount === 999) return current;
  const created = await stripe.prices.create(
    {
      product: productId,
      currency: 'eur',
      unit_amount: 999,
      recurring: { interval: 'month', interval_count: 1 },
      lookup_key: LOOKUP_KEY,
      transfer_lookup_key: true,
      nickname: 'Duoly PRO monthly',
      tax_behavior: 'inclusive',
      metadata: { duoly_kind: 'duoly_pro' },
    },
    { idempotencyKey: 'duoly-pro-price-monthly-999-v1' },
  );
  if (current) await stripe.prices.update(current.id, { active: false });
  return created;
}

async function portal(productId, priceId) {
  const list = await stripe.billingPortal.configurations.list({
    active: true,
    limit: 100,
  });
  const found = list.data.find((c) => c.metadata?.duoly_kind === 'duoly_pro');
  if (found) return found;
  return stripe.billingPortal.configurations.create(
    {
      business_profile: {
        headline: 'Manage your Duoly PRO membership',
        privacy_policy_url: 'https://duoly.gg/privacy',
        terms_of_service_url: 'https://duoly.gg/terms',
      },
      default_return_url: 'https://duoly.gg/dashboard#pro',
      features: {
        customer_update: { enabled: false },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
          proration_behavior: 'none',
          cancellation_reason: {
            enabled: true,
            options: ['too_expensive', 'unused', 'missing_features', 'other'],
          },
        },
        subscription_update: { enabled: false },
      },
      metadata: { duoly_kind: 'duoly_pro', product: productId, price: priceId },
    },
    { idempotencyKey: 'duoly-pro-portal-v1' },
  );
}

const p = await product();
const pr = await price(p.id);
const c = await portal(p.id, pr.id);
process.stdout.write(
  JSON.stringify(
    {
      livemode: pr.livemode,
      product: p.id,
      price: pr.id,
      lookup_key: pr.lookup_key,
      portal_configuration: c.id,
    },
    null,
    2,
  ) + '\n',
);
