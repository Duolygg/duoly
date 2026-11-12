import test from 'node:test';
import assert from 'node:assert/strict';
import { replay, replayFanOut } from './fixtures.mjs';
import { analyze } from './analysis.mjs';
import { normalizeSource } from './sources.mjs';
import { recommendationEvidence } from './ladder.mjs';
import { aggregateFanOut } from './fanout.mjs';
import { buildReport } from './report.mjs';

test('saved provider fixtures retain source links and ladder evidence', async () => {
  for (const provider of ['openai', 'gemini', 'anthropic', 'perplexity']) {
    const result = await replay(provider, 'default');
    assert.ok(result.answer);
    assert.ok(result.sources.length);
    assert.equal(
      typeof analyze(result.answer, result.sources).ladder.named,
      'boolean',
    );
  }
  const fanout = await replayFanOut('default');
  assert.ok(fanout.queries.length);
  assert.ok(fanout.openedSources.length);
});

test('direct source URL beats misleading title or domain metadata', () => {
  const result = normalizeSource({
    url: 'https://evil.test/',
    title: 'duoly.gg',
    domain: 'duoly.gg',
  });
  assert.equal(result.domain, 'evil.test');
  assert.equal(analyze('Duoly', [result]).duolyCited, false);
});

test('recommendation language about a competitor is not a Duoly endorsement', () => {
  assert.equal(
    recommendationEvidence('Duoly is listed, but I recommend Metafy instead.'),
    null,
  );
});

test('fanout distinguishes retrieved domains from explicit opens', () => {
  const summary = aggregateFanOut([
    {
      status: 'answered',
      id: 'x',
      queries: ['a'],
      searchedDomains: ['reddit.com'],
      openedDomains: ['duoly.gg'],
      citedDomains: ['metafy.gg'],
    },
  ]);
  assert.equal(
    summary.domains.find((d) => d.domain === 'reddit.com').searchedInPrompts,
    1,
  );
  assert.equal(
    summary.domains.find((d) => d.domain === 'duoly.gg').openedInPrompts,
    1,
  );
});

test('browser report preserves surface and repeated-run baseline denominators', () => {
  const rows = [1, 2].map((repeat) => ({
    provider: 'google-ai-mode',
    engine: 'Google AI Mode',
    surface: 'consumer browser',
    id: 'p',
    repeat,
    intent: 'Trust',
    status: 'answered',
    ...analyze('Duoly offers gaming teammates', ['https://duoly.gg/about']),
  }));
  const report = buildReport(rows, { runId: 'test' });
  assert.match(report, /Google AI Mode/);
  assert.match(report, /2\/2/);
  assert.match(report, /2 runs each/);
  assert.doesNotMatch(report, /Surface: API/);
});
