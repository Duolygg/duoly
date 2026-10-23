import { useEffect, useRef, useState } from 'react';
import {
  CompletionInputSchema,
  type Completion,
  type CompletionInput,
} from '../../contracts/completion';
import type { ProofState } from '../proofs/proof-session';
import type { ReadState } from './OrderDesk';
import {
  completeOrder,
  completionProofIds,
  matchesCompletion,
  readEarnings,
} from './completion-client';

export function CompletionReceipt({ entry }: { entry: Completion }) {
  const usd = (cents: number) => `$${(cents / 100).toFixed(2)} USD`;
  return (
    <article className="td-card td-completion-receipt">
      <h3>Permanent earning recorded</h3>
      <p className="td-muted">Order ID: {entry.order_id}</p>
      <p>
        <time dateTime={entry.completed_at}>
          {entry.completed_at.replace('T', ' ')}
        </time>
      </p>
      <dl>
        <div>
          <dt>Gross USD</dt>
          <dd>{usd(entry.payout_usd_cents)}</dd>
        </div>
        <div>
          <dt>Held deposit ({entry.deposit_percent}%)</dt>
          <dd>{usd(entry.held_usd_cents)}</dd>
        </div>
        <div>
          <dt>Net USD recorded</dt>
          <dd className="td-payout">{usd(entry.net_usd_cents)}</dd>
        </div>
        <div>
          <dt>Trust tier at completion</dt>
          <dd>{entry.trust_tier}</dd>
        </div>
      </dl>
      <p className="td-muted">
        Withdrawals and deposit releases are not available yet.
      </p>
    </article>
  );
}
export function RecentEarnings({ state }: { state: ReadState<Completion[]> }) {
  return (
    <section className="td-panel td-earnings" aria-labelledby="td-earnings">
      <h2 id="td-earnings">Recent permanent earnings</h2>
      {state.kind === 'ready' ? (
        state.value.length ? (
          <div className="td-orders">
            {state.value.map((entry) => (
              <CompletionReceipt key={entry.order_id} entry={entry} />
            ))}
          </div>
        ) : (
          <p role="status">No permanent earnings recorded.</p>
        )
      ) : (
        <p role={state.kind === 'loading' ? 'status' : 'alert'}>
          {state.kind === 'loading'
            ? 'Reading permanent earnings...'
            : state.kind === 'signed-out'
              ? 'Sign in again to read permanent earnings.'
              : state.kind === 'denied'
                ? 'Permanent earnings access denied. Refresh to check access.'
                : 'Permanent earnings unavailable. Refresh the desk to read again. No balance has been confirmed.'}
        </p>
      )}
    </section>
  );
}
export function CompletionControls({
  orderId,
  assignmentId,
  csrf,
  state,
  disabled,
  onCompleted,
  onBusyChange,
}: {
  orderId: string;
  assignmentId: string;
  csrf: string;
  state: ProofState;
  disabled?: boolean;
  onCompleted: (entry: Completion) => void | Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const [command, setCommand] = useState<CompletionInput | null>(null);
  const [phase, setPhase] = useState<
    'idle' | 'confirm' | 'sending' | 'uncertain' | 'terminal' | 'done'
  >('idle');
  const [message, setMessage] = useState('');
  const live = useRef(true),
    inFlight = useRef(false),
    frozen = useRef<CompletionInput | null>(null);
  const callbacks = useRef({ onCompleted, onBusyChange });
  callbacks.current = { onCompleted, onBusyChange };
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      callbacks.current.onBusyChange(false);
    };
  }, []);
  const ids = completionProofIds(state, orderId, assignmentId);
  const allowed = !!ids && !!csrf.trim() && !disabled;
  function prepare() {
    if (!allowed || inFlight.current || frozen.current) return;
    const parsed = CompletionInputSchema.safeParse({
      order_id: orderId,
      assignment_id: assignmentId,
      request_id: crypto.randomUUID(),
      proof_ids: ids,
    });
    if (!parsed.success) return;
    frozen.current = parsed.data;
    setCommand(parsed.data);
    setPhase('confirm');
    onBusyChange(true);
  }
  async function finish(entry: Completion) {
    if (!live.current) return;
    setPhase('done');
    setMessage(
      'Completion recorded. Reading your current assignment and permanent earnings...',
    );
    await callbacks.current.onCompleted(entry);
    if (live.current) callbacks.current.onBusyChange(false);
  }
  async function send() {
    if (
      inFlight.current ||
      !frozen.current ||
      !csrf.trim() ||
      !['confirm', 'uncertain'].includes(phase)
    )
      return;
    inFlight.current = true;
    setPhase('sending');
    setMessage('Recording completion...');
    callbacks.current.onBusyChange(true);
    const result = await completeOrder(fetch, frozen.current, csrf);
    if (!live.current) return;
    if (result.kind === 'completed') await finish(result.completion);
    else if (result.kind === 'uncertain') {
      setPhase('uncertain');
      setMessage(
        'Completion is unconfirmed. It may have reached the server. Read back permanent earnings or explicitly retry the same request. No automatic retry will be made.',
      );
    } else {
      setPhase('terminal');
      setMessage(
        result.kind === 'signed-out'
          ? 'Your session ended. Sign in again.'
          : result.kind === 'denied'
            ? 'Completion access denied. Refresh the desk to check your assignment.'
            : result.kind === 'conflict'
              ? 'Completion conflicts with the current assignment or proof. Refresh the desk before taking further action.'
              : 'Completion input was rejected. Refresh the desk before taking further action.',
      );
      callbacks.current.onBusyChange(false);
    }
    inFlight.current = false;
  }
  async function readback() {
    if (inFlight.current || !frozen.current) return;
    inFlight.current = true;
    setPhase('sending');
    setMessage('Reading permanent earnings...');
    const result = await readEarnings(fetch);
    if (!live.current) return;
    const entry =
      result.kind === 'ready'
        ? result.value.find((entry) =>
            matchesCompletion(entry, frozen.current!),
          )
        : undefined;
    if (entry) await finish(entry);
    else {
      setPhase('uncertain');
      setMessage(
        result.kind === 'ready'
          ? 'Completion is unconfirmed. No matching record was returned in recent earnings. This does not prove the request failed. Retry only the same completion.'
          : 'Completion is unconfirmed. Permanent earnings could not be read. Retry only the same completion or sign in again.',
      );
    }
    inFlight.current = false;
  }
  return (
    <div className="td-completion" aria-busy={phase === 'sending'}>
      <h3>Mark as done</h3>
      <p>
        Finish this assignment using 1 to 5 uploaded screenshots, like your
        match history. The server records your permanent earning and held
        deposit together.
      </p>
      {phase === 'idle' && (
        <>
          <p className="td-muted">
            Upload your evidence first. Only fresh evidence for this assignment
            can be used.
          </p>
          <button
            className="td-accept"
            type="button"
            disabled={!allowed}
            onClick={prepare}
          >
            Mark as done
          </button>
        </>
      )}
      {phase === 'confirm' && (
        <div className="td-notice">
          <h3>Confirm order completion</h3>
          <p>
            Complete this assignment with {command?.proof_ids.length} evidence
            image{command?.proof_ids.length === 1 ? '' : 's'}? This records a
            permanent earning. The server determines the deposit and net amount.
          </p>
          <div className="td-completion-actions">
            <button
              className="td-accept"
              type="button"
              onClick={() => void send()}
            >
              Confirm completion
            </button>
            <button
              type="button"
              onClick={() => {
                frozen.current = null;
                setCommand(null);
                setPhase('idle');
                onBusyChange(false);
              }}
            >
              Keep playing
            </button>
          </div>
        </div>
      )}
      {message && (
        <p
          role={
            phase === 'uncertain' || phase === 'terminal' ? 'alert' : 'status'
          }
          aria-live="polite"
        >
          {message}
        </p>
      )}
      {phase === 'uncertain' && (
        <div className="td-completion-actions">
          <button
            type="button"
            disabled={!csrf.trim() || !!disabled}
            onClick={() => void send()}
          >
            Retry same completion
          </button>
          <button type="button" onClick={() => void readback()}>
            Read back completion
          </button>
        </div>
      )}
      <p className="td-muted">
        Withdrawals and deposit releases are not available yet.
      </p>
    </div>
  );
}
