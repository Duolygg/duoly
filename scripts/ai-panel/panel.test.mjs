import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyze, isDuolyUrl, summarize } from './analysis.mjs';
import { parseAnswer, estimate, request } from './providers.mjs';

const { URL } = globalThis;

// Synthetic fixtures below are parser tests, never panel observations.
test('fixed prompt panel has 20 unique prompts, IDs, locales and intent cohorts', async () => {
  const prompts = JSON.parse(
    await readFile(new URL('./prompts.json', import.meta.url), 'utf8'),
  );
  assert.equal(prompts.length, 20);
  assert.equal(new Set(prompts.map((p) => p.id)).size, 20);
  assert.equal(new Set(prompts.map((p) => p.prompt)).size, 20);
  assert.ok(prompts.some((p) => p.locale === 'de'));
  assert.ok(prompts.some((p) => p.intent === 'free'));
});

test('brand order is distinct tracked-brand order, not recommendation rank', () => {
  const result = analyze('Fiverr, Fiverr, E-Pal, then Duoly.gg; Discord.', [
    'https://duoly.gg/games',
  ]);
  assert.equal(result.firstMentionRank, 3);
  assert.equal(result.duolyMentioned, true);
  assert.equal(result.duolyCited, true);
  assert.deepEqual(result.competitors, ['epal', 'fiverr', 'discord']);
  assert.equal(analyze('Duolingo and notduoly.gg', []).duolyMentioned, false);
  assert.equal(analyze('No brand', []).firstMentionRank, null);
});

test('citation hostname validation rejects substring and credential lookalikes', () => {
  assert.equal(isDuolyUrl('https://www.duoly.gg/'), true);
  for (const url of [
    'https://duoly.gg.evil.test',
    'https://duoly.gg@evil.test',
    'invalid',
  ])
    assert.equal(isDuolyUrl(url), false);
  assert.equal(
    analyze('No named service', ['https://duoly.gg']).duolyCited,
    true,
  );
  assert.equal(
    analyze('No named service', ['https://duoly.gg']).duolyMentioned,
    false,
  );
});

test('OpenAI parser separates answers, citations, actual search and completion', () => {
  const result = parseAnswer('openai', {
    status: 'completed',
    output: [
      { type: 'web_search_call' },
      {
        content: [
          {
            type: 'output_text',
            text: 'Fixture answer',
            annotations: [{ type: 'url_citation', url: 'https://example.com' }],
          },
        ],
      },
    ],
    usage: { input_tokens: 100, output_tokens: 20 },
  });
  assert.equal(result.answer, 'Fixture answer');
  assert.deepEqual(result.citedUrls, ['https://example.com']);
  assert.equal(result.searched, true);
  assert.equal(result.complete, true);
  assert.ok(Math.abs(estimate('openai', result) - 0.01002) < 1e-10);
});

test('Gemini parser includes thinking costs and only public answer text', () => {
  const result = parseAnswer('gemini', {
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [
            { thought: true, text: 'private reasoning fixture' },
            { text: 'Public fixture' },
          ],
        },
        groundingMetadata: {
          webSearchQueries: ['fixture'],
          groundingChunks: [{ web: { uri: 'https://example.com' } }],
        },
      },
    ],
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 20,
      thoughtsTokenCount: 30,
    },
  });
  assert.equal(result.answer, 'Public fixture');
  assert.equal(result.outputTokens, 50);
  assert.equal(result.searches, 1);
  assert.equal(result.searched, true);
});

test('optional adapters parse citation and search metadata', () => {
  assert.equal(
    parseAnswer('anthropic', {
      content: [
        {
          type: 'text',
          text: 'Fixture',
          citations: [{ url: 'https://example.com' }],
        },
      ],
      usage: { server_tool_use: { web_search_requests: 1 } },
      stop_reason: 'end_turn',
    }).searched,
    true,
  );
  assert.equal(
    parseAnswer('perplexity', {
      choices: [{ message: { content: 'Fixture' }, finish_reason: 'stop' }],
      citations: ['https://example.com'],
    }).complete,
    true,
  );
  assert.equal(parseAnswer('openai', {}).complete, false);
});

test('summary denominators exclude skipped and failed rows from answers', () => {
  const [summary] = summarize([
    {
      provider: 'openai',
      status: 'answered',
      ...analyze('Duoly and Reddit', []),
      estimatedUsd: 0.01,
    },
    { provider: 'openai', status: 'error', estimatedUsd: null },
    { provider: 'openai', status: 'skipped', estimatedUsd: 0 },
  ]);
  assert.equal(summary.attempted, 2);
  assert.equal(summary.answered, 1);
  assert.equal(summary.mentioned, 1);
  assert.equal(summary.unknownCostRequests, 1);
  assert.deepEqual(summary.competitors, [{ brand: 'reddit', count: 1 }]);
});

test('optional provider costs do not invent a tariff after API reformulation', () => {
  assert.equal(estimate('perplexity', { usage: {} }), null);
  assert.equal(
    estimate('perplexity', { usage: { cost: { total_cost: 0.007 } } }),
    0.007,
  );
  assert.ok(
    Math.abs(
      estimate('anthropic', {
        inputTokens: 200000,
        outputTokens: 100,
        searches: 1,
      }) - 0.11025,
    ) < 1e-10,
  );
});

test('HTTP errors never retain a potentially secret response body', async () => {
  const original = globalThis.fetch;
  // request captures fetch at module evaluation, so import an isolated instance after stubbing.
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    text: async () => 'secret fixture',
  });
  try {
    const isolated = await import('./providers.mjs?http-error-test');
    await assert.rejects(
      isolated.request('https://example.com', 'fake-test-key'),
      { message: 'HTTP 401' },
    );
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(typeof request, 'function');
});
