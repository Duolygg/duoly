# Creator referral rollout decisions

The referral attribution implementation is ready, but referral capture stays disabled unless `REFERRALS_ENABLED=true`. The owner decisions are resolved below; enable it after this release is live.

## Rules copied from Fabian's original code

These values come from `duoly-admin/duoly@7f0299f` in `lib/creators.js`:

- Rising: 8% commission
- Partner: 10% commission from 25 attributed completed orders in a calendar month
- Elite: 12% commission from 100 attributed completed orders in a calendar month
- Attribution: 12 months from the referred customer's first paid order
- Manual monthly payout threshold: €50
- Advertised first-order customer discount: 10%

The migration records attribution and calculates commission owed. It never moves money. The 10% customer discount is applied on the server at checkout (see decision 4).

## Owner decisions (2026-10-27)

1. Commercial terms: Fabian's tiers (8, 10, 12%), the 12-month window and the €50 manual payout threshold are approved.
2. Referral cookie: 30 days, approved.
3. Consent: the referral cookie is optional and managed through the site's cookie banner (`src/components/site/CookieBanner.astro`), shown on the first visit. It is only set after "Accept all"; "Only necessary" refuses it and removes an existing one, and checkout ignores the code without consent. The choice lives in the `duoly-consent` cookie (1 year) and can be changed under "Cookie settings" in the footer. The privacy page lists both cookies.
4. 10% first-order discount: implemented (`20261025240000_referral_first_order_discount.sql`). Checkout applies it on the server when the code belongs to an active creator, the customer has no previous order and no other discounted checkout is open. Duoly covers it: the teammate payout stays computed on the full price; the creator commission is calculated on what the customer paid. The checkout page shows it as its own line.
5. Payout marking: commission stays recorded per creator and month in admin Creators. Paying creators uses the same manual rail as teammate payouts (bank or Wise with a recorded reference) and is added to the payouts work (money step M2), so there is one payout ledger rather than two.

## Safe deploy order

1. Apply `supabase/migrations/20261025110000_creator_referrals.sql` through the reviewed migration release process while the existing application is still live. The migration only adds schema and does not replace existing functions.
2. Deploy the application with referral capture disabled.
3. Verify the admin Settings and Creators screens against the migrated database.
4. Resolve the owner decisions above.
5. Enable referral capture in a separate approved Vercel configuration change.
