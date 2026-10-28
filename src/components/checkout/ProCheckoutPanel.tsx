import { useEffect, useRef, useState } from 'react';
import {
  loadStripe,
  type Appearance,
  type StripeCheckoutElementsSdk,
  type StripeCheckoutLoadActionsSuccess,
} from '@stripe/stripe-js';
import './checkout.css';

type Phase = 'loading' | 'ready' | 'paying' | 'done' | 'failed';

interface Props {
  publishableKey: string;
  csrf: string;
  trial: boolean;
  fontUrl: string;
}

const appearance: Appearance = {
  theme: 'night',
  labels: 'above',
  variables: {
    colorPrimary: '#D6BBFF',
    colorBackground: '#0B0716',
    colorText: '#F3EEFF',
    colorTextSecondary: '#A79DC4',
    colorTextPlaceholder: '#8E84AB',
    colorDanger: '#FF8A9B',
    fontFamily: 'Geist, system-ui, sans-serif',
    fontSizeBase: '15px',
    borderRadius: '12px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': {
      border: '1px solid rgba(214, 187, 255, 0.18)',
      boxShadow: 'none',
      padding: '13px 14px',
    },
    '.Input:focus': {
      border: '1px solid rgba(214, 187, 255, 0.6)',
      boxShadow: '0 0 0 3px rgba(214, 187, 255, 0.18)',
    },
    '.Label': {
      fontSize: '13px',
      fontWeight: '600',
      color: '#CFC4EA',
      marginBottom: '6px',
    },
  },
};

const WELCOME = '/dashboard?pro=welcome#pro';

/** Duoly PRO sign-up on Checkout Elements (subscription mode, ledger #39). */
export default function ProCheckoutPanel({
  publishableKey,
  csrf,
  trial,
  fontUrl,
}: Props) {
  const paymentRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<StripeCheckoutLoadActionsSuccess | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [fatal, setFatal] = useState('');

  useEffect(() => {
    let cancelled = false;
    let checkout: StripeCheckoutElementsSdk | null = null;
    const fail = (message: string) => {
      if (cancelled) return;
      setFatal(message);
      setPhase('failed');
    };
    (async () => {
      try {
        const response = await fetch('/api/pro/checkout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csrf }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          client_secret?: string;
          error?: string;
        };
        if (!response.ok || !data.client_secret)
          return fail(data.error || 'Duoly PRO is unavailable. Try again.');
        const stripe = await loadStripe(publishableKey);
        if (!stripe || cancelled) return;
        checkout = stripe.initCheckoutElementsSdk({
          clientSecret: data.client_secret,
          elementsOptions: {
            appearance,
            loader: 'never',
            fonts: [
              { family: 'Geist', src: `url(${fontUrl})`, weight: '400' },
              { family: 'Geist', src: `url(${fontUrl})`, weight: '600' },
            ],
          },
        });
        const loaded = await checkout.loadActions();
        if (cancelled) return;
        if (loaded.type === 'error')
          return fail(
            'This sign-up has ended. Reload the page to start again.',
          );
        actionsRef.current = loaded.actions;
        const element = checkout.createPaymentElement({
          layout: { type: 'accordion', defaultCollapsed: false },
        });
        element.on('change', () => setError(''));
        element.on('ready', () => {
          if (!cancelled) setPhase('ready');
        });
        element.on('loaderror', () =>
          fail('The payment form couldn’t load. Reload the page.'),
        );
        if (paymentRef.current) element.mount(paymentRef.current);
      } catch {
        fail(
          'The payment form couldn’t load. Check your connection and reload.',
        );
      }
    })();
    return () => {
      cancelled = true;
      checkout?.getPaymentElement()?.destroy();
    };
  }, [publishableKey, csrf, fontUrl]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const actions = actionsRef.current;
    if (!actions || phase !== 'ready') return;
    setError('');
    setPhase('paying');
    const result = await actions.confirm({ redirect: 'if_required' });
    if (result.type === 'error') {
      setError(
        result.error.message ||
          'That didn’t go through. Try again or use another card.',
      );
      setPhase('ready');
      return;
    }
    setPhase('done');
    window.location.assign(WELCOME);
  };

  if (phase === 'failed')
    return (
      <div className="pay-card pay-failed" role="alert">
        <h2>PRO sign-up unavailable</h2>
        <p>{fatal}</p>
        <a className="pay-btn as-link" href="/dashboard#pro">
          Back to your dashboard
        </a>
      </div>
    );

  const label = trial ? 'Start my 7 free days' : 'Get PRO · €4.99/month';
  return (
    <form
      className={`pay-card is-${phase}`}
      onSubmit={submit}
      aria-busy={phase === 'loading' || phase === 'paying'}
      noValidate
      data-pro-checkout
    >
      <div className="pay-head">
        <h2>Payment</h2>
        <span className="pay-secure">Secured by Stripe</span>
      </div>
      <div className="pay-element">
        {phase === 'loading' && (
          <div className="pay-skeleton" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        )}
        <div ref={paymentRef} />
      </div>
      {error && (
        <p className="pay-error" role="alert">
          {error}
        </p>
      )}
      <button className="pay-btn" type="submit" disabled={phase !== 'ready'}>
        <span className="pay-btn-label">
          {phase === 'paying' || phase === 'done' ? 'Confirming…' : label}
        </span>
      </button>
      <p className="pay-fine">
        {trial
          ? 'Free for 7 days, then €4.99 a month until you cancel. Cancel anytime from your dashboard.'
          : '€4.99 a month until you cancel. Cancel anytime from your dashboard.'}
      </p>
    </form>
  );
}
