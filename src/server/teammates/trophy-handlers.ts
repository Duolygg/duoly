import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  OwnTrophySchema,
  TrophySubmissionSchema,
  defaultRarity,
  RARITIES,
} from '../../contracts/trophies';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import { adminRoute } from '../admin/handlers';
import { publicProfilesEnabled } from './public-profiles';
import {
  decodeProof,
  discardProof,
  signProofs,
  storeProof,
  MAX_PROOF_BYTES,
} from './trophies';

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;

const RequestSchema = z.discriminatedUnion('action', [
  z.strictObject({
    csrf: z.string(),
    action: z.literal('submit'),
    trophy: z.unknown(),
    image: z.string().optional(),
  }),
  z.strictObject({
    csrf: z.string(),
    action: z.literal('delete'),
    id: z.uuid(),
  }),
]);

const MESSAGES: Record<number, string> = {
  400: 'Check the trophy details.',
  403: 'Only teammates can add trophies.',
  404: 'That trophy is gone.',
};
function rpcError(data: unknown): { code: number; message: string } | null {
  if (!data || typeof data !== 'object' || !('error' in data)) return null;
  const err = (data as { error?: { code?: unknown; message?: unknown } }).error;
  const code = Number(err?.code);
  const message =
    typeof err?.message === 'string' && [400, 409].includes(code)
      ? err.message
      : (MESSAGES[code] ?? 'Trophies are unavailable right now.');
  return { code: [400, 403, 404, 409].includes(code) ? code : 503, message };
}

/** The signed-in teammate's own trophies: list (GET), submit and withdraw (POST). */
export const teammateTrophies: APIRoute = async (context) => {
  let account = accountContext(context.request, context.cookies);
  try {
    if (!publicProfilesEnabled())
      return account.json({ error: 'Not found.' }, 404);
    const method = context.request.method;
    if (method !== 'GET' && method !== 'POST') {
      const res = account.json({ error: 'Method not allowed.' }, 405);
      res.headers.set('Allow', 'GET, POST');
      return res;
    }
    if (context.url.search)
      return account.json({ error: 'Invalid trophy request.' }, 400);
    let body: z.infer<typeof RequestSchema> | null = null;
    if (method === 'POST') {
      const prepared = await mutation(
        context,
        Math.ceil((MAX_PROOF_BYTES * 4) / 3) + 8192,
      );
      account = prepared.account;
      if (prepared.failure) return prepared.failure;
      const parsed = RequestSchema.safeParse(prepared.body);
      if (!parsed.success)
        return account.json({ error: 'Invalid trophy request.' }, 400);
      body = parsed.data;
    }
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'teammate')
      return account.json({ error: 'Teammate role required.' }, 403);
    const rpc = account.client.rpc.bind(account.client) as unknown as Rpc;

    if (body?.action === 'delete') {
      const { data, error } = await rpc('teammate_trophy_delete', {
        p_id: body.id,
      });
      const failed = error
        ? { code: 503, message: 'Trophies are unavailable right now.' }
        : rpcError(data);
      if (failed) return account.json({ error: failed.message }, failed.code);
      return account.json({ ok: true });
    }

    if (body?.action === 'submit') {
      const trophy = TrophySubmissionSchema.safeParse(body.trophy);
      if (!trophy.success)
        return account.json(
          {
            error:
              trophy.error.issues[0]?.message ?? 'Check the trophy details.',
          },
          400,
        );
      const image = body.image ? decodeProof(body.image) : null;
      if (body.image && !image)
        return account.json(
          { error: 'Use a screenshot up to 900 KB (WebP or JPEG).' },
          400,
        );
      if (!image && !trophy.data.proofUrl)
        return account.json(
          { error: 'Add a screenshot or a link that shows it.' },
          400,
        );
      const path = image ? await storeProof(identity.viewer.id, image) : null;
      if (image && !path)
        return account.json(
          { error: 'The screenshot could not be saved.' },
          503,
        );
      const { data, error } = await rpc('teammate_trophy_submit', {
        p_trophy: { ...trophy.data, rarity: defaultRarity(trophy.data) },
        p_proof_path: path,
      });
      const failed = error
        ? { code: 503, message: 'Trophies are unavailable right now.' }
        : rpcError(data);
      if (failed) {
        if (path) await discardProof(path);
        return account.json({ error: failed.message }, failed.code);
      }
      const saved = OwnTrophySchema.safeParse(
        (data as { trophy?: unknown }).trophy,
      );
      return saved.success
        ? account.json({ trophy: saved.data })
        : account.json({ error: 'Trophies are unavailable right now.' }, 503);
    }

    const { data, error } = await rpc('teammate_trophy_list');
    const failed = error
      ? { code: 503, message: 'Trophies are unavailable right now.' }
      : rpcError(data);
    if (failed) return account.json({ error: failed.message }, failed.code);
    const list = z
      .array(OwnTrophySchema)
      .safeParse((data as { trophies?: unknown }).trophies);
    return list.success
      ? account.json({ trophies: list.data })
      : account.json({ error: 'Trophies are unavailable right now.' }, 503);
  } catch {
    return account.json({ error: 'Trophies are unavailable right now.' }, 503);
  }
};

/** Staff review queue. Proof images come back as short-lived signed links. */
export const adminTrophies = adminRoute(
  async (client, context) => {
    const status = z
      .enum(['pending', 'approved', 'rejected'])
      .safeParse(context.url.searchParams.get('status') ?? 'pending');
    if (!status.success)
      return {
        data: { error: { code: 400, message: 'Pick a status.' } },
        error: null,
      };
    const { data, error } = await (client.rpc.bind(client) as unknown as Rpc)(
      'admin_trophy_queue',
      { p_status: status.data, p_limit: 100 },
    );
    if (error || !data || typeof data !== 'object' || !('trophies' in data))
      return { data, error };
    const rows = (data as { trophies: Record<string, unknown>[] }).trophies;
    const signed = await signProofs(
      rows
        .map((r) => r.proofPath)
        .filter((p): p is string => typeof p === 'string'),
    );
    return {
      data: {
        trophies: rows.map(({ proofPath, ...row }) => ({
          ...row,
          proofImage:
            typeof proofPath === 'string'
              ? (signed.get(proofPath) ?? null)
              : null,
        })),
      },
      error: null,
    };
  },
  [
    {
      schema: z.strictObject({
        csrf: z.string(),
        action: z.literal('review'),
        id: z.uuid(),
        decision: z.enum(['approved', 'rejected']),
        rarity: z.enum(RARITIES).nullable(),
        note: z.string().trim().max(300).nullable(),
      }),
      call: (client, b) =>
        (client.rpc.bind(client) as unknown as Rpc)('admin_trophy_review', {
          p_id: b.id,
          p_decision: b.decision,
          p_rarity: b.rarity,
          p_note: b.note || null,
        }),
    },
  ],
  ['teammates'],
);
