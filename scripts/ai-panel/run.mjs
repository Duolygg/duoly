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
import { ask, estimate, providers, request } from './providers.mjs';

const { console, URL } = globalThis;
const args = process.argv.slice(2);
const allowed = new Set(['--local-keychain', '--dry-run']);
if (args.some((arg) => !allowed.has(arg)))
  throw new Error('Options: --local-keychain --dry-run');
const local =
  args.includes('--local-keychain') &&
  process.platform === 'darwin' &&
  !process.env.CI;
const dry = args.includes('--dry-run');
const source = await readFile(
  new URL('./prompts.json', import.meta.url),
  'utf8',
);
const prompts = JSON.parse(source);
if (prompts.length !== 20 || new Set(prompts.map((p) => p.id)).size !== 20)
  throw new Error('Expected 20 unique prompts');
const promptSetHash = createHash('sha256').update(source).digest('hex');
const runId = new Date().toISOString().replaceAll(':', '-');
const repo = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
const outputDir = join(homedir(), 'Desktop/Duoly/ai-agents-research/panel');
await mkdir(outputDir, { recursive: true, mode: 0o700 });
const actualDir = await realpath(outputDir);
if (!relative(repo, actualDir).startsWith('..'))
  throw new Error('Panel output must stay outside the repository');
const outputFile = join(actualDir, `${runId}${dry ? '-dry-run' : ''}.jsonl`);
const budget = Number(process.env.AI_PANEL_BUDGET_USD ?? 5);
if (!Number.isFinite(budget) || budget <= 0 || budget > 10)
  throw new Error('Budget must be above 0 and at most USD 10');
// Conservative request reservation. This is a local guard, not a provider billing hard limit.
const reservation = 0.15;
let reserved = 0;
const rows = [];
const skips = {};

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

for (const [provider, config] of Object.entries(providers)) {
  let key = dry ? '' : process.env[config.env];
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
  if (provider === 'gemini') {
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
  for (const prompt of prompts.slice(0, 20)) {
    const row = {
      runId,
      date: new Date().toISOString(),
      provider,
      model: config.model,
      surface: 'API search-grounded panel',
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
      reserved += reservation;
      try {
        const result = await ask(provider, key, prompt.prompt);
        Object.assign(row, result, analyze(result.answer, result.citedUrls), {
          status: result.answer.trim() ? 'answered' : 'error',
          estimatedUsd: estimate(provider, result),
          pricingSnapshot: '2026-11-06',
        });
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
const summary = summarize(stored);
const report = {
  runId,
  promptSetHash,
  surface: 'API panel, not consumer assistant UI rankings',
  budgetUsd: budget,
  reservedUsd: reserved,
  outputFile,
  providers: summary,
  skippedProviders: skips,
};
await writeFile(
  join(actualDir, `${runId}${dry ? '-dry-run' : ''}-summary.json`),
  `${JSON.stringify(report, null, 2)}\n`,
  { mode: 0o600 },
);
console.table(
  summary.map((p) => ({
    provider: p.provider,
    attempted: p.attempted,
    answered: p.answered,
    duolyMentioned: p.mentioned,
    duolyCited: p.cited,
    topCompetitors: p.competitors
      .slice(0, 3)
      .map((c) => `${c.brand}: ${c.count}`)
      .join(', '),
    estimatedUsd: p.estimatedUsd.toFixed(6),
    unknownCostRequests: p.unknownCostRequests,
  })),
);
console.log(JSON.stringify(report, null, 2));
console.log(
  'Costs are estimates before credits and taxes. Failed requests may have unknown charges. Check provider billing.',
);
if (stored.some((row) => row.status === 'error')) process.exitCode = 1;
