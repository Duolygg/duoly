import {
  CompletionInputSchema,
  CompletionResponseSchema,
  type Completion,
  type CompletionInput,
} from '../../contracts/completion';
import { ProofListSchema, ProofUuidSchema } from '../../contracts/proofs';
import type { ProofState } from '../proofs/proof-session';
import { EarningsResponseSchema } from '../../contracts/completion';
import type { DeskFetch, ReadState } from './OrderDesk';
export function completionProofIds(
  state: ProofState,
  order: string,
  assignment: string,
): string[] | null {
  if (
    state.kind !== 'ready' ||
    state.stale ||
    state.pending ||
    state.error ||
    state.choice
  )
    return null;
  const o = ProofUuidSchema.safeParse(order),
    a = ProofUuidSchema.safeParse(assignment),
    proofs = ProofListSchema.safeParse({ proofs: state.proofs });
  if (!o.success || !a.success || !proofs.success) return null;
  const list = proofs.data.proofs;
  if (
    list.length < 1 ||
    list.length > 5 ||
    list.some((p) => p.order_id !== o.data || p.assignment_id !== a.data) ||
    new Set(list.map((p) => p.id)).size !== list.length
  )
    return null;
  return list.map((p) => p.id);
}
export async function readEarnings(
  fetcher: DeskFetch,
): Promise<ReadState<Completion[]>> {
  try {
    const response = await fetcher('/api/teammate/earnings', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (response.status === 401) return { kind: 'signed-out' };
    if (response.status === 403 || response.status === 404)
      return { kind: 'denied' };
    if (!response.ok) return { kind: 'unavailable' };
    const { earnings } = EarningsResponseSchema.parse(await response.json());
    if (new Set(earnings.map((e) => e.order_id)).size !== earnings.length)
      return { kind: 'unavailable' };
    return { kind: 'ready', value: earnings };
  } catch {
    return { kind: 'unavailable' };
  }
}
export function matchesCompletion(entry: Completion, input: CompletionInput) {
  return (
    entry.order_id === input.order_id &&
    entry.assignment_id === input.assignment_id &&
    entry.request_id === input.request_id &&
    entry.proof_ids.length === input.proof_ids.length &&
    input.proof_ids.every((id) => entry.proof_ids.includes(id))
  );
}
export type CompletionResult =
  | { kind: 'completed'; completion: Completion }
  | { kind: 'bad' | 'denied' | 'signed-out' | 'conflict' | 'uncertain' };
export async function completeOrder(
  fetcher: DeskFetch,
  command: CompletionInput,
  csrf: string,
): Promise<CompletionResult> {
  const parsed = CompletionInputSchema.safeParse(command);
  if (!parsed.success || !csrf.trim()) return { kind: 'bad' };
  const input = parsed.data;
  try {
    const response = await fetcher(
      `/api/teammate/orders/${input.order_id}/complete`,
      {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csrf,
          assignment_id: input.assignment_id,
          request_id: input.request_id,
          proof_ids: input.proof_ids,
        }),
      },
    );
    if (response.status === 400) return { kind: 'bad' };
    if (response.status === 401) return { kind: 'signed-out' };
    if (response.status === 403 || response.status === 404)
      return { kind: 'denied' };
    if (response.status === 409) return { kind: 'conflict' };
    if (!response.ok) return { kind: 'uncertain' };
    const { completion } = CompletionResponseSchema.parse(
      await response.json(),
    );
    if (!matchesCompletion(completion, input)) return { kind: 'uncertain' };
    return { kind: 'completed', completion };
  } catch {
    return { kind: 'uncertain' };
  }
}
