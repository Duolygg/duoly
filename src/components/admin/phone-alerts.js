// Phone alerts for the support inbox (Web Push) and the installable "Duoly Admin" app.
// The service worker and the manifest are served to admins only (/admin/sw.js,
// /admin/app.webmanifest); /api/admin/push re-checks the admin role and the Support section.
/* global window, navigator, Notification, atob */

const SCOPE = '/admin/';

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  );
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    (window.matchMedia &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true
  );
}

export function isIos() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Base64url VAPID key → the bytes PushManager wants. */
export function keyBytes(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function deviceName() {
  const ua = navigator.userAgent || '';
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : 'Browser';
  return os + (isStandalone() ? ' app' : '');
}

async function registration() {
  if (!pushSupported()) return null;
  try {
    return (await navigator.serviceWorker.getRegistration(SCOPE)) || null;
  } catch {
    return null;
  }
}

/** 'unsupported' | 'install' (iPhone outside the home-screen app) | 'denied' | 'on' | 'off' */
export async function alertState() {
  if (!pushSupported())
    return isIos() && !isStandalone() ? 'install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Turn alerts on for this device. Returns { ok, error? }. */
export async function enableAlerts(api) {
  if (!pushSupported())
    return { ok: false, error: 'This browser can’t show phone alerts.' };
  const config = await api.get('/api/admin/push');
  if (!config.ok) return { ok: false, error: config.error };
  if (!config.data.enabled || !config.data.publicKey)
    return {
      ok: false,
      error: 'Phone alerts aren’t set up on the server yet.',
    };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted')
    return {
      ok: false,
      error:
        permission === 'denied'
          ? 'Notifications are blocked for this site. Allow them in your settings.'
          : 'Notifications weren’t allowed.',
    };
  let sub;
  try {
    const reg = await navigator.serviceWorker.register('/admin/sw.js', {
      scope: SCOPE,
    });
    await navigator.serviceWorker.ready;
    sub = await reg.pushManager.getSubscription();
    const key = keyBytes(config.data.publicKey);
    // A subscription made with another server key can't receive our alerts: replace it.
    const current =
      sub && sub.options && sub.options.applicationServerKey
        ? new Uint8Array(sub.options.applicationServerKey)
        : null;
    if (sub && current && current.join() !== key.join()) {
      await sub.unsubscribe();
      sub = null;
    }
    if (!sub)
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
  } catch {
    return { ok: false, error: 'Couldn’t turn on alerts on this device.' };
  }
  const json = sub.toJSON();
  const saved = await api.post('/api/admin/push', {
    action: 'subscribe',
    subscription: { endpoint: json.endpoint, keys: json.keys },
    device: deviceName(),
  });
  if (!saved.ok) {
    await sub.unsubscribe().catch(() => undefined);
    return { ok: false, error: saved.error };
  }
  return { ok: true };
}

/** Turn alerts off for this device. */
export async function disableAlerts(api) {
  const reg = await registration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return { ok: true };
  const saved = await api.post('/api/admin/push', {
    action: 'unsubscribe',
    endpoint: sub.endpoint,
  });
  await sub.unsubscribe().catch(() => undefined);
  return saved.ok ? { ok: true } : { ok: false, error: saved.error };
}

/** Android/desktop Chrome: the saved "Install app" prompt, if the browser offered one. */
export function installPrompt() {
  return (typeof window !== 'undefined' && window.__duolyInstall) || null;
}

export async function runInstall() {
  const event = installPrompt();
  if (!event) return false;
  window.__duolyInstall = null;
  try {
    await event.prompt();
    const choice = await event.userChoice;
    return choice && choice.outcome === 'accepted';
  } catch {
    return false;
  }
}
