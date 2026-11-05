import { track } from '../../client/analytics/track';
import { useEffect, useRef, useState } from 'react';

type State = 'waiting' | 'processing' | 'failed' | 'conflict' | 'expired';

/** Polls until the webhook has turned the payment into a queued order. */
export default function ReturnStatus({
  intentId,
  initial,
}: {
  intentId: string;
  initial: State;
}) {
  const [state, setState] = useState<State>(initial);
  const reported = useRef(false);
  useEffect(() => {
    if (reported.current || initial === 'waiting' || initial === 'processing')
      return;
    reported.current = true;
    track('checkout_returned', {
      outcome:
        initial === 'expired'
          ? 'cancelled'
          : initial === 'failed' || initial === 'conflict'
            ? 'failed'
            : 'processing',
    });
  }, [initial]);
  useEffect(() => {
    if (state !== 'waiting' && state !== 'processing') return;
    let stop = false;
    let delay = 700;
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
        if (!reported.current) {
          reported.current = true;
          track('checkout_returned', {
            outcome:
              data.status === 'paid'
                ? 'paid'
                : data.status === 'failed' || data.status === 'conflict'
                  ? 'failed'
                  : data.status === 'expired'
                    ? 'cancelled'
                    : data.status === 'processing'
                      ? 'processing'
                      : 'unknown',
          });
        }
        if (data.status === 'paid' && data.order_id) {
          window.location.replace(`/queue/${data.order_id}`);
          return;
        }
        if (data.status === 'failed') return setState('failed');
        if (data.status === 'conflict') return setState('conflict');
        if (data.status === 'expired') return setState('expired');
        if (data.status === 'processing') setState('processing');
      } catch {
        /* keep polling */
      }
      delay = Math.min(delay * 1.3, 5000);
      setTimeout(poll, delay);
    };
    void poll();
    return () => {
      stop = true;
    };
  }, [intentId, state]);
  const copy: Record<State, [string, string]> = {
    waiting: [
      'Payment received',
      'Putting you in the queue. This takes a second…',
    ],
    processing: [
      'Waiting for your bank',
      'Your payment method confirms in the background. We’ll queue your order the moment it does and email you.',
    ],
    failed: [
      'Payment didn’t go through',
      'Nothing was charged. Go back and try another payment method.',
    ],
    conflict: [
      'You already have an open order',
      'We released this payment automatically. Finish or cancel your open order first.',
    ],
    expired: [
      'Checkout expired',
      'Nothing was charged. Start again from the homepage.',
    ],
  };
  const [title, text] = copy[state];
  const busy = state === 'waiting' || state === 'processing';
  return (
    <section className="return-card" role="status" aria-live="polite">
      {busy && <span className="return-spinner" aria-hidden="true" />}
      <h1>{title}</h1>
      <p>{text}</p>
      {!busy && (
        <a
          className="return-link"
          href={state === 'conflict' ? '/dashboard' : '/#games'}
        >
          {state === 'conflict' ? 'Open my order' : 'Back to booking'}
        </a>
      )}
    </section>
  );
}
