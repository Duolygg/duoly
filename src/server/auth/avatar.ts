import { createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseGif } from '../../lib/gif';

/** Largest avatar we store: the browser crops to 256×256 (~20 KB WebP). */
export const MAX_AVATAR_BYTES = 96 * 1024;
/**
 * An animated GIF avatar, cut frame by frame in the browser (src/components/account/animated-image.ts,
 * AVATAR_GIF_MAX_BYTES), to a square from 128 to 256 pixels.
 */
export const MAX_AVATAR_GIF_BYTES = 1024 * 1024;
/** Room for the largest GIF as a data URL; /api/me/profile reads a body this big. */
export const MAX_AVATAR_DATA_URL = Math.ceil(MAX_AVATAR_GIF_BYTES / 3) * 4 + 32;

export type DecodedAvatar = {
  bytes: Buffer;
  ext: 'webp' | 'jpg' | 'gif';
  type: string;
};

/** Pure: validates a data URL from the profile cropper by its real file signature. */
export function decodeAvatar(dataUrl: unknown): DecodedAvatar | null {
  if (typeof dataUrl !== 'string' || dataUrl.length > MAX_AVATAR_DATA_URL)
    return null;
  const match =
    /^data:image\/(webp|jpeg|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) return null;
  const bytes = Buffer.from(match[2]!, 'base64');
  if (match[1] === 'gif') {
    if (bytes.length < 64 || bytes.length > MAX_AVATAR_GIF_BYTES) return null;
    const gif = parseGif(bytes, 1);
    return gif &&
      gif.width === gif.height &&
      gif.width >= 128 &&
      gif.width <= 256
      ? { bytes, ext: 'gif', type: 'image/gif' }
      : null;
  }
  if (bytes.length < 64 || bytes.length > MAX_AVATAR_BYTES) return null;
  const webp =
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (match[1] === 'webp' && webp)
    return { bytes, ext: 'webp', type: 'image/webp' };
  if (match[1] === 'jpeg' && jpeg)
    return { bytes, ext: 'jpg', type: 'image/jpeg' };
  return null;
}

let admin: { key: string; client: SupabaseClient } | null = null;
function storageAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? import.meta.env?.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? import.meta.env?.SUPABASE_SECRET_KEY;
  if (typeof url !== 'string' || typeof key !== 'string' || !url || !key)
    return null;
  if (admin?.key !== key)
    admin = {
      key,
      client: createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    };
  return admin.client;
}

/** Stores the avatar under the user's own folder and returns its public URL. */
export async function storeAvatar(
  userId: string,
  avatar: DecodedAvatar,
): Promise<string | null> {
  const client = storageAdmin();
  if (!client) return null;
  const name = createHash('sha256')
    .update(avatar.bytes)
    .digest('hex')
    .slice(0, 16);
  const path = `${userId}/${name}.${avatar.ext}`;
  const { error } = await client.storage
    .from('avatars')
    .upload(path, avatar.bytes, {
      contentType: avatar.type,
      cacheControl: '31536000',
      upsert: true,
    });
  if (error) return null;
  return client.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}
