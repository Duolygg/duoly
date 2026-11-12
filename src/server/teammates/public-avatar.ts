/**
 * The avatar a public profile is allowed to print: one of the ten mascots that ship with the
 * site, or the photo the teammate uploaded themselves.
 *
 * Uploads live in the public `avatars` bucket, one folder per account, 256x256 cropped WebP or
 * JPEG, written only by the server after it checked the real file signature
 * (20261023150000_avatar_uploads.sql, src/server/auth/avatar.ts).
 *
 * Two rules, in two places, so a face on a profile is always that teammate's own upload:
 *
 * - Postgres checks the folder against that teammate's own user id, which never leaves the
 *   database (public_teammate_profile in 20261112163000_public_profile_photos.sql).
 * - Here the host is pinned to this deployment's own Supabase project rather than to any
 *   *.supabase.co, so a URL from a project we do not run cannot be printed as a teammate's face
 *   even if one ever reached the column.
 *
 * SUPABASE_URL is the same variable the read path itself needs (src/server/auth/config.ts refuses
 * to build a client without a valid https://<ref>.supabase.co), so whenever there is profile data
 * to validate there is a host to pin it to.
 */

/** The ten presets any account can pick on /profile. */
const MASCOT = /^\/assets\/avatars\/avatar-(?:[1-9]|10)\.png$/;
/** Other art that ships in /public/assets/avatars, as the schema has always allowed. */
const SITE_ART = /^\/assets\/avatars\/[a-zA-Z0-9/_-]+\.(?:webp|png|jpg)$/;
/** One uploaded file: <user id>/<16 hex>.webp|jpg under the public avatars bucket. */
const UPLOAD_PATH =
  /^\/storage\/v1\/object\/public\/avatars\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\/[0-9a-f]{16}\.(?:webp|jpg)$/;

/** This deployment's own Supabase origin, or null when there is no usable one. */
export function avatarStorageOrigin(
  env: Record<string, string | undefined> = {
    SUPABASE_URL: process.env.SUPABASE_URL ?? import.meta.env?.SUPABASE_URL,
  },
): string | null {
  const raw: unknown = env.SUPABASE_URL;
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' &&
      /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

/** True for a mascot, for site art, and for an upload in this project's avatars bucket. */
export function publicAvatarValid(value: string): boolean {
  if (MASCOT.test(value) || SITE_ART.test(value)) return true;
  const origin = avatarStorageOrigin();
  if (!origin) return false;
  try {
    const url = new URL(value);
    return (
      url.origin === origin &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      UPLOAD_PATH.test(url.pathname)
    );
  } catch {
    return false;
  }
}

/**
 * A real photograph rather than a mascot. The mascots are transparent PNGs that stand in their
 * own light, so they are drawn as they are; a photo is a square crop and has to be clipped to the
 * ring and covered instead. Anything absolute got past publicAvatarValid, so it is an upload.
 */
export const publicAvatarIsPhoto = (value: string): boolean =>
  !value.startsWith('/');
