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
  return { status: 'missing' };
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
  return [];
}

/** Published profiles that pass the quality rule, for the sitemap. */
export async function loadIndexableProfiles(): Promise<
  { slug: string; updatedAt: string }[]
> {
  if (fixturesEnabled()) {
    const { fixtureIndexable } = await import('./profile-fixtures');
    return fixtureIndexable();
  }
  return [];
}
