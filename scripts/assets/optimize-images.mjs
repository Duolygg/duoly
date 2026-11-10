/* global console */
import process from 'node:process';
/**
 * Regenerates the responsive WebP variants under public/assets from their committed masters.
 *
 * The first pass of responsive artwork (docs/qa/homepage-contrast) encoded every variant
 * losslessly, which made the hero art 356 KB at 684 px and left PageSpeed asking for 799 KiB
 * back on the homepage. These variants are derived files, never the masters, so this script
 * re-encodes them as high-quality lossy WebP at the same pixel sizes and adds the families the
 * homepage still served at full size (game art, payment badges, country flags).
 *
 * Run it after changing a master or a width ladder:
 *   node scripts/assets/optimize-images.mjs            # write variants, print a table
 *   node scripts/assets/optimize-images.mjs --check     # fail if anything is missing or stale
 *
 * sharp ships with Astro's image pipeline rather than as a direct dependency, so it is resolved
 * out of the pnpm store instead of imported by name.
 */
import {
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const store = resolve(import.meta.dirname, '../../node_modules/.pnpm');
const sharpDir = existsSync(store)
  ? readdirSync(store).find((d) => d.startsWith('sharp@'))
  : null;
if (!sharpDir) {
  console.error(
    'sharp was not found in node_modules/.pnpm. Run `corepack pnpm install` first; sharp comes with astro.',
  );
  process.exit(1);
}
const sharp = require(join(store, sharpDir, 'node_modules/sharp'));

const PUBLIC = resolve(import.meta.dirname, '../../public');
const check = process.argv.includes('--check');

/**
 * One family per master shape. `widths` are the variant widths the markup offers in `srcset`;
 * the browser picks one from the CSS width times its device pixel ratio, so the ladder has to
 * cover every display size in the components plus a 2x step above the largest.
 */
const FAMILIES = [
  {
    name: 'avatars',
    sources: () =>
      readdirSync(join(PUBLIC, 'assets/avatars'))
        .filter((f) => /^avatar-\d+\.png$/.test(f))
        .map((f) => `assets/avatars/${f}`),
    widths: [50, 78, 100, 156],
    out: (src, w) => src.replace(/\.png$/, `-${w}.webp`),
    // Photographs in a circular mask. Lossless costs three times as much for no visible
    // difference at the 28 to 52 px these are drawn at.
    encode: { quality: 88, effort: 6, alphaQuality: 100, smartSubsample: true },
  },
  {
    name: 'hero art',
    sources: () => ['assets/brand/logo-full.webp'],
    widths: [342, 560, 684, 1120],
    out: (src, w) => src.replace(/\.webp$/, `-${w}.webp`),
    encode: { quality: 84, effort: 6, alphaQuality: 100, smartSubsample: true },
  },
  {
    name: 'wordmark',
    sources: () => ['assets/brand/logo-wordmark.webp'],
    // 144 and 288 cover the footer wordmark at 1x and 2x.
    widths: [96, 104, 144, 192, 208, 288],
    out: (src, w) => src.replace(/\.webp$/, `-${w}.webp`),
    encode: { quality: 92, effort: 6, alphaQuality: 100 },
  },
  {
    name: 'mascots',
    sources: () => ['assets/brand/logo-mascots.webp'],
    widths: [40, 56, 72, 80, 112, 144],
    out: (src, w) => src.replace(/\.webp$/, `-${w}.webp`),
    encode: { quality: 92, effort: 6, alphaQuality: 100 },
  },
  {
    name: 'game art',
    sources: () =>
      readdirSync(join(PUBLIC, 'assets/games'))
        .filter((f) => f.endsWith('.png'))
        .map((f) => `assets/games/${f}`),
    // 48 covers the homepage picker at 1x, 128 is the master size and covers every homepage
    // use at 2x, 256 covers the 120 px game-hub hero card on a phone (Lighthouse asks for 180).
    widths: [48, 96, 128, 256],
    out: (src, w) => src.replace(/\.png$/, `-${w}.webp`),
    // Lossless would be 12 KB an icon against 3 KB here, for art drawn at 26 to 120 px.
    encode: { quality: 92, effort: 6, alphaQuality: 100 },
  },
  {
    name: 'payment logos',
    sources: () =>
      readdirSync(join(PUBLIC, 'assets/payments'))
        .filter((f) => f.endsWith('.png'))
        .map((f) => `assets/payments/${f}`),
    widths: [56, 112, 168, 252],
    out: (src, w) => src.replace(/\.png$/, `-${w}.webp`),
    // Flat colour and hard edges: lossless is both smaller than lossy here and exact.
    encode: { lossless: true, effort: 6 },
  },
  {
    name: 'flags',
    sources: () =>
      readdirSync(join(PUBLIC, 'assets/flags/svg'))
        .filter((f) => f.endsWith('.svg'))
        .map((f) => `assets/flags/svg/${f}`),
    // Flags render in an 16x12 or 18x13 box. One 54 px raster covers 3x and replaces SVGs that
    // reach 91 KB (es.svg) and cost a rasterisation on the main thread for every card.
    widths: [54],
    out: (src, w) =>
      src.replace(
        /^assets\/flags\/svg\/(.*)\.svg$/,
        `assets/flags/webp/$1-${w}.webp`,
      ),
    // Bands of flat colour: lossless stays under 1 KB and keeps every stripe exact.
    encode: { lossless: true, effort: 6 },
  },
];

const rows = [];
let stale = 0;
for (const family of FAMILIES) {
  for (const src of family.sources()) {
    const input = join(PUBLIC, src);
    const master = statSync(input).size;
    for (const width of family.widths) {
      const rel = family.out(src, width);
      const output = join(PUBLIC, rel);
      // The 1120 hero step is wider than its 900 px master; upscaling invents no detail but keeps
      // the ladder the markup already ships. Game art at 256 is the same deliberate 2x step.
      const pipeline = sharp(input, { density: 384 })
        .resize({ width, withoutEnlargement: false, kernel: 'lanczos3' })
        .webp(family.encode);
      const buffer = await pipeline.toBuffer();
      const before = existsSync(output) ? statSync(output).size : 0;
      if (check) {
        if (!before) {
          console.error(`missing ${rel}`);
          stale++;
        }
      } else {
        mkdirSync(dirname(output), { recursive: true });
        writeFileSync(output, buffer);
      }
      rows.push({
        family: family.name,
        source: `/${src}`,
        output: `/${rel}`,
        width,
        masterBytes: master,
        beforeBytes: before,
        bytes: buffer.length,
      });
    }
  }
}

if (check) {
  if (stale) {
    console.error(
      `${stale} variant(s) missing; run node scripts/assets/optimize-images.mjs`,
    );
    process.exit(1);
  }
  console.log(`${rows.length} variants present`);
} else {
  const byFamily = new Map();
  for (const row of rows) {
    const acc = byFamily.get(row.family) ?? { n: 0, before: 0, after: 0 };
    acc.n++;
    acc.before += row.beforeBytes;
    acc.after += row.bytes;
    byFamily.set(row.family, acc);
  }
  console.log('| family | variants | before KB | after KB |');
  console.log('|---|---|---|---|');
  for (const [name, a] of byFamily)
    console.log(
      `| ${name} | ${a.n} | ${(a.before / 1024).toFixed(1)} | ${(a.after / 1024).toFixed(1)} |`,
    );
  writeFileSync(
    resolve(import.meta.dirname, '../../docs/qa/mobile-lighthouse/images.json'),
    JSON.stringify(rows, null, 2) + '\n',
  );
}
