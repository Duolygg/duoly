import { useEffect, useRef, useState } from 'react';
import {
  loadStripe,
  type StripeElements,
  type StripePaymentElement,
} from '@stripe/stripe-js';
import type { TipPayment } from '../../contracts/tips';

export default function TipPaymentPanel({
  payment,
  onPaid,
}: {
  payment: TipPayment;
  onPaid: () => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const elements = useRef<StripeElements | null>(null);
  const stripeRef = useRef<Awaited<ReturnType<typeof loadStripe>>>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let element: StripePaymentElement | null = null;
    void (async () => {
      const stripe = await loadStripe(payment.publishableKey);
      const target = mount.current;
      if (!stripe || cancelled || !target) return;
      const group = stripe.elements({
        clientSecret: payment.clientSecret,
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#D6BBFF',
            colorBackground: '#090414',
            colorText: '#FFFFFF',
            colorDanger: '#F0A6FF',
            borderRadius: '12px',
            fontFamily: 'Bricolage Grotesque, sans-serif',
          },
        },
      });
      element = group.create('payment', { layout: 'accordion' });
      element.on('ready', () => setReady(true));
      element.on('change', () => setError(''));
      element.mount(target);
      stripeRef.current = stripe;
      elements.current = group;
    })();
    return () => {
      cancelled = true;
      element?.destroy();
    };
  }, [payment]);

  const confirm = async () => {
    if (!stripeRef.current || !elements.current) return;
    setBusy(true);
    setError('');
    const result = await stripeRef.current.confirmPayment({
      elements: elements.current,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    if (result.error) {
      setBusy(false);
      setError(result.error.message || 'The tip could not be paid. Try again.');
      return;
    }
    if (result.paymentIntent?.status === 'succeeded') onPaid();
    else {
      setBusy(false);
      setError('The tip is still processing. Check this order again shortly.');
    }
  };

  // a dollar tip is shown as picked ($5) and charged in EUR (€4.58); whole amounts without .00
  const short = (sym: string, n: number) =>
    sym + n.toFixed(2).replace(/\.00$/, '');
  const charged = short('€', payment.amount);
  const picked = payment.shown ? short('$', payment.shown.amount) : charged;

  return (
    <div className="q-tip-payment" aria-label="Pay your tip">
      <p style={{ margin: '0 0 12px', color: '#A79DC4', fontSize: '13.5px' }}>
        Your rating is saved. Now pay your {picked} tip
        {payment.shown ? ` (${charged} in euros)` : ''}, and 100% of it goes to{' '}
        {payment.teammate}.
      </p>
      <div ref={mount} />
      {error ? (
        <p role="alert" style={{ color: '#F0A6FF' }}>
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="q-review-send"
        disabled={!ready || busy}
        onClick={confirm}
      >
        {busy ? 'Paying…' : `Pay ${picked} tip`}
      </button>
    </div>
  );
}
