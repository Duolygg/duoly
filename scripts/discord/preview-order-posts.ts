// Posts every order post state to a private channel so the design can be checked in Discord.
// node scripts/discord/preview-order-posts.ts <channelId>
// Bot token and guild come from the macOS Keychain. Mentions are silent.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { openPost, closedPost } from '../../src/server/discord/order-posts.ts';

const key = (s: string) =>
  execFileSync('security', [
    'find-generic-password',
    '-s',
    s,
    '-a',
    'duoly-prod',
    '-w',
  ])
    .toString()
    .trim();
const token = key('duoly-discord-bot-token');
const channel = process.argv[2];
if (!channel) throw new Error('channel id required');
const site = 'https://duoly.gg';
const now = Date.now();

type Payload = {
  components: { components: { items: { media: { url: string } }[] }[] }[];
  attachments?: unknown[];
};

async function send(input: object, banner?: string) {
  const payload = input as unknown as Payload;
  const form = new FormData();
  if (banner) {
    const gallery = payload.components[1]!.components[0]!;
    gallery.items[0]!.media.url = `attachment://${banner}.webp`;
    form.append(
      'files[0]',
      new Blob([readFileSync(`public/discord/orders/${banner}.webp`)], {
        type: 'image/webp',
      }),
      `${banner}.webp`,
    );
    payload.attachments = [{ id: 0, filename: `${banner}.webp` }];
  }
  form.append('payload_json', JSON.stringify(payload));
  const r = await fetch(
    `https://discord.com/api/v10/channels/${channel}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bot ${token}` },
      body: form,
    },
  );
  const j = (await r.json()) as { id?: string };
  console.log(r.status, r.ok ? j.id : JSON.stringify(j).slice(0, 600));
}

const base = { queuedAt: now - 100_000, cancelsAt: now + 200_000 };
const role = '1561145577369239592';
await send(
  openPost(
    {
      reference: 'DL-48321',
      game: 'lol',
      title: 'Duo Pro',
      units: 3,
      unit: 'game',
      rank: 'Platinum II',
      region: 'EUW',
      voice: true,
      gg: false,
      payoutUsdCents: 1086,
      ...base,
    },
    `${site}/claim/PREVIEWxxxxxxxxxxxxxxxxx`,
    { site, roleId: role, silent: true },
  ),
  'lol',
);
await send(
  openPost(
    {
      reference: 'DL-48322',
      game: 'val',
      title: 'Duo Plus',
      units: 2,
      unit: 'hour',
      rank: 'Gold 3',
      region: 'EU',
      voice: false,
      gg: true,
      payoutUsdCents: 1420,
      ...base,
    },
    `${site}/claim/PREVIEWxxxxxxxxxxxxxxxxx`,
    { site, roleId: role, silent: true },
  ),
  'val',
);
const order = {
  reference: 'DL-48321',
  game: 'lol',
  title: 'Duo Pro',
  units: 3,
  unit: 'game',
};
await send(
  closedPost(
    {
      order,
      outcome: 'taken',
      at: now - 30_000,
      teammate: 'Kira',
      waitedMs: 127_000,
    },
    { site },
  ),
);
await send(
  closedPost(
    {
      order: {
        ...order,
        game: 'cs2',
        reference: 'DL-48323',
        title: 'Duo FACEIT',
      },
      outcome: 'expired',
      at: now,
    },
    { site },
  ),
);
await send(
  closedPost(
    {
      order: { ...order, game: 'fn', reference: 'DL-48324' },
      outcome: 'rerolled',
      at: now,
    },
    { site },
  ),
);
