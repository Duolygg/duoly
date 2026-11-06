import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('keeps all six captured MCP text samples complete and parseable', () => {
  const markdown = readFileSync('docs/product/mcp-text-samples.md', 'utf8');
  const samples = [...markdown.matchAll(/```text\n([^\n]+)\n([^\n]+)\n```/g)];
  expect(samples).toHaveLength(6);
  expect(markdown).not.toContain('[truncated]');
  for (const [, summary, json] of samples) {
    expect(summary).toContain('Share bookUrl');
    const data = JSON.parse(json!);
    const entries = data.services ?? data.matches ?? [data];
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries)
      expect(entry.bookUrl).toContain('agent=claude');
  }
});
