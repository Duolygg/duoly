// Owner-operated consumer capture. Never submits a query or logs in automatically.
import { chromium } from '@playwright/test';
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import {
  readFile,
  appendFile,
  writeFile,
  mkdir,
  realpath,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve, relative } from 'node:path';
import { homedir } from 'node:os';
import { analyze } from './analysis.mjs';
import {
  parseBrowserCapture,
  parseChatGPTTrace,
  parseTraceBody,
} from './browser-capture.mjs';
import { buildReport, buildFanOutReport } from './report.mjs';

const { console, URL } = globalThis;
const { values: flags } = parseArgs({
  options: {
    engine: { type: 'string', default: 'google-ai-mode' },
    prompts: { type: 'string' },
    cdp: { type: 'string', default: 'http://127.0.0.1:9222' },
    'answer-selector': { type: 'string' },
    'sources-selector': { type: 'string' },
    'fan-out': { type: 'boolean', default: false },
    perplexity: { type: 'boolean', default: false },
    'logged-in-session': { type: 'boolean', default: false },
    fixtures: { type: 'boolean', default: false },
    output: { type: 'string' },
  },
});
const engine = flags.engine;
if (!['google-ai-mode', 'chatgpt', 'perplexity-browser'].includes(engine))
  throw new Error('Unknown consumer engine');
if (
  engine === 'perplexity-browser' &&
  !(flags.perplexity && flags['logged-in-session'])
)
  throw new Error(
    'Perplexity is off: requires --perplexity --logged-in-session and an already logged-in browser.',
  );
if (flags['fan-out'] && engine !== 'chatgpt')
  throw new Error('Fan-out requires --engine chatgpt');
const source = flags['fan-out']
  ? await readFile(new URL('./fanout-prompts.json', import.meta.url), 'utf8')
  : flags.fixtures
    ? JSON.stringify([
        {
          id: 'fixture',
          prompt: 'Synthetic parser fixture',
          locale: 'en-US',
          intent: 'Trust',
        },
      ])
    : await readFile(
        flags.prompts ??
          (() => {
            throw new Error(
              'Supply the original 29-prompt prompts-v1.json with --prompts; the 20-prompt API portfolio is NOT the baseline.',
            );
          })(),
        'utf8',
      );
const prompts = JSON.parse(source);
const expected = flags['fan-out'] ? 5 : flags.fixtures ? 1 : 29;
if (
  prompts.length !== expected ||
  new Set(prompts.map((p) => p.id)).size !== expected ||
  prompts.some((p) => !p.id || !p.prompt || !p.intent || !p.locale)
)
  throw new Error(
    `Expected ${expected} unique prompts with id, prompt, intent (baseline topic), locale`,
  );
const repeats = flags['fan-out'] ? 1 : 2;
const output = resolve(
  flags.output ?? join(homedir(), 'Desktop/Duoly/ai-agents-research/panel'),
);
await mkdir(output, { recursive: true, mode: 0o700 });
const repo = await realpath(new URL('../../', import.meta.url));
if (!relative(repo, await realpath(output)).startsWith('..'))
  throw new Error('Output must be outside repository');
const runId = new Date().toISOString().replaceAll(':', '-');
const file = join(
  output,
  `${runId}-${engine}${flags['fan-out'] ? '-fanout' : ''}${flags.fixtures ? '-fixtures' : ''}.jsonl`,
);
const meta = {
  runId,
  fixtures: flags.fixtures,
  promptSetHash: createHash('sha256').update(source).digest('hex'),
  outputFile: file,
};
let browser, rl;
try {
  let page;
  if (!flags.fixtures) {
    if (!flags['answer-selector'] || !flags['sources-selector'])
      throw new Error(
        'Inspect current UI and supply --answer-selector and --sources-selector scoped to the latest answer and its expanded sources, not page-wide links.',
      );
    const endpoint = new URL(flags.cdp);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname))
      throw new Error('CDP must be local');
    browser = await chromium.connectOverCDP(flags.cdp);
    const hosts = {
      chatgpt: 'chatgpt.com',
      'google-ai-mode': 'google.com',
      'perplexity-browser': 'perplexity.ai',
    };
    const pages = browser
      .contexts()
      .flatMap((context) => context.pages())
      .filter((p) => {
        try {
          const host = new URL(p.url()).hostname;
          return host === hosts[engine] || host.endsWith(`.${hosts[engine]}`);
        } catch {
          return false;
        }
      });
    if (pages.length !== 1)
      throw new Error('Keep exactly one target engine tab open');
    [page] = pages;
    rl = createInterface({ input: process.stdin, output: process.stdout });
  }
  for (const prompt of prompts)
    for (let repeat = 1; repeat <= repeats; repeat++) {
      let result,
        trace = {},
        sessionState = 'synthetic fixture';
      if (flags.fixtures) {
        result = parseBrowserCapture(
          JSON.parse(
            await readFile(
              new URL('./fixtures/google-ai-mode.json', import.meta.url),
              'utf8',
            ),
          ),
        );
        if (flags['fan-out'])
          trace = parseChatGPTTrace(
            JSON.parse(
              await readFile(
                new URL('./fixtures/chatgpt-trace.json', import.meta.url),
                'utf8',
              ),
            ),
          );
      } else {
        console.log(
          `\n${prompt.id}, run ${repeat}/${repeats}: ${prompt.prompt}`,
        );
        console.log(
          'Create a fresh conversation, set en-US, submit the exact prompt, wait for completion, expand ALL cited sources. Do not reuse another answer.',
        );
        const captured = [];
        const pending = new Set();
        const listener = (response) => {
          const url = new URL(response.url());
          if (
            url.hostname !== 'chatgpt.com' ||
            !url.pathname.startsWith('/backend-api/') ||
            !/conversation/.test(url.pathname)
          )
            return;
          const work = response
            .text()
            .then((text) =>
              captured.push(parseChatGPTTrace(parseTraceBody(text))),
            )
            .catch(() => {});
          pending.add(work);
          void work.finally(() => pending.delete(work));
        };
        if (flags['fan-out']) page.on('response', listener);
        try {
          const ready = await rl.question(
            'After the answer and sources are fully loaded, type capture (or skip): ',
          );
          if (ready !== 'capture') {
            await appendFile(
              file,
              JSON.stringify({
                ...prompt,
                runId,
                provider: engine,
                repeat,
                status: 'skipped',
                reason: 'owner skipped',
                surface: 'consumer browser',
              }) + '\n',
              { mode: 0o600 },
            );
            continue;
          }
          sessionState = await rl.question(
            'Session state (logged-out/logged-in): ',
          );
          if (!['logged-out', 'logged-in'].includes(sessionState))
            throw new Error('Explicit session state required');
          if (engine === 'perplexity-browser' && sessionState !== 'logged-in')
            throw new Error('Perplexity requires logged-in session');
          const answer = page.locator(flags['answer-selector']);
          if ((await answer.count()) !== 1)
            throw new Error(
              'Answer selector must match exactly one current answer',
            );
          const sourceLinks = await page
            .locator(flags['sources-selector'])
            .evaluateAll((nodes) =>
              nodes.map((node) => ({
                url: node.href,
                title: node.textContent?.trim(),
              })),
            );
          result = parseBrowserCapture({
            answer: await answer.innerText(),
            sourceLinks,
            sourcesExpanded: true,
            answerComplete: true,
          });
          // SSE streams may not terminate. Never hang or infer unseen queries.
          await Promise.race([
            Promise.all([...pending]),
            new Promise((r) => globalThis.setTimeout(r, 2000)),
          ]);
          trace = {
            queries: [...new Set(captured.flatMap((t) => t.queries))],
            searchedDomains: [
              ...new Set(captured.flatMap((t) => t.searchedDomains)),
            ],
            openedDomains: [
              ...new Set(captured.flatMap((t) => t.openedDomains)),
            ],
            openedUrls: [...new Set(captured.flatMap((t) => t.openedUrls))],
            traceAvailable: captured.some((t) => t.traceAvailable),
          };
        } finally {
          page.off('response', listener);
        }
      }
      const row = {
        ...prompt,
        ...result,
        ...trace,
        ...analyze(result.answer, result.sources),
        runId,
        date: new Date().toISOString(),
        provider: engine,
        repeat,
        surface: flags.fixtures ? 'fixture replay' : 'consumer browser',
        sessionState,
        promptSetHash: meta.promptSetHash,
        mode: flags['fan-out'] ? 'fan-out' : 'panel',
        status: 'answered',
        estimatedUsd: 0,
      };
      await appendFile(file, JSON.stringify(row) + '\n', { mode: 0o600 });
    }
  const rows = (await readFile(file, 'utf8'))
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const report = flags['fan-out']
    ? buildFanOutReport(rows, meta)
    : buildReport(rows, meta);
  await writeFile(file.replace(/\.jsonl$/, '-report.md'), report, {
    mode: 0o600,
  });
  console.log(report);
  console.log(`Raw: ${file}`);
} finally {
  rl?.close();
  // Disconnect Playwright; do not close the owner's browser or tabs.
  if (browser) await browser.close();
}
