import { trackRequest } from '../analytics/client';
import type { APIContext, APIRoute } from 'astro';
import { z } from 'zod';
import type { AccountContext } from '../auth/context';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import {
  AdminCancelOrderSchema,
  AdminCreateHandoverSchema,
  AdminRefundOrderSchema,
  ApplicationSchema,
  APPLICATION_SERVICES,
  DecideApplicationSchema,
  SetAccessSchema,
  SetStreamAccessSchema,
  EditMatchReportSchema,
  SetProofRemovedSchema,
  SetPermissionsSchema,
  SetBlockedSchema,
  SetRoleSchema,
  SetSuspendedSchema,
  WalletAdjustSchema,
  applicationError,
} from '../../contracts/admin';
import {
  adminAccess,
  canUse,
  NO_SECTION_ACCESS,
  type AdminSection,
} from './access';
import { AdminPriorityCommandSchema, tierById } from '../../contracts/priority';
import { AdminCreatorCommandSchema } from '../../contracts/creators';
import { AdminPayoutCommandSchema } from '../../contracts/payouts';
import { customerUsdRate, eurToUsd } from '../fx';
import { referralsEnabled } from '../referrals';
import { ownerEmails } from './owners';
import { sendApplicationDecision, sendApplicationReceived } from './notify';
import { settleSoon } from '../payments/webhook';
import { syncRolesAfter } from '../discord/role-hooks';
import { connectEnabled } from '../connect/config';

type Client = NonNullable<AccountContext['client']>;
type Rpc = PromiseLike<{ data: unknown; error: unknown }>;

/**
 * Admin RPCs answer `{ error: { code, message } }` for refusals and a plain payload otherwise.
 * Maps that envelope to an HTTP response with the message the screen shows as a toast.
 */
export function rpcResponse(
  account: AccountContext,
  data: unknown,
  error: unknown,
): Response {
  if (error || !data || typeof data !== 'object')
    return account.json({ error: 'Admin service unavailable.' }, 503);
  const refusal = (data as { error?: { code?: unknown; message?: unknown } })
    .error;
  if (refusal) {
    const code = Number(refusal.code);
    return account.json(
      {
        error:
          typeof refusal.message === 'string'
            ? refusal.message
            : 'That didn’t work.',
      },
      code >= 400 && code < 600 ? code : 400,
    );
  }
  return account.json(data);
}

type Command = {
  schema: z.ZodType<Record<string, unknown> & { csrf: string }>;
  call: (client: Client, body: Record<string, unknown>) => Rpc;
  /** Side effect after a successful command (emails, Discord roles). Never fails the request. */
  after?: (
    data: Record<string, unknown>,
    body: Record<string, unknown>,
  ) => Promise<void>;
};

/**
 * One admin endpoint. GET reads, POST runs the first command whose schema matches.
 * Non-admins get 404, like /admin itself; the database re-checks the role on every call.
 */
type AdminGet = (client: Client, context: APIContext) => Rpc;

export function pageParams(url: URL): { limit: number; offset: number } {
  const rawLimit = Number(url.searchParams.get('limit') || 200);
  const rawOffset = Number(url.searchParams.get('offset') || 0);
  return {
    limit:
      Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= 500
        ? rawLimit
        : 200,
    offset: Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0,
  };
}

/**
 * `sections`: the dashboard sections this endpoint belongs to (any of them is enough). Owners have
 * all; other admins only what an owner gave them (migration 20261105130000). The database checks
 * again in every admin function.
 */
export function adminRoute(
  get: AdminGet | null,
  post: Command[],
  sections: readonly AdminSection[],
) {
  const handler: APIRoute = async (context: APIContext) => {
    let account = accountContext(context.request, context.cookies);
    try {
      const method = context.request.method;
      if (method !== 'GET' && method !== 'POST') {
        const response = account.json({ error: 'Method not allowed.' }, 405);
        response.headers.set('Allow', get ? 'GET, POST' : 'POST');
        return response;
      }
      let body: Record<string, unknown> | null = null;
      if (method === 'POST') {
        const prepared = await mutation(context, 8192);
        account = prepared.account;
        if (prepared.failure) return prepared.failure;
        body = prepared.body;
      }
      const identity = await account.identity();
      if (!identity || !account.client)
        return account.json({ error: 'Authentication required.' }, 401);
      if (identity.viewer.role !== 'admin')
        return account.json({ error: 'Not found.' }, 404);
      if (!canUse(await adminAccess(account.client), sections))
        return account.json({ error: NO_SECTION_ACCESS }, 403);
      if (method === 'GET') {
        if (!get) return account.json({ error: 'Method not allowed.' }, 405);
        const { data, error } = await get(account.client, context);
        return rpcResponse(account, data, error);
      }
      for (const command of post) {
        const parsed = command.schema.safeParse(body);
        if (!parsed.success) continue;
        const { data, error } = await command.call(account.client, parsed.data);
        const response = rpcResponse(account, data, error);
        if (response.status === 200 && command.after)
          await command
            .after(data as Record<string, unknown>, parsed.data)
            .catch(() => undefined);
        return response;
      }
      return account.json({ error: 'Invalid admin request.' }, 400);
    } catch {
      return account.json({ error: 'Admin service unavailable.' }, 503);
    }
  };
  return handler;
}

export const users = adminRoute(
  (client) => client.rpc('admin_accounts'),
  [
    {
      schema: SetRoleSchema,
      call: (client, body) =>
        client.rpc('admin_set_role', {
          p_user_id: body.userId as string,
          p_role: body.role as string,
        }),
      after: (_data, body) =>
        syncRolesAfter({ users: [body.userId as string] }),
    },
    {
      schema: SetAccessSchema,
      call: (client, body) => {
        const access = body.access as { games: string[]; gg: boolean };
        return client.rpc('admin_set_access', {
          p_user_id: body.userId as string,
          p_games: access.games,
          p_gg: access.gg,
        });
      },
    },
    {
      schema: SetStreamAccessSchema,
      call: (client, body) =>
        (
          client.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>,
          ) => Rpc
        )('admin_set_stream_access', {
          p_user_id: body.userId as string,
          p_games: body.streamGames as string[],
        }),
    },
    {
      // Owners only; the database refuses everyone else.
      schema: SetPermissionsSchema,
      call: (client, body) =>
        (
          client.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>,
          ) => Rpc
        )('admin_set_permissions', {
          p_user_id: body.userId as string,
          p_sections: body.permissions as string[],
        }),
    },
  ],
  ['users'],
);

export const applications = adminRoute(
  (client, context) => {
    const page = pageParams(context.url);
    return client.rpc('admin_applications_page', {
      p_limit: page.limit,
      p_offset: page.offset,
    });
  },
  [
    {
      schema: DecideApplicationSchema,
      call: (client, body) =>
        client.rpc('admin_decide_application', {
          p_application_id: body.id as string,
          p_decision: body.decision as string,
          p_reason: (body.reason as string | undefined) ?? '',
        }),
      after: (data) =>
        sendApplicationDecision(
          data.application as Parameters<typeof sendApplicationDecision>[0],
        ),
    },
  ],
  ['teammates'],
);

/** Admin, Teammates, Match reports: what teammates reported on win/loss orders (20261102160000). */
export const matchReports = adminRoute(
  (client, context) => {
    const page = pageParams(context.url);
    return (
      client.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => PromiseLike<{ data: unknown; error: unknown }>
    ).call(client, 'admin_match_reports', {
      p_limit: page.limit,
      p_offset: page.offset,
    });
  },
  [
    {
      // An admin corrects a report a teammate got wrong (20261105140000).
      schema: EditMatchReportSchema as unknown as Command['schema'],
      call: (client, body) =>
        (
          client.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>,
          ) => Rpc
        )('admin_edit_match_report', {
          p_assignment_id: body.assignmentId as string,
          p_games: body.games,
          p_wins: body.wins as number,
          p_losses: body.losses as number,
          p_reason: body.reason as string,
        }),
    },
  ],
  ['teammates', 'orders'],
);

/** Admin, a played order's screenshots: list, hide or show again (20261105140000). */
export const orderProofs = adminRoute(
  (client, context) =>
    (
      client.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Rpc
    )('admin_order_proofs', {
      p_order_id: z.uuid().parse(context.params.orderId),
    }),
  [
    {
      schema: SetProofRemovedSchema as unknown as Command['schema'],
      call: (client, body) =>
        (
          client.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>,
          ) => Rpc
        )('admin_set_order_proof_removed', {
          p_order_id: body.orderId as string,
          p_proof_id: body.proofId as string,
          p_removed: body.removed as boolean,
          p_reason: body.reason as string,
        }),
    },
  ],
  ['teammates', 'orders'],
);

export const teammates = adminRoute(
  (client) => client.rpc('admin_teammates'),
  [
    {
      schema: SetSuspendedSchema,
      call: (client, body) =>
        client.rpc('admin_set_suspended', {
          p_user_id: body.userId as string,
          p_suspended: body.suspended as boolean,
          p_reason: (body.reason as string | undefined) ?? '',
        }),
      after: (_data, body) =>
        syncRolesAfter({ users: [body.userId as string] }),
    },
  ],
  ['teammates'],
);

export const customers = adminRoute(
  (client) => client.rpc('admin_customers'),
  [
    {
      schema: WalletAdjustSchema,
      call: (client, body) =>
        client.rpc('admin_wallet_adjust', {
          p_user_id: body.userId as string,
          p_amount_eur_cents: body.amountCents as number,
          p_reason: body.reason as string,
        }),
    },
    {
      schema: SetBlockedSchema,
      call: (client, body) =>
        client.rpc('admin_set_blocked', {
          p_user_id: body.userId as string,
          p_blocked: body.blocked as boolean,
          p_reason: (body.reason as string | undefined) ?? '',
        }),
    },
  ],
  ['customers'],
);

export const orders = adminRoute(
  (client, context) => {
    const page = pageParams(context.url);
    return client.rpc('admin_orders_page', {
      p_limit: page.limit,
      p_offset: page.offset,
    });
  },
  [
    {
      schema: AdminCreateHandoverSchema,
      call: (client, body) =>
        client.rpc('admin_create_handover', {
          p_order_id: body.orderId as string,
        }),
      after: (_data, body) => syncRolesAfter({ order: body.orderId as string }),
    },
    {
      schema: AdminCancelOrderSchema,
      call: (client, body) =>
        client.rpc('admin_cancel_order', {
          p_order_id: body.orderId as string,
          p_reason: body.reason as string,
        }),
      after: async (_data, body) => {
        await settleSoon().catch(() => undefined);
        await syncRolesAfter({ order: body.orderId as string });
      },
    },
    {
      schema: AdminRefundOrderSchema,
      call: (client, body) =>
        client.rpc('admin_refund_order', {
          p_order_id: body.orderId as string,
          p_reason: body.reason as string,
        }),
      after: () => settleSoon(),
    },
  ],
  ['live', 'orders'],
);

export const overview = adminRoute(
  (client) => client.rpc('admin_overview'),
  [],
  ['overview'],
);

export const audit = adminRoute(
  (client) => client.rpc('admin_audit', { p_limit: 500 }),
  [],
  ['audit'],
);

/** GET lists teammates with their breakdown; POST runs one priority command. */
export const priority = adminRoute(
  (client) => client.rpc('admin_priority'),
  [
    {
      schema: AdminPriorityCommandSchema,
      call: (client, body) => {
        const p_user = body.userId as string;
        switch (body.action as string) {
          case 'set':
            return client.rpc('admin_set_priority', {
              p_user,
              p_base: body.prio as number,
            });
          case 'reset':
            return client.rpc('admin_reset_priority', { p_user });
          case 'adjust':
            return client.rpc('admin_adjust_priority', {
              p_user,
              p_points: tierById(body.tier as string)?.points ?? 0,
              p_duration: body.duration as string,
              p_reason: (body.reason as string | undefined) ?? '',
            });
          case 'clearAdjust':
            return client.rpc('admin_clear_adjustment', { p_user });
          default:
            return client.rpc('admin_forgive_misses', { p_user });
        }
      },
    },
  ],
  ['priority', 'live'],
);

/** GET lists creators with attributed orders and commission owed; POST adds or pauses one. */
export const creators = adminRoute(
  (client) => client.rpc('admin_creators'),
  [
    {
      schema: AdminCreatorCommandSchema,
      call: (client, body) => {
        if (body.action === 'create')
          return client.rpc('admin_create_creator', {
            p_code: body.code as string,
            p_name: body.name as string,
            p_channel: (body.channel as string | undefined) ?? '',
          });
        if (body.action === 'pay')
          return client.rpc('admin_creator_payout_pay', {
            p_creator_id: body.creatorId as string,
            p_month: body.month as string,
            p_method: body.method as string,
            p_reference: body.reference as string,
          });
        return client.rpc('admin_set_creator_active', {
          p_id: body.creatorId as string,
          p_active: body.active as boolean,
        });
      },
    },
  ],
  ['creators'],
);

/** Admin payouts read model plus whether Pay via Stripe is switched on (CONNECT_PAYOUTS_ENABLED). */
async function adminPayoutsRead(client: Client) {
  const result = await client.rpc('admin_payouts');
  const data = result.data as Record<string, unknown> | null;
  if (result.error || !data || typeof data !== 'object' || 'error' in data)
    return result;
  return { data: { ...data, connect: connectEnabled() }, error: null };
}

export const payouts = adminRoute(
  (client) => adminPayoutsRead(client),
  [
    {
      schema: AdminPayoutCommandSchema,
      call: (client, body) => {
        switch (body.action as string) {
          case 'adjust':
            return client.rpc('admin_teammate_adjust', {
              p_teammate_id: body.teammateId as string,
              p_amount_usd_cents: body.amountCents as number,
              p_reason: body.reason as string,
            });
          case 'pay':
            return client.rpc('admin_payout_pay', {
              p_line_id: body.payoutId as string,
              p_method: body.method as string,
              p_reference: body.reference as string,
            });
          case 'payAll':
            // With Stripe payouts on, the manual batch leaves Stripe-ready lines alone.
            return client.rpc(
              connectEnabled()
                ? 'admin_payout_pay_all_manual'
                : 'admin_payout_pay_all',
              {
                p_method: body.method as string,
                p_reference: body.reference as string,
              },
            );
          case 'hold':
            return client.rpc('admin_payout_hold', {
              p_line_id: body.payoutId as string,
              p_reason: body.reason as string,
            });
          default:
            return client.rpc('admin_payout_release', {
              p_line_id: body.payoutId as string,
            });
        }
      },
    },
  ],
  ['payouts'],
);

/**
 * What the read-only Settings screen needs from the server: today's ECB rate (original
 * lib/fx.js), whether owners are configured and whether referral capture is switched on.
 * No env values or names are returned.
 */
type FxReading = {
  rate: number;
  source: string;
  date?: string;
  fetchedAt?: number;
};

export async function settingsSnapshot(
  fx: () => Promise<FxReading> = () => eurToUsd(),
) {
  const value = await fx();
  const { rate, source } = value;
  return {
    fx: {
      rate,
      customerRate: customerUsdRate(rate),
      markup: 0.01,
      source,
      date:
        'date' in value && typeof value.date === 'string' ? value.date : null,
      ageMs:
        'fetchedAt' in value && typeof value.fetchedAt === 'number'
          ? Math.max(0, Date.now() - value.fetchedAt)
          : null,
      live: source === 'ecb',
      fallback: source === 'fallback',
    },
    ownersConfigured: ownerEmails().length > 0,
    referralsEnabled: referralsEnabled(),
  };
}

export const settings = adminRoute(
  () => settingsSnapshot().then((data) => ({ data, error: null })),
  [],
  ['settings', 'creators'],
);

/** POST /api/apply: the public teammate application (no account needed). */
export const apply: APIRoute = async (context) => {
  const { account, body, failure } = await mutation(context, 8192);
  if (failure) return failure;
  if (!account.client)
    return account.json({ error: 'Applications are closed right now.' }, 503);
  const parsed = ApplicationSchema.safeParse(body);
  if (!parsed.success)
    return account.json({ error: applicationError(parsed.error) }, 400);
  const f = parsed.data;
  try {
    const { data, error } = await account.client.rpc(
      'submit_teammate_application',
      {
        p_name: f.name,
        p_email: f.email,
        p_discord: f.discord,
        p_country: f.country,
        p_game: f.game,
        p_rank: f.rank,
        p_region: f.region,
        p_role: f.role,
        p_link: f.link,
        p_hours: f.hours,
        p_why: f.why,
        p_video: f.video,
        p_services: (
          Object.keys(APPLICATION_SERVICES) as (keyof typeof f.svc)[]
        )
          .filter((key) => f.svc[key])
          .map((key) => APPLICATION_SERVICES[key]),
      },
    );
    const response = rpcResponse(account, data, error);
    if (response.status === 200) {
      const application = (data as { application: { reference: string } })
        .application;
      await sendApplicationReceived(f, application.reference).catch(
        () => undefined,
      );
      // The application can be anonymous. Identity lookup must not affect its result.
      let analyticsUserId: string | null = null;
      try {
        analyticsUserId = (await account.identity())?.viewer.id ?? null;
      } catch {
        /* best effort */
      }
      trackRequest(context, analyticsUserId, 'teammate_applied', {
        game: f.game,
        services_count: Object.values(f.svc).filter(Boolean).length,
        hours_bucket: (
          {
            '5–10': 'under_10',
            '10–20': '10_20',
            '20–30': '20_30',
            '30+': 'over_30',
          } as const
        )[f.hours],
        has_video: !!f.video,
      });
      return account.json({ application }, 201);
    }
    return response;
  } catch {
    return account.json(
      { error: 'Couldn’t send your application. Please try again.' },
      503,
    );
  }
};
