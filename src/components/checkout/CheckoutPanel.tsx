import AnalyticsErrorBoundary from '../shared/AnalyticsErrorBoundary';
import type { ComponentProps } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  loadStripe,
  type Appearance,
  type StripeCheckoutElementsSdk,
  type StripeCheckoutLoadActionsSuccess,
} from '@stripe/stripe-js';
import './checkout.css';

type Phase = 'loading' | 'ready' | 'paying' | 'held' | 'failed';

interface Props {
  publishableKey: string;
  clientSecret: string;
  intentId: string;
  /** Server-rendered total, shown until Stripe reports the live one. */
  totalLabel: string;
  fontUrl: string;
}

/** Duoly's palette for Stripe's secure fields (they render in Stripe iframes). */
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
    colorSuccess: '#5EEAA8',
    colorIcon: '#A79DC4',
    fontFamily: 'Geist, system-ui, sans-serif',
    fontSizeBase: '15px',
    fontWeightNormal: '450',
    fontWeightMedium: '600',
    borderRadius: '12px',
    spacingUnit: '4px',
    gridRowSpacing: '14px',
    focusBoxShadow: '0 0 0 3px rgba(214, 187, 255, 0.22)',
    focusOutline: 'none',
  },
  rules: {
    '.Input': {
      border: '1px solid rgba(214, 187, 255, 0.18)',
      boxShadow: 'none',
      padding: '13px 14px',
      transition: 'border-color .15s ease, box-shadow .15s ease',
    },
    '.Input:hover': { border: '1px solid rgba(214, 187, 255, 0.28)' },
    '.Input:focus': {
      border: '1px solid rgba(214, 187, 255, 0.6)',
      boxShadow: '0 0 0 3px rgba(214, 187, 255, 0.18)',
    },
    '.Input--invalid': {
      border: '1px solid rgba(255, 138, 155, 0.7)',
      boxShadow: 'none',
    },
    '.Label': {
      fontSize: '13px',
      fontWeight: '600',
      color: '#CFC4EA',
      marginBottom: '6px',
    },
    '.AccordionItem': {
      backgroundColor: '#150D29',
      border: '1px solid rgba(214, 187, 255, 0.12)',
      boxShadow: 'none',
      padding: '14px 16px',
      color: '#F3EEFF',
      fontSize: '15px',
      fontWeight: '600',
    },
    '.AccordionItem:hover': { backgroundColor: '#1A1030' },
    '.AccordionItem--selected': {
      backgroundColor: '#1A1030',
      border: '1px solid #B98CFF',
      boxShadow: '0 0 0 3px rgba(185, 140, 255, 0.14)',
      color: '#FFFFFF',
    },
    '.Error': { fontSize: '13px' },
    '.Text--redirect': { color: '#A79DC4' },
  },
};

function friendly(message: string | undefined) {
  if (!message)
    return 'That didn’t go through. Try again or pick another method.';
  return message;
}

function CheckoutPanelContent({
  publishableKey,
  clientSecret,
  intentId,
  totalLabel,
  fontUrl,
}: Props) {
  const expressRef = useRef<HTMLDivElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<StripeCheckoutLoadActionsSuccess | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  // Apple Pay / Google Pay available: lead with one big wallet button.
  const [wallet, setWallet] = useState<'' | 'Apple Pay' | 'Google Pay'>('');
  const [showOther, setShowOther] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const [express, setExpress] = useState<'pending' | 'shown' | 'none'>(
    'pending',
  );
  const [total, setTotal] = useState(totalLabel);
  const [error, setError] = useState('');
  const [fatal, setFatal] = useState('');

  // Mount Stripe once. Everything else on the page is already rendered.
  useEffect(() => {
    let cancelled = false;
    let checkout: StripeCheckoutElementsSdk | null = null;
    (async () => {
      try {
        const stripe = await loadStripe(publishableKey);
        if (!stripe || cancelled) return;
        checkout = stripe.initCheckoutElementsSdk({
          clientSecret,
          adaptivePricing: { allowed: true },
          elementsOptions: {
            appearance,
            loader: 'never',
            fonts: [
              { family: 'Geist', src: `url(${fontUrl})`, weight: '400' },
              { family: 'Geist', src: `url(${fontUrl})`, weight: '600' },
            ],
          },
        });
        checkout.on('change', (session) => {
          if (session.total?.total?.amount)
            setTotal(session.total.total.amount);
        });
        const loaded = await checkout.loadActions();
        if (cancelled) return;
        if (loaded.type === 'error') {
          setFatal('This checkout has ended. Start a new order to pay.');
          setPhase('failed');
          return;
        }
        actionsRef.current = loaded.actions;
        const session = loaded.actions.getSession();
        if (session.total?.total?.amount) setTotal(session.total.total.amount);

        const expressElement = checkout.createExpressCheckoutElement({
          buttonHeight: 54,
          buttonTheme: {
            applePay: 'white',
            googlePay: 'white',
            paypal: 'white',
          },
          buttonType: { applePay: 'plain', googlePay: 'plain', paypal: 'pay' },
          // One button per row: the wallet gets the full width.
          layout: { maxColumns: 1, maxRows: 2, overflow: 'auto' },
          paymentMethodOrder: ['apple_pay', 'google_pay', 'paypal', 'link'],
          paymentMethods: undefined,
        });
        expressElement.on('ready', (event) => {
          const methods = event.availablePaymentMethods;
          setWallet(
            methods?.applePay
              ? 'Apple Pay'
              : methods?.googlePay
                ? 'Google Pay'
                : '',
          );
          setExpress(
            methods && Object.values(methods).some(Boolean) ? 'shown' : 'none',
          );
        });
        expressElement.on('loaderror', () => setExpress('none'));
        expressElement.on('confirm', async (event) => {
          const actions = actionsRef.current;
          if (!actions) return;
          setError('');
          setPhase('paying');
          const result = await actions.confirm({
            expressCheckoutConfirmEvent: event,
            redirect: 'if_required',
          });
          if (result.type === 'error') {
            setError(friendly(result.error.message));
            setPhase('ready');
          } else setPhase('held');
        });
        if (expressRef.current) expressElement.mount(expressRef.current);

        const paymentElement = checkout.createPaymentElement({
          layout: {
            type: 'accordion',
            defaultCollapsed: false,
            radios: 'never',
            spacedAccordionItems: true,
            visibleAccordionItemsCount: 3,
          },
          // Wallets and Link live in the express row above, once.
          wallets: { applePay: 'never', googlePay: 'never', link: 'never' },
        });
        // Any edit clears a previous error: never show a stale message.
        paymentElement.on('change', () => setError(''));
        paymentElement.on('ready', () => {
          if (!cancelled) setPaymentReady(true);
        });
        paymentElement.on('loaderror', () => {
          setFatal('The payment form couldn’t load. Reload the page.');
          setPhase('failed');
        });
        if (paymentRef.current) paymentElement.mount(paymentRef.current);
      } catch {
        if (!cancelled) {
          setFatal(
            'The payment form couldn’t load. Check your connection and reload.',
          );
          setPhase('failed');
        }
      }
    })();
    return () => {
      cancelled = true;
      checkout?.getPaymentElement()?.destroy();
      checkout?.getExpressCheckoutElement()?.destroy();
    };
  }, [publishableKey, clientSecret, fontUrl]);

  // Reveal only once both elements have decided, so the layout settles once.
  useEffect(() => {
    if (!paymentReady || phase !== 'loading') return;
    if (express !== 'pending') {
      setPhase('ready');
      return;
    }
    const fallback = setTimeout(() => setExpress('none'), 2500);
    return () => clearTimeout(fallback);
  }, [paymentReady, express, phase]);

  // After a successful confirm: wait for our webhook to queue the order.
  useEffect(() => {
    if (phase !== 'held') return;
    let stop = false;
    let delay = 500;
    const poll = async () => {
      if (stop) return;
      try {
        const response = await fetch(`/api/checkout/${intentId}/status`, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const data = (await response.json()) as {
          status?: string;
          order_id?: string | null;
        };
        if (data.status === 'paid' && data.order_id) {
          window.location.replace(`/queue/${data.order_id}`);
          return;
        }
        if (data.status === 'conflict') {
          window.location.replace('/dashboard');
          return;
        }
      } catch {
        /* keep polling */
      }
      delay = Math.min(delay * 1.25, 3000);
      setTimeout(poll, delay);
    };
    const first = setTimeout(poll, 400);
    return () => {
      stop = true;
      clearTimeout(first);
    };
  }, [phase, intentId]);

  const pay = async (event: React.FormEvent) => {
    event.preventDefault();
    const actions = actionsRef.current;
    if (!actions || phase !== 'ready') return;
    setError('');
    setPhase('paying');
    const result = await actions.confirm({ redirect: 'if_required' });
    if (result.type === 'error') {
      setError(friendly(result.error.message));
      setPhase('ready');
    } else setPhase('held');
  };

  if (phase === 'failed')
    return (
      <div className="pay-card pay-failed" role="alert">
        <h2>Checkout unavailable</h2>
        <p>{fatal}</p>
        <a className="pay-btn as-link" href="/#games">
          Start a new order
        </a>
      </div>
    );

  const busy = phase === 'paying';
  const walletFirst = !!wallet && !showOther && phase !== 'loading';
  return (
    <form
      data-private-block=""
      className={`pay-card is-${phase}`}
      onSubmit={pay}
      aria-busy={phase === 'loading' || busy}
      noValidate
    >
      <div className="pay-head">
        <h2>Payment</h2>
        <span className="pay-secure">
          <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z"
            />
          </svg>
          Secured by Stripe
        </span>
      </div>

      <div className={`pay-express ${express}${wallet ? ' wallet' : ''}`}>
        <div ref={expressRef} />
      </div>
      {walletFirst && (
        <>
          <p className="pay-wallet-note">
            One tap with {wallet}. Charged only when a teammate accepts.
          </p>
          <button
            type="button"
            className="pay-other"
            aria-expanded={false}
            onClick={() => setShowOther(true)}
          >
            Pay another way
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
              <path
                d="M6 9l6 6 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </>
      )}
      {express !== 'none' && !walletFirst && (
        <div className="pay-or" aria-hidden="true">
          <span>or pay another way</span>
        </div>
      )}

      <div className={`pay-element${walletFirst ? ' folded' : ''}`}>
        {phase === 'loading' && (
          <div className="pay-skeleton" aria-hidden="true">
            <i />
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

      <button
        className={`pay-btn${walletFirst ? ' folded' : ''}`}
        type="submit"
        disabled={phase !== 'ready'}
      >
        <span className="pay-btn-label">
          {busy ? 'Confirming…' : `Pay ${total}`}
        </span>
        {busy && <span className="pay-spinner" aria-hidden="true" />}
      </button>
      {!walletFirst && (
        <p className="pay-fine">
          No teammate within 5 minutes? You pay nothing.
        </p>
      )}

      {phase === 'held' && (
        <div className="pay-held" role="status" aria-live="polite">
          <svg className="pay-check" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="28" />
            <path d="M20 33l8 8 16-17" />
          </svg>
          <strong>Payment confirmed</strong>
          <span>Putting you in the queue…</span>
          <span className="pay-held-bar" aria-hidden="true" />
        </div>
      )}
    </form>
  );
}

export default function CheckoutPanel(
  props: ComponentProps<typeof CheckoutPanelContent>,
) {
  return (
    <AnalyticsErrorBoundary source="checkout">
      <CheckoutPanelContent {...props} />
    </AnalyticsErrorBoundary>
  );
}
