# Email

Provider: existing Resend account, with an independent Duoly domain and domain-scoped sending key. Current integration and delivery evidence: [backend rebuild status](../product/backend-rebuild-status.md). A separate duoly.gg domain was created and read back: c6c7296d-0736-4ce8-9e9b-f2d7ff83691a, eu-west-1, open/click tracking disabled, enforced TLS. Sending/receiving capabilities enabled. DKIM and rsend CNAME verified; primary send MX/TXT remain pending in Resend despite resolving publicly. Receiving root MX is still absent. See email-dns.json for exact returned public records. Authoritative nameservers are dns1.registrar-servers.com and dns2.registrar-servers.com; domain not present in the current Vercel account. The owner added sending DNS. Development Supabase SMTP is configured, signup remains closed. One owner-only SMTP test was rejected550 before acceptance; no delivery is claimed. No receiving webhook or forwarding is deployed. Pet to Portrait remains unchanged.

Reuse Pet to Portrait's architecture with independent Duoly keys, domain checks, branding, addresses and webhook secrets.

1. Confirm sender/support/Reply-To addresses, DNS owner and operator forwarding destination.
2. Verify sending/receiving domain, SPF, DKIM, DMARC and MX.
3. Keep sending off by default. Explicit non-production sends redirect only to sebastian.schrottenbach@gmail.com with visible test subject and no customer CC/BCC.
4. Build HTML/text templates for approved lifecycle events.
5. Persist send records and provider IDs. Stable idempotency keys, bounded retries, dead-letter/manual recovery and reconciliation for ambiguous sends are required. Resend's 24-hour idempotency window does not replace permanent application deduplication.
6. Verify signatures on bounded raw webhook payloads. Persist inbound work before acknowledgement when reliable forwarding is required, retrieve message, forward to operator and preserve original sender in Reply-To.
7. Prevent loops/auto-response storms, define attachments policy and verify delivery webhooks.
8. Separate transactional and marketing consent/unsubscribe requirements.

Acceptance, only after authorization: one redirected outbound with exact recipient/provider read-back, one inbound forwarding test, forged-signature rejection, duplicate safety and failure recovery. Delivery does not prove reading. No live activation until gates pass.

## Templates and sending (implemented)

- Source: `src/server/email/`. Each email is one content model rendered to HTML and plain text by `layout.ts`. Brand tokens in `theme.ts`, synthetic preview data in `samples.ts`.
- Auth emails (confirmation, recovery, email change, reauthentication, password and email changed notices) are rendered to `supabase/templates/*.html` with `node scripts/emails.ts supabase` and wired in `supabase/config.toml`. Tests fail if the committed HTML drifts from the source.
- Preview gallery: `node scripts/emails.ts preview <dir>` writes a self-contained `index.html` with desktop, mobile and plain text views.
- App emails are sent with `sendEmail()` in `send.ts`. `EMAIL_MODE=off` by default; `test` redirects every send to `EMAIL_TEST_RECIPIENT` with a `[TEST]` subject; `live` needs owner approval. Every send carries a stable Idempotency-Key and a `template` tag.
- Images and fonts load from `https://duoly.gg/email/` and `/fonts/`, so template changes must be deployed before their assets appear in inboxes. No Google Fonts (recipient IPs stay out of Google's logs).
- Keep open and click tracking off on the Resend domain. Tracking rewrites links, which breaks Supabase confirmation links and makes transactional mail look like marketing.
- Copy rules are enforced by tests: no en or em dashes and no ampersands in subjects or text.

## Inbound forwarding

Resend receives all mail for `*@duoly.gg` (apex MX `receive-euw1.forge.rmta.net`, priority 10) and posts `email.received` to `https://duoly.gg/api/webhooks/resend`. The handler verifies the Svix signature (5 minute tolerance), fetches the message, and forwards it to `INBOUND_FORWARD_TO` from `INBOUND_FORWARD_FROM` with Reply-To set to the original sender and the original attached as `.eml`. Its own forwards are never re-forwarded. Webhook retries reuse the Idempotency-Key `inbound-forward:<email_id>`.

Credentials: Keychain `duoly-resend-inbound-key` (full access, needed to read received mail) and `duoly-resend-webhook-secret`, both account `duoly-prod`. Configured as sensitive Vercel production variables only.
