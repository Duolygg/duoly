import { useEffect, useRef, useState } from 'react';
import {
  initialProofState,
  ProofSession,
  type ProofState,
} from './proof-session';
import { CompletionControls } from '../teammate/completion-ui';
import { ProofView, type ProofProps } from './proof-view';
import './proofs.css';

export { ProofView };

function ProofScope(props: ProofProps) {
  const [state, setState] = useState<ProofState>(initialProofState);
  const [completionLocked, setCompletionLocked] = useState(false);
  const completionLock = useRef(false);
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
    <>
      <ProofView
        {...props}
        disabled={props.disabled || completionLocked}
        state={state}
        onRefresh={() => {
          if (!completionLock.current) void session.current?.refresh();
        }}
        onSelect={(files) => {
          if (!completionLock.current) session.current?.select(files);
        }}
        onUpload={() => {
          if (!completionLock.current) void session.current?.upload();
        }}
        onRemove={(proofId) => {
          if (!completionLock.current) void session.current?.remove(proofId);
        }}
      />
      {props.mode === 'teammate' && props.assignmentId && props.onCompleted && (
        <CompletionControls
          orderId={props.orderId}
          assignmentId={props.assignmentId}
          csrf={props.csrf ?? ''}
          state={state}
          disabled={props.disabled}
          blocker={props.completionBlocker}
          onCompleted={props.onCompleted}
          onBusyChange={(locked) => {
            completionLock.current = locked;
            setCompletionLocked(locked);
            props.onCompletionBusyChange?.(locked);
          }}
        />
      )}
    </>
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
