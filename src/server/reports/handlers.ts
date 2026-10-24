import type { APIRoute } from 'astro';
import {
  CreateReportSchema,
  DecideReportSchema,
} from '../../contracts/reports';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import { verifyCsrf } from '../auth/security';
import {
  proofDigest,
  ProofFailure,
  validateProofBytes,
} from '../proofs/storage';
import { createReportBackend, type ReportObject } from './backend';

const CUSTOMER_MESSAGES = new Set([
  'You can report a teammate while the order is in progress or after it is completed.',
  'You already reported this. Our team is on it.',
  'This order has no teammate to report.',
]);
function refusal(data: unknown) {
  if (!data || typeof data !== 'object' || !('error' in data)) return null;
  const value = (data as { error?: { code?: unknown; message?: unknown } })
    .error;
  if (!value) return null;
  const status = Number(value.code);
  return {
    status: status >= 400 && status < 600 ? status : 400,
    message: typeof value.message === 'string' ? value.message : '',
  };
}

export const createReport: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  const fail = (message: string, status: number) =>
    account.json({ error: message }, status);
  const uploaded: ReportObject[] = [];
  let backend: ReturnType<typeof createReportBackend> = null;
  try {
    if (context.request.method !== 'POST') {
      const response = fail('Method not allowed.', 405);
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
      return fail('Report upload unavailable.', 403);
    const identity = await account.identity();
    if (!identity || !account.client)
      return fail('Authentication required.', 401);
    if (identity.viewer.role !== 'customer')
      return fail('Order access denied.', 403);
    if (context.url.search) return fail('Invalid report request.', 400);
    const length = Number(context.request.headers.get('content-length') || 0);
    if (length > 8 * 1024 * 1024)
      return fail('Report evidence is too large.', 413);
    const form = await context.request.formData();
    const files = form.getAll('evidence');
    const reportId = crypto.randomUUID();
    const parsedBase = CreateReportSchema.omit({ evidence: true }).safeParse({
      order_id: context.params.id,
      type: form.get('type'),
      description: form.get('description'),
    });
    if (
      !parsedBase.success ||
      files.length < 1 ||
      files.length > 5 ||
      files.some((file) => !(file instanceof File))
    )
      return fail('Invalid report request.', 400);
    backend = createReportBackend();
    if (!backend) return fail('Report service unavailable.', 503);
    const evidence = [];
    for (const entry of files) {
      const file = entry as File;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = validateProofBytes(bytes, file.type);
      const evidenceId = crypto.randomUUID();
      const object = {
        orderId: parsedBase.data.order_id,
        reportId,
        evidenceId,
      };
      await backend.put(object, bytes, mime);
      uploaded.push(object);
      evidence.push({
        id: evidenceId,
        mime,
        byte_size: bytes.length,
        sha256: proofDigest(bytes),
      });
    }
    const input = CreateReportSchema.parse({ ...parsedBase.data, evidence });
    const { data, error } = await account.client.rpc('order_report_create', {
      p_report_id: reportId,
      p_order_id: input.order_id,
      p_type: input.type,
      p_description: input.description,
      p_evidence: input.evidence,
    });
    if (error) throw new ProofFailure();
    const denied = refusal(data);
    if (denied) {
      await Promise.allSettled(
        uploaded.map((object) => backend?.remove(object)),
      );
      return fail(
        CUSTOMER_MESSAGES.has(denied.message)
          ? denied.message
          : 'Couldn’t send your report. Try again.',
        denied.status,
      );
    }
    if (!data || typeof data !== 'object' || !('report' in data))
      throw new ProofFailure();
    return account.json(data, 201);
  } catch (error) {
    if (backend && uploaded.length)
      await Promise.allSettled(
        uploaded.map((object) => backend?.remove(object)),
      );
    return fail(
      error instanceof ProofFailure && error.status === 400
        ? 'Invalid report evidence.'
        : 'Report service unavailable.',
      error instanceof ProofFailure ? error.status : 503,
    );
  }
};

export const adminReports: APIRoute = async (context) => {
  let account = accountContext(context.request, context.cookies);
  try {
    if (context.request.method !== 'GET' && context.request.method !== 'POST') {
      const response = account.json({ error: 'Method not allowed.' }, 405);
      response.headers.set('Allow', 'GET, POST');
      return response;
    }
    let body: Record<string, unknown> | null = null;
    if (context.request.method === 'POST') {
      const prepared = await mutation(context, 8192);
      account = prepared.account;
      if (prepared.failure) return prepared.failure;
      body = prepared.body;
    }
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'admin')
      return account.json({ error: 'Not found.' }, 404);
    if (context.url.search)
      return account.json({ error: 'Invalid admin request.' }, 400);
    if (context.request.method === 'POST') {
      const parsed = DecideReportSchema.safeParse(body);
      if (!parsed.success)
        return account.json(
          { error: 'Add a reason between 3 and 300 characters.' },
          400,
        );
      const { data, error } = await account.client.rpc(
        'admin_order_report_decide',
        {
          p_report_id: parsed.data.id,
          p_decision: parsed.data.decision,
          p_reason: parsed.data.reason,
        },
      );
      if (error)
        return account.json({ error: 'Admin service unavailable.' }, 503);
      const denied = refusal(data);
      return denied
        ? account.json(
            { error: denied.message || 'That didn’t work.' },
            denied.status,
          )
        : account.json(data);
    }
    const { data, error } = await account.client.rpc('admin_order_reports');
    if (
      error ||
      !data ||
      typeof data !== 'object' ||
      !('reports' in data) ||
      !Array.isArray(data.reports)
    )
      return account.json({ error: 'Admin service unavailable.' }, 503);
    const backend = createReportBackend();
    if (!backend)
      return account.json({ error: 'Report service unavailable.' }, 503);
    const rawReports = data.reports as unknown[];
    const reports = await Promise.all(
      rawReports.map(async (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value))
          throw new ProofFailure();
        const report = value as Record<string, unknown>;
        const rawEvidence = Array.isArray(report.evidence)
          ? report.evidence
          : [];
        const evidence = await Promise.all(
          rawEvidence.map(async (value) => {
            if (!value || typeof value !== 'object' || Array.isArray(value))
              throw new ProofFailure();
            const item = value as Record<string, unknown>;
            const { storage_key: storageKey, ...publicItem } = item;
            return {
              ...publicItem,
              url: await backend.sign(String(storageKey)),
            };
          }),
        );
        return { ...report, evidence };
      }),
    );
    return account.json({ ...data, reports });
  } catch {
    return account.json({ error: 'Admin service unavailable.' }, 503);
  }
};
