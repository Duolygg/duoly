/**
 * Server read side of public teammate profiles.
 *
 * OWNERSHIP: the data worker (branch feat/teammate-profiles-data) replaces the bodies of these
 * functions with calls to the read functions in Postgres. Signatures are the contract with the
 * pages: do not change them without updating both branches.
 *
 * Until then (and in local dev and tests when PUBLIC_PROFILE_FIXTURES=true) they serve the
 * fixtures from ./profile-fixtures.ts so the page can be built and tested without the database.
 */
import type {
  PublicTeammateCard,
  PublicTeammateProfile,
} from '../../contracts/teammate-profile';

import { createClient } from '@supabase/supabase-js';
import { authConfig } from '../auth/config';
import { slugValid } from '../../contracts/teammate-profile';
import {
  publicLookupSchema,
  publicCardSchema,
  indexableSchema,
} from './public-profile-schemas';

async function readRpc(
  fn: string,
  args?: Record<string, unknown>,
): Promise<unknown> {
  const config = authConfig();
  if (!config) return null;
  try {
    const db = createClient(config.url, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await db.rpc(fn, args);
    return error ? null : data;
  } catch {
    return null;
  }
}

/** Feature flag. Off in production until launch: profile routes answer 404. */
export const publicProfilesEnabled = () =>
  process.env.PUBLIC_PROFILES_ENABLED === 'true';

export const fixturesEnabled = () =>
  process.env.PUBLIC_PROFILE_FIXTURES === 'true';

export type ProfileLookup =
  | { status: 'ok'; profile: PublicTeammateProfile }
  | { status: 'moved'; slug: string } // an old slug: 301 to the current one
  | { status: 'gone' } // unpublished, hidden, suspended or deleted: 410
  | { status: 'missing' }; // never existed: 404

export async function loadPublicProfile(slug: string): Promise<ProfileLookup> {
  if (fixturesEnabled()) {
    const { fixtureLookup } = await import('./profile-fixtures');
    return fixtureLookup(slug);
  }
  if (!slugValid(slug)) return { status: 'missing' };
  const result = publicLookupSchema.safeParse(
    await readRpc('public_teammate_profile', { p_slug: slug }),
  );
  return result.success ? result.data : { status: 'missing' };
}

export async function loadTeammateCards(options: {
  game?: string;
  limit: number;
  excludeSlug?: string;
}): Promise<PublicTeammateCard[]> {
  if (fixturesEnabled()) {
    const { fixtureCards } = await import('./profile-fixtures');
    return fixtureCards(options);
  }
  const raw = await readRpc('public_teammate_cards', {
    p_game: options.game ?? null,
    p_limit: Math.max(1, Math.min(100, Math.trunc(options.limit) || 6)),
    p_exclude_slug: options.excludeSlug ?? null,
  });
  const result = publicCardSchema.array().safeParse(raw);
  return result.success ? result.data : [];
}

/** Published profiles that pass the quality rule, for the sitemap. */
export async function loadIndexableProfiles(): Promise<
  { slug: string; updatedAt: string }[]
> {
  if (fixturesEnabled()) {
    const { fixtureIndexable } = await import('./profile-fixtures');
    return fixtureIndexable();
  }
  const result = indexableSchema.safeParse(
    await readRpc('public_teammate_indexable'),
  );
  return result.success ? result.data : [];
}
