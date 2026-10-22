import Home from '../../design-reference/components/Home.jsx';
import type { LoginProviders, Viewer } from '../../contracts/account';
export default function AccountHome({
  viewer,
  csrf,
  checkoutEnabled = false,
  providers,
  signup = false,
}: {
  viewer: Viewer | null;
  csrf: string;
  checkoutEnabled?: boolean;
  providers: LoginProviders;
  signup?: boolean;
}) {
  const signOut = async () => {
    const response = await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csrf }),
    });
    if (response.ok) window.location.assign('/login');
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
      if (response.status === 401) {
        window.location.assign('/login');
        return {};
      }
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
      authError={null}
      askLogin={false}
      // Sign in and checkout both open Home's popup, which posts to the real account routes.
      authForms={{ csrf, providers, signup }}
      onSignOut={signOut}
      onCheckout={checkoutEnabled ? onCheckout : undefined}
    />
  );
}
