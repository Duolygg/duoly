import Dashboard from './Dashboard.jsx';
import type { Viewer } from '../../contracts/account';

/** The original customer Dashboard on the real session and order APIs. */
export default function LiveDashboard({
  viewer,
  csrf,
}: {
  viewer: Viewer;
  csrf: string;
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
  return <Dashboard user={viewer} csrf={csrf} onSignOut={onSignOut} />;
}
