# Monthly AI answer panel

Dependency-free Node 24 scripts for a fixed set of 20 English and German prompts. These are API search-grounded answers, not observations of ChatGPT, Claude, Gemini or Perplexity consumer interfaces. No Duoly MCP connector is installed or exposed to these requests.

## Run locally each month

From the repository root:

```sh
export PATH="$HOME/.hermes/tools/node-v24.21.0-darwin-arm64/bin:$PATH"
node scripts/ai-panel/run.mjs --dry-run
node --test scripts/ai-panel/panel.test.mjs
node scripts/ai-panel/run.mjs --local-keychain
```

`--local-keychain` permits macOS Keychain reads only on macOS outside CI. Without it, the script reads environment credentials only. Dry run never reads credentials or calls an API. Never copy keys into the repository, results or chat.

- OpenAI: `OPENAI_API_KEY` or Keychain service `duoly-openai-api-key`, account `sparky`. The script executes `security find-generic-password -s duoly-openai-api-key -a sparky -w` internally and never prints its output.
- Gemini: `GEMINI_API_KEY`, or Keychain service `gemini`. The script first reads service metadata without `-w`, extracts the account, then reads the secret internally. It skips credentials that are not Google API key shaped and validates model access with a non-generating API read. OAuth credentials stored under that service are not Gemini API keys.
- Anthropic: `ANTHROPIC_API_KEY` only. Adapter uses the native web search tool.
- Perplexity: `PERPLEXITY_API_KEY` only. Adapter uses synchronous Sonar compatibility requests with low search context. [Current migration guidance](https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview) says these requests continue through Agent API reformulation after Sonar support ended. Returned model and usage are retained. Costs use `usage.cost.total_cost` when returned and remain unknown otherwise. This compatibility surface is not a consumer Perplexity UI baseline.

All available providers run with up to 20 prompts each. Do not export an optional key unless that provider should be included. There are no automatic retries and no automatic model upgrades. The first request failure stops further requests to that provider and writes skipped rows for the remaining prompts. Missing or ineligible credentials appear in the summary as skipped providers. No dotenv files or credential files are read.

## Storage and method

Each run appends individual completed observations to:

```text
~/Desktop/Duoly/ai-agents-research/panel/<UTC-run-id>.jsonl
```

A sibling `<UTC-run-id>-summary.json` holds the counts, cost estimate and skip reasons. Output is outside the repository, with private file permissions. Dry runs use a separate filename suffix. Completed rows survive interruptions. A final read-back of the JSONL file produces the summary, avoiding counts from an incomplete in-memory batch.

Each observation includes date, provider, requested and returned model, exact prompt, prompt ID, locale, intent, prompt file hash, full answer text, cited URLs, actual search evidence, completion flag, usage and cost estimate. Requests are independent with no shared conversation or installed apps. Country and provider-side personalization are uncontrolled. Prompt language is recorded rather than pretending to set a consumer UI locale.

Keep prompt text, IDs and ordering stable. The file hash records exact prompt file bytes, including formatting. Baseline was captured before initial Prettier formatting; later file hashes differ even though all 20 prompt texts and IDs are unchanged. Compare semantic prompt fields as well as hashes. Review free, generic, paid and coaching cohorts separately. New questions should create a clearly versioned cohort instead of silently replacing this panel.

### Outcome definitions

- `duolyMentioned`: whole-word Duoly or Duoly.gg in answer text. `duolyDomainMentioned` specifically detects Duoly.gg.
- `duolyCited`: a structured citation URL whose parsed hostname is duoly.gg or a true subdomain. A mention is independent of a citation.
- `firstMentionRank`: one-based order of the first Duoly mention among distinct tracked brands in the answer. Repeated brands count once. This is not a recommended-service rank, search ranking or proof of endorsement. `firstMentionCharacter` is the zero-based text offset; absent mentions have null values.
- Competitor counts: number of answered prompts mentioning each tracked brand at least once. Tracked brands are epal, fiverr, tapin, metafy, gamerspal, playerduo, lfcarry, discord and reddit. Discord and Reddit are community alternatives. Lexical matching can include incidental or ambiguous mentions, including the phrase tap in. Manually review before drawing commercial conclusions.
- `searched` records evidence that the provider searched. OpenAI requires its web search tool. Gemini and optional adapters may choose not to search, even with tools available. `complete` flags token truncation or other incomplete responses. Nonempty incomplete answers remain in the answered denominator and should be examined separately.

Only structured provider citations are counted, not every URL string in answer prose. Gemini may return Google grounding redirect URLs. They are retained as returned and are not silently resolved or treated as Duoly citations. Consequently direct-domain citation detection can undercount Gemini citations. Inspect redirects manually before a citation conclusion. No responses are rewritten to make a brand appear.

## Cost controls

Defaults: OpenAI `gpt-6-luna`, Gemini `gemini-2.5-flash-lite`, optional Anthropic `claude-haiku-5-5`, optional Perplexity `sonar`. Models are deliberately inexpensive search-capable options. No fallback to a more expensive model occurs.

Each request has a 1,800 output-token limit and a 90-second timeout. OpenAI has one hosted tool-call limit and Anthropic web search has one use limit. Gemini 2.5 bills grounded prompts and may issue several search queries for one prompt. The script stops scheduling calls when its USD 0.15 per-request reservation would exceed `AI_PANEL_BUDGET_USD` (default USD 5, maximum USD 10). With all four providers and 20 prompts each, the default may skip later providers. Use a deliberate higher budget up to the maximum when needed.

This is a local scheduling guard, not a hard billing ceiling. Provider search inputs can add tokens, failed or timed-out requests may have incurred charges, and dashboard quotas remain the real account control. Summary marks failed-request costs unknown rather than zero. Estimates use reported token usage and observed search counts, without claiming billing precision, taxes or credits. Never rerun a failed full batch automatically.

Pricing snapshot checked 6 November 2026:

| Provider                       | Input USD per million tokens | Output USD per million tokens | Search estimate                                                    |
| ------------------------------ | ---------------------------- | ----------------------------- | ------------------------------------------------------------------ |
| OpenAI Luna                    | 0.10                         | 0.50                          | USD 0.01 per web search call, search content billed at model rates |
| Gemini 2.5 Flash-Lite          | 0.10                         | 0.40                          | USD 0.035 per grounded prompt before free allowances               |
| Anthropic Haiku 5.5            | 0.10                         | 0.50                          | USD 0.01 per search, for prompts up to 100,000 tokens              |
| Perplexity Sonar compatibility | Provider-reported            | Provider-reported             | Returned total cost or unknown, no historical tariff assumed       |

Sources: [OpenAI pricing](https://developers.openai.com/api/docs/pricing), [Luna capabilities](https://developers.openai.com/api/docs/models/gpt-6-luna), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing), [Perplexity pricing](https://docs.perplexity.ai/getting-started/pricing). Optional adapters were not exercised in the baseline and their estimates require rechecking before use. Free Gemini allowances are deliberately not deducted because other project usage is unknown. Review current rates before each monthly run and update `providers.mjs` if needed.

## Baseline: 6 November 2026

Run ID: `2026-11-06T08-08-31.822Z`.

| Provider   | Model      | Answered | Duoly mentions | Duoly citations | Leading tracked brands                   | Estimated USD |
| ---------- | ---------- | -------- | -------------- | --------------- | ---------------------------------------- | ------------- |
| OpenAI     | gpt-6-luna | 20       | 0              | 0               | Discord 10, Reddit 2, Fiverr 1, Metafy 1 | 0.2193883     |
| Gemini     | Not run    | 0        | Not measured   | Not measured    | Not measured                             | 0             |
| Anthropic  | Not run    | 0        | Not measured   | Not measured    | Not measured                             | 0             |
| Perplexity | Not run    | 0        | Not measured   | Not measured    | Not measured                             | 0             |

Gemini was skipped because the available Keychain credential was not a Gemini API key. Optional environment keys were absent. This is a valid OpenAI-only baseline, not evidence of Duoly absence in Gemini or any consumer assistant. Estimated total is USD 0.2193883 before taxes or billing adjustments. Raw answers and usage remain in the external research directory.

## Monthly review

Read the new summary and inspect raw answers for factual accuracy, incidental brand mentions, missing search evidence and incomplete answers. Compare like-for-like prompt cohorts and requested models. Retain missing-provider and failed-request records. A brand mention does not establish a recommendation. Track referred visits and completed bookings separately using authorized analytics; this script changes no analytics settings and sends no customer data.
