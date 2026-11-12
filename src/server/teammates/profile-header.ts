import { createHash } from 'node:crypto';
import { supportService } from '../support/store';

export const MAX_HEADER_BYTES = 300 * 1024;
export type DecodedHeader = { bytes: Buffer; ext: 'webp'; type: 'image/webp' };

/** Only accept WebP, never a MIME label standing in for a file signature. */
export function decodeHeader(dataUrl: unknown): DecodedHeader | null {
  if (typeof dataUrl !== 'string' || dataUrl.length > 409_623) return null;
  const match = /^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) return null;
  const bytes = Buffer.from(match[1]!, 'base64');
  if (bytes.length < 64 || bytes.length > MAX_HEADER_BYTES || bytes.toString('base64') !== match[1] || bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP') return null;
  return {bytes, ext: 'webp', type: 'image/webp'};
}

/** Paths come from the constrained database column, never from a caller-supplied URL. */
function objectPath(url: string, userId: string): string | null {
  const path = new URL(url).pathname.split('/profile-headers/')[1];
  return path && path.startsWith(userId + '/') && /^[0-9a-f-]{36}\/[0-9a-f]{16}\.webp$/.test(path) ? path : null;
}

async function changeHeader(userId: string, header: DecodedHeader | null): Promise<string | true | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(userId)) return null;
  const db = supportService();
  if (!db) return null;
  const current = await db.from('teammate_public_profiles').select('header_image').eq('user_id', userId).single();
  if (current.error || !current.data) return null;
  const old = current.data.header_image as string | null;
  const bucket = db.storage.from('profile-headers');
  let url: string | null = null;
  if (header) {
    const name = createHash('sha256').update(header.bytes).digest('hex').slice(0, 16);
    const path = `${userId}/${name}.webp`;
    const {error} = await bucket.upload(path, header.bytes, {contentType: 'image/webp', cacheControl: '31536000', upsert: true});
    if (error) return null;
    url = bucket.getPublicUrl(path).data.publicUrl;
  }
  // Compare-and-swap prevents a concurrent request from deleting another request's current image.
  let query = db.from('teammate_public_profiles').update({header_image: url, updated_at: new Date().toISOString()}).eq('user_id', userId);
  query = old === null ? query.is('header_image', null) : query.eq('header_image', old);
  const saved = await query.select('user_id').single();
  if (saved.error || !saved.data) return null;
  if (old && old !== url) {
    const path = objectPath(old, userId);
    // The durable cleanup queue retries API failures, including account deletions.
    if (path) await bucket.remove([path]);
  }
  return url ?? true;
}

export async function storeHeader(userId: string, decoded: DecodedHeader): Promise<string | null> {
  const result = await changeHeader(userId, decoded);
  return typeof result === 'string' ? result : null;
}
export async function removeHeader(userId: string): Promise<boolean> {
  return (await changeHeader(userId, null)) === true;
}
