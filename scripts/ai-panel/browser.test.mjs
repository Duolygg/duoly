import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseTraceBody } from './browser-capture.mjs';
import { parseBrowserCapture, parseChatGPTTrace } from './browser-capture.mjs';
import { analyze } from './analysis.mjs';

const { URL } = globalThis;

test('SSE search metadata retains queries without saving reasoning or invalid events', () => {
  const events = parseTraceBody(
    'data: {"search_queries":[{"q":"real observable query"}],"text":"private reasoning"}\n\ndata: [DONE]\n',
  );
  const trace = parseChatGPTTrace(events);
  assert.deepEqual(trace.queries, ['real observable query']);
  assert.equal(JSON.stringify(trace).includes('private reasoning'), false);
  assert.equal(
    parseChatGPTTrace({ text: 'invented search for Duoly' }).traceAvailable,
    false,
  );
});

test('consumer fixture CLI reads back two runs and the exact five fan-out prompts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'geo-fixtures-'));
  try {
    for (const args of [[], ['--engine', 'chatgpt', '--fan-out']]) {
      execFileSync(
        process.execPath,
        [
          'scripts/ai-panel/browser-run.mjs',
          '--fixtures',
          '--output',
          dir,
          ...args,
        ],
        { encoding: 'utf8' },
      );
    }
    const files = await readdir(dir);
    const panel = files.find(
      (f) => f.endsWith('.jsonl') && f.includes('google-ai-mode'),
    );
    const fanout = files.find(
      (f) => f.endsWith('.jsonl') && f.includes('chatgpt'),
    );
    const readRows = async (file) =>
      (await readFile(join(dir, file), 'utf8'))
        .trim()
        .split('\n')
        .map(JSON.parse);
    assert.equal((await readRows(panel)).length, 2);
    const rows = await readRows(fanout);
    assert.deepEqual(
      rows.map((r) => r.prompt),
      [
        'best site to find a gaming duo',
        'paid gaming teammate',
        'League of Legends coaching online',
        'is Duoly legit',
        'Duoly vs Metafy',
      ],
    );
    assert.ok(
      rows.every((r) => r.surface === 'fixture replay' && r.traceAvailable),
    );
    assert.equal(files.filter((f) => f.endsWith('-report.md')).length, 2);
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [
            'scripts/ai-panel/browser-run.mjs',
            '--fixtures',
            '--engine',
            'perplexity-browser',
            '--output',
            dir,
          ],
          { stdio: 'pipe' },
        ),
      /Command failed/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Google AI Mode saved capture retains only answer-scoped source links', async () => {
  const fixture = JSON.parse(
    await readFile(
      new URL('./fixtures/google-ai-mode.json', import.meta.url),
      'utf8',
    ),
  );
  const parsed = parseBrowserCapture(fixture);
  assert.deepEqual(parsed.citedUrls, [
    'https://duoly.gg/about',
    'https://metafy.gg/',
  ]);
  assert.equal(analyze(parsed.answer, parsed.sources).duolyCited, true);
  assert.equal(parsed.sourceCaptureComplete, true);
});

test('Google redirect query destination counts, unrelated Google navigation does not', () => {
  const result = parseBrowserCapture({
    answer: 'Answer',
    sourceLinks: [
      {
        url: 'https://www.google.com/url?q=https%3A%2F%2Fduoly.gg%2Fpricing&sa=U',
      },
      { url: 'https://accounts.google.com/' },
    ],
  });
  assert.equal(result.sources[0].domain, 'duoly.gg');
  assert.equal(
    result.sources[0].url.startsWith('https://www.google.com/url?'),
    true,
  );
  assert.equal(result.sources.length, 1);
});

test('ChatGPT saved search events distinguish searched sources from explicitly opened pages', async () => {
  const data = JSON.parse(
    await readFile(
      new URL('./fixtures/chatgpt-trace.json', import.meta.url),
      'utf8',
    ),
  );
  const result = parseChatGPTTrace(data);
  assert.deepEqual(result.queries, [
    'Duoly gaming reviews',
    'paid gaming teammate',
  ]);
  assert.deepEqual(result.openedDomains, ['duoly.gg']);
  assert.deepEqual(result.searchedDomains, ['duoly.gg', 'reddit.com']);
  assert.equal(result.traceAvailable, true);
});

test('missing or blocked captures cannot enter the answered denominator', () => {
  assert.throws(
    () =>
      parseBrowserCapture({
        answer: 'Sign up and repeat your request',
        sourceLinks: [],
      }),
    /blocked/,
  );
  assert.throws(
    () => parseBrowserCapture({ answer: '', sourceLinks: [] }),
    /empty/,
  );
  assert.equal(
    parseBrowserCapture({ answer: 'No citations here', sourceLinks: [] })
      .sourceCaptureComplete,
    false,
  );
});
