import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  ProofBindingSchema,
  ProofAuthorizationSchema,
  ProofListSchema,
  ProofReservationSchema,
  ProofResponseSchema,
  ProofUploadSchema,
  ProofUuidSchema,
} from '../../contracts/proofs';
import { proofRpcData } from './results';
import { accountContext } from '../auth/context';
import { verifyCsrf } from '../auth/security';
import { createProofBackend } from './backend';
import {
  ProofFailure,
  proofDigest,
  readProofBytes,
  validateProofBytes,
} from './storage';

function readRoute(image: boolean): APIRoute {
  return async (context) => {
    const account = accountContext(context.request, context.cookies);
    const fail = (status: number) =>
      account.json(
        {
          error:
            status === 404 ? 'Proof not found.' : 'Proof service unavailable.',
        },
        status,
      );
    try {
      if (context.request.method !== 'GET') {
        const response = fail(405);
        response.headers.set('Allow', 'GET');
        return response;
      }
      const orderId = ProofUuidSchema.safeParse(context.params.id);
      const proofId = ProofUuidSchema.safeParse(context.params.proofId);
      if (!orderId.success || (image && !proofId.success) || context.url.search)
        return fail(404);
      const identity = await account.identity();
      if (!identity || !account.client) return fail(404);
      if (!image) {
        const result = ProofListSchema.parse(
          proofRpcData(
            await account.client.rpc('list_order_proofs', {
              p_order_id: orderId.data,
            }),
          ),
        );
        if (result.proofs.some((proof) => proof.order_id !== orderId.data))
          return fail(404);
        return account.json(result);
      }
      if (!proofId.success) return fail(404);
      const result = ProofResponseSchema.parse(
        proofRpcData(
          await account.client.rpc('get_order_proof', {
            p_order_id: orderId.data,
            p_proof_id: proofId.data,
          }),
        ),
      );
      const proof = result.proof;
      if (proof.id !== proofId.data || proof.order_id !== orderId.data)
        return fail(404);
      const backend = createProofBackend();
      if (!backend) return fail(503);
      const binding = {
        id: proof.id,
        order_id: proof.order_id,
        assignment_id: proof.assignment_id,
      };
      const bytes = await backend.get(binding);
      if (!bytes || bytes.length !== proof.byte_size) return fail(503);
      try {
        validateProofBytes(bytes, proof.mime);
      } catch {
        return fail(503);
      }
      // The locked public DTO intentionally has no digest. Verify MIME/magic and
      // byte size; immutable storage prevents replacement. No locator is exposed.
      const headers = new Headers(account.headers);
      headers.set('Cache-Control', 'private, no-store');
      headers.set('Content-Type', proof.mime);
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Content-Length', String(bytes.length));
      return new Response(bytes, { headers });
    } catch (error) {
      return fail(
        error instanceof ProofFailure &&
          [400, 401, 403, 404, 409, 410].includes(error.status)
          ? 404
          : 503,
      );
    }
  };
}
export const list = readRoute(false);
export const image = readRoute(true);

/**
 * A teammate takes back one of their own screenshots on the open assignment (uploaded by
 * mistake). The database only hides it (teammate_remove_order_proof, 20261112153802): the file
 * stays for admins and disputes, so this never touches storage.
 */
export const remove: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  const fail = (status: number) =>
    account.json(
      {
        error:
          status === 503
            ? 'Proof service unavailable.'
            : 'Screenshot could not be removed.',
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
    if (identity.viewer.role !== 'teammate') return fail(403);
    const order = ProofUuidSchema.safeParse(context.params.id);
    const proof = ProofUuidSchema.safeParse(context.params.proofId);
    const assignment = ProofUuidSchema.safeParse(
      context.request.headers.get('x-assignment-id'),
    );
    if (
      !order.success ||
      !proof.success ||
      !assignment.success ||
      context.url.search
    )
      return fail(400);
    const result = z
      .strictObject({ removed: z.literal(true), proof_id: ProofUuidSchema })
      .parse(
        proofRpcData(
          await account.client.rpc('teammate_remove_order_proof', {
            p_order_id: order.data,
            p_assignment_id: assignment.data,
            p_proof_id: proof.data,
          }),
        ),
      );
    if (result.proof_id !== proof.data) return fail(503);
    return account.json(result);
  } catch (error) {
    return fail(error instanceof ProofFailure ? error.status : 503);
  }
};

export const upload: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  const fail = (status: number) =>
    account.json(
      {
        error:
          status === 503
            ? 'Proof service unavailable.'
            : 'Proof upload unavailable.',
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
    if (identity.viewer.role !== 'teammate') return fail(403);
    const input = ProofUploadSchema.safeParse({
      order_id: context.params.id,
      assignment_id: context.request.headers.get('x-assignment-id'),
      request_id: context.request.headers.get('x-idempotency-key'),
    });
    if (!input.success || context.url.search) return fail(400);
    const authorization = ProofAuthorizationSchema.parse(
      proofRpcData(
        await account.client.rpc('authorize_order_proof_upload', {
          p_order_id: input.data.order_id,
          p_assignment_id: input.data.assignment_id,
        }),
      ),
    );
    if (
      authorization.order_id !== input.data.order_id ||
      authorization.assignment_id !== input.data.assignment_id
    )
      throw new ProofFailure();
    const backend = createProofBackend();
    if (!backend) return fail(503);
    const bytes = await readProofBytes(context.request.body);
    const mime = validateProofBytes(
      bytes,
      context.request.headers.get('content-type'),
    );
    const reservation = ProofReservationSchema.parse(
      proofRpcData(
        await account.client.rpc('begin_order_proof_upload', {
          p_order_id: input.data.order_id,
          p_assignment_id: input.data.assignment_id,
          p_request_id: input.data.request_id,
        }),
      ),
    );
    if (
      reservation.order_id !== input.data.order_id ||
      reservation.assignment_id !== input.data.assignment_id
    )
      throw new ProofFailure();
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
        if ((await backend.get(binding)) !== null) throw new ProofFailure();
      } catch {
        /* Only trusted stale-claim cleanup may retry. Never delete without a successful abandon. */
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
      // A lost/duplicate ACK is not a failed write. A racing matching request may
      // already have finalized; neither overwrite nor abandon its ready object.
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
      validateProofBytes(stored, mime);
    }
    try {
      const result = ProofResponseSchema.parse(
        proofRpcData(
          await backend.rpc('finalize_order_proof_upload', {
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
        result.proof.assignment_id !== binding.assignment_id ||
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
    return fail(error instanceof ProofFailure ? error.status : 503);
  }
};
