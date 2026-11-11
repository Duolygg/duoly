/* global console */
import process from 'node:process';
/**
 * Measures how far each responsive variant is from the asset it replaces, at the size the page
 * actually draws it and composited over the page background, because a raw comparison is
 * meaningless for artwork that is mostly transparent.
 *
 * Reference is the file at `git show <ref>:<path>` when the variant already existed (the earlier
 * lossless pass), otherwise the committed master. Prints mean and maximum per-channel delta out
 * of 255 and the share of channels off by more than 2, and writes fidelity.json.
 *
 *   node scripts/assets/variant-fidelity.mjs [git-ref]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const store = resolve(import.meta.dirname, '../../node_modules/.pnpm');
const sharpDir = readdirSync(store).find((d) => d.startsWith('sharp@'));
const sharp = require(join(store, sharpDir, 'node_modules/sharp'));
sharp.cache(false);

const ROOT = resolve(import.meta.dirname, '../..');
const PUBLIC = join(ROOT, 'public');
const ref = process.argv[2] || 'origin/main';
// Every surface that carries this artwork is #090414 or #120B22; the darker page background is
// the harsher of the two for edge haloes.
const BACKGROUND = '#090414';

/** [variant, drawn CSS width, replaced asset] */
const CASES = [
  ['assets/brand/logo-full-342.webp', 342, 'assets/brand/logo-full-342.webp'],
  ['assets/brand/logo-full-560.webp', 560, 'assets/brand/logo-full-560.webp'],
  ['assets/brand/logo-full-684.webp', 342, 'assets/brand/logo-full-684.webp'],
  [
    'assets/brand/logo-wordmark-192.webp',
    104,
    'assets/brand/logo-wordmark-192.webp',
  ],
  [
    'assets/brand/logo-mascots-112.webp',
    56,
    'assets/brand/logo-mascots-112.webp',
  ],
  ['assets/avatars/avatar-1-100.webp', 50, 'assets/avatars/avatar-1-100.webp'],
  ['assets/avatars/avatar-1-78.webp', 42, 'assets/avatars/avatar-1-78.webp'],
  ['assets/avatars/avatar-1-50.webp', 28, 'assets/avatars/avatar-1-50.webp'],
  ['assets/games/valorant-128.webp', 120, 'assets/games/valorant.png'],
  ['assets/games/valorant-128.webp', 48, 'assets/games/valorant.png'],
  ['assets/games/rocket-league-128.webp', 48, 'assets/games/rocket-league.png'],
  ['assets/games/valorant-48.webp', 26, 'assets/games/valorant.png'],
  ['assets/payments/paypal-112.webp', 83, 'assets/payments/paypal.png'],
  ['assets/payments/google-pay-112.webp', 56, 'assets/payments/google-pay.png'],
  ['assets/payments/apple-pay-112.webp', 47, 'assets/payments/apple-pay.png'],
  ['assets/flags/webp/es-54.webp', 18, 'assets/flags/svg/es.svg'],
  ['assets/flags/webp/de-54.webp', 18, 'assets/flags/svg/de.svg'],
  ['assets/flags/webp/jp-54.webp', 16, 'assets/flags/svg/jp.svg'],
];

const drawn = (input, width, height) =>
  sharp(input, { density: 384 })
    .resize({ width, height, fit: 'fill', kernel: 'lanczos3' })
    .flatten({ background: BACKGROUND })
    .raw()
    .toBuffer();

const fromRef = (path) => {
  try {
    return execFileSync('git', ['show', `${ref}:public/${path}`], {
      cwd: ROOT,
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'buffer',
    });
  } catch {
    return null;
  }
};

const rows = [];
for (const [variant, cssWidth, replaced] of CASES) {
  const current = join(PUBLIC, variant);
  if (!existsSync(current)) {
    console.error(`missing ${variant}`);
    process.exitCode = 1;
    continue;
  }
  // The reference is the same path at `ref` when it existed there, else today's master.
  const referenceBuffer =
    fromRef(replaced) ?? readFileSync(join(PUBLIC, replaced));
  const meta = await sharp(referenceBuffer, { density: 384 }).metadata();
  const height = Math.max(1, Math.round((cssWidth * meta.height) / meta.width));
  const [a, b] = await Promise.all([
    drawn(referenceBuffer, cssWidth, height),
    drawn(readFileSync(current), cssWidth, height),
  ]);
  let sum = 0;
  let max = 0;
  let off = 0;
  for (let i = 0; i < a.length; i++) {
    const delta = Math.abs(a[i] - b[i]);
    sum += delta;
    if (delta > max) max = delta;
    if (delta > 2) off++;
  }
  rows.push({
    variant: `/${variant}`,
    replaces: `/${replaced}`,
    drawnAt: `${cssWidth}x${height}`,
    meanDelta: Number((sum / a.length).toFixed(3)),
    maxDelta: max,
    channelsOffByMoreThan2: Number(((100 * off) / a.length).toFixed(2)),
  });
}

writeFileSync(
  join(ROOT, 'docs/qa/mobile-lighthouse/fidelity.json'),
  JSON.stringify({ reference: ref, background: BACKGROUND, rows }, null, 2) +
    '\n',
);
console.log(
  '| variant | replaces | drawn at | mean delta /255 | max delta /255 | channels off by >2 |',
);
console.log('|---|---|---|---|---|---|');
for (const r of rows)
  console.log(
    `| ${r.variant} | ${r.replaces} | ${r.drawnAt} | ${r.meanDelta} | ${r.maxDelta} | ${r.channelsOffByMoreThan2}% |`,
  );
