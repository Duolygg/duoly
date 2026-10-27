# Creator referral rollout decisions

The referral attribution implementation is ready, but referral capture stays disabled unless `REFERRALS_ENABLED=true`. Do not enable it until the owner resolves these points.

## Rules copied from Fabian's original code

These values come from `duoly-admin/duoly@7f0299f` in `lib/creators.js`:

- Rising: 8% commission
- Partner: 10% commission from 25 attributed completed orders in a calendar month
- Elite: 12% commission from 100 attributed completed orders in a calendar month
- Attribution: 12 months from the referred customer's first paid order
- Manual monthly payout threshold: €50
- Advertised first-order customer discount: 10%

The migration records attribution and calculates commission owed. It never moves money. The 10% customer discount is deliberately not applied at checkout because discounts would change the server-authoritative order price and need a separate approved implementation.

## Open owner decisions before activation

1. Approve the original commission tiers, 12-month window and €50 manual payout threshold as commercial terms. Fabian marked them as proposals to review.
2. Approve the 30-day referral-cookie lifetime. Fabian's code did not define a cookie duration.
3. Confirm the consent and privacy treatment for the httpOnly referral cookie before enabling capture.
4. Decide whether and how to implement the advertised 10% first-order customer discount. Until then, the Settings screen labels it as unavailable.
5. Define how manual creator payouts are recorded as paid. This change reports total commission owed and performs no payout or money movement.

## Safe deploy order

1. Apply `supabase/migrations/20261025110000_creator_referrals.sql` through the reviewed migration release process while the existing application is still live. The migration only adds schema and does not replace existing functions.
2. Deploy the application with referral capture disabled.
3. Verify the admin Settings and Creators screens against the migrated database.
4. Resolve the owner decisions above.
5. Enable referral capture in a separate approved Vercel configuration change.
