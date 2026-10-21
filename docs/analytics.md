# Analytics

Provider: PostHog. The existing EU account is confirmed through the Pet to Portrait reporting credential. That key can read its exact project233929 but cannot list/create other projects (HTTP403). A separate Duoly project is not provisioned/verified yet; do not mix Duoly events into Pet to Portrait.

Defaults: analytics disabled, autocapture disabled, session replay disabled. A key alone does not authorize collection. Actual SDK initialization requires explicit enablement, valid configuration and consent under the approved policy. Withdrawal must stop collection. Non-production is off or uses its own project.

The initial typed transport-injection facade is a testable boundary, not live PostHog SDK integration. Event names and properties must be allowlisted. Do not claim real events are captured until network/provider verification exists.

Before activation define each event's purpose, owner, producer, properties, consent, identity and deduplication. Never send email/player names, messages, payment details, tokens, uploads, sensitive dynamic IDs or raw URLs/query strings. Use approved route templates. Login uses opaque internal IDs and logout resets identity. Test Astro navigation to avoid duplicate pageviews. Server events obey consent too. Committed backend state produces business events, not a browser success page.

Acceptance requires actual network/provider checks for refusal, grant, withdrawal, identity reset and preview isolation. PostHog is not a financial/audit source of truth.
