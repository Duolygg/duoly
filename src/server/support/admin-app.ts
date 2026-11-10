import type { APIContext } from 'astro';
import { accountContext } from '../auth/context';

/**
 * The installable "Duoly Admin" phone app: its manifest and service worker. Both are served only
 * to signed-in admins; everyone else gets the same plain 404 as the admin pages, so the app is
 * invisible outside the admin team. The app is the admin site itself (scope /admin/), opening on
 * the support inbox, so every admin page check and permission still applies inside it.
 */
export async function adminOnly(
  context: APIContext,
  body: () => string,
  type: string,
): Promise<Response> {
  const account = accountContext(context.request, context.cookies);
  const notFound = () =>
    new Response('Not found', {
      status: 404,
      headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' },
    });
  try {
    const identity = await account.identity();
    if (identity?.viewer.role !== 'admin') return notFound();
  } catch {
    return notFound();
  }
  return new Response(body(), {
    status: 200,
    headers: {
      'content-type': type,
      // Never cached by a shared cache: it's only for this admin's browser.
      'cache-control': 'private, no-cache',
      vary: 'Cookie',
    },
  });
}

export function adminManifest(): string {
  return JSON.stringify({
    id: '/admin/support',
    name: 'Duoly Admin',
    short_name: 'Duoly Admin',
    description: 'Duoly support inbox for admins.',
    start_url: '/admin/support',
    scope: '/admin/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#090414',
    background_color: '#090414',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  });
}

/** The service worker: shows support alerts and opens the chat when one is tapped. */
export function adminServiceWorker(): string {
  return `// Duoly Admin: support alerts. Served to admins only.
'use strict';
const ICON = '/icon-192.png';
// Only ever open pages of the admin support inbox on this site.
const safeUrl = (value) => {
  try {
    const url = new URL(value || '/admin/support', self.location.origin);
    if (url.origin === self.location.origin && url.pathname === '/admin/support')
      return url.pathname + url.search;
  } catch (e) {}
  return '/admin/support';
};
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = typeof data.title === 'string' && data.title ? data.title : 'Duoly support';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === 'string' ? data.body : 'Open the support inbox to reply.',
      icon: ICON,
      badge: ICON,
      tag: typeof data.tag === 'string' ? data.tag : 'duoly-support',
      renotify: true,
      data: { url: safeUrl(data.url) },
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = safeUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).pathname.startsWith('/admin/') && 'navigate' in client)
          return client
            .navigate(url)
            .then((c) => (c || client).focus())
            .catch(() => self.clients.openWindow(url));
      }
      return self.clients.openWindow(url);
    }),
  );
});
`;
}
