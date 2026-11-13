# GEO consumer measurement and monthly API panel

## Consumer baseline rerun (23 November)

Use `browser-run.mjs` for actual Google AI Mode and ChatGPT observations. **Gemini API is not Google AI Mode, and OpenAI API search is not ChatGPT.** The API panel below remains a separate cohort, never a replacement for the 9 November browser baseline.

This is an owner-operated capture workflow: it never submits a prompt, navigates an engine, reads credentials or logs in. It attaches to a local Chrome debugging endpoint, shows each exact prompt, and waits for the owner to submit it in a fresh conversation. After the answer finishes, expand all citation/source cards and type `capture`. It records the answer plus only the source-link anchors selected for that answer. A changed UI fails visibly rather than guessing selectors and counting unrelated page links. `skip` preserves a skipped observation rather than counting an absent brand.

Prepare a dedicated local Chrome profile with remote debugging enabled on localhost (do not expose CDP to the network). Keep exactly one target engine tab open. For example, on macOS:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.hermes/cache/scratch/geo-panel-browser"
```

Do not use your normal browsing profile. For baseline comparability, use logged-out fresh browser sessions, en-US, and no installed connectors. Close prior conversations, clear engine site data between prompts, and retain only one target tab. The runner records the owner's explicit session-state declaration; it cannot prove session freshness or disable personalization. Do not change accounts or log in as part of an automated run.

The original `prompts-v1.json` (29 prompts) and raw `baseline-2026-11-09.jsonl` referenced by the research note are **not present in this worktree or the available research directory**. Supply the original prompt file; do not reconstruct it from topic names or substitute this repo's 20-prompt `prompts.json`. Required fields are `id`, `prompt`, `locale`, `intent` (use the baseline topic names). Two repetitions are recorded per prompt, producing 58 observations per engine when none are skipped. The exact prompt-file SHA-256 travels with every row.

Inspect the current engine DOM and choose CSS selectors for exactly the latest answer text and its expanded source-link anchors. These are deliberately required arguments, not undocumented brittle selectors:

```sh
export PATH="$HOME/.hermes/tools/node-v24.21.0-darwin-arm64/bin:$PATH"
node scripts/ai-panel/browser-run.mjs --engine google-ai-mode \
  --prompts /absolute/path/to/prompts-v1.json \
  --answer-selector 'CURRENT_ANSWER_SELECTOR' \
  --sources-selector 'CURRENT_EXPANDED_SOURCES_SELECTOR a[href]'
# Repeat with --engine chatgpt for the same 29-prompt portfolio.

node scripts/ai-panel/browser-run.mjs --engine chatgpt --fan-out \
  --answer-selector 'CURRENT_ANSWER_SELECTOR' \
  --sources-selector 'CURRENT_EXPANDED_SOURCES_SELECTOR a[href]'
```

Fan-out uses exactly these five prompts, once each: `best site to find a gaming duo`, `paid gaming teammate`, `League of Legends coaching online`, `is Duoly legit`, `Duoly vs Metafy`. Start the runner **before** submitting each prompt. It observes ChatGPT conversation response metadata (JSON or SSE), retaining only search queries, retrieved source domains, explicit page opens, and citation links. Raw conversation payloads and private reasoning are never written. Consumer metadata is undocumented and may not be exposed: `traceAvailable: false` means unknown, not zero searches. The report shows trace coverage and ranks retrieved, explicitly opened, and cited domains separately. A retrieved search result is not evidence of an explicit open. No synthetic search is substituted for missing metadata.

**Sessions:** Google AI Mode and ChatGPT can be captured logged out when their UI permits it. ChatGPT may require an already logged-in session to expose search metadata; record that condition and keep it separate from the logged-out baseline. Perplexity is excluded by default and refuses to run unless both `--engine perplexity-browser --perplexity --logged-in-session` are supplied and the owner confirms `logged-in` at capture time. It requires an already configured logged-in browser; this tool never handles login. The separate API adapter uses an API key plus `--perplexity`, not a consumer login.

Each consumer run appends private JSONL outside the repository and reads it back to create a baseline-shaped Markdown report: ladder per engine (cited, named, recommended, framing), named/runs by topic, brands named, citation domains and framing evidence. Recommendation and framing are conservative lexical heuristics requiring human review, not endorsed facts. Google source URLs are stored verbatim, including redirect wrappers; transparent Google `/url` destinations are parsed without fetching. Missing or unexpanded sources must not be interpreted as a measured citation absence.

### Offline verification (no accounts, no API calls)

```sh
node --test scripts/ai-panel/*.test.mjs
node scripts/ai-panel/browser-run.mjs --fixtures
node scripts/ai-panel/browser-run.mjs --fixtures --engine chatgpt --fan-out
node scripts/ai-panel/run.mjs --fixtures
node scripts/ai-panel/run.mjs --fixtures --fan-out
# Explicit opt-in here replays Perplexity fixtures, never uses a session:
node scripts/ai-panel/run.mjs --fixtures --perplexity
node scripts/ai-panel/report.mjs /absolute/path/to/run.jsonl
```

All saved fixtures are **synthetic parser examples**, not captured engine observations. Fixture outputs are labeled accordingly. `pnpm test:unit` includes the Node parser suite through `tests/unit/ai-panel.test.ts`. Offline tests cover answer-scoped citations, redirect domains, misleading domain metadata, blocked/empty answers, actual query fields versus reasoning text, separate retrieved/opened/cited domain ranks, repeated denominators and both consumer fixture CLIs. Live extraction is deliberately untested against engine accounts: the owner must confirm current selectors and exposed metadata before the next measurement.

## Monthly API answer panel (separate cohort)

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
