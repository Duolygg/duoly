/* global Response, fetch, AbortSignal */
import {
  TeammateOrderSchema,
  OrderResponseSchemas,
} from '../../contracts/orders';
import { TeammateStatsResponseSchema } from '../../contracts/reviews';
import { QueueSettingsResponseSchema } from '../../contracts/queue-settings';
import { z } from 'zod';
import { canTake } from '../../design-reference/lib/access';
const PresenceSchema = z
  .object({
    online: z.boolean(),
    online_since: z.string().datetime().nullable(),
    forced_offline: z.object({ reason: z.string(), by: z.string() }).nullable(),
  })
  .strict();
const json = (data, status = 200) => Response.json(data, { status });
/** @param {{ csrf: string, fetcher?: (url: string, init?: RequestInit) => Promise<Response> }} options */
export function createTeammateFetch({ csrf, fetcher = fetch }) {
  const request = async (url, schema, init = {}) => {
    const response = await fetcher(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      ...init,
    });
    if (!response.ok) throw { status: response.status };
    return schema.parse(await response.json());
  };
  return async (path, init = {}) => {
    try {
      if (path === '/api/presence') {
        let command;
        try {
          command = JSON.parse(init.body || '{}');
        } catch {
          return json({ error: 'Invalid presence command' }, 400);
        }
        if (!csrf || init.method !== 'POST')
          return json({ error: 'Invalid presence command' }, 400);
        const result = await request('/api/teammate/presence', PresenceSchema, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...command, csrf }),
        });
        return json(toOriginalPresence(result));
      }
      if (path === '/api/queue-settings') {
        let body;
        if (init.method === 'POST') {
          try {
            body = JSON.parse(init.body || '{}');
          } catch {
            return json({ error: 'Invalid queue settings' }, 400);
          }
          if (
            !csrf ||
            !Array.isArray(body.enabledGames) ||
            typeof body.voiceOptIn !== 'boolean' ||
            Object.keys(body).length !== 2
          )
            return json({ error: 'Invalid queue settings' }, 400);
        }
        const settings = await request(
          '/api/teammate/queue-settings',
          QueueSettingsResponseSchema,
          init.method === 'POST'
            ? {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ csrf, ...body }),
              }
            : {},
        );
        return json({
          allowedGames: settings.allowed_games,
          enabledGames: settings.enabled_games,
          ggAccess: settings.gg_access,
          voiceOptIn: settings.voice_opt_in,
        });
      }
      if (path === '/api/desk') {
        const [queue, assignment] = await Promise.all([
          request('/api/teammate/queue', OrderResponseSchemas.teammateQueue),
          request(
            '/api/teammate/order',
            OrderResponseSchemas.teammateAssignment,
          ),
        ]);
        if (
          queue.orders.some((o) => o.status !== 'queued') ||
          (assignment.order &&
            (assignment.order.status !== 'in_progress' ||
              !assignment.order.current_assignment_id))
        )
          throw new Error('Invalid assignment');
        return json({
          queue: queue.orders.map(toOriginalTeammateOrder),
          mine: assignment.order
            ? toOriginalTeammateOrder(assignment.order)
            : null,
        });
      }
      if (path === '/api/teammate/stats')
        return json(
          await request('/api/teammate/stats', TeammateStatsResponseSchema),
        );
      if (path.startsWith('/api/orders/')) {
        const id = path.slice('/api/orders/'.length);
        const parsedId = TeammateOrderSchema.shape.id.safeParse(id);
        let body;
        try {
          body = JSON.parse(init.body);
        } catch {
          return json({ error: 'Invalid command' }, 400);
        }
        if (
          !parsedId.success ||
          !csrf ||
          init.method !== 'POST' ||
          body.action !== 'accept' ||
          Object.keys(body).length !== 1
        )
          return json({ error: 'Invalid command' }, 400);
        const result = await request(
          '/api/teammate/orders/' + id + '/accept',
          OrderResponseSchemas.teammateOrder,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csrf }),
          },
        );
        if (
          result.order.id !== id ||
          result.order.status !== 'in_progress' ||
          !result.order.current_assignment_id
        )
          throw new Error('Unconfirmed acceptance');
        return json({ order: toOriginalTeammateOrder(result.order) });
      }
      return json({ error: 'Unsupported action' }, 404);
    } catch (error) {
      return json(
        { error: 'Could not load the teammate desk.' },
        [401, 403, 404, 409].includes(error.status) ? error.status : 503,
      );
    }
  };
}

export function toOriginalPresence(raw) {
  const presence = PresenceSchema.parse(raw);
  return {
    online: presence.online,
    onlineSince: presence.online_since
      ? Date.parse(presence.online_since)
      : null,
    forcedOffline: presence.forced_offline,
  };
}

/** Null means the first queue snapshot, which must stay silent. */
export function newEligibleOrders(previousIds, orders, access, settings) {
  if (previousIds === null) return [];
  const seen = new Set(previousIds);
  const enabled = new Set(settings?.enabledGames || []);
  return orders.filter(
    (order) =>
      !seen.has(order.id) &&
      canTake(order, access) &&
      enabled.has(order.game) &&
      (settings?.voiceOptIn || !order.voice),
  );
}

/** Privacy-safe DTO to Fabian's display shape. UUIDs remain command bindings. */
export function toOriginalTeammateOrder(raw) {
  const o = TeammateOrderSchema.parse(raw);
  return {
    id: o.id,
    publicReference: o.public_reference,
    status: o.status,
    game: o.game,
    service: o.service,
    title: o.title,
    games: o.units,
    unit: o.unit,
    gg: o.gg,
    rank: o.rank,
    region: o.region,
    ign: o.ign,
    note: o.note,
    voice: o.voice,
    customer: o.customer_name,
    customerImage: o.customer_image,
    flag: o.customer_country,
    payout: o.payout_usd_cents / 100,
    realCustomer: true,
    assignmentId: o.current_assignment_id,
  };
}
