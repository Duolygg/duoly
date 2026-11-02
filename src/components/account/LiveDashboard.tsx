import Dashboard from './Dashboard.jsx';
import type { Viewer } from '../../contracts/account';
import type { ProView } from '../../contracts/pro';

/** The original customer Dashboard on the real session and order APIs. */
export default function LiveDashboard({
  viewer,
  csrf,
  pro = null,
  proWelcome = false,
  cur = 'EUR',
  usdRate,
}: {
  viewer: Viewer;
  csrf: string;
  pro?: ProView | null;
  proWelcome?: boolean;
  /** the customer's currency: the account's, else the one picked on this browser */
  cur?: 'EUR' | 'USD';
  usdRate?: number;
}) {
  const onSignOut = async () => {
    const response = await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csrf }),
    });
    if (response.ok) window.location.assign('/');
  };
  return (
    <Dashboard
      user={viewer}
      csrf={csrf}
      onSignOut={onSignOut}
      pro={pro}
      proWelcome={proWelcome}
      cur={cur}
      usdRate={usdRate}
    />
  );
}
