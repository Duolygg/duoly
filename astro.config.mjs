import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  // Ship the page's CSS inside the HTML instead of as a <link>. Every page here is rendered per
  // request, so the stylesheet was never cached across the first view: on a throttled phone the
  // render-blocking /_astro/SiteLayout.*.css cost a round trip plus its own transfer before the
  // first paint (PageSpeed Insights measured 150 ms, est. saving 300 ms). Inlining puts the same
  // bytes in the response that is already in flight. It grows the homepage HTML from about 48 to
  // 68 KB gzipped, which arrives on the connection the browser has already opened.
  build: { inlineStylesheets: 'always' },
  vite: { build: { sourcemap: 'hidden' } },
  integrations: [react()],
  site: 'https://duoly.gg',
});
