import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  vite: { build: { sourcemap: 'hidden' } },
  integrations: [react()],
  site: process.env.SITE_URL || undefined,
});
