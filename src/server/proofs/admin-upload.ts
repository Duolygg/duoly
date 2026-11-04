import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  ProofBindingSchema,
  ProofReservationSchema,
  ProofResponseSchema,
  ProofUuidSchema,
} from '../../contracts/proofs';
import { proofRpcData } from './results';
import { accountContext } from '../auth/context';
import { verifyCsrf } from '../auth/security';
import { adminAccess, canUse } from '../admin/access';
import { createProofBackend } from './backend';
import {
  ProofFailure,
  proofDigest,
  readProofBytes,
  validateProofBytes,
} from './storage';

/**
 * POST /api/admin/proofs/[orderId]/upload: an admin adds a correct screenshot to a played order
 * (migration 20261105140000_admin_correct_results.sql). The same checks as the teammate upload
 * (src/server/proofs/handlers.ts): CSRF, image type and bytes, size, digest, private storage, and
 * the abandon-then-delete compensation when finishing fails.
 */
export const adminUpload: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  const fail = (status: number, message?: string) =>
    account.json(
      {
        error:
          message ??
          (status === 503
            ? 'Proof service unavailable.'
            : 'Screenshot upload unavailable.'),
      },
      status,
    );
  try {
    if (context.request.method !== 'POST') {
      const response = fail(405);
      response.headers.set('Allow', 'POST');
      return response;
    }
    const origin =
      account.config?.origin ?? new URL(context.request.url).origin;
    if (
      !verifyCsrf(
        context.request,
        origin,
        context.cookies.get(account.names.csrf)?.value,
        context.request.headers.get('x-csrf-token'),
      )
    )
      return fail(403);
    const identity = await account.identity();
    if (!identity || !account.client) return fail(401);
    if (identity.viewer.role !== 'admin') return fail(404);
    if (!canUse(await adminAccess(account.client), ['teammates', 'orders']))
      return fail(403);
    const input = z
      .strictObject({ order_id: ProofUuidSchema, request_id: ProofUuidSchema })
      .safeParse({
        order_id: context.params.orderId,
        request_id: context.request.headers.get('x-idempotency-key'),
      });
    if (!input.success || context.url.search) return fail(400);
    const backend = createProofBackend();
    if (!backend) return fail(503);
    const bytes = await readProofBytes(context.request.body);
    const mime = validateProofBytes(
      bytes,
      context.request.headers.get('content-type'),
    );
    const reservation = ProofReservationSchema.parse(
      proofRpcData(
        await (
          account.client.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>,
          ) => PromiseLike<{ data: unknown; error: unknown }>
        ).call(account.client, 'admin_begin_order_proof_upload', {
          p_order_id: input.data.order_id,
          p_request_id: input.data.request_id,
        }),
      ),
    );
    if (reservation.order_id !== input.data.order_id) throw new ProofFailure();
    const binding = ProofBindingSchema.parse({
      id: reservation.id,
      order_id: reservation.order_id,
      assignment_id: reservation.assignment_id,
    });
    const compensate = async () => {
      try {
        const abandoned = z.strictObject({ abandoned: z.boolean() }).parse(
          proofRpcData(
            await backend.rpc('abandon_order_proof_upload', {
              p_proof_id: binding.id,
            }),
          ),
        );
        if (!abandoned.abandoned) return;
        await backend.remove(binding);
      } catch {
        /* the stale-upload cleanup retries; never delete without a successful abandon */
      }
    };
    const digest = proofDigest(bytes);
    let compare = reservation.state === 'ready';
    if (!compare) {
      try {
        await backend.put(binding, bytes, mime);
      } catch {
        compare = true;
      }
    }
    if (compare) {
      const stored = await backend.get(binding);
      if (!stored) {
        if (reservation.state !== 'ready') await compensate();
        throw new ProofFailure();
      }
      if (
        stored.length !== bytes.length ||
        proofDigest(stored) !== digest ||
        !Buffer.from(stored).equals(Buffer.from(bytes))
      )
        throw new ProofFailure(409);
    }
    try {
      const result = ProofResponseSchema.parse(
        proofRpcData(
          await backend.rpc('admin_finalize_order_proof_upload', {
            p_proof_id: binding.id,
            p_mime: mime,
            p_byte_size: bytes.length,
            p_sha256: digest,
          }),
        ),
      );
      if (
        result.proof.id !== binding.id ||
        result.proof.order_id !== binding.order_id ||
        result.proof.mime !== mime ||
        result.proof.byte_size !== bytes.length
      )
        throw new ProofFailure();
      return account.json(result);
    } catch (error) {
      await compensate();
      throw error;
    }
  } catch (error) {
    if (error instanceof ProofFailure && error.status === 409)
      return fail(
        409,
        'Five screenshots already, or this order wasn’t played. Remove one first.',
      );
    return fail(error instanceof ProofFailure ? error.status : 503);
  }
};
