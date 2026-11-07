import { useState } from 'react';
import './order-ai-status.css';

/** A capability is held only in React memory, never props, storage, analytics or data attributes. */
export default function OrderAiStatus({
  id,
  csrf,
}: {
  id: string;
  csrf: string;
}) {
  const [code, setCode] = useState<{ token: string; expiresAt: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [copied, setCopied] = useState(false);
  async function change(method: 'POST' | 'DELETE') {
    setBusy(true);
    setMessage('');
    setCopied(false);
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(id)}/ai-status-token`,
        {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csrf }),
          cache: 'no-store',
        },
      );
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      if (method === 'DELETE') {
        setCode(null);
        setMessage('Code revoked.');
      } else if (
        typeof data.token === 'string' &&
        /^dos_[A-Za-z0-9_-]{43}$/.test(data.token) &&
        Number.isFinite(Date.parse(data.expiresAt))
      )
        setCode({ token: data.token, expiresAt: data.expiresAt });
      else throw new Error('Unavailable');
    } catch {
      setMessage('Your code could not be updated. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(
        `Check my Duoly order with code ${code.token}`,
      );
      setCopied(true);
    } catch {
      setMessage('Copy is unavailable. Select the code and copy it.');
    }
  }
  return (
    <section
      className="order-ai-panel"
      aria-labelledby="order-ai-heading"
      data-private
      data-private-block
    >
      <div className="order-ai-heading">
        <span className="order-ai-icon" aria-hidden="true">
          ✧
        </span>
        <div>
          <h2 id="order-ai-heading">Ask your AI about this order</h2>
          <p>Claude or ChatGPT can check it for you any time you ask.</p>
        </div>
      </div>
      {code ? (
        <>
          <div className="order-ai-code">
            <div>
              <span>Check my Duoly order with code</span>
              <code>
                {code.token.slice(0, 13)}…{code.token.slice(-4)}
              </code>
            </div>
            <button type="button" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="order-ai-meta">
            <span>
              Expires{' '}
              {new Date(code.expiresAt).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
              })}
            </span>
            <span>Only this order</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => change('DELETE')}
            >
              Revoke code
            </button>
          </div>
        </>
      ) : (
        <div className="order-ai-actions">
          <button type="button" disabled={busy} onClick={() => change('POST')}>
            {busy ? 'Generating...' : 'Generate code'}
          </button>
          <button
            className="order-ai-revoke"
            type="button"
            disabled={busy}
            onClick={() => change('DELETE')}
          >
            Revoke code
          </button>
        </div>
      )}
      <div className="order-ai-sharing">
        <div>
          <span aria-hidden="true">✓</span>
          <p>
            <b>Shared</b>Order status, game, service, games booked, rank and
            region, price paid, teammate display names
          </p>
        </div>
        <div>
          <span aria-hidden="true">×</span>
          <p>
            <b>Never shared</b>Your email, card and billing details, chat
            messages, Riot ID, account details
          </p>
        </div>
      </div>
      <p className="order-ai-warning">
        Anyone with this code can see this limited status. A new code replaces
        the previous one. Keep it private; you will not see it again after this
        page.
      </p>
      <p className="order-ai-setup">
        No Duoly connector yet?{' '}
        <a href="https://duoly.gg/ai">Add it to your AI in a minute</a>
      </p>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
