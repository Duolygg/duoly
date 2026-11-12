import { z } from 'zod';
import { OrderRpcErrorSchema } from '../../contracts/orders';
import { ProofFailure } from './storage';

export function proofRpcData(result: {
  data: unknown;
  error: unknown;
}): unknown {
  if (result.error !== null && result.error !== undefined) {
    const error = z.object({ code: z.string() }).safeParse(result.error);
    const status =
      error.success && /^PT(400|401|403|404|409|410)$/.test(error.data.code)
        ? Number(error.data.code.slice(2))
        : 503;
    throw new ProofFailure(status);
  }
  const business = OrderRpcErrorSchema.safeParse(result.data);
  if (business.success)
    throw new ProofFailure(
      business.data.error.code,
      business.data.error.message,
    );
  return result.data;
}
