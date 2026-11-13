import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { drainStorageCleanup } from '../../src/server/storage-cleanup';

const USER = '9f4703b0-7758-4270-8391-8da62db44ba4';
const A = `${USER}/0123456789abcdef.webp`;
const B = `${USER}/fedcba9876543210.jpg`;

function fake(claimed: unknown[], failBucket?: string) {
  const removed: Array<[string, string[]]> = [];
  const finished: unknown[] = [];
  const client = {
    rpc: async (name: string, args: unknown) => {
      if (name === 'storage_cleanup_claim')
        return { data: claimed, error: null };
      finished.push(args);
      return { data: 1, error: null };
    },
    storage: {
      from: (bucket: string) => ({
        remove: async (paths: string[]) => {
          removed.push([bucket, paths]);
          return bucket === failBucket
            ? { data: null, error: { message: 'boom' } }
            : { data: [], error: null };
        },
      }),
    },
  } as unknown as SupabaseClient;
  return { client, removed, finished };
}

describe('drainStorageCleanup', () => {
  it('deletes each bucket in one call and marks the rows done', async () => {
    const f = fake([
      { bucket: 'avatars', path: A },
      { bucket: 'profile-headers', path: B },
      { bucket: 'avatars', path: B },
    ]);
    await expect(drainStorageCleanup(f.client)).resolves.toStrictEqual({
      deleted: 3,
      failed: 0,
    });
    expect(f.removed).toStrictEqual([
      ['avatars', [A, B]],
      ['profile-headers', [B]],
    ]);
    expect(f.finished).toStrictEqual([
      { p_bucket: 'avatars', p_paths: [A, B], p_deleted: true },
      { p_bucket: 'profile-headers', p_paths: [B], p_deleted: true },
    ]);
  });

  it('counts a failed attempt and keeps the rows for the next run', async () => {
    const f = fake([{ bucket: 'avatars', path: A }], 'avatars');
    await expect(drainStorageCleanup(f.client)).resolves.toStrictEqual({
      deleted: 0,
      failed: 1,
    });
    expect(f.finished).toStrictEqual([
      { p_bucket: 'avatars', p_paths: [A], p_deleted: false },
    ]);
  });

  it('never deletes outside the two photo buckets or the owner/hash.ext shape', async () => {
    const f = fake([
      { bucket: 'order-proof', path: A },
      { bucket: 'avatars', path: '../x' },
      { bucket: 'avatars', path: `${USER}/` },
      { bucket: 'avatars', path: `${USER}/0123456789abcdef.png` },
    ]);
    await expect(drainStorageCleanup(f.client)).resolves.toStrictEqual({
      deleted: 0,
      failed: 0,
    });
    expect(f.removed).toStrictEqual([]);
  });

  it('does nothing when the queue is empty', async () => {
    const f = fake([]);
    await expect(drainStorageCleanup(f.client)).resolves.toStrictEqual({
      deleted: 0,
      failed: 0,
    });
    expect(f.removed).toStrictEqual([]);
  });
});
