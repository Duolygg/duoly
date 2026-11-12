import { execFileSync } from 'node:child_process';
import {
  readFile,
  mkdir,
  appendFile,
  writeFile,
  realpath,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { analyze, summarize } from './analysis.mjs';
import { aggregateFanOut } from './fanout.mjs';
import { replay, replayFanOut } from './fixtures.mjs';
import { buildFanOutReport, buildReport } from './report.mjs';
import {
  ask,
  askFanOut,
  estimate,
  fanOutMaxToolCalls,
  providers,
  request,
} from './providers.mjs';

const { console, URL } = globalThis;
const args = process.argv.slice(2);
const allowed = new Set([
  '--local-keychain',
  '--dry-run',
  '--fixtures',
  '--fan-out',
  '--perplexity',
]);
if (args.some((arg) => !allowed.has(arg)))
  throw new Error(
    'Options: --local-keychain --dry-run --fixtures --fan-out --perplexity',
  );
const local =
  args.includes('--local-keychain') &&
  process.platform === 'darwin' &&
  !process.env.CI;
// Fixture replay is a dry run with parsing: saved payloads, no credential, no network.
const fixtures = args.includes('--fixtures');
const dry = args.includes('--dry-run') || fixtures;
// Fan-out mode records the searches ChatGPT runs for five key prompts instead of
// collecting the full panel.
const fanOut = args.includes('--fan-out');
// Perplexity needs a logged-in account. Logged out it answered once and then demanded a
// sign-up, which is why it was excluded from the 2026-11-09 baseline.
const perplexityEnabled = args.includes('--perplexity');
const promptFile = fanOut ? './fanout-prompts.json' : './prompts.json';
const source = await readFile(new URL(promptFile, import.meta.url), 'utf8');
const prompts = JSON.parse(source);
const expected = fanOut ? 5 : 20;
if (
  prompts.length !== expected ||
  new Set(prompts.map((p) => p.id)).size !== expected
)
  throw new Error(`Expected ${expected} unique prompts`);
const promptSetHash = createHash('sha256').update(source).digest('hex');
const runId = new Date().toISOString().replaceAll(':', '-');
const repo = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
const outputDir = join(homedir(), 'Desktop/Duoly/ai-agents-research/panel');
await mkdir(outputDir, { recursive: true, mode: 0o700 });
const actualDir = await realpath(outputDir);
if (!relative(repo, actualDir).startsWith('..'))
  throw new Error('Panel output must stay outside the repository');
const suffix = `${fanOut ? '-fanout' : ''}${fixtures ? '-fixtures' : dry ? '-dry-run' : ''}`;
const outputFile = join(actualDir, `${runId}${suffix}.jsonl`);
const budget = Number(process.env.AI_PANEL_BUDGET_USD ?? 5);
if (!Number.isFinite(budget) || budget <= 0 || budget > 10)
  throw new Error('Budget must be above 0 and at most USD 10');
// Conservative request reservation. This is a local guard, not a provider billing hard
// limit. Fan-out reserves more because one prompt may run several searches.
const reservation = fanOut ? 0.25 : 0.15;
let reserved = 0;
const rows = [];
const skips = {};
const surface = fixtures
  ? 'fixture replay'
  : fanOut
    ? 'API search-grounded fan-out trace'
    : 'API search-grounded panel';

function keychain(...parameters) {
  if (!local || dry) return '';
  try {
    return execFileSync('security', ['find-generic-password', ...parameters], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10000,
    }).trim();
  } catch {
    return '';
  }
}

const selected = Object.entries(providers).filter(
  ([provider]) => !fanOut || provider === 'openai',
);
for (const [provider, config] of selected) {
  if (config.requiresSession && !perplexityEnabled) {
    skips[provider] =
      `off by default: needs a logged-in ${provider} session, pass ${config.enableFlag}`;
    continue;
  }
  let key = fixtures ? 'fixture-replay' : dry ? '' : process.env[config.env];
  if (!key && provider === 'openai')
    key = keychain('-s', 'duoly-openai-api-key', '-a', 'sparky', '-w');
  if (!key && provider === 'gemini') {
    const metadata = keychain('-s', 'gemini');
    const account = metadata.match(/"acct"<blob>="([^"]+)"/)?.[1];
    if (account) key = keychain('-s', 'gemini', '-a', account, '-w');
  }
  if (!key) {
    skips[provider] = dry ? 'dry run' : 'no eligible key';
    continue;
  }
  if (provider === 'gemini' && !fixtures) {
    if (!/^AIza[\w-]{30,}$/.test(key)) {
      skips[provider] = 'credential is not a Gemini API key';
      continue;
    }
    try {
      await request(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.model}`,
        '',
        undefined,
        { 'x-goog-api-key': key, Authorization: '' },
      );
    } catch {
      skips[provider] = 'Gemini key or model validation failed';
      continue;
    }
  }
  let stopped = '';
  for (const prompt of prompts.slice(0, expected)) {
    const row = {
      runId,
      date: new Date().toISOString(),
      provider,
      engine: config.engine,
      mode: fanOut ? 'fan-out' : 'panel',
      model: config.model,
      surface,
      country: 'uncontrolled',
      personalization: 'new stateless request',
      installedApps: [],
      promptSetHash,
      ...prompt,
      status: 'skipped',
      estimatedUsd: 0,
    };
    if (!stopped && reserved + reservation > budget + 1e-9)
      stopped = 'local budget reservation exhausted';
    if (stopped) row.reason = stopped;
    else {
      if (!fixtures) reserved += reservation;
      try {
        const result = fixtures
          ? fanOut
            ? await replayFanOut(prompt.id)
            : await replay(provider, prompt.id)
          : fanOut
            ? await askFanOut(key, prompt.prompt)
            : await ask(provider, key, prompt.prompt);
        Object.assign(
          row,
          result,
          analyze(result.answer, result.sources),
          fanOut
            ? {
                openedDomains: result.openedSources
                  .map((entry) => entry.domain)
                  .filter(Boolean),
                openedUrls: result.openedSources
                  .map((entry) => entry.url)
                  .filter(Boolean),
                maxToolCalls: fanOutMaxToolCalls,
              }
            : {},
          {
            status: result.answer.trim() ? 'answered' : 'error',
            estimatedUsd: fixtures ? 0 : estimate(provider, result),
            pricingSnapshot: '2026-11-06',
          },
        );
        if (!result.answer.trim()) {
          row.reason = 'empty answer';
          stopped = 'empty answer from provider';
        }
      } catch (error) {
        // Only our own sanitized HTTP status is retained. Network exceptions can contain request data.
        row.status = 'error';
        row.estimatedUsd = null;
        row.reason = /^HTTP \d{3}$/.test(error.message)
          ? error.message
          : 'request failed or timed out';
        stopped = 'provider stopped after first failure; no automatic retries';
      }
    }
    rows.push(row);
    await appendFile(outputFile, `${JSON.stringify(row)}\n`, { mode: 0o600 });
    console.log(`${provider}: ${prompt.id}: ${row.status}`);
  }
}
if (!rows.length) await writeFile(outputFile, '', { mode: 0o600 });
// Read back the actual persisted batch before counting. Partial runs remain recoverable.
const stored = (await readFile(outputFile, 'utf8'))
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const meta = {
  runId,
  promptSetHash,
  outputFile,
  fixtures,
  skippedProviders: skips,
  maxToolCalls: fanOutMaxToolCalls,
};
const summary = fanOut ? aggregateFanOut(stored) : summarize(stored);
const report = {
  runId,
  mode: fanOut ? 'fan-out' : 'panel',
  promptSetHash,
  surface: fixtures
    ? 'fixture replay, measures the harness and not an engine'
    : 'API panel, not consumer assistant UI rankings',
  budgetUsd: budget,
  reservedUsd: reserved,
  outputFile,
  ...(fanOut ? { fanOut: summary } : { providers: summary }),
  skippedProviders: skips,
};
await writeFile(
  join(actualDir, `${runId}${suffix}-summary.json`),
  `${JSON.stringify(report, null, 2)}\n`,
  { mode: 0o600 },
);
// The ladder report is the artifact the next run is compared against.
const markdownFile = join(actualDir, `${runId}${suffix}-report.md`);
await writeFile(
  markdownFile,
  fanOut ? buildFanOutReport(stored, meta) : buildReport(stored, meta),
  { mode: 0o600 },
);
if (fanOut)
  console.table(
    summary.domains.slice(0, 20).map((domain) => ({
      domain: domain.domain,
      promptsSearched: domain.searchedInPrompts,
      openedLinks: domain.opens,
      promptsCited: domain.citedInPrompts,
    })),
  );
else
  console.table(
    summary.map((p) => ({
      provider: p.provider,
      attempted: p.attempted,
      answered: p.answered,
      duolyCited: p.ladder.cited,
      duolyNamed: p.ladder.named,
      duolyRecommended: p.ladder.recommended,
      framing:
        p.ladder.framing.map((flag) => `${flag.label}: ${flag.count}`).join(', ') ||
        'none',
      estimatedUsd: p.estimatedUsd.toFixed(6),
      unknownCostRequests: p.unknownCostRequests,
    })),
  );
console.log(JSON.stringify(report, null, 2));
console.log(`Report: ${markdownFile}`);
console.log(
  'Costs are estimates before credits and taxes. Failed requests may have unknown charges. Check provider billing.',
);
if (stored.some((row) => row.status === 'error')) process.exitCode = 1;
