import { z } from 'zod';
import { youtubeVideoId } from '../design-reference/lib/youtube.js';
import { ADMIN_SECTIONS, AdminSectionSchema } from './admin-access';

/** Game ids in canonical (demand) order, as stored in teammate_order_access. */
export const GAME_IDS = [
  'lol',
  'val',
  'cs2',
  'fn',
  'cod',
  'apex',
  'r6',
  'mr',
  'ow',
  'dota',
  'rl',
  'wow',
  'pubg',
  'tft',
  'fc',
  'arc',
  'wr',
  'mc',
  'dl',
  'pu',
] as const;
export const GameIdSchema = z.enum(GAME_IDS);

const csrf = z.string().min(1).max(128);

export const SetRoleSchema = z
  .object({
    csrf,
    userId: z.uuid(),
    role: z.enum(['customer', 'teammate', 'admin']),
  })
  .strict();

export const SetAccessSchema = z
  .object({
    csrf,
    userId: z.uuid(),
    access: z
      .object({
        games: z.array(GameIdSchema).max(GAME_IDS.length),
        gg: z.boolean(),
      })
      .strict(),
  })
  .strict();

/** Owners only: the dashboard sections an admin may use (20261105130000). */
export const SetPermissionsSchema = z
  .object({
    csrf,
    userId: z.uuid(),
    permissions: z
      .array(AdminSectionSchema)
      .max(ADMIN_SECTIONS.length)
      .refine((list) => new Set(list).size === list.length),
  })
  .strict();

/** Correct a win/loss report (20261105140000). Same game rules as the teammate's own report. */
const MatchGameSchema = z.strictObject({
  teammateIgn: z.string().trim().min(1).max(64),
  customerIgn: z.string().trim().min(1).max(64),
  link: z
    .string()
    .trim()
    .max(300)
    .regex(/^https:\/\/\S{4,}$/),
});
export const EditMatchReportSchema = z
  .object({
    csrf,
    action: z.literal('edit'),
    assignmentId: z.uuid(),
    games: z.array(MatchGameSchema).min(1).max(20),
    wins: z.number().int().min(0).max(20),
    losses: z.number().int().min(0).max(20),
    reason: z.string().trim().min(3).max(200),
  })
  .strict()
  .refine((body) => body.wins + body.losses === body.games.length, {
    message: 'Wins and losses need to add up to the games.',
    path: ['wins'],
  });

/** Hide or show a proof screenshot again (20261105140000). */
export const SetProofRemovedSchema = z
  .object({
    csrf,
    orderId: z.uuid(),
    proofId: z.uuid(),
    removed: z.boolean(),
    reason: z.string().trim().max(200).default(''),
  })
  .strict();

/** Twitch streaming per game (20261105100000); only the teammate's approved games are kept. */
export const SetStreamAccessSchema = z
  .object({
    csrf,
    userId: z.uuid(),
    streamGames: z
      .array(GameIdSchema)
      .max(GAME_IDS.length)
      .refine((games) => new Set(games).size === games.length),
  })
  .strict();

export const DecideApplicationSchema = z
  .object({
    csrf,
    id: z.uuid(),
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().max(120).optional(),
  })
  .strict();

/** No control characters; trims and collapses nothing else (original lib/applications.js clean()). */
const text = (min: number, max: number) =>
  z
    .string()
    .transform((value) =>
      [...value]
        .map((character) => {
          const code = character.charCodeAt(0);
          return (code < 32 && code !== 10) || code === 127 ? ' ' : character;
        })
        .join('')
        .trim(),
    )
    .pipe(z.string().min(min).max(max));

export const APPLICATION_HOURS = ['5–10', '10–20', '20–30', '30+'] as const;
export const APPLICATION_SERVICES = {
  duo: 'Duo',
  coach: 'Coaching',
  social: 'Social',
  gg: 'Gamer Girl',
} as const;

/** Body of POST /api/apply, exactly what the /apply form sends (plus csrf). */
export const ApplicationSchema = z
  .object({
    csrf,
    name: text(2, 60),
    email: z.string().trim().toLowerCase().max(120).pipe(z.email()),
    discord: text(2, 40),
    country: text(0, 40),
    adult: z.literal(true),
    game: GameIdSchema,
    rank: text(1, 60),
    region: text(1, 40),
    role: text(0, 60),
    link: text(0, 200),
    // Required YouTube intro video where they talk (design-reference/lib/youtube.js).
    video: text(1, 200).refine((value) => youtubeVideoId(value) !== ''),
    hours: z.enum(APPLICATION_HOURS),
    why: text(0, 600),
    svc: z
      .object({
        duo: z.boolean(),
        coach: z.boolean(),
        social: z.boolean(),
        gg: z.boolean(),
      })
      .strict()
      .refine((value) => Object.values(value).some(Boolean)),
  })
  .strict();
export type Application = z.infer<typeof ApplicationSchema>;

/** The first problem in plain words, for the form's error line. */
export function applicationError(error: z.ZodError): string {
  const field = String(error.issues[0]?.path[0] ?? '');
  const message: Record<string, string> = {
    name: 'Add your name.',
    email: 'That email doesn’t look right.',
    discord: 'Add your Discord username.',
    adult: 'You need to be 18 or older to apply.',
    game: 'Pick your game, rank and region.',
    rank: 'Pick your game, rank and region.',
    region: 'Pick your game, rank and region.',
    video: 'Add a YouTube link to your intro video.',
    svc: 'Pick at least one service.',
    hours: 'Pick how many hours you can play each week.',
  };
  return message[field] ?? 'Please check the form and try again.';
}

export const SetSuspendedSchema = z
  .object({
    csrf,
    userId: z.uuid(),
    suspended: z.boolean(),
    reason: z.string().trim().max(200).optional(),
  })
  .strict();

export const WalletAdjustSchema = z
  .object({
    csrf,
    action: z.literal('adjustWallet'),
    userId: z.uuid(),
    amountCents: z
      .number()
      .int()
      .min(-100000)
      .max(100000)
      .refine((value) => value !== 0),
    reason: z.string().trim().min(1).max(200),
  })
  .strict();

export const SetBlockedSchema = z
  .object({
    csrf,
    userId: z.uuid(),
    blocked: z.boolean(),
    reason: z.string().trim().max(200).optional(),
  })
  .strict();

const orderAction = {
  csrf,
  orderId: z.uuid(),
};

export const AdminCreateHandoverSchema = z
  .object({ ...orderAction, action: z.literal('handover') })
  .strict();

const reason = z.string().trim().min(3).max(200);
export const AdminCancelOrderSchema = z
  .object({ ...orderAction, action: z.literal('cancel'), reason })
  .strict();
export const AdminRefundOrderSchema = z
  .object({ ...orderAction, action: z.literal('refund'), reason })
  .strict();

/** Duo tier level per teammate (migration 20261030140000, docs/product/duo-tiers.md). */
export const DUO_LEVELS = ['standard', 'plus_only'] as const;
export type DuoLevel = (typeof DUO_LEVELS)[number];
export const SetDuoLevelSchema = z
  .object({ csrf, userId: z.uuid(), level: z.enum(DUO_LEVELS) })
  .strict();
