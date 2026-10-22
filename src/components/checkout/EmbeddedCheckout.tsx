import { useEffect, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

/** Mounts Stripe's Embedded Checkout for a session created on our server. */
export default function EmbeddedCheckout({
  publishableKey,
  clientSecret,
}: {
  publishableKey: string;
  clientSecret: string;
}) {
  const node = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let checkout: { destroy: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const stripe = await loadStripe(publishableKey);
        if (!stripe || cancelled || !node.current) return;
        const instance = await stripe.createEmbeddedCheckoutPage({
          fetchClientSecret: async () => clientSecret,
        });
        if (cancelled) return instance.destroy();
        checkout = instance;
        instance.mount(node.current);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      checkout?.destroy();
    };
  }, [publishableKey, clientSecret]);
  return failed ? (
    <p role="alert" className="checkout-error">
      The payment form couldn’t load. Check your connection and reload the page.
    </p>
  ) : (
    <div ref={node} className="checkout-frame" aria-label="Payment" />
  );
}
