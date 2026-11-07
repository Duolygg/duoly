import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('keeps twelve captured MCP text summaries readable without duplicate JSON', () => {
  const markdown = readFileSync('docs/product/mcp-text-samples.md', 'utf8');
  const samples = [...markdown.matchAll(/```text\n([\s\S]*?)\n```/g)];
  expect(samples).toHaveLength(12);
  expect(markdown).not.toContain('[truncated]');
  for (const [, text] of samples) {
    expect(text).toContain('https://duoly.gg/');
    expect(text).toContain('agent=claude');
    expect(text).not.toMatch(/^[{[]/m);
    expect(text).not.toMatch(/[\u2013\u2014]| & |not .*, but /i);
  }
});
