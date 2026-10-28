import { describe, expect, it } from 'vitest';
import { decodeAvatar } from '../../src/server/auth/avatar';
import { eurToUsd, parseEcbUsd, resetFxCache } from '../../src/server/fx';
import { ProfileUpdateSchema } from '../../src/contracts/account';

const webp = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WEBPVP8 '),
  Buffer.alloc(80, 1),
]);
const jpeg = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(80, 2),
]);
const url = (type: string, bytes: Buffer) =>
  `data:image/${type};base64,${bytes.toString('base64')}`;

describe('avatar uploads', () => {
  it('accepts WebP and JPEG by their real signature', () => {
    expect(decodeAvatar(url('webp', webp))?.ext).toBe('webp');
    expect(decodeAvatar(url('jpeg', jpeg))?.ext).toBe('jpg');
  });
  it('rejects mismatched, oversized and non-image payloads', () => {
    expect(decodeAvatar(url('webp', jpeg))).toBeNull();
    expect(decodeAvatar(url('png', webp))).toBeNull();
    expect(
      decodeAvatar(url('jpeg', Buffer.concat([jpeg, Buffer.alloc(100_000)]))),
    ).toBeNull();
    expect(decodeAvatar('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
    expect(decodeAvatar(42)).toBeNull();
  });
  it('lets profiles point only at uploaded avatars or presets', () => {
    const base = { name: 'Player', country: '' };
    const own =
      'https://omnejesspybaxuacjlah.supabase.co/storage/v1/object/public/avatars/5e100000-0000-4000-8000-000000000001/0123456789abcdef.webp';
    expect(ProfileUpdateSchema.safeParse({ ...base, image: own }).success).toBe(
      true,
    );
    expect(
      ProfileUpdateSchema.safeParse({
        ...base,
        image: 'https://evil.example/a.webp',
      }).success,
    ).toBe(false);
  });
});

describe('ECB exchange rate', () => {
  const xml = `<Cube currency='USD' rate='1.0921'/><Cube currency='JPY' rate='160.1'/>`;
  it('parses the USD rate', () => {
    expect(parseEcbUsd(xml)).toBe(1.0921);
    expect(parseEcbUsd('<nothing/>')).toBeNull();
  });
  it('caches the ECB rate and falls back when unreachable', async () => {
    resetFxCache();
    let calls = 0;
    const ok = (async () => {
      calls += 1;
      return new Response(xml);
    }) as unknown as typeof fetch;
    expect(await eurToUsd(ok, 1_000)).toMatchObject({
      rate: 1.0921,
      source: 'ecb',
    });
    expect(await eurToUsd(ok, 2_000)).toMatchObject({
      rate: 1.0921,
      source: 'ecb',
    });
    expect(calls).toBe(1);
    resetFxCache();
    const down = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await eurToUsd(down, 3_000)).toMatchObject({
      rate: 1.08,
      source: 'fallback',
    });
  });
});
