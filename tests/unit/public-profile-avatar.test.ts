import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  avatarStorageOrigin,
  publicAvatarIsPhoto,
  publicAvatarValid,
} from '../../src/server/teammates/public-avatar';
import {
  publicCardSchema,
  publicProfileSchema,
} from '../../src/server/teammates/public-profile-schemas';
import { fixtureLookup } from '../../src/server/teammates/profile-fixtures';
import { profileSchemas } from '../../src/server/teammates/profile-page';

const HOST = 'https://abcdefghij.supabase.co';
const USER = '3f9b7c21-5d64-4ab8-9f0e-2c7d81a4e6b5';
const upload = (path: string) =>
  `${HOST}/storage/v1/object/public/avatars/${path}`;
const own = upload(`${USER}/7c1a4e9b20d53f68.webp`);
const project = () => vi.stubEnv('SUPABASE_URL', HOST);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('avatars a public profile may print', () => {
  it('takes the ten mascots and the art that ships with the site', () => {
    project();
    for (let n = 1; n <= 10; n += 1)
      expect(publicAvatarValid(`/assets/avatars/avatar-${n}.png`)).toBe(true);
    /*
     * Unchanged from before the photos: anything under /assets/avatars is site art the build
     * ships, so the schema takes it. Only the mascots are ever chosen on an account, and the
     * read function in Postgres emits nothing else from this folder.
     */
    expect(publicAvatarValid('/assets/avatars/crew/nyx.webp')).toBe(true);
    expect(publicAvatarValid('/assets/avatars/avatar-11.png')).toBe(true);
    /* Mascots keep working with no Supabase project configured at all. */
    vi.unstubAllEnvs();
    vi.stubEnv('SUPABASE_URL', '');
    expect(publicAvatarValid('/assets/avatars/avatar-1.png')).toBe(true);
  });

  it('takes an upload from this project, in webp and in jpg', () => {
    project();
    expect(publicAvatarValid(own)).toBe(true);
    expect(publicAvatarValid(upload(`${USER}/00112233445566ff.jpg`))).toBe(
      true,
    );
  });

  it.each([
    ['another project', own.replace('abcdefghij', 'somebodyelse')],
    ['a lookalike host', own.replace('abcdefghij.supabase.co', 'evil.invalid')],
    [
      'a host that only ends in the right suffix',
      own.replace('abcdefghij.supabase.co', 'abcdefghij.supabase.co.evil.test'),
    ],
    ['plain http', own.replace('https://', 'http://')],
    ['credentials in the URL', own.replace('https://', 'https://user:pw@')],
    ['a query string', `${own}?download=1`],
    ['a fragment', `${own}#x`],
    [
      'another bucket',
      upload(`${USER}/7c1a4e9b20d53f68.webp`).replace('/avatars/', '/proofs/'),
    ],
    [
      'a private object path',
      own.replace('/object/public/', '/object/authenticated/'),
    ],
    ['a nested file', upload(`${USER}/sub/7c1a4e9b20d53f68.webp`)],
    ['a short hash', upload(`${USER}/7c1a4e9b20d53f6.webp`)],
    ['an upper case hash', upload(`${USER}/7C1A4E9B20D53F68.webp`)],
    ['a hash that is not hex', upload(`${USER}/7c1a4e9b20d53fzz.webp`)],
    ['another file type', upload(`${USER}/7c1a4e9b20d53f68.svg`)],
    ['a folder that is not a user id', upload('nyx/7c1a4e9b20d53f68.webp')],
    [
      'a traversal out of the folder',
      upload(`${USER}/../7c1a4e9b20d53f68.webp`),
    ],
    ['art from elsewhere on the site', '/assets/games/val.png'],
    ['a data URL', 'data:image/webp;base64,AAAA'],
    ['a script URL', 'javascript:alert(1)'],
    ['nothing at all', ''],
  ])('refuses %s', (_label, value) => {
    project();
    expect(publicAvatarValid(value)).toBe(false);
  });

  it('refuses every upload when there is no project host to pin it to', () => {
    vi.stubEnv('SUPABASE_URL', 'http://localhost:54321');
    expect(publicAvatarValid(own)).toBe(false);
    expect(avatarStorageOrigin({})).toBe(null);
    expect(avatarStorageOrigin({ SUPABASE_URL: 'not a url' })).toBe(null);
    expect(avatarStorageOrigin({ SUPABASE_URL: `${HOST}/` })).toBe(HOST);
  });

  it('tells a photo apart from a mascot for the renderer', () => {
    expect(publicAvatarIsPhoto(own)).toBe(true);
    expect(publicAvatarIsPhoto('/assets/avatars/avatar-1.png')).toBe(false);
  });
});

describe('the read schemas', () => {
  const profile = () => {
    const found = fixtureLookup('nyx');
    if (found.status !== 'ok') throw new Error('fixture missing');
    return found.profile;
  };
  const card = {
    slug: 'nyx',
    name: 'Nyx',
    avatar: '/assets/avatars/avatar-1.png',
    accent: 'mint',
    tier: 'rookie',
    online: true,
    game: 'val',
    rank: null,
    rating: null,
  };

  it('lets a photo through and keeps a foreign one out', () => {
    project();
    expect(
      publicProfileSchema.safeParse({ ...profile(), avatar: own }).success,
    ).toBe(true);
    expect(publicCardSchema.safeParse({ ...card, avatar: own }).success).toBe(
      true,
    );
    const foreign = own.replace('abcdefghij', 'somebodyelse');
    expect(
      publicProfileSchema.safeParse({ ...profile(), avatar: foreign }).success,
    ).toBe(false);
    expect(
      publicCardSchema.safeParse({ ...card, avatar: foreign }).success,
    ).toBe(false);
  });

  /* The Person image in the page's structured data is the photo itself, not a site path. */
  it('publishes the photo as the Person image', () => {
    project();
    const schema = profileSchemas(
      { ...profile(), avatar: own },
      new URL('https://duoly.gg'),
    );
    expect(schema[0]!.mainEntity).toMatchObject({ image: own });
  });
});
