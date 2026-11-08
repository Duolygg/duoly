/* global document, console */
// Builds the wide game banners shown at the top of open Discord order posts.
// Run after adding a game: node scripts/discord/build-order-banners.mjs
// Renders HTML with the site fonts in headless Chromium (Playwright) and writes
// public/discord/orders/<game>.webp (1200 x 400). The PNGs are committed.
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const pnpm = join(root, 'node_modules', '.pnpm');
const sharp = require(
  join(
    pnpm,
    readdirSync(pnpm).find((d) => d.startsWith('sharp@')),
    'node_modules',
    'sharp',
  ),
);

export const BANNER_GAMES = {
  lol: ['League of Legends', 'league-of-legends'],
  val: ['Valorant', 'valorant'],
  cs2: ['Counter-Strike 2', 'counter-strike-2'],
  fn: ['Fortnite', 'fortnite'],
  cod: ['Call of Duty', 'call-of-duty'],
  apex: ['Apex Legends', 'apex-legends'],
  r6: ['Rainbow Six Siege', 'rainbow-six-siege'],
  mr: ['Marvel Rivals', 'marvel-rivals'],
  ow: ['Overwatch 2', 'overwatch-2'],
  rl: ['Rocket League', 'rocket-league'],
  tft: ['Teamfight Tactics', 'teamfight-tactics'],
  fc: ['EA SPORTS FC 27', 'ea-sports-fc-27'],
  arc: ['ARC Raiders', 'arc-raiders'],
  mc: ['Minecraft', 'minecraft'],
  pu: ['Pokémon Unite', 'pokemon-unite'],
  dota: ['Dota 2', 'dota-2'],
  wow: ['World of Warcraft', 'world-of-warcraft'],
  pubg: ['PUBG: Battlegrounds', 'pubg'],
  wr: ['Wild Rift', 'wild-rift'],
  dl: ['Deadlock', 'deadlock'],
  social: ['Social', 'social'],
};

const dataUrl = (file, type) =>
  `data:${type};base64,${readFileSync(join(root, file)).toString('base64')}`;
const bricolage = dataUrl(
  'public/fonts/bricolage-grotesque-latin.woff2',
  'font/woff2',
);
const geist = dataUrl('public/fonts/geist-latin.woff2', 'font/woff2');
const mascots = dataUrl('public/assets/brand/logo-mascots.webp', 'image/webp');

// the game's own color, pushed to a vivid version so the glow never turns muddy
async function gameColor(file) {
  const { dominant } = await sharp(join(root, file)).stats();
  let { r, g, b } = dominant;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 40) return '#B48CFF'; // grey or black icons get Duoly lilac
  const k = 235 / max;
  [r, g, b] = [r, g, b].map((v) => Math.round(Math.min(255, v * k)));
  return `rgb(${r}, ${g}, ${b})`;
}

function html(name, icon, color) {
  return `<!doctype html><html><head><style>
  @font-face { font-family: Bricolage; src: url(${bricolage}) format('woff2'); font-weight: 200 800; }
  @font-face { font-family: Geist; src: url(${geist}) format('woff2'); font-weight: 100 900; }
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 400px; overflow: hidden; background: #090414; }
  .b { position: relative; width: 1200px; height: 400px; overflow: hidden;
    background:
      radial-gradient(520px 420px at 170px 200px, color-mix(in srgb, ${color} 30%, transparent), transparent 70%),
      radial-gradient(560px 460px at 1040px 210px, rgba(140, 92, 255, 0.34), transparent 70%),
      radial-gradient(900px 300px at 600px 520px, rgba(214, 187, 255, 0.10), transparent 70%),
      linear-gradient(100deg, #120826 0%, #090414 60%, #0d0620 100%); }
  .grid { position: absolute; inset: 0; opacity: 0.22;
    background-image: linear-gradient(rgba(214,187,255,.22) 1px, transparent 1px),
      linear-gradient(90deg, rgba(214,187,255,.22) 1px, transparent 1px);
    background-size: 40px 40px;
    mask-image: radial-gradient(700px 300px at 600px 200px, #000 10%, transparent 75%); }
  .icon { position: absolute; left: 80px; top: 112px; width: 176px; height: 176px; border-radius: 40px;
    background: url(${icon}) center / cover;
    box-shadow: 0 0 0 1.5px rgba(255,255,255,.14),
      0 24px 60px -10px color-mix(in srgb, ${color} 80%, transparent), 0 0 110px color-mix(in srgb, ${color} 26%, transparent); }
  .text { position: absolute; left: 300px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; gap: 16px; width: 500px; }
  .eyebrow { font: 600 23px/1 Geist; letter-spacing: .14em; text-transform: uppercase; color: #D6BBFF; display: flex; align-items: center; gap: 12px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #5EEAA8; box-shadow: 0 0 0 5px rgba(94,234,168,.18), 0 0 18px #5EEAA8; }
  .name { font: 800 ${name.length > 15 ? 54 : 66}px/1 Bricolage; letter-spacing: -0.03em; color: #fff;
    text-shadow: 0 2px 30px rgba(9,4,20,.6); }
  .sub { font: 500 27px/1.2 Geist; color: #CFC8E6; }
  .m { position: absolute; right: 80px; top: 50%; transform: translateY(-56%); height: 196px;
    filter: drop-shadow(0 0 40px rgba(180,140,255,.55)) drop-shadow(0 18px 30px rgba(0,0,0,.5)); }
  .fade { position: absolute; inset: auto 0 0 0; height: 90px; background: linear-gradient(transparent, rgba(9,4,20,.55)); }
  </style></head><body><div class="b"><div class="grid"></div>
  <div class="icon"></div>
  <div class="text"><div class="eyebrow"><span class="dot"></span>New order on Duoly</div>
  <div class="name">${name}</div><div class="sub">A player needs a teammate now</div></div>
  <img class="m" src="${mascots}"><div class="fade"></div></div></body></html>`;
}

const out = join(root, 'public', 'discord', 'orders');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 400 },
  deviceScaleFactor: 1,
});
const only = process.argv.slice(2);
for (const [id, [name, slug]] of Object.entries(BANNER_GAMES)) {
  if (only.length && !only.includes(id)) continue;
  const file = `public/assets/games/${slug}.png`;
  await page.setContent(
    html(name, dataUrl(file, 'image/png'), await gameColor(file)),
  );
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: 'png' });
  await sharp(png)
    .webp({ quality: 90, smartSubsample: true })
    .toFile(join(out, id + '.webp'));
  console.log('built', id);
}
await browser.close();
