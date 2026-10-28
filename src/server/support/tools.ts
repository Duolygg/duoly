// Sparky's read-only lookup tools (ledger #25, S2), exposed to the model through
// OpenAI function calling. Scope rules:
// - The asker comes from the server session (SupportPerson + a lookup bound to
//   their user id). No tool has a parameter that names a person.
// - Guests get catalog_prices and faq_search only. Account tools need a signed-in
//   asker; teammate_desk_status needs the teammate role.
// - Arguments are validated with strict zod schemas; anything extra is refused.
// - Outputs are minimal DTOs (see lookup.ts): no emails, no internal ids beyond
//   the public order reference, no admin data, no priority data.
// - S3: order_by_reference and person_summary are admin-only. They are offered
//   only when the session account role is admin (person.accountRole, set from
//   the server session in person.ts) and an admin lookup bound to the asker's
//   own signed-in client exists; the admin RPCs re-check the role in the
//   database. A forged call from anyone else is refused before any read.
import { z } from 'zod';
import { FAQ_TABS } from '../../design-reference/lib/faq.js';
import { knowledgeFor } from './knowledge';
import type { SparkyLookup } from './lookup';
import type { SparkyAdminLookup } from './admin-lookup';
import { catalogFor, gameNames } from './offer';
import { CURRENT_FACTS, type SupportPerson } from './sparky';

export const MAX_TOOL_ROUNDS = 3;
/** Tool calls the model may make in one round; extra calls are refused. */
export const MAX_CALLS_PER_ROUND = 4;

export type ToolContext = {
  person: SupportPerson;
  /** Bound to the session user id; null for guests. */
  lookup: SparkyLookup | null;
  /** Admin reads through the asker's own signed-in client; only for admins. */
  admin?: SparkyAdminLookup | null;
};

export type ToolStatus = 'ok' | 'not_found' | 'invalid' | 'denied' | 'error';
export type ToolResult = {
  status: ToolStatus;
  args: Record<string, unknown> | null;
  output: unknown;
};

type Audience = 'everyone' | 'signed_in' | 'teammate' | 'admin';

const reference = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^DL-[0-9]{1,12}$/);

const TOOLS = {
  my_orders: {
    audience: 'signed_in' as Audience,
    description:
      'List the asker’s own recent orders (ones they booked, and for teammates ones they played). Newest first.',
    schema: z
      .object({
        limit: z.number().int().min(1).max(10).nullable(),
        status: z
          .enum(['queued', 'in_progress', 'completed', 'cancelled'])
          .nullable(),
      })
      .strict(),
    parameters: {
      limit: {
        type: ['integer', 'null'],
        description: 'How many orders, 1 to 10. Null for 5.',
      },
      status: {
        type: ['string', 'null'],
        enum: ['queued', 'in_progress', 'completed', 'cancelled', null],
        description: 'Only orders in this status. Null for all.',
      },
    },
  },
  order_detail: {
    audience: 'signed_in' as Audience,
    description:
      'Details of one of the asker’s own orders by its reference, for example DL-1042. Returns found false for any order that is not theirs.',
    schema: z.object({ reference }).strict(),
    parameters: {
      reference: {
        type: 'string',
        description: 'Order reference such as DL-1042.',
      },
    },
  },
  payment_status: {
    audience: 'signed_in' as Audience,
    description:
      'Payment state of an order the asker booked (on hold, charged, released, refunded). Null reference means their latest order, plus any checkout from the last 24 hours that did not create an order.',
    schema: z.object({ reference: reference.nullable() }).strict(),
    parameters: {
      reference: {
        type: ['string', 'null'],
        description: 'Order reference such as DL-1042, or null for the latest.',
      },
    },
  },
  teammate_desk_status: {
    audience: 'teammate' as Audience,
    description:
      'Why a teammate can or cannot go online or receive orders: suspension, Discord link, approved games, queue settings per game and for voice, online state and a running order.',
    schema: z.object({}).strict(),
    parameters: {},
  },
  catalog_prices: {
    audience: 'everyone' as Audience,
    description:
      'Services and prices from the checkout catalog for one game (EUR, from the base rank; rank can raise the price). Null game lists the games.',
    schema: z
      .object({ game: z.string().trim().min(1).max(40).nullable() })
      .strict(),
    parameters: {
      game: {
        type: ['string', 'null'],
        description: 'Game name, for example Valorant. Null for the game list.',
      },
    },
  },
  order_by_reference: {
    audience: 'admin' as Audience,
    description:
      'Admin only. Any order by its reference, as the admin Orders screen shows it: status, game, service, customer and teammate display names, payment state, timestamps, cancel and refund details, review, tip and reports.',
    schema: z.object({ reference }).strict(),
    parameters: {
      reference: {
        type: 'string',
        description: 'Order reference such as DL-1042.',
      },
    },
  },
  person_summary: {
    audience: 'admin' as Audience,
    description:
      'Admin only. Look up accounts by exact email, exact user id, or display name (exact, else partial; up to 3 matches). Returns role, blocked or suspended state, order counts, wallet balance and loyalty level for customers, and trust tier, rating and owed payout for teammates.',
    schema: z.object({ query: z.string().trim().min(2).max(120) }).strict(),
    parameters: {
      query: {
        type: 'string',
        description: 'Email, user id or display name.',
      },
    },
  },
  faq_search: {
    audience: 'everyone' as Audience,
    description:
      'Search Duoly’s current facts, support knowledge and FAQ. Current facts override older FAQ wording.',
    schema: z.object({ query: z.string().trim().min(2).max(200) }).strict(),
    parameters: {
      query: { type: 'string', description: 'What to look for.' },
    },
  },
} as const;

export type ToolName = keyof typeof TOOLS;
const ORDER: ToolName[] = [
  'my_orders',
  'order_detail',
  'payment_status',
  'teammate_desk_status',
  'order_by_reference',
  'person_summary',
  'catalog_prices',
  'faq_search',
];
const ADMIN_TOOLS: ToolName[] = ['order_by_reference', 'person_summary'];

function allowed(person: SupportPerson, audience: Audience) {
  if (audience === 'everyone') return true;
  if (!person.userId) return false;
  if (audience === 'teammate') return person.role === 'teammate';
  // accountRole comes from the server session (person.ts), never from the model.
  if (audience === 'admin') return person.accountRole === 'admin';
  return true;
}

export function toolNamesFor(person: SupportPerson): ToolName[] {
  return ORDER.filter((name) => allowed(person, TOOLS[name].audience));
}

export type FunctionTool = {
  type: 'function';
  name: ToolName;
  description: string;
  strict: true;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: false;
  };
};

export function toolDefinitions(person: SupportPerson): FunctionTool[] {
  return toolNamesFor(person).map((name) => ({
    type: 'function',
    name,
    description: TOOLS[name].description,
    strict: true,
    parameters: {
      type: 'object',
      properties: TOOLS[name].parameters,
      required: Object.keys(TOOLS[name].parameters),
      additionalProperties: false,
    },
  }));
}

const normalise = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '');

/** Keyword search over current facts, role knowledge and the FAQ. */
export function faqSearch(person: SupportPerson, query: string) {
  const words = [
    ...new Set(
      normalise(query)
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 3),
    ),
  ];
  const entries = [
    ...CURRENT_FACTS.map((text) => ({ source: 'current fact', text })),
    ...knowledgeFor(person.role).map((entry) => ({
      source: 'support knowledge',
      text: entry.text,
    })),
    ...FAQ_TABS.flatMap((tab) =>
      tab.items.map(([q, a]) => ({ source: 'faq', text: `${q} ${a}` })),
    ),
  ];
  return entries
    .map((entry, index) => {
      const tokens = normalise(entry.text).split(/[^a-z0-9]+/);
      const score = words.filter((word) =>
        tokens.some((token) =>
          word.length >= 4
            ? token.startsWith(word.slice(0, Math.max(4, word.length - 2)))
            : token === word,
        ),
      ).length;
      return { ...entry, score, index };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 5)
    .map(({ source, text }) => ({ source, text }));
}

async function execute(
  name: ToolName,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ status: ToolStatus; output: unknown }> {
  if (name === 'catalog_prices') {
    if (args.game === null)
      return { status: 'ok', output: { games: gameNames() } };
    const catalog = catalogFor(String(args.game));
    return catalog
      ? {
          status: 'ok',
          output: {
            ...catalog,
            note: 'Prices are from the base rank and can rise with the asker’s rank. Bundle discounts: 3 games 10%, 5 games 15%, 10 games 25%, not for coaching. The exact total shows before Stripe checkout.',
          },
        }
      : {
          status: 'not_found',
          output: { found: false, games: gameNames() },
        };
  }
  if (name === 'faq_search') {
    const results = faqSearch(ctx.person, String(args.query));
    return {
      status: results.length ? 'ok' : 'not_found',
      output: {
        note: 'Current facts override older FAQ wording (for example, there is no Duoly wallet).',
        results,
      },
    };
  }
  if (ADMIN_TOOLS.includes(name)) {
    const admin = ctx.admin;
    if (!admin) return { status: 'denied', output: { error: 'Admins only.' } };
    if (name === 'order_by_reference') {
      const order = await admin.orderByReference(String(args.reference));
      return order
        ? { status: 'ok', output: { found: true, order } }
        : {
            status: 'not_found',
            output: { found: false, note: 'No order with this reference.' },
          };
    }
    const result = await admin.personSummary(String(args.query));
    return {
      status: result.people.length ? 'ok' : 'not_found',
      output: {
        found: result.people.length > 0,
        ...result,
        note: 'Priority and matching delays are not part of this summary; they stay on the admin Priority screen.',
      },
    };
  }
  const lookup = ctx.lookup;
  if (!lookup) return { status: 'denied', output: { error: 'Sign in first.' } };
  if (name === 'my_orders') {
    const orders = await lookup.myOrders(
      (args.limit as number | null) ?? 5,
      (args.status as string | null) ?? null,
    );
    return { status: 'ok', output: { orders } };
  }
  if (name === 'order_detail') {
    const order = await lookup.orderDetail(String(args.reference));
    return order
      ? { status: 'ok', output: { found: true, order } }
      : {
          status: 'not_found',
          output: {
            found: false,
            note: 'No order with this reference on the asker’s account.',
          },
        };
  }
  if (name === 'payment_status') {
    const result = await lookup.paymentStatus(
      (args.reference as string | null) ?? null,
    );
    if (!result.payment && args.reference)
      return {
        status: 'not_found',
        output: {
          found: false,
          note: 'No order with this reference booked on the asker’s account.',
        },
      };
    return {
      status: 'ok',
      output: { found: !!result.payment, ...result },
    };
  }
  const desk = await lookup.deskStatus();
  return desk
    ? { status: 'ok', output: desk }
    : {
        status: 'not_found',
        output: { found: false, note: 'No teammate access on this account.' },
      };
}

/**
 * Run one tool call from the model. Never throws: every problem becomes a status
 * the model can explain, and the call is logged by the caller.
 */
export async function runTool(
  name: string,
  rawArgs: string,
  ctx: ToolContext,
): Promise<ToolResult> {
  if (!(ORDER as string[]).includes(name))
    return { status: 'denied', args: null, output: { error: 'Unknown tool.' } };
  const tool = name as ToolName;
  if (!toolNamesFor(ctx.person).includes(tool))
    return {
      status: 'denied',
      args: null,
      output: { error: 'This tool is not available for this asker.' },
    };
  let json: unknown;
  try {
    json = JSON.parse(rawArgs || '{}');
  } catch {
    return {
      status: 'invalid',
      args: null,
      output: { error: 'Arguments must be JSON.' },
    };
  }
  const parsed = TOOLS[tool].schema.safeParse(json);
  if (!parsed.success)
    return {
      status: 'invalid',
      args: null,
      output: { error: 'Invalid arguments.' },
    };
  const args = parsed.data as Record<string, unknown>;
  try {
    const result = await execute(tool, args, ctx);
    return { ...result, args };
  } catch {
    return {
      status: 'error',
      args,
      output: { error: 'Lookup failed. Offer a human.' },
    };
  }
}
