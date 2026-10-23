import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
  output: 'server',
  integrations: [react()],
  publicDir: '../../../public',
  cacheDir: '../../../.astro/chat-ui-fixture',
  outDir: '../../../.astro/chat-ui-fixture-build',
  vite: {
    server: {
      fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] },
    },
  },
});
