// Read-only data behind Sparky's lookup tools (ledger #25, S2).
// Every query is bound to the user id from the server session, captured when
// the lookup is created. Tool arguments can only narrow a query further
// (an order reference, a limit); they can never name a different person.
// Outputs are minimal DTOs: no emails, no internal ids beyond the public order
// reference, no admin notes and no priority data.
import type { SupabaseClient } from '@supabase/supabase-js';
import { GAME } from '../../design-reference/lib/games.js';

const gameName = (id: string) =>
  (GAME as Record<string, { name?: string } | undefined>)[id]?.name ?? id;
const firstName = (name: unknown) =>
  typeof name === 'string' ? (name.trim().split(/\s+/)[0] ?? '') : '';
const eur = (cents: unknown) => Math.round(Number(cents)) / 100;
const usd = eur;

// Column lists are explicit so private fields (ign, note, priority, admin notes)
// are never read, even by accident.
const ORDER_COLUMNS =
  'id,public_reference,customer_id,customer_name,title,game,units,unit,status,voice,amount_eur_cents,payout_usd_cents,queued_at,accepted_at,completed_at,cancelled_at,cancel_reason,assigned_teammate_id,rerolls,created_at';

type OrderRow = {
  id: string;
  public_reference: string;
  customer_id: string;
  customer_name: string;
  title: string;
  game: string;
  units: number;
  unit: string;
  status: string;
  voice: boolean;
  amount_eur_cents: number;
  payout_usd_cents: number;
  queued_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  assigned_teammate_id: string | null;
  rerolls: number;
};

export type OrderSummary = {
  reference: string;
  as: 'customer' | 'teammate';
  title: string;
  game: string;
  units: number;
  unit: string;
  status: string;
  queuedAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  voice: boolean;
  /** Customer view: what they pay. */
  priceEur?: number;
  /** Customer view: first name of the teammate playing. */
  teammate?: string | null;
  rerollsUsed?: number;
  rerollOpenUntil?: string | null;
  /** Teammate view: recorded payout for this order. */
  payoutUsd?: number;
  /** Teammate view: first name of the customer. */
  customer?: string;
};

export type PaymentSummary = {
  reference: string;
  amountEur: number;
  method: string;
  state: string;
  charged: boolean;
  meaning: string;
  refundedAt: string | null;
};

export type DeskStatus = {
  suspended: boolean;
  discordLinked: boolean;
  approvedGames: string[];
  gamerGirlAccess: boolean;
  queue: {
    receivingGames: string[];
    pausedGames: string[];
    voiceOrders: boolean;
  };
  /** Null when presence cannot be read; the dashboard shows it. */
  presence: { online: boolean; setOfflineByAdmin: string | null } | null;
  busyWithOrder: string | null;
  canGoOnline: boolean;
  reasonsNoOrders: string[];
};

export type SparkyLookup = {
  myOrders(limit: number, status: string | null): Promise<OrderSummary[]>;
  orderDetail(reference: string): Promise<OrderSummary | null>;
  paymentStatus(reference: string | null): Promise<{
    payment: PaymentSummary | null;
    pendingCheckout: { status: string; startedAt: string } | null;
  }>;
  deskStatus(): Promise<DeskStatus | null>;
};

export const PAYMENT_MEANING: Record<string, [boolean, string]> = {
  authorized: [
    false,
    'The amount is on hold on the card, nothing is charged yet. It is charged only when a teammate accepts.',
  ],
  captured: [true, 'Charged, because a teammate accepted the order.'],
  voided: [
    false,
    'Not charged. The hold was released; the bank may take a few days to show it.',
  ],
  refunded: [true, 'Refunded to the original payment method through Stripe.'],
  capture_failed: [
    false,
    'There was a problem with this payment. The team handles it; offer a human.',
  ],
  release_failed: [
    false,
    'The hold release is still being processed. The team handles it; offer a human.',
  ],
};

function rerollOpenUntil(row: OrderRow): string | null {
  if (row.status !== 'in_progress' || !row.accepted_at) return null;
  const until = Date.parse(row.accepted_at) + 5 * 60_000;
  return Number.isFinite(until) ? new Date(until).toISOString() : null;
}

async function names(service: SupabaseClient, ids: string[]) {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data, error } = await service
    .from('profiles')
    .select('id,name')
    .in('id', ids);
  if (error) throw error;
  for (const row of (data ?? []) as { id: string; name: string }[])
    map.set(row.id, firstName(row.name));
  return map;
}

export function sparkyLookup(
  service: SupabaseClient,
  userId: string,
): SparkyLookup {
  const toSummary = (row: OrderRow, teammates: Map<string, string>) => {
    const base = {
      reference: row.public_reference,
      title: row.title,
      game: gameName(row.game),
      units: row.units,
      unit: row.unit,
      status: row.status,
      queuedAt: row.queued_at,
      acceptedAt: row.accepted_at,
      completedAt: row.completed_at,
      cancelledAt: row.cancelled_at,
      cancelReason: row.cancel_reason,
      voice: row.voice,
    };
    if (row.customer_id === userId)
      return {
        ...base,
        as: 'customer',
        priceEur: eur(row.amount_eur_cents),
        teammate: row.assigned_teammate_id
          ? teammates.get(row.assigned_teammate_id) || 'Your teammate'
          : null,
        rerollsUsed: row.rerolls,
        rerollOpenUntil: rerollOpenUntil(row),
      } satisfies OrderSummary;
    return {
      ...base,
      as: 'teammate',
      payoutUsd: usd(row.payout_usd_cents),
      customer: firstName(row.customer_name) || 'Customer',
    } satisfies OrderSummary;
  };

  const summarise = async (rows: OrderRow[]) => {
    const teammates = await names(service, [
      ...new Set(
        rows
          .filter((row) => row.customer_id === userId)
          .map((row) => row.assigned_teammate_id)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ]);
    return rows.map((row) => toSummary(row, teammates));
  };

  /** The order with this reference, only if the asker booked it or plays it. */
  const ownOrder = async (reference: string) => {
    for (const column of ['customer_id', 'assigned_teammate_id']) {
      const { data, error } = await service
        .from('orders')
        .select(ORDER_COLUMNS)
        .eq('public_reference', reference)
        .eq(column, userId)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as unknown as OrderRow;
    }
    return null;
  };

  return {
    async myOrders(limit, status) {
      const query = (column: string) => {
        let q = service.from('orders').select(ORDER_COLUMNS).eq(column, userId);
        if (status) q = q.eq('status', status);
        return q.order('created_at', { ascending: false }).limit(limit);
      };
      const [booked, played] = await Promise.all([
        query('customer_id'),
        query('assigned_teammate_id'),
      ]);
      if (booked.error) throw booked.error;
      if (played.error) throw played.error;
      const rows = [
        ...((booked.data ?? []) as unknown as OrderRow[]),
        ...((played.data ?? []) as unknown as OrderRow[]),
      ].filter(
        (row, index, all) =>
          all.findIndex((other) => other.id === row.id) === index,
      );
      return summarise(
        rows
          .sort((a, b) => Date.parse(b.queued_at) - Date.parse(a.queued_at))
          .slice(0, limit),
      );
    },

    async orderDetail(reference) {
      const row = await ownOrder(reference);
      if (!row) return null;
      return (await summarise([row]))[0] ?? null;
    },

    async paymentStatus(reference) {
      let row: OrderRow | null;
      if (reference) {
        const { data, error } = await service
          .from('orders')
          .select(ORDER_COLUMNS)
          .eq('public_reference', reference)
          .eq('customer_id', userId)
          .maybeSingle();
        if (error) throw error;
        row = data as unknown as OrderRow | null;
      } else {
        const { data, error } = await service
          .from('orders')
          .select(ORDER_COLUMNS)
          .eq('customer_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);
        if (error) throw error;
        row = ((data ?? []) as unknown as OrderRow[])[0] ?? null;
      }
      let pendingCheckout = null;
      if (!reference) {
        const since = new Date(Date.now() - 24 * 3600_000).toISOString();
        const { data, error } = await service
          .from('checkout_intents')
          .select('status,created_at,customer_id')
          .eq('customer_id', userId)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(1);
        if (error) throw error;
        const intent = (
          (data ?? []) as { status: string; created_at: string }[]
        )[0];
        if (intent && intent.status !== 'paid')
          pendingCheckout = {
            status: intent.status,
            startedAt: intent.created_at,
          };
      }
      if (!row) return { payment: null, pendingCheckout };
      const { data, error } = await service
        .from('order_payments')
        .select(
          'order_id,state,settle,amount_eur_cents,payment_method_type,refunded_at',
        )
        .eq('order_id', row.id)
        .maybeSingle();
      if (error) throw error;
      const pay = data as {
        state: string;
        settle: string;
        amount_eur_cents: number;
        payment_method_type: string;
        refunded_at: string | null;
      } | null;
      if (!pay) return { payment: null, pendingCheckout };
      const [charged, meaning] = PAYMENT_MEANING[pay.state] ?? [
        false,
        'Unknown payment state; offer a human.',
      ];
      return {
        payment: {
          reference: row.public_reference,
          amountEur: eur(pay.amount_eur_cents),
          method: pay.payment_method_type || 'card',
          state: pay.state,
          charged,
          meaning:
            pay.settle !== 'none'
              ? `${meaning} A ${pay.settle === 'capture' ? 'charge' : 'release'} is being processed right now.`
              : meaning,
          refundedAt: pay.refunded_at,
        },
        pendingCheckout,
      };
    },

    async deskStatus() {
      // The Discord link is read from teammate_order_access.discord_id, which a
      // trigger mirrors from the linked Discord identity: the service role has no
      // read grant on discord_accounts. Presence: 20261026170000 grants the four
      // columns read here; still best effort so an older database answers null.
      const [access, presence, busy] = await Promise.all([
        service
          .from('teammate_order_access')
          .select(
            'user_id,approved_games,enabled_games,gg_access,voice_opt_in,suspended,discord_id',
          )
          .eq('user_id', userId)
          .maybeSingle(),
        service
          .from('teammate_presence')
          .select('user_id,online,last_seen_at,set_offline_reason')
          .eq('user_id', userId)
          .maybeSingle(),
        service
          .from('orders')
          .select('public_reference,assigned_teammate_id,status')
          .eq('assigned_teammate_id', userId)
          .eq('status', 'in_progress')
          .maybeSingle(),
      ]);
      for (const result of [access, busy]) if (result.error) throw result.error;
      const presenceKnown = !presence.error;
      if (presence.error && presence.error.code !== '42501')
        throw presence.error;
      const a = access.data as {
        approved_games: string[];
        enabled_games: string[];
        gg_access: boolean;
        voice_opt_in: boolean;
        suspended: boolean;
        discord_id: string | null;
      } | null;
      if (!a) return null;
      const p = presence.data as {
        online: boolean;
        last_seen_at: string | null;
        set_offline_reason: string;
      } | null;
      const allowed = a.gg_access
        ? Object.keys(GAME as Record<string, unknown>)
        : a.approved_games;
      const receiving = allowed.filter((g) => a.enabled_games.includes(g));
      const paused = allowed.filter((g) => !a.enabled_games.includes(g));
      const online =
        !!p?.online &&
        !!p.last_seen_at &&
        Date.parse(p.last_seen_at) > Date.now() - 20_000;
      const discordLinked = !!a.discord_id;
      const busyRef =
        (busy.data as { public_reference?: string } | null)?.public_reference ??
        null;
      const reasons: string[] = [];
      if (a.suspended) reasons.push('Account is suspended.');
      if (!discordLinked) reasons.push('Discord is not connected.');
      if (!allowed.length) reasons.push('No approved games yet.');
      else if (!receiving.length)
        reasons.push('Every approved game is switched off in queue settings.');
      if (!a.voice_opt_in)
        reasons.push(
          'Voice orders are switched off, so voice orders skip you.',
        );
      if (presenceKnown && !online) reasons.push('Not online right now.');
      if (busyRef)
        reasons.push(
          `Playing ${busyRef}; new orders wait until it is finished.`,
        );
      return {
        suspended: a.suspended,
        discordLinked,
        approvedGames: allowed.map(gameName),
        gamerGirlAccess: a.gg_access,
        queue: {
          receivingGames: receiving.map(gameName),
          pausedGames: paused.map(gameName),
          voiceOrders: a.voice_opt_in,
        },
        presence: presenceKnown
          ? {
              online,
              setOfflineByAdmin:
                !online && p?.set_offline_reason ? p.set_offline_reason : null,
            }
          : null,
        busyWithOrder: busyRef,
        canGoOnline: !a.suspended && discordLinked,
        reasonsNoOrders: reasons,
      };
    },
  };
}
