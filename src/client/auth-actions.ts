// Sign-in from the popup (components/auth/AuthDialog.jsx), shared by the homepage and the dialog
// every other page opens: the same server routes the /login page posts to.

/** Google and Discord: posts the provider form, the browser follows the provider redirect. */
export function signInWith(provider: string, csrf: string) {
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
}

/**
 * Email and password: answered as JSON so the popup shows messages in place. Signed in, it goes
 * where the server says and returns null; otherwise it returns the message to show.
 */
export async function emailAuth(
  form: { mode: 'login' | 'register'; email: string; password: string },
  csrf: string,
): Promise<string | null> {
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
}
