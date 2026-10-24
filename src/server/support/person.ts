import { GAME } from '../../design-reference/lib/games.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupportPerson, SupportRole, CustomerOrder } from './sparky';

const gameName = (id: string) =>
  (GAME as Record<string, { name?: string } | undefined>)[id]?.name ?? id;

type Identity = {
  viewer: {
    id: string;
    role: 'customer' | 'teammate' | 'admin';
    name: string;
    email: string | null;
    image: string;
  };
} | null;

const mapOrder = (row: Record<string, unknown>): CustomerOrder => ({
  id: String(row.id),
  reference: String(row.public_reference),
  title: String(row.title),
  game: gameName(String(row.game)),
  units: Number(row.units),
  status: String(row.status),
  amountEurCents: Number(row.amount_eur_cents),
  queuedAt: String(row.queued_at),
  teammateName:
    typeof row.teammate_name === 'string' ? row.teammate_name : null,
  rerollUntil:
    row.status === 'in_progress' && typeof row.accepted_at === 'string'
      ? new Date(Date.parse(row.accepted_at) + 5 * 60_000).toISOString()
      : null,
});

/** "sebastian.miller+x@…" -> "Sebastian", so a profile without a name still gets a real greeting. */
export function nameFromEmail(email: string | null | undefined): string {
  const local = (email ?? '').split('@')[0] ?? '';
  const first = local.split(/[.+_-]/)[0] ?? '';
  if (!/^[a-z]{2,20}$/i.test(first)) return '';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export async function supportPerson(
  service: SupabaseClient,
  identity: Identity,
): Promise<SupportPerson> {
  if (!identity) return { role: 'guest', name: 'Guest' };
  const viewer = identity.viewer;
  const role: SupportRole =
    viewer.role === 'teammate' ? 'teammate' : 'customer';
  const base = {
    role,
    userId: viewer.id,
    accountRole: viewer.role === 'admin' ? 'admin' : role,
    name: viewer.name || nameFromEmail(viewer.email) || 'Player',
    email: viewer.email ?? '',
    image: viewer.image,
  } as SupportPerson;
  if (role === 'customer') {
    const { data, error } = await service
      .from('orders')
      .select(
        'id,public_reference,title,game,units,status,amount_eur_cents,queued_at,accepted_at,assigned_teammate_id',
      )
      .eq('customer_id', viewer.id)
      .order('created_at', { ascending: false })
      .limit(6);
    if (error) throw error;
    const rows = (data ?? []) as Record<string, unknown>[];
    const teammateIds = [
      ...new Set(
        rows
          .map((row) => row.assigned_teammate_id)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];
    const names = new Map<string, string>();
    if (teammateIds.length) {
      const result = await service
        .from('profiles')
        .select('id,name')
        .in('id', teammateIds);
      if (result.error) throw result.error;
      for (const profile of result.data ?? [])
        names.set(profile.id, profile.name);
    }
    const orders = rows.map((row) =>
      mapOrder({
        ...row,
        teammate_name:
          typeof row.assigned_teammate_id === 'string'
            ? names.get(row.assigned_teammate_id)
            : null,
      }),
    );
    return {
      ...base,
      customer: {
        currentOrder:
          orders.find((order) =>
            ['queued', 'in_progress'].includes(order.status),
          ) ?? null,
        recentOrders: orders.filter((order) =>
          ['completed', 'cancelled'].includes(order.status),
        ),
      },
    };
  }
  // Discord link from teammate_order_access.discord_id (mirrored by a trigger
  // from the linked identity): the service role cannot read discord_accounts.
  const [orderResult, accessResult, completedResult] = await Promise.all([
    service
      .from('orders')
      .select('id,public_reference,title,game,units,customer_name,accepted_at')
      .eq('assigned_teammate_id', viewer.id)
      .eq('status', 'in_progress')
      .maybeSingle(),
    service
      .from('teammate_order_access')
      .select('approved_games,suspended,discord_id')
      .eq('user_id', viewer.id)
      .maybeSingle(),
    service
      .from('orders')
      .select('payout_usd_cents')
      .eq('assigned_teammate_id', viewer.id)
      .eq('status', 'completed'),
  ]);
  for (const result of [orderResult, accessResult, completedResult])
    if (result.error) throw result.error;
  const order = orderResult.data as Record<string, unknown> | null;
  const completed = (completedResult.data ?? []) as {
    payout_usd_cents: number;
  }[];
  return {
    ...base,
    teammate: {
      assignment: order
        ? {
            orderId: String(order.id),
            reference: String(order.public_reference),
            title: String(order.title),
            game: gameName(String(order.game)),
            units: Number(order.units),
            customerName: String(order.customer_name),
            acceptedAt: String(order.accepted_at),
          }
        : null,
      completedOrders: completed.length,
      recordedEarningsUsdCents: completed.reduce(
        (sum, row) => sum + row.payout_usd_cents,
        0,
      ),
      approvedGames: (
        (accessResult.data as { approved_games?: string[] } | null)
          ?.approved_games ?? []
      ).map(gameName),
      discordConnected: !!(
        accessResult.data as { discord_id?: string | null } | null
      )?.discord_id,
      suspended:
        (accessResult.data as { suspended?: boolean } | null)?.suspended ===
        true,
    },
  };
}
