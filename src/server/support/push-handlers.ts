import type { APIRoute } from 'astro';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import { rpcResponse } from '../admin/handlers';
import { adminAccess, canUse } from '../admin/access';
import { AdminPushSchema, pushConfig } from './push';

/**
 * /api/admin/push: turn phone alerts for the support inbox on or off. Admins only (others get a
 * plain 404, like every admin route); saving a phone also needs the Support section, which the
 * database checks again (admin_push_subscribe).
 */
export const getAdminPush: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  try {
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'admin')
      return account.json({ error: 'Not found.' }, 404);
    const access = await adminAccess(account.client);
    if (!canUse(access, ['support']))
      return account.json({ error: 'Not found.' }, 404);
    const config = pushConfig();
    return account.json({
      enabled: !!config,
      publicKey: config?.publicKey ?? '',
    });
  } catch {
    return account.json({ error: 'Phone alerts unavailable.' }, 503);
  }
};

export const postAdminPush: APIRoute = async (context) => {
  const prepared = await mutation(context, 4096);
  if (prepared.failure || !prepared.body) return prepared.failure!;
  const { account } = prepared;
  try {
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'admin')
      return account.json({ error: 'Not found.' }, 404);
    const parsed = AdminPushSchema.safeParse(prepared.body);
    if (!parsed.success)
      return account.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request.' },
        400,
      );
    if (parsed.data.action === 'unsubscribe') {
      const { data, error } = await account.client.rpc(
        'admin_push_unsubscribe',
        {
          p_endpoint: parsed.data.endpoint,
        },
      );
      return rpcResponse(account, data, error);
    }
    if (!pushConfig())
      return account.json({ error: 'Phone alerts aren’t set up yet.' }, 503);
    const { subscription, device } = parsed.data;
    const { data, error } = await account.client.rpc('admin_push_subscribe', {
      p_endpoint: subscription.endpoint,
      p_p256dh: subscription.keys.p256dh,
      p_auth: subscription.keys.auth,
      p_device: device ?? '',
    });
    return rpcResponse(account, data, error);
  } catch {
    return account.json({ error: 'Phone alerts unavailable.' }, 503);
  }
};
