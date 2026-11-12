import { waitUntil } from '@vercel/functions';
import { submissionPayload } from '../../../scripts/indexnow.mjs';
import { slugValid } from '../../contracts/teammate-profile';

/** Best effort, bounded, and never sends local/test URLs or fixture data. */
export function pingProfileChanges(
  before: { slug?: string; published?: boolean } | null,
  after: { slug: string; published: boolean },
) {
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.PUBLIC_PROFILES_ENABLED !== 'true' ||
    process.env.PUBLIC_PROFILE_FIXTURES === 'true'
  )
    return;
  if (before?.slug === after.slug && before?.published === after.published)
    return;
  const urls = [
    ...new Set(
      [before?.slug, after.slug].filter(
        (s): s is string => !!s && slugValid(s),
      ),
    ),
  ].map((s) => `https://duoly.gg/teammates/${s}`);
  if (!urls.length) return;
  const pending = fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(submissionPayload(urls)),
    signal: AbortSignal.timeout(5000),
  })
    .then(() => undefined)
    .catch(() => undefined);
  waitUntil(pending);
}
