import type { APIRoute } from 'astro';
import {
  loadPublicProfile,
  publicProfilesEnabled,
} from '../../../server/teammates/public-profiles';
import {
  profileGame,
  profileMonth,
  profilePresentation,
} from '../../../server/teammates/profile-page';
import { publicAvatarIsPhoto } from '../../../server/teammates/public-avatar';
import { loadPublicTrophies } from '../../../server/teammates/trophies';
import { trophyCase } from '../../../server/teammates/trophy-view';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Public profile data only, and it changes rarely: a minute keeps the panel instant.
      'Cache-Control': status === 200 ? 'public, max-age=60' : 'no-store',
    },
  });

/*
 * GET /api/teammates/preview?slug=nyx: the directory's quick view. Every field is one the public
 * profile page at /teammates/<slug> already shows; this is that page's essentials as JSON.
 */
export const GET: APIRoute = async ({ url }) => {
  if (!publicProfilesEnabled()) return json({ error: 'Not found.' }, 404);
  const slug = url.searchParams.get('slug') ?? '';
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 24)
    return json({ error: 'Not found.' }, 404);
  const result = await loadPublicProfile(slug);
  if (result.status !== 'ok') return json({ error: 'Not found.' }, 404);
  const p = result.profile;
  const view = profilePresentation(p);
  /* Approved trophies count as verification too, so a teammate whose ranks were checked through
     the trophy case never reads "Rank not verified" here. Rarest first, then most recent. */
  const trophies = trophyCase(await loadPublicTrophies(p.slug));
  const trophyRank = (game: string) => {
    const mine = trophies.filter((t) => t.game === game);
    const best =
      mine
        .filter((t) => t.kind === 'rank')
        .reduce<(typeof mine)[number] | undefined>(
          (a, b) => (!a || b.tierOrder > a.tierOrder ? b : a),
          undefined,
        ) ?? mine[0];
    return best ? { rank: best.name, peak: null } : null;
  };
  return json({
    slug: p.slug,
    name: p.name,
    avatar: p.avatar,
    photo: publicAvatarIsPhoto(p.avatar),
    header: p.header ?? null,
    tier: p.tier === 'rookie' ? null : p.tier,
    online: p.online,
    gamerGirl: p.gamerGirl === true,
    bio: p.bio,
    vibeTags: p.vibeTags,
    languages: p.languages,
    country: p.country,
    memberSince: profileMonth(p.memberSince),
    games: p.games.map((g) => {
      const fromProfile =
        g.verified && g.rank ? { rank: g.rank, peak: g.peakRank } : null;
      const verified = fromProfile ?? trophyRank(g.game);
      return {
        name: profileGame(g.game).name,
        img: profileGame(g.game).img,
        rank: verified?.rank ?? null,
        peak: verified?.peak ?? null,
        roles: g.roles,
      };
    }),
    rating: view.rating,
    sessions: view.showSessions ? p.sessions : null,
    winRate: view.winRate,
    reviews: p.reviews
      .filter((r) => r.text.trim())
      .slice(0, 2)
      .map((r) => ({
        rating: r.rating,
        text: r.text,
        game: profileGame(r.game).name,
        month: profileMonth(r.month),
      })),
    price: view.offer
      ? { display: view.offer.display, unit: view.offer.unit }
      : null,
    book: view.book,
    profile: `/teammates/${p.slug}`,
    gameName: view.game.name,
  });
};
