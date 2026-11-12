import { createHash } from 'node:crypto';
import { supportService } from '../support/store';

export const MAX_HEADER_BYTES = 300 * 1024;
export type DecodedHeader =
  | { bytes: Buffer; ext: 'webp'; type: 'image/webp' }
  | { bytes: Buffer; ext: 'jpg'; type: 'image/jpeg' };

/**
 * WebP, or JPEG for browsers that cannot encode WebP from a canvas (Safari). The file
 * signature decides, never the MIME label.
 */
export function decodeHeader(dataUrl: unknown): DecodedHeader | null {
  if (typeof dataUrl !== 'string' || dataUrl.length > 409_624) return null;
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
    bytes.length > MAX_HEADER_BYTES ||
    bytes.toString('base64') !== match[2] ||
    (match[1] === 'webp' ? !webp : !jpeg)
  )
    return null;
  return match[1] === 'webp'
    ? { bytes, ext: 'webp', type: 'image/webp' }
    : { bytes, ext: 'jpg', type: 'image/jpeg' };
}

/** Paths come from the constrained database column, never from a caller-supplied URL. */
function objectPath(url: string, userId: string): string | null {
  const path = new URL(url).pathname.split('/profile-headers/')[1];
  return path &&
    path.startsWith(userId + '/') &&
    /^[0-9a-f-]{36}\/[0-9a-f]{16}\.(webp|jpg)$/.test(path)
    ? path
    : null;
}

async function changeHeader(
  userId: string,
  header: DecodedHeader | null,
): Promise<string | true | null> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      userId,
    )
  )
    return null;
  const db = supportService();
  if (!db) return null;
  const current = await db
    .from('teammate_public_profiles')
    .select('header_image')
    .eq('user_id', userId)
    .single();
  if (current.error || !current.data) return null;
  const old = current.data.header_image as string | null;
  const bucket = db.storage.from('profile-headers');
  let url: string | null = null;
  if (header) {
    const name = createHash('sha256')
      .update(header.bytes)
      .digest('hex')
      .slice(0, 16);
    const path = `${userId}/${name}.${header.ext}`;
    const { error } = await bucket.upload(path, header.bytes, {
      contentType: header.type,
      cacheControl: '31536000',
      upsert: true,
    });
    if (error) return null;
    url = bucket.getPublicUrl(path).data.publicUrl;
  }
  // Compare-and-swap prevents a concurrent request from deleting another request's current image.
  let query = db
    .from('teammate_public_profiles')
    .update({ header_image: url, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  query =
    old === null
      ? query.is('header_image', null)
      : query.eq('header_image', old);
  const saved = await query.select('user_id').single();
  if (saved.error || !saved.data) return null;
  if (old && old !== url) {
    const path = objectPath(old, userId);
    // The durable cleanup queue retries API failures, including account deletions.
    if (path) await bucket.remove([path]);
  }
  return url ?? true;
}

export async function storeHeader(
  userId: string,
  decoded: DecodedHeader,
): Promise<string | null> {
  const result = await changeHeader(userId, decoded);
  return typeof result === 'string' ? result : null;
}
export async function removeHeader(userId: string): Promise<boolean> {
  return (await changeHeader(userId, null)) === true;
}
