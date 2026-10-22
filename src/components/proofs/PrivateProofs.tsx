import { useEffect, useId, useRef, useState } from 'react';
import { proofUrl } from './proof-client';
import {
  initialProofState,
  ProofSession,
  type ProofState,
} from './proof-session';
import './proofs.css';

type ProofProps = {
  orderId: string;
  assignmentId?: string;
  mode: 'customer' | 'teammate';
  csrf?: string;
  disabled?: boolean;
};
export function ProofView({
  orderId,
  assignmentId,
  mode,
  csrf,
  state,
  disabled = false,
  onRefresh,
  onSelect,
  onUpload,
}: ProofProps & {
  state: ProofState;
  onRefresh?: () => void;
  onSelect?: (files: File[]) => void;
  onUpload?: () => void;
}) {
  const inputId = useId();
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state.error]);
  const blocked = disabled || state.pending;
  const currentCount =
    state.proofs?.filter((p) => p.assignment_id === assignmentId).length ?? 0;
  const mayUpload = mode === 'teammate' && !!assignmentId;
  return (
    <section
      className="private-proofs"
      aria-label="Private evidence"
      aria-busy={state.pending}
    >
      <div className="proof-heading">
        <h3>Private evidence</h3>
        <button type="button" disabled={blocked} onClick={onRefresh}>
          Refresh evidence
        </button>
      </div>
      <p>Evidence only. Order completion is not available yet.</p>
      {state.kind === 'loading' && (
        <p role="status">Loading private evidence…</p>
      )}
      {state.error && (
        <p className="proof-error" role="alert" tabIndex={-1} ref={errorRef}>
          {state.error}{' '}
          {state.kind === 'signed-out' && <a href="/login">Sign in</a>}
        </p>
      )}
      {state.stale && (
        <p className="proof-error">
          Displayed evidence may be stale. Refresh before uploading.
        </p>
      )}
      <p role="status" aria-live="polite">
        {state.pending ? 'Checking private evidence…' : state.message}
      </p>
      {state.kind === 'ready' && state.proofs?.length === 0 && (
        <p>No evidence uploaded.</p>
      )}
      {state.proofs && (
        <ul className="proof-images">
          {state.proofs.map((proof, index) => {
            const url = proofUrl(
              orderId,
              proof,
              mode === 'teammate' ? assignmentId : undefined,
            );
            return (
              <li key={proof.id}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open evidence image ${index + 1}`}
                >
                  <img
                    src={url}
                    alt={`Evidence image ${index + 1}`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                  />
                  <span>Open evidence image {index + 1}</span>
                </a>
                <p>
                  <time dateTime={proof.created_at}>
                    {proof.created_at.replace('T', ' ')}
                  </time>
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {mayUpload && (
        <div className="proof-upload">
          {state.proofs !== null && (
            <p>{currentCount} / 5 images for your current assignment.</p>
          )}
          <label htmlFor={inputId}>Choose one evidence image</label>
          <input
            id={inputId}
            type="file"
            accept="image/webp,image/jpeg,image/png"
            aria-describedby={`${inputId}-help`}
            disabled={
              blocked ||
              state.kind !== 'ready' ||
              state.stale ||
              currentCount >= 5
            }
            onChange={(event) =>
              onSelect?.(Array.from(event.currentTarget.files ?? []))
            }
          />
          <p id={`${inputId}-help`}>
            PNG, JPEG or WebP; 1–1,572,864 bytes each. Up to five images per
            assignment. Browser checks are a convenience; the server validates
            every upload.
          </p>
          {state.choice && <p>One image selected for upload.</p>}
          <button
            type="button"
            disabled={
              blocked ||
              !csrf ||
              state.kind !== 'ready' ||
              state.stale ||
              !state.choice
            }
            onClick={onUpload}
          >
            {state.message.includes('not confirmed')
              ? 'Retry selected upload'
              : 'Upload selected image'}
          </button>
        </div>
      )}
    </section>
  );
}
function ProofScope(props: ProofProps) {
  const [state, setState] = useState<ProofState>(initialProofState);
  const session = useRef<ProofSession | null>(null);
  useEffect(() => {
    const current = new ProofSession(
      props.orderId,
      props.mode === 'teammate' ? props.assignmentId : undefined,
      props.csrf ?? '',
      fetch,
      setState,
    );
    session.current = current;
    void current.refresh();
    return () => {
      current.dispose();
      session.current = null;
    };
  }, [props.orderId, props.assignmentId, props.mode, props.csrf]);
  return (
    <ProofView
      {...props}
      state={state}
      onRefresh={() => void session.current?.refresh()}
      onSelect={(files) => session.current?.select(files)}
      onUpload={() => void session.current?.upload()}
    />
  );
}
export default function PrivateProofs(props: ProofProps) {
  // Reset synchronously, before effects, so assignment changes never paint old evidence.
  return (
    <ProofScope
      key={`${props.mode}:${props.orderId}:${props.assignmentId ?? 'none'}:${props.csrf ?? ''}`}
      {...props}
    />
  );
}
