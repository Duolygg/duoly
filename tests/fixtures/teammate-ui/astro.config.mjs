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
    server: {
      fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] },
    },
  },
});
