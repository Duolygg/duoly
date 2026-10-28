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
    // React islands written in plain JSX. Catches undefined helpers (a missing
    // import crashed the admin once) without the TypeScript checker.
    files: ['src/components/**/*.jsx'],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: Object.fromEntries(
        [
          'window',
          'document',
          'navigator',
          'localStorage',
          'sessionStorage',
          'fetch',
          'Notification',
          'Audio',
          'AudioContext',
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
          'requestAnimationFrame',
          'cancelAnimationFrame',
          'console',
          'URL',
          'URLSearchParams',
          'location',
          'history',
          'AbortController',
          'Intl',
          'IntersectionObserver',
          'ResizeObserver',
          'matchMedia',
          'getComputedStyle',
          'globalThis',
          'alert',
          'confirm',
          'FormData',
          'Blob',
          'File',
          'FileReader',
          'crypto',
          'performance',
          'Event',
          'CustomEvent',
          'Image',
          'HTMLElement',
          'Node',
          'btoa',
          'atob',
          'TextEncoder',
        ].map((name) => [name, 'readonly']),
      ),
    },
    // Ported legacy JSX keeps its original style; only crash-class rules apply.
    rules: {
      'no-empty': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-useless-escape': 'off',
      'no-prototype-builtins': 'off',
      'no-cond-assign': 'off',
      'no-redeclare': 'off',
      'no-useless-assignment': 'off',
      'no-undef': 'error',
    },
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
