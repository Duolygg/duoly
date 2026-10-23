import Home from '../home/Home.jsx';
import type { Viewer } from '../../contracts/account';

const PENDING_KEY = 'duoly-pending-queue';

/** A checkout started while signed out resumes on the homepage after sign-in. */
function rememberCheckout() {
  try {
    if (window.localStorage.getItem(PENDING_KEY))
      document.cookie =
        'duoly_resume=checkout; Max-Age=1800; Path=/; SameSite=Lax; Secure';
  } catch {
    /* Storage blocked: sign-in still works, the order form just starts fresh. */
  }
}

/** The original homepage (Home.jsx) on real checkout, FX and sign-in. */
export default function LiveHome({
  viewer,
  csrf,
  checkoutEnabled = false,
  usdRate,
  authError = null,
}: {
  viewer: Viewer | null;
  csrf: string;
  checkoutEnabled?: boolean;
  usdRate?: number;
  authError?: string | null;
}) {
  const signOut = async () => {
    const response = await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csrf }),
    });
    if (response.ok) window.location.assign('/');
  };
  // Google and Discord: the same server route the sign-in page uses.
  const onSignIn = (provider: string) => {
    rememberCheckout();
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/auth/oauth';
    for (const [name, value] of [
      ['csrf', csrf],
      ['provider', provider],
    ] as const) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  };
  // Email and password: answered as JSON so the popup shows messages in place.
  const onEmailAuth = async (form: {
    mode: 'login' | 'register';
    email: string;
    password: string;
  }): Promise<string | null> => {
    rememberCheckout();
    try {
      const response = await fetch(
        form.mode === 'register'
          ? '/auth/password/register'
          : '/auth/password/login',
        {
          method: 'POST',
          credentials: 'same-origin',
          redirect: 'error',
          headers: {
            'Content-Type': 'application/json',
            'X-Duoly-Auth': 'popup',
          },
          body: JSON.stringify({
            csrf,
            email: form.email,
            password: form.password,
          }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        redirect?: string;
        error?: string;
        notice?: string;
      };
      if (data.redirect?.startsWith('/')) {
        window.location.assign(data.redirect);
        return null;
      }
      return (
        data.error ??
        data.notice ??
        'Sign-in didn’t work. Reload the page and try again.'
      );
    } catch {
      return 'Can’t reach Duoly right now. Check your connection and try again.';
    }
  };
  const onCheckout = async (selection: Record<string, unknown>) => {
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        credentials: 'same-origin',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selection, csrf }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        order_id?: string;
      };
      if (response.ok && data.url?.startsWith('/checkout/'))
        return { url: data.url };
      if (response.status === 409 && data.order_id)
        return { orderId: data.order_id };
      return {
        error: data.error ?? 'Couldn’t start checkout. Please try again.',
      };
    } catch {
      return {
        error:
          'Can’t reach Duoly right now. Check your connection and try again.',
      };
    }
  };
  return (
    <Home
      session={viewer ? { user: viewer } : null}
      initialCurrency="EUR"
      authError={authError}
      askLogin={false}
      onSignIn={onSignIn}
      onSignOut={signOut}
      onEmailAuth={onEmailAuth}
      onCheckout={checkoutEnabled ? onCheckout : undefined}
      usdRate={usdRate}
    />
  );
}
