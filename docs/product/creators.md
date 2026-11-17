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

## Checkout creator code (Workstream A)

The booking confirmation includes one optional **Creator code** field before a payment
session is created. A consent-allowed creator link pre-fills it and is checked automatically.
Typing replaces the link; removing sends an explicit empty code for this checkout only.
A typed code is an explicit customer request, needs no referral cookie or consent, and
never changes cookie choices. Link capture remains gated by `REFERRALS_ENABLED` and
referral consent. Withdrawing referral consent clears an unchanged link field.

`POST /api/creators/code/check` uses the signed-in customer, existing CSRF protection,
a 1 KB body bound and 12 checks per account per minute (bounded per-process burst limit).
It accepts the booking selection and display currency and returns
`{valid, displayName, discountPercent, reason, preview}`. For valid codes the preview
contains the original, discounted and saved minor-unit amounts in EUR or USD, plus
the exact EUR checkout amount. It uses `buildCheckout` and `applyOrderDiscounts`,
including server-read PRO membership and server FX, without changing discount rules.
The confirmation strikes through the original total, shows the saving and uses the
server amount in both the summary and payment copy. Applied codes are read-only
with a check icon, a live status and a text-style Remove button.
Unknown and inactive codes share one refusal. The read never creates an intent or attribution. Checkout
revalidates independently with the existing eligibility RPC and server pricing.

Rules are unchanged: active creator, no prior order and no outstanding discounted
intent; 10% after bundle discounts, with the existing EUR 0.99 floor. PRO and creator
discounts do not stack, with PRO winning a tie. Streaming bookings and free coaching
remain excluded. The schema has no creator-owner identity or self-referral prohibition,
so this feature does not invent one. Existing paid-order triggers alone record the
customer's creator once and preserve the 12-month attribution window. Changing a code
cannot replace an already established customer attribution.

Analytics adds `creator_code_applied` with only `source: typed | link` and `valid`.
No code, creator name or customer input is sent to analytics. No migration is needed.
The code can be checked or removed before continuing; the payment page uses the final
server-priced checkout intent and does not mutate existing Stripe sessions.

## Creator portal (migration 20261117120000)

A creator now applies on /creators with a Duoly account, and sees everything about themselves on
**/creators/dashboard**. Admin work shrinks to approve, pay and review. Spec:
`ai-agents-research/25-creator-portal-spec.md`.

**Applying.** The form keeps Fabian's fields and adds the requested code (3 to 20 letters or
numbers, checked live), country, an 18 or older confirmation and acceptance of the published
creator terms (`src/content/creator-terms.ts`, version 2026-11-17, stored with the time on the
application). Signed-out visitors get the existing sign-in popup first, because the application
belongs to an account. One open application per account, and a rejected applicant can apply again
30 days after the decision. The support inbox still gets every application.

**Codes.** A code is reserved while an application is open, through a partial unique index plus an
advisory lock, so two accounts cannot both take one. Words the site answers itself (`blog`, `pro`,
`terms`, …) are refused, because duoly.gg/CODE only redirects on a path no page answers. The list
lives in `src/contracts/creator-portal.ts` and in `public.creator_reserved_code()`, and a unit test
keeps the two equal.

**Admin.** Admin, Creators shows the queue: channel link, platform, audience, country and message,
approve with the requested code or an edited one, or reject with a reason the creator reads on
their dashboard. Both decisions are written to the admin log, and an approval sends the "You're in"
email with the code, the links and the way to the dashboard.

**Money, and how it reconciles.** The dashboard reads one function, `creator_portal()`, which
answers for `auth.uid()` only.

- **Earned** is the completed-order figure the admin screen shows. The month tier comes from
  `public.creator_tier()` and the month total is the same round half up expression
  `admin_creator_dto()` and `creator_month_commission()` use, so admin and creator always agree.
  `supabase/tests/creator_portal.sql` asserts that equality.
- **Available** is the part of an unpaid month that is past the 30 day hold and not blocked by an
  open report or Stripe dispute (`payout_order_blocked`).
- **Pending** is the rest: the hold, plus an estimate at this month's tier for orders that are
  still being played. The dashboard labels that estimate as one, because it is not earned yet.
- **Paid** is what `creator_payouts` recorded. A month marked paid leaves the available balance,
  exactly like the admin screen's owed figure.
- **Reversed** is commission lost to refunds, voids and chargebacks, including orders that never
  reached a commission month.

**Link clicks** are an aggregate counter per code and day (`creator_link_clicks`): no IP, no
cookie, no user id, nothing about the visitor. They are counted whatever the visitor chose in the
cookie banner, because the row is a code, a day and a number; the referral cookie itself stays
consent gated. Counting happens on the landing with a valid `?ref=` code, which is where both
paths end up, since the short link redirects there. The write is never awaited.

**Self-referral.** `checkout_intent_attribute()` is replaced (the one function this migration
replaces) so an order whose customer is the creator's own account never attributes and never
counts, in both directions. Existing attribution rows stay immutable.

**Known gap.** `admin_creator_payout_pay()` (20261025250000) still only checks the €50 unpaid
total: it does not look at the 30 day hold or at `payout_order_blocked`, so an admin can mark a
whole month paid while the dashboard still shows part of that month as held. The creator numbers
stay correct either way (a paid month leaves the available balance). Decide between treating it as
a manual admin policy, or adding the guard in a follow-up migration; this release does not change
that function, because the portal migration replaces only the attribution trigger.

## Safe deploy order

1. Apply `supabase/migrations/20261025110000_creator_referrals.sql` through the reviewed migration release process while the existing application is still live. The migration only adds schema and does not replace existing functions.
2. Deploy the application with referral capture disabled.
3. Verify the admin Settings and Creators screens against the migrated database.
4. Resolve the owner decisions above.
5. Enable referral capture in a separate approved Vercel configuration change.
