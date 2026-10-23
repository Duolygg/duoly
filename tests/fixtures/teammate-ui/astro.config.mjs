import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
  devToolbar: { enabled: false },
  output: 'server',
  integrations: [react()],
  publicDir: '../../../public',
  cacheDir: '../../../.astro/teammate-ui-fixture',
  outDir: '../../../.astro/teammate-ui-fixture-build',
  vite: {
    // Avoid cold optimizer discoveries reloading the first CI page before its
    // React island hydrates. Keep this fixture's optimizer cache independent.
    cacheDir: fileURLToPath(
      new URL('../../../node_modules/.vite-teammate-fixture', import.meta.url),
    ),
    optimizeDeps: {
      include: [
        'react',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'zod',
        '@supabase/supabase-js',
      ],
    },
    server: {
      fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] },
    },
  },
});
