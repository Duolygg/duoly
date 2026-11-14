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
    games: p.games.map((g) => ({
      name: profileGame(g.game).name,
      img: profileGame(g.game).img,
      rank: g.verified ? g.rank : null,
      peak: g.verified ? g.peakRank : null,
      roles: g.roles,
    })),
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
