// The proof list and upload UI, without the stylesheet so it can render outside a bundler
// (homepage preview, Playwright). proofs.css is loaded by PrivateProofs and by pages that use this alone.
import { useEffect, useId, useRef, useState } from 'react';
import { proofUrl } from './proof-client';
import type { ProofState } from './proof-session';
import type { Completion } from '../../contracts/completion';
import type { Proof } from '../../contracts/proofs';

export type ProofProps = {
  orderId: string;
  assignmentId?: string;
  mode: 'customer' | 'teammate';
  csrf?: string;
  disabled?: boolean;
  /** Why the order can't be finished yet (e.g. the match report isn't saved); disables Mark as done. */
  completionBlocker?: string;
  onCompleted?: (entry: Completion) => void | Promise<void>;
  onCompletionBusyChange?: (busy: boolean) => void;
};

const MAX = 5;

/** "2026-10-23T10:00:00Z" -> "23 Oct, 10:00" in the viewer's time zone (raw text if unparsable). */
function shortTime(iso: string) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso.replace('T', ' ');
  return at.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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
  onRemove,
  imageSrc,
}: ProofProps & {
  state: ProofState;
  /** where each image loads from; defaults to the proof API (the homepage preview passes demo images) */
  imageSrc?: (proof: Proof) => string;
  onRefresh?: () => void;
  onSelect?: (files: File[]) => void;
  onUpload?: () => void;
  /** teammates: take back one of this assignment's screenshots */
  onRemove?: (proofId: string) => void;
}) {
  const inputId = useId();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [dragging, setDragging] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state.error]);
  const blocked = disabled || state.pending;
  const currentCount =
    state.proofs?.filter((p) => p.assignment_id === assignmentId).length ?? 0;
  const mayUpload = mode === 'teammate' && !!assignmentId;
  const pickDisabled =
    blocked || state.kind !== 'ready' || state.stale || currentCount >= MAX;
  const status = state.pending ? 'Checking private evidence…' : state.message;
  return (
    <section
      data-private-block=""
      className="private-proofs"
      aria-label="Private evidence"
      aria-busy={state.pending}
    >
      <div className="proof-heading">
        <div>
          <h3>Private evidence</h3>
          <p className="proof-sub">
            Private screenshots are visible only to authorized participants.
          </p>
        </div>
        <button
          type="button"
          className="proof-ghost"
          disabled={blocked}
          onClick={onRefresh}
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
          Refresh evidence
        </button>
      </div>
      {state.kind === 'loading' && (
        <p className="proof-status" role="status">
          Loading private evidence…
        </p>
      )}
      {state.error && (
        <p className="proof-error" role="alert" tabIndex={-1} ref={errorRef}>
          {state.error}{' '}
          {state.kind === 'signed-out' && <a href="/?signin=1">Sign in</a>}
        </p>
      )}
      {state.stale && (
        <p className="proof-error">
          Displayed evidence may be stale. Refresh before uploading.
        </p>
      )}
      <p
        className={status ? 'proof-status' : 'proof-status proof-status-empty'}
        role="status"
        aria-live="polite"
      >
        {status}
      </p>
      {state.kind === 'ready' && state.proofs?.length === 0 && !mayUpload && (
        <p className="proof-empty">No evidence uploaded.</p>
      )}
      {state.proofs && state.proofs.length > 0 && (
        <ul className="proof-images">
          {state.proofs.map((proof, index) => {
            const url = imageSrc
              ? imageSrc(proof)
              : proofUrl(
                  orderId,
                  proof,
                  mode === 'teammate' ? assignmentId : undefined,
                );
            return (
              <li
                key={proof.id}
                className={asking === proof.id ? 'is-asking' : undefined}
              >
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
                  <span className="proof-badge" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="proof-sr">
                    Open evidence image {index + 1}
                  </span>
                </a>
                <div className="proof-meta">
                  <time dateTime={proof.created_at}>
                    {shortTime(proof.created_at)}
                  </time>
                  {mayUpload &&
                    onRemove &&
                    proof.assignment_id === assignmentId &&
                    (asking === proof.id ? (
                      <span className="proof-ask">
                        <button
                          type="button"
                          className="proof-remove is-confirm"
                          disabled={blocked || !csrf}
                          onClick={() => {
                            setAsking(null);
                            onRemove(proof.id);
                          }}
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          className="proof-remove"
                          onClick={() => setAsking(null)}
                        >
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="proof-remove"
                        aria-label={`Remove evidence image ${index + 1}`}
                        disabled={blocked || !csrf || state.kind !== 'ready'}
                        onClick={() => setAsking(proof.id)}
                      >
                        Remove
                      </button>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {mayUpload && (
        <div className="proof-upload">
          <input
            id={inputId}
            className="proof-file"
            type="file"
            accept="image/webp,image/jpeg,image/png"
            aria-label="Choose one evidence image"
            aria-describedby={`${inputId}-help`}
            disabled={pickDisabled}
            onChange={(event) =>
              onSelect?.(Array.from(event.currentTarget.files ?? []))
            }
          />
          <label
            htmlFor={inputId}
            className={
              'proof-drop' +
              (dragging ? ' is-dragging' : '') +
              (state.choice ? ' has-choice' : '')
            }
            onDragOver={(event) => {
              if (pickDisabled) return;
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              setDragging(false);
              if (pickDisabled) return;
              event.preventDefault();
              onSelect?.(Array.from(event.dataTransfer.files ?? []));
            }}
          >
            <span className="proof-drop-icon" aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {state.choice ? (
                  <path d="M20 6 9 17l-5-5" />
                ) : (
                  <>
                    <path d="M12 16V4" />
                    <path d="m6 10 6-6 6 6" />
                    <path d="M4 20h16" />
                  </>
                )}
              </svg>
            </span>
            <span className="proof-drop-text">
              <strong>
                {state.choice
                  ? state.choice.file.name
                  : currentCount >= MAX
                    ? 'All five screenshots added'
                    : 'Choose a screenshot or drop it here'}
              </strong>
              <span id={`${inputId}-help`}>
                PNG, JPEG or WebP, up to 1.5 MB.
                {state.proofs !== null &&
                  ` ${currentCount} / ${MAX} images for your current assignment.`}
              </span>
            </span>
          </label>
          <button
            type="button"
            className="proof-primary"
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
