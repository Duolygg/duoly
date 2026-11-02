// The homepage's sign-in popup (AuthDialog.jsx) on every other page, for signed-out visitors:
// any link to /login opens it in place. The link keeps working without JavaScript.
import React from 'react';
import AuthDialog, { authStat } from './AuthDialog';
import { emailAuth, signInWith } from '../../client/auth-actions';

export default function SiteAuthDialog({ csrf }) {
  const [open, setOpen] = React.useState(false);
  const [stat, setStat] = React.useState(null);
  React.useEffect(() => {
    const onClick = (event) => {
      const link =
        event.target.closest && event.target.closest('a[href="/login"]');
      if (
        !link ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      document
        .querySelectorAll('.site-header details[open]')
        .forEach((d) => d.removeAttribute('open'));
      setOpen(true);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  // the rating line, from the same public stats as the homepage (loaded the first time it opens)
  React.useEffect(() => {
    if (!open || stat) return;
    fetch('/api/home/live', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setStat(authStat(data && data.stats)))
      .catch(() => {});
  }, [open, stat]);
  return (
    <AuthDialog
      open={open}
      stat={stat || {}}
      onClose={() => setOpen(false)}
      onSignIn={(provider) => signInWith(provider, csrf)}
      onEmailAuth={(form) => emailAuth(form, csrf)}
      onDone={() => setOpen(false)}
    />
  );
}
