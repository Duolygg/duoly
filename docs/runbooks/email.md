# Email

Provider: existing Resend account, outbound plus Receiving. A separate duoly.gg domain was created and read back: c6c7296d-0736-4ce8-9e9b-f2d7ff83691a, eu-west-1, open/click tracking disabled, enforced TLS. Sending/receiving capabilities enabled but DNS is unverified. See email-dns.json for exact returned public records. Authoritative nameservers are dns1.registrar-servers.com and dns2.registrar-servers.com; domain not present in the current Vercel account. No DNS changes, webhook deployment, live email or sender activation has occurred. Pet to Portrait remains unchanged.

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
