import { createHash } from 'node:crypto';
import { supportService } from '../support/store';
import { parseGif } from '../../lib/gif';

export const MAX_HEADER_BYTES = 300 * 1024;
/**
 * An animated GIF header, cut frame by frame in the browser (src/components/account/animated-image.ts,
 * HEADER_GIF_MAX_BYTES), to a 3:1 strip from 600 by 200 to 1500 by 500.
 */
export const MAX_HEADER_GIF_BYTES = 2560 * 1024;
/** Room for the largest GIF as a data URL; the header endpoint reads a body this big. */
export const MAX_HEADER_DATA_URL = Math.ceil(MAX_HEADER_GIF_BYTES / 3) * 4 + 32;
export type DecodedHeader =
  | { bytes: Buffer; ext: 'webp'; type: 'image/webp' }
  | { bytes: Buffer; ext: 'jpg'; type: 'image/jpeg' }
  | { bytes: Buffer; ext: 'gif'; type: 'image/gif' };

/**
 * WebP, or JPEG for browsers that cannot encode WebP from a canvas (Safari), or an animated GIF.
 * The file signature decides, never the MIME label.
 */
export function decodeHeader(dataUrl: unknown): DecodedHeader | null {
  if (typeof dataUrl !== 'string' || dataUrl.length > MAX_HEADER_DATA_URL)
    return null;
  const match =
    /^data:image\/(webp|jpeg|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) return null;
  const bytes = Buffer.from(match[2]!, 'base64');
  if (match[1] === 'gif') {
    if (
      bytes.length < 64 ||
      bytes.length > MAX_HEADER_GIF_BYTES ||
      bytes.toString('base64') !== match[2]
    )
      return null;
    const gif = parseGif(bytes, 1);
    return gif &&
      gif.width === gif.height * 3 &&
      gif.height >= 200 &&
      gif.height <= 500
      ? { bytes, ext: 'gif', type: 'image/gif' }
      : null;
  }
  if (dataUrl.length > 409_624) return null;
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
    /^[0-9a-f-]{36}\/[0-9a-f]{16}\.(webp|jpg|gif)$/.test(path)
    ? path
    : null;
}

/** Failures used to vanish into a bare 503; say which step failed (no user data, no image). */
const fail = (
  step: string,
  error?: { message?: string; code?: string } | null,
) => {
  console.error(
    `[profile-header] ${step} failed`,
    error?.code ?? '',
    error?.message ?? '',
  );
  return null;
};

/** The teammate has never saved a public profile, so there is no row to hang a header on. */
export const NO_PROFILE = 'no-profile' as const;

async function changeHeader(
  userId: string,
  header: DecodedHeader | null,
): Promise<string | true | typeof NO_PROFILE | null> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      userId,
    )
  )
    return null;
  const db = supportService();
  if (!db) return fail('config');
  const readHeader = () =>
    db
      .from('teammate_public_profiles')
      .select('header_image')
      .eq('user_id', userId)
      .maybeSingle();
  const current = await readHeader();
  if (current.error) return fail('read', current.error);
  if (!current.data) return NO_PROFILE;
  let old = current.data.header_image as string | null;
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
    if (error) return fail('upload', error as { message?: string });
    url = bucket.getPublicUrl(path).data.publicUrl;
  }
  // Compare-and-swap prevents a concurrent request from deleting another request's current image.
  const swap = (from: string | null) => {
    const query = db
      .from('teammate_public_profiles')
      .update({ header_image: url, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    return (
      from === null
        ? query.is('header_image', null)
        : query.eq('header_image', from)
    )
      .select('user_id')
      .maybeSingle();
  };
  let saved = await swap(old);
  if (!saved.error && !saved.data) {
    // Another request (a double tap, a second tab) changed the header in between. The newest
    // choice wins: read the header again and swap once more instead of failing the save.
    const again = await readHeader();
    if (again.error) return fail('reread', again.error);
    if (!again.data) return NO_PROFILE;
    old = again.data.header_image as string | null;
    saved =
      old === url
        ? ({ data: { user_id: userId }, error: null } as typeof saved)
        : await swap(old);
  }
  if (saved.error || !saved.data) return fail('save', saved.error);
  if (old && old !== url) {
    const path = objectPath(old, userId);
    // The durable cleanup queue retries API failures, including account deletions.
    if (path) {
      try {
        const { error } = await bucket.remove([path]);
        if (error) fail('cleanup', error);
      } catch {
        // The database change is already durable. A cleanup outage must not report a failed save.
        fail('cleanup');
      }
    }
  }
  return url ?? true;
}

export async function storeHeader(
  userId: string,
  decoded: DecodedHeader,
): Promise<string | typeof NO_PROFILE | null> {
  const result = await changeHeader(userId, decoded);
  return typeof result === 'string' ? result : null;
}
export async function removeHeader(userId: string): Promise<boolean> {
  const result = await changeHeader(userId, null);
  return result === true || result === NO_PROFILE;
}
