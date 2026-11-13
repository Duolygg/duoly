/**
 * Trophy case, server side: proof images (private bucket, written here with the service key),
 * the teammate's own list and submissions (RPCs as the signed-in user), staff signed links and
 * the public read for the profile page.
 */
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  PublicTrophySchema,
  type PublicTrophy,
} from '../../contracts/trophies';
import { slugValid } from '../../contracts/teammate-profile';
import { authConfig } from '../auth/config';
import { supportService } from '../support/store';
import { fixturesEnabled } from './public-profiles';

export const PROOF_BUCKET = 'trophy-proofs';
export const MAX_PROOF_BYTES = 900 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{16}\.(webp|jpg)$/;

export type DecodedProof =
  | { bytes: Buffer; ext: 'webp'; type: 'image/webp' }
  | { bytes: Buffer; ext: 'jpg'; type: 'image/jpeg' };

/** A WebP or JPEG data URL from the browser. The file signature decides, never the label. */
export function decodeProof(dataUrl: unknown): DecodedProof | null {
  if (
    typeof dataUrl !== 'string' ||
    dataUrl.length > Math.ceil((MAX_PROOF_BYTES * 4) / 3) + 32
  )
    return null;
  const match = /^data:image\/(webp|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    dataUrl,
  );
  if (!match) return null;
  const bytes = Buffer.from(match[2]!, 'base64');
  const webp =
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (
    bytes.length < 64 ||
    bytes.length > MAX_PROOF_BYTES ||
    bytes.toString('base64') !== match[2] ||
    (match[1] === 'webp' ? !webp : !jpeg)
  )
    return null;
  return match[1] === 'webp'
    ? { bytes, ext: 'webp', type: 'image/webp' }
    : { bytes, ext: 'jpg', type: 'image/jpeg' };
}

export const proofPath = (userId: string, proof: DecodedProof) =>
  `${userId}/${createHash('sha256').update(proof.bytes).digest('hex').slice(0, 16)}.${proof.ext}`;

/** Upload a proof image into the teammate's private folder. Returns the object path. */
export async function storeProof(
  userId: string,
  proof: DecodedProof,
): Promise<string | null> {
  if (!UUID.test(userId)) return null;
  const db = supportService();
  if (!db) return null;
  const path = proofPath(userId, proof);
  const { error } = await db.storage
    .from(PROOF_BUCKET)
    .upload(path, proof.bytes, { contentType: proof.type, upsert: true });
  return error ? null : path;
}

/** Best effort: a file whose submission failed. Missed ones are swept by storage cleanup. */
export async function discardProof(path: string): Promise<void> {
  if (!PATH.test(path)) return;
  await supportService()
    ?.storage.from(PROOF_BUCKET)
    .remove([path])
    .catch(() => undefined);
}

/** Short-lived links so staff can look at proof images. Paths come from the database only. */
export async function signProofs(
  paths: string[],
): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((p) => PATH.test(p)))];
  const out = new Map<string, string>();
  const db = supportService();
  if (!db || wanted.length === 0) return out;
  const { data } = await db.storage
    .from(PROOF_BUCKET)
    .createSignedUrls(wanted, 60 * 30);
  for (const row of data ?? [])
    if (row.path && row.signedUrl && !row.error)
      out.set(row.path, row.signedUrl);
  return out;
}

/** Approved trophies for a public profile. Any failure is an empty case, never a broken page. */
export async function loadPublicTrophies(
  slug: string,
): Promise<PublicTrophy[]> {
  if (fixturesEnabled()) {
    const { fixtureTrophies } = await import('./profile-fixtures');
    return fixtureTrophies(slug);
  }
  if (!slugValid(slug)) return [];
  const config = authConfig();
  if (!config) return [];
  try {
    const db = createClient(config.url, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await db.rpc('public_teammate_trophies', {
      p_slug: slug,
    });
    if (error || !Array.isArray(data)) return [];
    return data.flatMap((row) => {
      const parsed = PublicTrophySchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}
