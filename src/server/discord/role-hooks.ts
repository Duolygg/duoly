import type { APIRoute } from 'astro';
import {
  roleSyncConfig,
  syncDiscordRoles,
  tickAuthorized,
  type SyncScope,
} from './role-sync';

/**
 * Event hooks for the Discord role sync (ledger #40). The original synced 300 ms after a
 * link or unlink and otherwise every 5 seconds; here the server syncs the affected people
 * right after an action succeeded. It never changes the response of that action: Discord
 * errors are swallowed and the pg_cron sweep fixes anything left over.
 */
const HOOK_BUDGET_MS = 2500;

export async function syncRolesAfter(scope: SyncScope): Promise<void> {
  try {
    if (!roleSyncConfig()) return;
    const users = (scope.users ?? []).filter(Boolean);
    if (!users.length && !scope.order) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      syncDiscordRoles(
        { users, ...(scope.order ? { order: scope.order } : {}) },
        { budgetMs: HOOK_BUDGET_MS },
      ).catch(() => undefined),
      new Promise((resolve) => {
        timer = setTimeout(resolve, HOOK_BUDGET_MS + 1000);
      }),
    ]);
    clearTimeout(timer);
  } catch {
    /* never fail the user's request because of Discord */
  }
}

/**
 * Same sync, but the response goes out first. On Vercel the function stays alive for it through
 * the platform's request context (what @vercel/functions' waitUntil reads); elsewhere (local dev,
 * tests) there is none, so it falls back to awaiting.
 */
export async function syncRolesInBackground(scope: SyncScope): Promise<void> {
  const context = (
    globalThis as {
      [key: symbol]:
        | { get?: () => { waitUntil?: (p: Promise<unknown>) => void } }
        | undefined;
    }
  )[Symbol.for('@vercel/request-context')];
  const waitUntil = context?.get?.()?.waitUntil;
  if (typeof waitUntil === 'function') waitUntil(syncRolesAfter(scope));
  else await syncRolesAfter(scope);
}

/** Runs the hook after a successful (200) response of the wrapped route. */
export function withRoleSync(
  handler: APIRoute,
  scope: (context: Parameters<APIRoute>[0]) => SyncScope | null,
): APIRoute {
  return async (context) => {
    const response = await handler(context);
    if (response.status === 200) {
      const target = (() => {
        try {
          return scope(context);
        } catch {
          return null;
        }
      })();
      if (target) await syncRolesAfter(target);
    }
    return response;
  };
}

/** POST /api/discord/roles/tick: the reconcile sweep called by pg_cron every 30 seconds. */
export const rolesTick: APIRoute = async ({ request }) => {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
  if (request.method !== 'POST')
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { ...headers, Allow: 'POST' },
    });
  if (!tickAuthorized(request.headers.get('authorization')))
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers,
    });
  try {
    const result = await syncDiscordRoles(null);
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: 'sync_failed' }), {
      status: 503,
      headers,
    });
  }
};
