import type { SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { z } from 'zod';

/**
 * Phone alerts for the admin support inbox (Web Push, migration
 * 20261110190000_admin_push_subscriptions.sql). Only admins with the Support section can save a
 * phone, and the database picks the phones to alert at send time (admin_push_targets), so a
 * demoted admin or one without Support never gets an alert.
 */

const envValue = (name: string) =>
  process.env[name] ?? (import.meta.env?.[name] as string | undefined);

/** Push services of the browsers that support Web Push. The server only ever posts to these. */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^(?:[a-z0-9-]+\.)*push\.apple\.com$/,
  /^(?:[a-z0-9-]+\.)*notify\.windows\.com$/,
];

export function isPushEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    (url.port === '' || url.port === '443') &&
    PUSH_HOSTS.some((host) => host.test(url.hostname))
  );
}

const base64url = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .regex(/^[A-Za-z0-9_-]+=*$/);

export const PushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .min(20)
    .max(1024)
    .refine(isPushEndpoint, 'Unsupported push service.'),
  keys: z.object({ p256dh: base64url(20, 200), auth: base64url(8, 100) }),
});

export const AdminPushSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('subscribe'),
    subscription: PushSubscriptionSchema,
    device: z.string().max(120).optional(),
  }),
  z.object({
    action: z.literal('unsubscribe'),
    endpoint: z.string().min(20).max(1024),
  }),
]);

export type PushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

/** VAPID keys from the environment; null (alerts off) when any is missing. */
export function pushConfig(): PushConfig | null {
  const publicKey = envValue('WEB_PUSH_PUBLIC_KEY')?.trim();
  const privateKey = envValue('WEB_PUSH_PRIVATE_KEY')?.trim();
  const subject =
    envValue('WEB_PUSH_SUBJECT')?.trim() || 'mailto:support@duoly.gg';
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

const plain = (value: string, max: number) =>
  Array.from(value, (ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return code < 32 || (code >= 127 && code <= 159) ? ' ' : ch;
  })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

export type SupportPush = {
  conversationId: string;
  title: string;
  body: string;
};

/** What the phone shows; the link always stays inside the admin support inbox. */
export function supportPushPayload(push: SupportPush) {
  const id = z.uuid().safeParse(push.conversationId);
  return {
    title: plain(push.title, 80) || 'Duoly support',
    body: plain(push.body, 180),
    tag: id.success ? `duoly-support-${id.data}` : 'duoly-support',
    url: id.success
      ? `/admin/support?chat=${encodeURIComponent(id.data)}`
      : '/admin/support',
  };
}

type Sender = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  options: webpush.RequestOptions,
) => Promise<unknown>;

/** Alert every admin phone that may see support. Never throws; returns how many were sent. */
export async function sendSupportPush(
  service: SupabaseClient,
  push: SupportPush,
  {
    config = pushConfig(),
    send = webpush.sendNotification as Sender,
  }: { config?: PushConfig | null; send?: Sender } = {},
): Promise<number> {
  if (!config) return 0;
  try {
    const { data, error } = await service.rpc('admin_push_targets');
    if (error || !Array.isArray(data)) return 0;
    const shown = supportPushPayload(push);
    const payload = JSON.stringify(shown);
    // Same chat: a newer alert replaces an undelivered older one (topic is max 32 url-safe chars).
    const topic = shown.tag.replace(/[^A-Za-z0-9]/g, '').slice(-32);
    const results = await Promise.all(
      (data as { endpoint: string; p256dh: string; auth: string }[])
        .filter((row) => isPushEndpoint(row.endpoint))
        .map(async (row) => {
          try {
            await send(
              {
                endpoint: row.endpoint,
                keys: { p256dh: row.p256dh, auth: row.auth },
              },
              payload,
              {
                vapidDetails: config,
                TTL: 60 * 60,
                urgency: 'high',
                topic,
                timeout: 4000,
              },
            );
            return true;
          } catch (err) {
            // The phone unsubscribed or the browser dropped it: forget it.
            const status = (err as { statusCode?: number })?.statusCode;
            if (status === 404 || status === 410)
              await service
                .from('admin_push_subscriptions')
                .delete()
                .eq('endpoint', row.endpoint);
            return false;
          }
        }),
    );
    return results.filter(Boolean).length;
  } catch {
    return 0;
  }
}
