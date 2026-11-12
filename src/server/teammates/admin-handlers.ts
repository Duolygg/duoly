import { z } from 'zod';
import { adminRoute } from '../admin/handlers';
import { slugValid } from '../../contracts/teammate-profile';
import { ranksForGame } from '../../contracts/public-profile-admin';
type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
export const adminPublicProfile = adminRoute(
  (client, context) => {
    const id = z.uuid().safeParse(context.url.searchParams.get('userId'));
    if (!id.success)
      return Promise.resolve({
        data: { error: { code: 400, message: 'Invalid teammate.' } },
        error: null,
      });
    return (client.rpc.bind(client) as unknown as Rpc)(
      'admin_public_profile_get',
      { p_user_id: id.data },
    );
  },
  [
    {
      schema: z
        .object({
          csrf: z.string(),
          action: z.literal('rank'),
          userId: z.uuid(),
          game: z.string().min(2).max(8),
          rank: z.string().nullable(),
          peakRank: z.string().nullable(),
          verified: z.boolean(),
        })
        .strict()
        .refine(
          (v) =>
            (v.rank === null || ranksForGame(v.game).includes(v.rank)) &&
            (v.peakRank === null ||
              ranksForGame(v.game).includes(v.peakRank)) &&
            (!v.verified || v.rank !== null),
        ),
      call: (client, b) =>
        (client.rpc.bind(client) as unknown as Rpc)('admin_set_game_rank', {
          p_user_id: b.userId,
          p_game: b.game,
          p_rank: b.rank,
          p_peak_rank: b.peakRank,
          p_verified: b.verified,
        }),
    },
    {
      schema: z
        .object({
          csrf: z.string(),
          action: z.literal('hide'),
          slug: z.string().refine(slugValid),
          hidden: z.boolean(),
          reason: z.string().trim().min(1).max(500),
        })
        .strict(),
      call: (client, b) =>
        (client.rpc.bind(client) as unknown as Rpc)(
          'admin_hide_public_profile',
          { p_slug: b.slug, p_hidden: b.hidden, p_reason: b.reason },
        ),
    },
  ],
  ['teammates'],
);
