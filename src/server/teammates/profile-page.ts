import {
  MIN_GAMES_FOR_WINRATE,
  MIN_REVIEWS_FOR_RATING,
  PROFILE_ACCENTS,
  PROFILE_ACCENT_GLOW,
  PROFILE_REVIEWS_MAX,
  profileIndexable,
  type ProfileAccent,
  type PublicProfileReview,
  type PublicTeammateProfile,
} from '../../contracts/teammate-profile';
import { SITE_GAMES, type SiteGame } from '../../site/games';
import { bookingHref, organizationSchema } from '../../site/seo';
import { AUTO_CANCEL_MINUTES } from '../seo/fees';
import { seoOffers } from '../seo/offers';
import type { ProfileLookup } from './public-profiles';
/**
 * The catalog entry for a game id. A profile only ever features a game an admin approved, so a
 * miss means the catalog and the database disagree; the page then prints the raw id rather than
 * throwing a 500 at a visitor.
 */
export const profileGame = (id: string): SiteGame =>
  SITE_GAMES.find((g) => g.id === id) ?? {
    id,
    name: id,
    img: '/assets/games/social.png',
    slug: id,
  };
/**
 * What a teammate's picks are called in each game. Roles and picks are typed by the teammate, so
 * the label has to be right for twenty games, not just the two the design started with. Anything
 * without an established word for it gets "Mains", which is what a player would say.
 */
const PICK_LABELS: Record<string, string> = {
  lol: 'Champions',
  wr: 'Champions',
  dota: 'Heroes',
  val: 'Agents',
  mr: 'Heroes',
  ow: 'Heroes',
  apex: 'Legends',
  r6: 'Operators',
  dl: 'Heroes',
  pu: 'Pokémon',
  rl: 'Cars',
  fc: 'Clubs',
};
export const pickLabel = (id: string) => PICK_LABELS[id] ?? 'Mains';
/**
 * The rank emblem on a game card: one solid geometric crest per game, filled with the game
 * colour, never an official rank badge and never a second copy of the game logo. The hero
 * lockup used to print the bare crest; next to the name it read as a warning sign, so it
 * names the game with the game's own icon instead.
 */
export const rankEmblem = (id: string) => ({
  shape:
    id === 'lol'
      ? 'M32 2 59 14l-5 33L32 70 10 47 5 14Z'
      : 'M32 2 60 19v30L32 70 4 49V19Z',
  mark: 'm18 43 14-17 14 17',
});
/** Accent and the light strength that goes with it, as inline custom properties. */
export const accentStyle = (accent: ProfileAccent) =>
  `--accent:${PROFILE_ACCENTS[accent]};--glow:${PROFILE_ACCENT_GLOW[accent]}`;
/**
 * The longest word in a display name, which is what the headline has to fit beside the mascot
 * on a narrow screen. Wrapping happens at spaces, so "Mary Jane" fits at the full display size
 * while "Crafty" is the one that has to step down.
 */
export const nameChars = (name: string) =>
  Math.max(
    1,
    ...name
      .trim()
      .split(/\s+/)
      .map((word) => word.length),
  );
export const profileMonth = (month: string) =>
  new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));
export function profilePresentation(p: PublicTeammateProfile) {
  const game = profileGame(p.featuredGame);
  const context = { customerCurrency: 'EUR' as const, eurToUsd: 1 };
  const cheapest = (category: 'teammate' | 'training') =>
    seoOffers(game.id, category, context).sort(
      (a, b) => a.amountMinor - b.amountMinor,
    )[0] ?? null;
  /** Null when the catalog sells nothing for this game: the page then shows no price at all. */
  const offer = cheapest('teammate');
  /** The coaching entry price, only when the catalog actually sells coaching here. */
  const coachOffer = p.coaching ? cheapest('training') : null;
  /*
   * The existing booking page, untouched. It used to be handed a ?teammate= slug it never read;
   * naming the teammate is the favorite, not a query parameter, so the link is the plain one.
   */
  const booking = (id: string, coaching = false) =>
    bookingHref(id, coaching ? { tab: 'training' } : {});
  const rating =
    p.rating && p.rating.count >= MIN_REVIEWS_FOR_RATING ? p.rating : null;
  const winRate =
    p.winRate && p.winRate.games >= MIN_GAMES_FOR_WINRATE ? p.winRate : null;
  const showSessions = p.tier !== 'rookie' && p.sessions >= 5;
  return {
    game,
    offer,
    coachOffer,
    booking,
    book: booking(game.id),
    primary: p.online ? `Book with ${p.name}` : `Book a ${game.name} teammate`,
    rating,
    winRate,
    showSessions,
    /** No stat has reached its sample minimum, so the row would be empty: show the new state. */
    showStats: Boolean(rating || winRate || showSessions),
    /** The trust plaque is a track record. A teammate without one does not wear it. */
    showTier: p.tier !== 'rookie',
  };
}
/**
 * The one line that closes the booking block, under the button, the price and the availability.
 * It says only what the favorite actually buys: the order reaches this teammate the moment it
 * goes public, with no priority delay, and a verified stand-in takes it while they are in a
 * match. An offline teammate cannot promise either, so that line sends the reader on instead.
 */
export const bookingLine = (p: PublicTeammateProfile) =>
  p.online
    ? `${p.name} sees your order with no queue delay. Busy? Another verified teammate takes it.`
    : `${p.name} is offline right now. A verified ${profileGame(p.featuredGame).name} teammate can take your order today.`;
/**
 * The three answers a profile owes a first time reader, written from the profile's own data.
 *
 * The page quality audit scored every profile 2 or 3: the markup carried a name, a rank plate,
 * labels and a price, and between 27 and 54 words of prose, so a visitor arriving from a search
 * for a player's name was given nothing to read and no answer to the obvious questions. What a
 * session is, what Duoly actually checked, and what happens when the player named at the top is
 * already in a match.
 *
 * Every sentence here is a fact the profile or the catalog holds. A teammate with no verified
 * rank, no languages, no second game and no finished sessions gets the honest version of each
 * answer rather than a filled-in template: the branches are the data, which is also what keeps
 * eight profiles from publishing the same paragraph.
 */
export function profileAnswers(p: PublicTeammateProfile) {
  const view = profilePresentation(p);
  const game = view.game;
  const featured = p.games.find((g) => g.game === p.featuredGame);
  const rank = featured?.verified ? featured.rank : null;
  const verified = p.games.filter((g) => g.verified && g.rank);
  const others = p.games
    .filter((g) => g.game !== p.featuredGame)
    .map((g) => {
      const name = profileGame(g.game).name;
      return g.verified && g.rank ? `${name} at ${g.rank}` : name;
    });
  const unit = view.offer?.unit ?? 'session';
  /** Minecraft and the Social hours are sold by the hour and have no match to win. */
  const hourly = unit === 'hour';
  /** Whether any teammate service for this game is priced off the customer's own rank. */
  const rankedPricing = seoOffers(game.id, 'teammate', {
    customerCurrency: 'EUR',
    eurToUsd: 1,
  }).some((offer) => offer.rank);
  const units = hourly ? 'hours' : `${unit}s`;
  const session: string[] = [];
  session.push(
    featured?.roles.length
      ? `${p.name} plays ${profileList(featured.roles)} in ${game.name}${
          featured.picks.length
            ? `, usually on ${profileList(featured.picks)}`
            : ''
        }.`
      : `${game.name} is the game ${p.name} is approved to play on Duoly.`,
  );
  if (rank)
    session.push(
      `That ${rank} is a rank Duoly checked${
        featured?.peakRank && featured.peakRank !== rank
          ? `, and the peak beside it is ${featured.peakRank}`
          : ''
      }.`,
    );
  else
    session.push(
      `No rank on ${p.name}'s profile is verified yet, so nothing here claims one: the games list says what an administrator approved ${p.name} to play.`,
    );
  if (p.languages.length)
    session.push(`Sessions with ${p.name} run in ${profileList(p.languages)}.`);
  else
    session.push(
      `The profile lists no language, so settle on one in the order chat before you queue.`,
    );
  if (others.length)
    session.push(
      `${profileList(others)} ${others.length > 1 ? 'are' : 'is'} on the profile too.`,
    );
  const how = [
    `You and ${p.name} each play on your own account and meet on Discord for voice, so a handle and a microphone are the whole kit.`,
    `A booking is the number of ${units} you choose at checkout, and you and ${p.name} agree a start time in the order chat before the first one.`,
  ];
  if (p.coaching && view.coachOffer)
    how.push(
      // No figure here: the page prints each price once, beside the button it
      // belongs to, and tests/profiles/public-profiles.spec.ts holds that rule.
      `${p.name} coaches ${game.name} as well, which is the same ${view.coachOffer.unit === 'hour' ? 'play' : 'games'} with the decisions explained as they happen, at the price beside the coaching button above.`,
    );
  how.push(
    hourly
      ? `There is no scoreline to promise here. What the booking buys is ${p.name} playing with you for those hours.`
      : `Nobody can promise how a ${game.name} match ends, ${p.name} included. What the booking buys is ${p.name} on your side for those ${units}.`,
  );
  const checked = [
    verified.length
      ? `An administrator approved every game on ${p.name}'s profile before it went public, and a rank reads verified only once Duoly has seen it. ${p.name} carries ${verified.length === 1 ? 'one verified rank' : `${verified.length} verified ranks`}: ${profileList(verified.map((g) => `${g.rank} in ${profileGame(g.game).name}`))}.`
      : `An administrator approved ${game.name} on ${p.name}'s profile before it went public. Duoly has verified no rank for ${p.name} yet, so no tier on this page is labelled that way.`,
    view.showSessions && view.rating
      ? `The ${p.sessions.toLocaleString('en-US')} sessions and the ${view.rating.average.toFixed(1)} rating from ${view.rating.count} reviews above are counted from finished orders, and the reviews were written by the customers who played them. ${p.name} has been on Duoly since ${profileMonth(p.memberSince)}.`
      : view.showSessions
        ? `The ${p.sessions.toLocaleString('en-US')} sessions above are counted from finished orders on Duoly, where ${p.name} has played since ${profileMonth(p.memberSince)}. Too few customers have rated those sessions for a rating to mean anything yet, so the page shows none.`
        : p.sessions > 0
          ? `${p.name} joined Duoly in ${profileMonth(p.memberSince)} and has ${p.sessions === 1 ? 'one finished session' : `${p.sessions} finished sessions`} here, which is too few for a rating or a win rate to say anything, so the page shows neither.`
          : `${p.name} joined Duoly in ${profileMonth(p.memberSince)} and has no finished sessions here yet, so there is no rating to read. The page shows what ${p.name} is approved to play and nothing it cannot back up.`,
    `Payment finishes on duoly.gg and never in a private message to ${p.name}, and nobody needs your login, because ${p.name} queues on a separate account. If a session with ${p.name} goes wrong, the order tools are where it belongs, and the Duoly terms carry the cancellation and refund rules.`,
  ];
  const busy = [
    `Nothing on this page reserves ${p.name} for you. The order goes out to every verified ${game.name} teammate on Duoly, so whoever accepts it first plays the session, and while ${p.name} is ${hourly ? 'in another session' : 'mid match'} that can be somebody else. ${
      p.online
        ? `If no ${game.name} teammate accepts within ${AUTO_CANCEL_MINUTES} minutes, the order cancels itself and your money comes straight back.`
        : `If no ${game.name} teammate accepts within ${AUTO_CANCEL_MINUTES} minutes, the order cancels itself and the full amount returns to your balance.`
    }`,
  ];
  busy.push(
    `${
      p.online
        ? `Booking from this page saves ${p.name} to your favorites first, which is the one thing that changes the queue: your next ${game.name} order appears for ${p.name} the moment it goes public, instead of after the delay every other teammate waits out.`
        : `${p.name} is offline right now, so an order placed today may sit until they are back. Booking from this page still saves ${p.name} to your favorites, and the next ${game.name} order you place appears for them the moment it goes public, ahead of the queue everyone else waits out.`
    }${
      view.offer
        ? ` The figure beside the booking button is where a ${game.name} session with ${p.name} starts, and checkout works out the exact total from the service you choose, the number of ${units}${rankedPricing ? ' and, on the ranked services, your own rank' : ' and nothing else'}.`
        : ''
    }`,
  );
  return [
    {
      id: 'session',
      heading: `What is a ${game.name} session with ${p.name} like?`,
      paragraphs: [session.join(' '), how.join(' ')],
    },
    {
      id: 'checks',
      heading: `What has Duoly checked about ${p.name}?`,
      paragraphs: checked,
    },
    {
      id: 'busy',
      heading: `What happens if ${p.name} is already in a game?`,
      paragraphs: busy,
    },
  ];
}
/**
 * What a booking button on a profile has to do before it opens booking.
 *
 * `customer` saves the teammate to their favorites first, which is the only thing that changes
 * the queue for them. `signin` has nobody to save for yet, so the buttons that name the teammate
 * go through sign-in and come back. `none` is a teammate or an admin reading a profile: they can
 * still book, they simply have no favorites list of their own.
 */
export type BookingMode = 'customer' | 'signin' | 'none';
export const bookingMode = (role: string | undefined): BookingMode =>
  !role ? 'signin' : role === 'customer' ? 'customer' : 'none';
/**
 * Only reviews with text become quote cards; the rest still count in the tag bars.
 * An odd number would leave a hole in the two column grid, so the first quote is
 * promoted to a full width lead and the grid always fills every cell.
 */
export function profileReviewLayout(reviews: PublicProfileReview[]) {
  const written = reviews
    .filter((r) => r.text.trim().length > 0)
    .slice(0, PROFILE_REVIEWS_MAX);
  const lead = written.length % 2 === 1 ? (written[0] ?? null) : null;
  return { lead, rest: lead ? written.slice(1) : written };
}
/** "German", "German and English", "German, English and Dutch". Never an ampersand. */
export function profileList(items: string[]) {
  if (items.length < 2) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
/** "an Immortal 3", "a Valorant": the rank and the game both follow the same rule. */
const profileArticle = (phrase: string) =>
  /^[aeiou]/i.test(phrase) ? 'an' : 'a';
/** A search result shows roughly 160 characters and reads as broken under about 70. */
const META_MAX = 160;
const META_MIN = 70;
/** "Calm comms. Clean utility." -> ["Calm comms.", "Clean utility."] */
const firstSentence = (text: string) => text.split(/(?<=[.!?])\s+/)[0] ?? text;
/**
 * Joins as many whole sentences as fit the search result. A sentence too long to fit is
 * retried as its own first sentence, which is how a 140 character bio still contributes
 * its opening line instead of being dropped whole.
 */
function fitDescription(sentences: string[], tail: string) {
  let text = '';
  for (const sentence of sentences) {
    for (const candidate of [sentence, firstSentence(sentence)]) {
      const next = text ? `${text} ${candidate}` : candidate;
      if (next.length <= META_MAX) {
        text = next;
        break;
      }
    }
  }
  if (!text) text = sentences[0] ?? '';
  if (text.length >= META_MIN) return text;
  const padded = `${text} ${tail}`;
  return padded.length <= META_MAX ? padded : text;
}
/**
 * Title and description are built only from facts that are on the page. A teammate without a
 * verified rank, without languages or without a bio simply gets a shorter description instead of
 * an empty "Speaks ." or a sentence that trails off.
 *
 * The description has to land inside the window a search result actually prints. A profile with
 * a bio used to run past 250 characters and lose its tail, and a profile with no bio, no
 * languages and no sessions stopped at 48, so the shortest ones end on what the page still
 * answers: the games and the price of a session.
 */
export function profileMetadata(p: PublicTeammateProfile) {
  const game = profileGame(p.featuredGame);
  const rank = p.games.find((g) => g.game === game.id && g.verified)?.rank;
  const { showSessions } = profilePresentation(p);
  const sentences = [
    `Meet ${p.name}, ${profileArticle(rank ?? game.name)} ${rank ? `${rank} ` : ''}${game.name} teammate on Duoly.`,
  ];
  if (p.languages.length) sentences.push(`Speaks ${profileList(p.languages)}.`);
  if (showSessions)
    sentences.push(`${p.sessions} sessions completed on Duoly.`);
  if (p.bio.trim()) sentences.push(p.bio.trim());
  return {
    title: `${p.name}, ${game.name}${rank ? ` ${rank}` : ''} teammate | Duoly`,
    description: fitDescription(
      sentences,
      `See the games ${p.name} plays and what a session costs before you book.`,
    ),
    indexing: profileIndexable(p)
      ? ('index, follow' as const)
      : ('noindex, follow' as const),
  };
}
export function profileRoute(enabled: boolean, result: ProfileLookup) {
  if (!enabled || result.status === 'missing') return { status: 404 as const };
  if (result.status === 'moved')
    return {
      status: 301 as const,
      location: `/teammates/${encodeURIComponent(result.slug)}`,
    };
  return { status: result.status === 'gone' ? (410 as const) : (200 as const) };
}
export function profileSchemas(p: PublicTeammateProfile, site: URL) {
  const view = profilePresentation(p);
  const url = new URL(`/teammates/${p.slug}`, site).href;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      url,
      dateModified: p.updatedAt,
      mainEntity: {
        '@type': 'Person',
        name: p.name,
        image: new URL(p.avatar, site).href,
        ...(p.bio.trim() ? { description: p.bio.trim() } : {}),
        ...(p.languages.length ? { knowsLanguage: p.languages } : {}),
        knowsAbout: p.games.map((g) => profileGame(g.game).name),
        ...(view.showSessions
          ? {
              interactionStatistic: {
                '@type': 'InteractionCounter',
                interactionType: 'https://schema.org/InteractAction',
                userInteractionCount: p.sessions,
              },
            }
          : {}),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        ['Duoly', '/'],
        ['Teammates', '/teammates'],
        [p.name, `/teammates/${p.slug}`],
      ].map(([name, path], i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name,
        item: new URL(path!, site).href,
      })),
    },
    /* The offered service, only while the catalog actually sells it for this game. */
    ...(view.offer
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: `${view.game.name} teammate sessions`,
            provider: organizationSchema(site),
            url,
            offers: {
              '@type': 'Offer',
              price: view.offer.price,
              priceCurrency: view.offer.currency,
              url: new URL(view.book, site).href,
            },
          },
        ]
      : []),
  ];
}
