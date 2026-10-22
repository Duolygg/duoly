import Home from '../../design-reference/components/Home.jsx';
import type { Viewer } from '../../contracts/account';
export default function AccountHome({
  viewer,
  csrf,
}: {
  viewer: Viewer | null;
  csrf: string;
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
  return (
    <Home
      session={viewer ? { user: viewer } : null}
      initialCurrency="EUR"
      authError={null}
      askLogin={false}
      onOpenLogin={() => window.location.assign('/login')}
      onSignIn={() => window.location.assign('/login')}
      onSignOut={signOut}
      onEmailAuth={async () => 'Use the account sign-in page.'}
    />
  );
}
