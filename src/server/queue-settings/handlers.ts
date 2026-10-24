import type { APIRoute } from 'astro';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import {
  QueueSettingsCommandSchema,
  QueueSettingsResponseSchema,
} from '../../contracts/queue-settings';

function resultResponse(
  account: ReturnType<typeof accountContext>,
  data: unknown,
  error: unknown,
) {
  if (error || !data || typeof data !== 'object')
    return account.json({ error: 'Queue settings unavailable.' }, 503);
  const refusal = (data as { error?: { code?: unknown; message?: unknown } })
    .error;
  if (refusal) {
    const code = Number(refusal.code);
    return account.json(
      {
        error:
          typeof refusal.message === 'string'
            ? refusal.message
            : 'Could not save queue settings.',
      },
      code >= 400 && code < 600 ? code : 400,
    );
  }
  const parsed = QueueSettingsResponseSchema.safeParse(data);
  return parsed.success
    ? account.json(parsed.data)
    : account.json({ error: 'Queue settings unavailable.' }, 503);
}

export const queueSettings: APIRoute = async (context) => {
  let account = accountContext(context.request, context.cookies);
  try {
    if (!['GET', 'POST'].includes(context.request.method)) {
      const response = account.json({ error: 'Method not allowed.' }, 405);
      response.headers.set('Allow', 'GET, POST');
      return response;
    }
    let command: ReturnType<typeof QueueSettingsCommandSchema.parse> | null =
      null;
    if (context.request.method === 'POST') {
      const prepared = await mutation(context, 2048);
      account = prepared.account;
      if (prepared.failure) return prepared.failure;
      const parsed = QueueSettingsCommandSchema.safeParse(prepared.body);
      if (!parsed.success)
        return account.json({ error: 'Invalid queue settings.' }, 400);
      command = parsed.data;
    }
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'teammate')
      return account.json({ error: 'Teammates only.' }, 403);
    const result = command
      ? await account.client.rpc('set_teammate_queue_settings', {
          p_enabled_games: command.enabledGames,
          p_voice_opt_in: command.voiceOptIn,
        })
      : await account.client.rpc('teammate_queue_settings');
    return resultResponse(account, result.data, result.error);
  } catch {
    return account.json({ error: 'Queue settings unavailable.' }, 503);
  }
};
