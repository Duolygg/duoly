import { z } from 'zod';
import { ProofBindingSchema } from '../../contracts/proofs';
import { createProofBackend } from './backend';
import { proofRpcData } from './results';
import { ProofFailure } from './storage';

/** Trusted scheduler/maintenance entry only: deliberately has no public route.
 * The service-only claim RPC atomically abandons stale pending rows and never
 * returns ready rows. Failed deletions remain abandoned and retryable.
 */
export async function cleanupStaleProofUploads(
  limit = 100,
): Promise<{ claimed: number; deleted: number; failed: number }> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new ProofFailure(400);
  const backend = createProofBackend();
  if (!backend) throw new ProofFailure();
  const result = z
    .strictObject({ proofs: z.array(ProofBindingSchema).max(limit) })
    .parse(
      proofRpcData(
        await backend.rpc('claim_stale_order_proof_uploads', {
          p_limit: limit,
        }),
      ),
    );
  let deleted = 0;
  for (const binding of result.proofs) {
    try {
      await backend.remove(binding);
      if ((await backend.get(binding)) !== null) throw new ProofFailure();
      deleted++;
    } catch {
      /* Return counts only, never locators or infrastructure diagnostics. */
    }
  }
  return {
    claimed: result.proofs.length,
    deleted,
    failed: result.proofs.length - deleted,
  };
}
