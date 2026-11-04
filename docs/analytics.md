# Analytics and consent

## Current rollout

Step 1 implements consent and privacy text only. No analytics SDK, analytics requests, replay, anonymous visit counting or ad conversion delivery is active. PostHog EU Cloud (Frankfurt) is the planned provider. The old transport-injection facade remains unused. Consent alone does not activate collection.

Step 2 will add the analytics SDK and server plumbing behind explicit enablement and production isolation. Full analytics, replay and account ID linking require Analytics consent. Visitors who decline will have anonymous cookieless visit counting with a daily changing server hash, no replay and no identity. Nothing is sent before a choice. These paths need network and provider verification before activation.

Marketing is a separate owner-approved purpose for planned server-side Meta and Google Ads conversion measurement. It is not active. No ad pixels or advertising SDKs are added by step 1. Hashed email may go to Meta only with Marketing consent. Without Marketing consent nothing goes to ad platforms. Neither analytics nor referral consent implicitly grants Marketing.

## Cookie contract

`duoly-consent` lasts 365 days, with `Path=/`, `SameSite=Lax` and `Secure` on HTTPS. Its exact format is `v2.a1.m1.r1`: `a0` or `a1` is Analytics, `m0` or `m1` is Marketing, and `r0` or `r1` is Creator link. The categories are independent.

- Only necessary: `v2.a0.m0.r0`.
- Accept all: `v2.a1.m1.r1`, in one click.
- Customise with Analytics only: `v2.a1.m0.r0`.

`src/contracts/consent.ts` exports `ConsentState`, `parseConsent`, `serializeConsent` and `needsConsentPrompt`. A state has `version: 2` and boolean `analytics`, `marketing` and `referral` fields. Missing and malformed cookies parse to `null` and prompt again. Legacy `all` maps to referral true, Analytics false and Marketing false. Legacy `necessary` maps to all false. Both legacy values prompt again because the old question covered only the creator cookie. The unreleased three-part format is invalid.

`src/server/consent.ts` exports `consentFromCookies(cookies)` for the next server analytics step. Referral capture and checkout reads check `referral` only, preserving legacy attribution. An explicit referral refusal deletes the existing referral cookie on a page GET. The feature flag and existing first-creator-wins behavior are unchanged.

The banner sets `window.__duolyConsent` to the parsed state or `null` on load. On every choice it writes the cookie, hides the banner, updates that global and dispatches `duoly:consent` with the complete state in `event.detail`. It then fetches the current page without caching so middleware applies referral capture or removal. Cookie settings reopens the category controls with the saved choices pre-filled. Step 2 can read the initial global and subscribe to the event for grants and withdrawals.

## Activation requirements

Event names and properties must be allowlisted. Define purpose, owner, producer, properties, consent, identity and deduplication before activation. Never send names, email, Discord handles, in-game names, messages, payment details, tokens, uploads or raw sensitive URLs to PostHog. Use approved route templates and opaque account IDs only with Analytics consent. Mask every input and chat text in replay. Logout resets identity, and withdrawal stops the corresponding optional collection.

Committed server state produces business events. PostHog is not the financial or audit source of truth. Keep operational payments, orders and reviews distinct from optional provider delivery. Server conversion delivery will need an explicit consent snapshot because webhooks do not receive the browser cookie.

Before release, verify refusal, grant, withdrawal, identity reset, URL sanitisation, masking, retention and preview isolation through actual network and provider checks. The privacy text describes the planned behavior and marks analytics and marketing as not active yet. Legal review remains necessary before activating these services.
