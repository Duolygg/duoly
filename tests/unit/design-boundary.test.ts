import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';

const root = resolve('src/design-reference');
function files(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(path, entry.name);
    return entry.isDirectory()
      ? files(full)
      : /\.(js|jsx)$/.test(full)
        ? [full]
        : [];
  });
}

describe('design compatibility boundary', () => {
  it('imports only React, local design data and offline preview adapters', () => {
    const violations: string[] = [];
    for (const file of files(root)) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.JS,
      );
      for (const node of source.statements) {
        if (
          !ts.isImportDeclaration(node) ||
          !ts.isStringLiteral(node.moduleSpecifier)
        )
          continue;
        const name = node.moduleSpecifier.text;
        if (name === 'react') continue;
        if (!name.startsWith('.')) {
          violations.push(`${relative(root, file)}: ${name}`);
          continue;
        }
        const target = resolve(dirname(file), name);
        const permitted =
          target.startsWith(root + '/') ||
          target === resolve('src/design-preview/preview-transport') ||
          target === resolve('src/design-preview/preview-auth');
        if (
          !permitted ||
          !['', '.ts', '.js', '.jsx', '.tsx'].some((suffix) =>
            existsSync(target + suffix),
          )
        )
          violations.push(`${relative(root, file)}: ${name}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('binds every legacy fetch call to the offline transport', () => {
    const unbound = files(root).filter((file) => {
      const text = readFileSync(file, 'utf8');
      return (
        /\bfetch\s*\(/.test(text) &&
        !/import\s*\{\s*previewFetch\s+as\s+fetch\s*\}/.test(text)
      );
    });
    expect(unbound.map((file) => relative(root, file))).toEqual([]);
  });

  it('does not retain browser beacon or direct network escape hatches', () => {
    const escapes = files(root).filter((file) =>
      /navigator\.sendBeacon|window\.fetch|new\s+(?:XMLHttpRequest|WebSocket|EventSource)\s*\(/.test(
        readFileSync(file, 'utf8'),
      ),
    );
    expect(escapes.map((file) => relative(root, file))).toEqual([]);
  });
});
