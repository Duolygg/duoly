/**
 * Deletes storage files nobody uses any more: old profile photos and headers, and every file of a
 * deleted account. The database decides what goes (public.storage_cleanup, filled by triggers in
 * 20261113100100_storage_cleanup.sql) and re-checks at claim time that no profile or chat still
 * shows a replaced file. This only does what Postgres cannot: call the Storage API.
 *
 * Runs from /api/internal/reconcile when duoly-background-fix finds queued files. Deleting a file
 * that is already gone succeeds, so a repeat after a lost answer is harmless.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type StorageCleanupResult = { deleted: number; failed: number };

type Claimed = { bucket: string; path: string };

const BUCKETS = new Set(['avatars', 'profile-headers']);
const PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{16}\.(webp|jpg)$/;

export async function drainStorageCleanup(
  db: SupabaseClient,
  limit = 100,
): Promise<StorageCleanupResult> {
  const { data, error } = await db.rpc('storage_cleanup_claim', {
    p_limit: limit,
  });
  if (error) throw new Error(`claim: ${error.message}`);
  const byBucket = new Map<string, string[]>();
  for (const row of (data ?? []) as Claimed[]) {
    // The table's own checks already hold these; a second look costs nothing before a delete.
    if (!BUCKETS.has(row.bucket) || !PATH.test(row.path)) continue;
    byBucket.set(row.bucket, [...(byBucket.get(row.bucket) ?? []), row.path]);
  }
  const result: StorageCleanupResult = { deleted: 0, failed: 0 };
  for (const [bucket, paths] of byBucket) {
    const removed = await db.storage.from(bucket).remove(paths);
    const ok = !removed.error;
    const finished = await db.rpc('storage_cleanup_finish', {
      p_bucket: bucket,
      p_paths: paths,
      p_deleted: ok,
    });
    if (finished.error) throw new Error(`finish: ${finished.error.message}`);
    if (ok) result.deleted += paths.length;
    else result.failed += paths.length;
  }
  return result;
}
