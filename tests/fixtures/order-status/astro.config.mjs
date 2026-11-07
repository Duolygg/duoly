import { defineConfig } from 'astro/config';
import { fileURLToPath, URL } from 'node:url';
// Separate local-only app: exercise the production MCP route against fictional RPC storage.
export default defineConfig({
  output: 'server',
  cacheDir: '../../../.astro/order-status-fixture',
  outDir: '../../../.astro/order-status-fixture-build',
  vite: {
    server: {
      fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] },
    },
  },
});
