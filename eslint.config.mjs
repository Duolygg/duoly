import { builtinModules } from 'node:module';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  {
    ignores: [
      'dist/**',
      '.astro/**',
      '.vercel/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      // Pinned legacy design source is checked by the explicit compatibility-boundary tests.
      // Newly authored adapters remain fully linted and type-checked.
      'src/design-reference/**',
      '.superdesign/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ['supabase/tests/proof_http_acceptance*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: Object.fromEntries(
        [
          'require',
          'module',
          '__dirname',
          'global',
          'process',
          'fetch',
          'AbortSignal',
          'setTimeout',
          'Buffer',
          'console',
          'document',
          'window',
        ].map((name) => [name, 'readonly']),
      ),
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: { process: 'readonly' } },
  },
  {
    files: [
      'src/client/**/*.{ts,tsx}',
      'src/components/**/*.{ts,tsx}',
      'src/lib/**/*.{ts,tsx}',
      'src/design-preview/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression',
          message:
            'Use static browser-safe imports so module boundaries can be checked.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'node:*',
                '**/server',
                '**/server/**',
                '**/*.server',
                '**/*.server.*',
              ],
              message: 'Browser-safe modules must not import server modules.',
            },
            {
              group: [...builtinModules, '@supabase/supabase-js'],
              message: 'Keep privileged dependencies on the server.',
            },
          ],
        },
      ],
    },
  },
];
