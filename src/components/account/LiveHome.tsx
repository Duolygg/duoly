import AnalyticsErrorBoundary from '../shared/AnalyticsErrorBoundary';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import Home from '../home/Home.jsx';
import { emailAuth, signInWith } from '../../client/auth-actions';
import type { Currency, Viewer } from '../../contracts/account';
import type {
  HeroTeammate,
  HomeStats,
  RecentMatch,
} from '../../contracts/home';
import type { ProView } from '../../contracts/pro';
import {
  CustomerPerksSchema,
  PickableTeammatesSchema,
  type CustomerPerks,
  type PickableTeammates,
} from '../../contracts/orders';

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
function LiveHomeContent({
  viewer,
  csrf,
  checkoutEnabled = false,
  usdRate,
  accountCurrency = null,
  cookieCurrency = null,
  autoCurrency = null,
  onlineNow: initialOnline = 0,
  recentMatches: initialMatches = [],
  stats: initialStats = null,
  teammates: initialTeammates = [],
  authError = null,
  pro = null,
  askLogin = false,
}: {
  viewer: Viewer | null;
  csrf: string;
  checkoutEnabled?: boolean;
  usdRate?: number;
  accountCurrency?: Currency | null;
  cookieCurrency?: Currency | null;
  autoCurrency?: Currency | null;
  onlineNow?: number;
  recentMatches?: RecentMatch[];
  stats?: HomeStats | null;
  teammates?: HeroTeammate[];
  authError?: string | null;
  pro?: ProView | null;
  /** open the sign-in dialog on load (a signed-out visit to a page that needs an account) */
  askLogin?: boolean;
}) {
  const [walletEur, setWalletEur] = useState<number | undefined>(undefined);
  // /?signin=1 opened the sign-in dialog; drop it from the address so a reload doesn't reopen it
  useEffect(() => {
    if (!askLogin) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('signin');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, [askLogin]);
  const [live, setLive] = useState({
    onlineNow: initialOnline,
    recentMatches: initialMatches,
    stats: initialStats,
    teammates: initialTeammates,
  });
  // Keeps the figures fresh on an open tab. The endpoint is CDN-cached, so this is cheap.
  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const response = await fetch('/api/home/live', {
          credentials: 'omit',
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          onlineNow?: unknown;
          recentMatches?: unknown;
          stats?: HomeStats | null;
          teammates?: unknown;
        };
        setLive((current) => ({
          onlineNow:
            typeof data.onlineNow === 'number'
              ? data.onlineNow
              : current.onlineNow,
          recentMatches: Array.isArray(data.recentMatches)
            ? (data.recentMatches as RecentMatch[])
            : current.recentMatches,
          stats:
            data.stats && typeof data.stats === 'object'
              ? data.stats
              : current.stats,
          teammates: Array.isArray(data.teammates)
            ? (data.teammates as HeroTeammate[])
            : current.teammates,
        }));
      } catch {
        /* Keep the last figures. */
      }
    };
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!viewer || viewer.role !== 'customer') return;
    let active = true;
    void fetch('/api/orders/credits', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { balance?: { total_eur_cents?: unknown } } | null) => {
        const cents = Number(data?.balance?.total_eur_cents);
        if (active && Number.isFinite(cents))
          setWalletEur(Math.max(0, cents) / 100);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [viewer]);

  // Original HomeWithAuth saveCurrency: a cookie so the next visit knows it (also
  // signed out), plus the account when signed in so it follows the user to other devices.
  const saveCurrency = (code: Currency) => {
    document.cookie =
      'duoly-currency=' +
      code +
      '; Path=/; Max-Age=31536000; SameSite=Lax; Secure';
    if (!viewer) return;
    fetch('/api/me/currency', {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency: code, csrf }),
    }).catch(() => {});
  };
  // Auto-detected currency: its own cookie (never the account), so the next load renders it
  // right away while the navbar still says "Auto-detected".
  const saveAutoCurrency = (code: Currency) => {
    document.cookie =
      'duoly-currency-auto=' +
      code +
      '; Path=/; Max-Age=31536000; SameSite=Lax; Secure';
  };
  // Just signed in: the account's currency wins; if it has none yet, keep the one picked here.
  useEffect(() => {
    if (viewer && !accountCurrency && cookieCurrency)
      saveCurrency(cookieCurrency);
    // Runs once per page load with the server-rendered values.
  }, []);
  const signOut = async () => {
    const response = await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csrf }),
    });
    if (response.ok) window.location.assign('/');
  };
  // Google, Discord and email: the same routes as the sign-in page (client/auth-actions.ts).
  // A pending order is remembered first, so a sign-in comes straight back to pay.
  const onSignIn = (provider: string) => {
    rememberCheckout();
    signInWith(provider, csrf);
  };
  const onEmailAuth = (form: {
    mode: 'login' | 'register';
    email: string;
    password: string;
  }) => {
    rememberCheckout();
    return emailAuth(form, csrf);
  };
  // Perks (migration 20261026160000): null hides every perk control (not live or not allowed).
  const loadPerks = async (): Promise<CustomerPerks | null> => {
    try {
      const response = await fetch('/api/orders/perks', {
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
      });
      if (!response.ok) return null;
      const parsed = CustomerPerksSchema.safeParse(
        ((await response.json()) as { perks?: unknown }).perks,
      );
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  };
  // Diamond: past teammates free for this game, Gamer Girl and voice choice right now.
  const loadPickable = async (
    query: string,
  ): Promise<PickableTeammates['teammates']> => {
    try {
      const response = await fetch('/api/orders/pickable-teammates?' + query, {
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
      });
      if (!response.ok) return [];
      const parsed = PickableTeammatesSchema.safeParse(await response.json());
      return parsed.success && parsed.data.eligible
        ? parsed.data.teammates
        : [];
    } catch {
      return [];
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
      if (
        response.ok &&
        data.url &&
        (data.url.startsWith('/checkout/') || data.url.startsWith('/queue/'))
      )
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
      csrf={csrf}
      session={viewer ? { user: viewer } : null}
      initialCurrency={accountCurrency ?? cookieCurrency}
      initialAutoCurrency={autoCurrency}
      onCurrency={saveCurrency}
      onAutoCurrency={saveAutoCurrency}
      authError={authError}
      askLogin={askLogin}
      onSignIn={onSignIn}
      onSignOut={signOut}
      onEmailAuth={onEmailAuth}
      onCheckout={checkoutEnabled ? onCheckout : undefined}
      loadPerks={loadPerks}
      loadPickable={loadPickable}
      walletEur={walletEur}
      usdRate={usdRate}
      onlineNow={live.onlineNow}
      recentMatches={live.recentMatches}
      stats={live.stats}
      teammates={live.teammates}
      pro={pro}
    />
  );
}

export default function LiveHome(
  props: ComponentProps<typeof LiveHomeContent>,
) {
  return (
    <AnalyticsErrorBoundary source="home">
      <LiveHomeContent {...props} />
    </AnalyticsErrorBoundary>
  );
}
