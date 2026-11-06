# Proposed AI connector legal additions

Draft for owner and legal review only. No live legal page has been edited. Apply the privacy text only after checking it against the deployed schemas, infrastructure, rate limiter and analytics. A claim that no personal data is ever processed would be inaccurate if security logs contain IP addresses or other identifiers.

## Proposed privacy policy section: AI assistant connectors

Duoly provides public tools that compatible AI assistants can call to retrieve game and service information, request a quote, check availability and prepare a link to duoly.gg. A tool call contains the tool name and structured parameters supported by that tool, such as game and service identifiers and session quantities. You do not need to sign in to Duoly to use these public tools.

The public connector is designed to operate without personal data. Its supported inputs do not require your name, email address, game account password, Duoly account credentials, payment details or conversation transcript. Do not include those details in a tool request. Duoly does not store personal information from tool-call arguments or store your assistant conversation through these tools. The assistant provider handles your conversation under its own privacy terms and may retain the information you share with it.

We use request limits and technical security controls to protect the public endpoint. Hosting and security systems may process connection information needed to deliver requests and prevent abuse. The categories, purposes, legal bases, recipients and retention periods for that processing are described in the applicable hosting and security sections of this policy. Connector usage measurement is limited to the technical and service information needed for operation and measurement, subject to the privacy choices described in this policy.

A booking link opens duoly.gg. If you continue there, the website's account, booking, payment and consent processes apply. The public connector cannot access private booking history or payment information and cannot complete a purchase in the assistant.

## Proposed terms section: Use through AI assistants

You may use supported AI assistant connectors to browse Duoly's public game and service catalog, request indicative quotes, check availability and prepare a link to continue on duoly.gg. Friendly Social voice sessions are excluded from the initial connector release. We may restrict requests, apply rate limits or temporarily suspend connector access to protect service availability and prevent misuse. Do not circumvent those controls or use the tools to request unsupported or unlawful services.

Assistant-generated explanations may contain errors. A quote, availability response or booking link does not reserve a teammate, create an order or confirm a session. Check the current price, currency, session details, eligibility and booking conditions on duoly.gg before proceeding. Availability may change and matching depends on a teammate accepting the request.

All bookings and payments must be completed through Duoly's website under the applicable booking terms. The public tools do not charge cards, transfer wallet funds, issue refunds or accept payment credentials. Do not provide passwords or card details to a connector. An assistant's statement that a session is booked does not establish a booking without confirmation from Duoly's booking process.

The existing information about statutory consumer withdrawal rights, any required express consent for early service performance, cancellation and refunds remains unchanged and continues to apply. The connector creates no new waiver of those rights and cannot give that consent on your behalf.

## Required verification before adoption

- Confirm that tool schemas accept only documented public parameters and that invalid free-text or personal data is rejected without retention in validation logs. If this cannot be verified, revise the no-storage sentence before publication.
- Audit application logs, hosting logs, crash reports, analytics and proxy gateways. Identify any IP-derived rate-limit keys, hashing or pseudonymization, retention periods and recipients. Pseudonymous identifiers may remain personal data. Populate the existing policy with the actual legal basis and retention rather than inventing values here.
- Confirm the actual controller identity and privacy contact from the existing policy. Review processor contracts and international transfers for hosting and any registry gateway. The AI assistant's own role and retention are separate from Duoly's.
- Verify that link generation creates no stored personal draft, reservation or order, and that user account access and payment stay outside v1 MCP. If implementation changes, update the text and seek fresh review.
- Confirm the endpoint's real limit and retry behavior in the developer documentation. This draft supplies no invented numeric quota.
- Have counsel check consistency with the existing Austrian consumer withdrawal wording, age requirements, service conditions and game-publisher restrictions. Keep required consents in the existing site flow.
