// Markdown report in the shape of 18-geo-baseline-2026-11-09.md, so the 23 November run
// can be read beside the baseline. Run it on a stored run:
//   node scripts/ai-panel/report.mjs ~/Desktop/Duoly/ai-agents-research/panel/<run>.jsonl
import { readFile, realpath } from 'node:fs/promises';
import { summarize } from './analysis.mjs';
import { aggregateFanOut } from './fanout.mjs';
import { providers } from './providers.mjs';

const { console, process } = globalThis;

export function engineLabel(provider) {
  return providers[provider]?.engine ?? provider;
}

// Keeps deliberate blank lines, collapses the gaps left by omitted optional lines.
function render(lines) {
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function table(header, rows) {
  if (!rows.length) return '';
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

// Cohort rows keep the baseline's "mention rate by topic" reading.
function cohorts(rows) {
  const answered = rows.filter((row) => row.status === 'answered');
  const intents = [...new Set(answered.map((row) => row.intent))]
    .filter(Boolean)
    .sort();
  const groups = intents.map((intent) => ({
    label: `${intent} (${new Set(answered.filter((row) => row.intent === intent).map((row) => row.id)).size} prompts)`,
    match: (row) => row.intent === intent,
  }));
  if (answered.some((row) => row.locale === 'de'))
    groups.push({
      label: `German prompts (${new Set(answered.filter((row) => row.locale === 'de').map((row) => row.id)).size})`,
      match: (row) => row.locale === 'de',
    });
  return groups;
}

export function buildReport(rows, meta = {}) {
  const summary = summarize(rows);
  const engines = summary.map((entry) => entry.provider);
  const answered = rows.filter((row) => row.status === 'answered');
  const lines = [];
  const title = meta.fixtures
    ? 'GEO panel report, SYNTHETIC FIXTURE REPLAY (not an observation)'
    : `GEO panel report, run ${meta.runId ?? 'unknown'}`;
  lines.push(`# ${title}`, '');
  if (meta.fixtures)
    lines.push(
      'Every number below comes from saved parser fixtures. It measures the harness, never an engine.',
      '',
    );
  lines.push(
    `Portfolio: ${new Set(rows.map((row) => row.id)).size} prompts, prompt file hash \`${meta.promptSetHash ?? 'unknown'}\`, one run each.`,
    `Surface: API search-grounded requests, stateless, no installed apps and no consumer UI session. Country and provider personalization are uncontrolled.`,
    `Engines: ${engines.map((provider) => `${engineLabel(provider)} n=${summary.find((e) => e.provider === provider).answered}`).join('; ') || 'none'}.`,
    meta.outputFile ? `Raw: \`${meta.outputFile}\`.` : '',
    '',
    'The 2026-11-09 baseline was captured in logged-out browser sessions of the consumer',
    'surfaces. These rows come from the provider APIs, so treat trend direction as the',
    'signal and do not read a one-answer difference as movement.',
    '',
  );

  lines.push(
    '## Ladder per engine',
    '',
    table(
      ['Engine', 'Answered', 'Cited', 'Named', 'Recommended', 'Framing'],
      summary.map((entry) => [
        engineLabel(entry.provider),
        String(entry.answered),
        `${entry.ladder.cited}/${entry.answered}`,
        `${entry.ladder.named}/${entry.answered}`,
        `${entry.ladder.recommended}/${entry.answered}`,
        entry.ladder.framing.length
          ? entry.ladder.framing
              .map((flag) => `${flag.label} ${flag.count}`)
              .join(', ')
          : entry.ladder.named
            ? 'neutral'
            : 'not named',
      ]),
    ),
    '',
    'Cited: a source link whose domain is duoly.gg or a subdomain. Named: whole-word Duoly',
    'in the answer text. Recommended: a Duoly sentence carrying recommendation language with',
    'no negation in it. Framing: lexical classes from the baseline claim ledger. Recommended',
    'and framing are lexical readings; confirm each one against the raw answer before quoting it.',
    '',
  );

  const groups = cohorts(rows);
  if (groups.length)
    lines.push(
      '## Duoly mention rate by topic (runs where Duoly is named / runs)',
      '',
      table(
        ['Topic', ...engines.map(engineLabel)],
        groups.map((group) => [
          group.label,
          ...engines.map((provider) => {
            const scope = answered.filter(
              (row) => row.provider === provider && group.match(row),
            );
            return `${scope.filter((row) => row.duolyMentioned).length}/${scope.length}`;
          }),
        ]),
      ),
      '',
    );

  lines.push('## Brands named (answered runs per engine)', '');
  for (const entry of summary)
    lines.push(
      `- ${engineLabel(entry.provider)}: ${
        entry.competitors
          .map((brand) => `${brand.brand} ${brand.count}`)
          .join(', ') || 'none of the tracked brands'
      }`,
    );
  lines.push(
    '',
    'Lexical matching can catch incidental mentions, including the phrase tap in. Review before drawing commercial conclusions.',
    '',
  );

  lines.push('## Cited source domains', '');
  for (const entry of summary) {
    const top = entry.citedDomains.slice(0, 15);
    lines.push(
      `### ${engineLabel(entry.provider)}`,
      '',
      top.length
        ? table(
            ['Domain', 'Prompts', 'Links'],
            top.map((row) => [row.domain, String(row.prompts), String(row.hits)]),
          )
        : 'No source links were returned.',
      '',
    );
    const metadataOnly = answered.filter(
      (row) =>
        row.provider === entry.provider &&
        (row.sources ?? []).some((source) => source.domainFromMetadata),
    ).length;
    if (metadataOnly)
      lines.push(
        `${metadataOnly} answers returned redirect-wrapped source links. Their domain comes from the grounding metadata, not from following the redirect.`,
        '',
      );
  }

  const flagged = answered.filter(
    (row) => (row.framingEvidence ?? []).length || row.recommendationEvidence,
  );
  lines.push('## Framing and accuracy evidence', '');
  if (!flagged.length) lines.push('No answer named Duoly with a framing flag.', '');
  for (const row of flagged) {
    lines.push(`### ${engineLabel(row.provider)}, prompt \`${row.id}\``, '');
    for (const flag of row.framingEvidence ?? [])
      lines.push(`- ${flag.label}: "${flag.evidence}"`);
    if (row.recommendationEvidence)
      lines.push(`- recommendation language: "${row.recommendationEvidence}"`);
    const citedUrls = row.duolyCitedSourceUrls ?? [];
    if (citedUrls.length)
      lines.push(`- Duoly source links: ${citedUrls.join(', ')}`);
    lines.push('');
  }

  const skipped = Object.entries(meta.skippedProviders ?? {});
  if (skipped.length)
    lines.push(
      '## Engines not measured',
      '',
      ...skipped.map(([provider, reason]) => `- ${engineLabel(provider)}: ${reason}`),
      '',
      'A skipped engine is not evidence of Duoly absence there.',
      '',
    );
  return render(lines);
}

export function buildFanOutReport(rows, meta = {}) {
  const fanOut = aggregateFanOut(rows);
  const lines = [
    meta.fixtures
      ? '# ChatGPT fan-out, SYNTHETIC FIXTURE REPLAY (not an observation)'
      : `# ChatGPT fan-out, run ${meta.runId ?? 'unknown'}`,
    '',
    `Prompts answered: ${fanOut.promptsAnswered}. Search calls: ${fanOut.searchCalls}. Distinct queries: ${fanOut.distinctQueries}.`,
    `Surface: ${engineLabel('openai')}, up to ${meta.maxToolCalls ?? 'several'} searches per prompt.`,
    'These are the searches the model ran for the prompt. The consumer ChatGPT fan-out is',
    'not observable from outside, so read this as the closest available proxy.',
    fanOut.sourceIncludeSupported
      ? ''
      : 'The API rejected the search-source include, so opened domains come from citations and search actions only.',
    '',
    '## Ranked domains ChatGPT searched',
    '',
    fanOut.domains.length
      ? table(
          ['Domain', 'Prompts searched', 'Opened links', 'Prompts cited'],
          fanOut.domains.map((row) => [
            row.domain,
            String(row.searchedInPrompts),
            String(row.opens),
            String(row.citedInPrompts),
          ]),
        )
      : 'No search sources were returned.',
    '',
    '## Queries per prompt',
    '',
  ];
  for (const entry of fanOut.queriesByPrompt) {
    lines.push(`### \`${entry.id}\`: ${entry.prompt}`, '');
    for (const query of entry.queries) lines.push(`- ${query}`);
    if (!entry.queries.length) lines.push('- no query text was returned');
    lines.push(
      '',
      `Domains opened: ${entry.openedDomains.join(', ') || 'none'}.`,
      `duoly.gg among them: ${entry.duolySearched ? 'yes' : 'no'}.`,
      '',
    );
  }
  return render(lines);
}

// CLI: regenerate a report from a stored run without touching any engine.
const invoked = await realpath(process.argv[1] ?? '.').catch(() => '');
if (invoked === import.meta.filename) {
  const file = process.argv[2];
  if (!file)
    throw new Error('Usage: node scripts/ai-panel/report.mjs <run.jsonl>');
  const rows = (await readFile(file, 'utf8'))
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const fanOutRun = rows.some((row) => row.mode === 'fan-out');
  const meta = {
    runId: rows[0]?.runId,
    promptSetHash: rows[0]?.promptSetHash,
    outputFile: file,
    fixtures: rows.some((row) => row.surface === 'fixture replay'),
  };
  console.log(
    fanOutRun ? buildFanOutReport(rows, meta) : buildReport(rows, meta),
  );
}
