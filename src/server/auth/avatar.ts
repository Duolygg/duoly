import { createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Largest avatar we store: the browser crops to 256×256 (~20 KB WebP). */
export const MAX_AVATAR_BYTES = 96 * 1024;

export type DecodedAvatar = {
  bytes: Buffer;
  ext: 'webp' | 'jpg';
  type: string;
};

/** Pure: validates a data URL from the profile cropper by its real file signature. */
export function decodeAvatar(dataUrl: unknown): DecodedAvatar | null {
  if (typeof dataUrl !== 'string' || dataUrl.length > 140_000) return null;
  const match = /^data:image\/(webp|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    dataUrl,
  );
  if (!match) return null;
  const bytes = Buffer.from(match[2]!, 'base64');
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
