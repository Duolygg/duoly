# Google Connected Apps preview application draft

Owner review required. No application or submission has been made. These are prepared application answers, not a claim that the private preview form uses these exact labels. Source: supplied `01-ai-stores.md`, Google sections G1 to G7, retrieved 6 November 2026.

## Application answers

**Product and website:** Duoly, https://duoly.gg. Legal entity, registration details and named applicant: owner to confirm against the current imprint. Support: hello@duoly.gg, subject to owner confirmation for review correspondence.

**What does your product do?** Duoly is an Austrian marketplace for paid online gaming teammates and coaching. Customers choose a supported game and session type, review a price and complete checkout on Duoly. The live catalog determines which services are available. Pokemon support in this integration means Pokemon Unite.

**What do you propose to connect?** A first-party remote MCP server at `https://duoly.gg/mcp` using HTTPS Streamable HTTP. Public v1 tools are `list_games`, `list_services`, `get_quote`, `get_availability` and `create_booking_link`. The server is being implemented separately. No OAuth or account access is included in v1. Please confirm that an unauthenticated public-data connector can enter the preview and whether account linking is mandatory for our category.

**What user problem does it solve?** A user can discover supported games and paid session types, check a current quote and availability, then continue on Duoly with the selected game and service. Requests for free teammates should be distinguished from paid services. Availability is a queue signal and does not guarantee an immediate match.

**Example requests:** Find a League of Legends teammate session. Check the price of Valorant coaching under 20 euros. Show Pokemon Unite sessions and current availability. Prepare a Marvel Rivals session link on Duoly. Expected calls follow the five-tool reviewer plan in `claude-directory.md`.

**What happens at checkout?** The assistant returns an owned-domain link. The user reviews the current offer and completes any required account steps and payment on duoly.gg. No MCP tool places an order, reserves a teammate, charges a card, transfers funds or issues a refund. A link is not a booking confirmation. Please classify this discovery and external-checkout flow under the applicable online services vertical and confirmation rules.

**What data is processed?** Structured public catalog requests such as game and service identifiers and supported session quantities. The intended v1 contract excludes names, contact details, conversation transcripts, account tokens and payment details. Confirm the actual server schemas, infrastructure security logs and analytics before adopting final retention statements. The host processes the user's conversation under its own policies.

**How are users protected?** Friendly Social voice sessions are excluded from v1 tools. Duoly's wider website includes Social sessions, which reviewers should be aware of. No tool should support sexual services, gambling, account sharing or promises of rank gains. Existing site age, moderation, reporting and blocking controls must be documented and reviewed by the owner. Their presence and effectiveness have not been certified by this draft.

**Geography and languages:** Request Austria and the countries where Duoly can actually serve sessions, with English and German discovery examples. Owner must provide the real service-country and language matrix. Preview admission and country selection do not establish Austrian availability in Gemini or Search. No unsupported country coverage is promised.

**Reviewer access:** Public MCP tools require no Duoly login. Discover tools, retrieve actual service IDs, request quotes and availability, and generate a link without paying. If preview policy requires seeded reviewer credentials, ask for a public-data exemption or guidance. Supply any later required credentials securely through the console, with no 2FA dependency, never through this document.

**UI:** Plain-text results and site links in v1. No MCP App UI is claimed. A later interactive UI requires separate testing and policy review.

**Public information:** Website `https://duoly.gg`; privacy `https://duoly.gg/privacy`; terms `https://duoly.gg/terms`; planned documentation `https://duoly.gg/developers/mcp`; planned user guide `https://duoly.gg/ai`. Verify planned URLs after deployment.

## Console and launch gates

- Apply through the [Connected Apps Platform](https://developers.google.com/connected-apps) preview route. Admission is phased. The API prompt panel in this PR is unrelated to consumer Connected Apps enrollment.
- Follow [prerequisites](https://developers.google.com/connected-apps/gpc/prerequisites) and [register, test and publish](https://developers.google.com/connected-apps/gpc/perform-the-steps). Domain verification requires the console challenge at `/.well-known/google-connected-apps`, direct HTTP 200 without redirect. This PR adds no challenge or site route.
- Prepare actual company and review contacts, approved icon and screenshots, geography matrix, policy URLs, tool snapshot and release details. Add only approved preview testers while unpublished.
- Resolve the no-auth public-data question before adding OAuth. The [OAuth guide](https://developers.google.com/connected-apps/mcp/oauth) and newer console instructions differ on DCR versus CIMD or static clients. Obtain Google's integration-specific answer. Do not claim existing Supabase social login satisfies MCP OAuth.
- Follow [Connected Apps policies](https://developers.google.com/connected-apps/connected-apps-policy), especially truthful static tool declarations, user-generated-content moderation and sensitive-action confirmation. V1 has no financial action tool. Ask explicitly whether the link handoff is eligible.
- Run the full reviewer plan against the production endpoint, including no inventory, unsupported service, Social exclusion, price change, malformed input and rate limits. Record results, not promises.
- Owner approves the application, confirms category and country eligibility, resolves review feedback and publishes only after approval. Ready to publish and published are different states. No review timeline is assumed.
