import type { APIContext, APIRoute } from 'astro';
import { beforeEach, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import { createReportBackend } from '../../src/server/reports/backend';
import { createReport, adminReports } from '../../src/server/reports/handlers';

vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
vi.mock('../../src/server/reports/backend', () => ({
  createReportBackend: vi.fn(),
}));
const rpc = vi.fn();
const identity = vi.fn();
const put = vi.fn();
const remove = vi.fn();
const sign = vi.fn();
const token = 'a'.repeat(64);
const id = '00000000-0000-4000-8000-000000000001';
const reportId = '00000000-0000-4000-8000-000000000010';
const evidenceId = '00000000-0000-4000-8000-000000000011';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const png = new File(
  [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1])],
  'proof.png',
  { type: 'image/png' },
);
function context(
  method = 'POST',
  body?: BodyInit,
  path = `/api/orders/${id}/report`,
) {
  const headers: Record<string, string> = {
    origin: 'http://localhost',
    'x-csrf-token': token,
  };
  if (typeof body === 'string') headers['content-type'] = 'application/json';
  const request = new Request('http://localhost' + path, {
    method,
    headers,
    body,
  });
  return {
    request,
    url: new URL(request.url),
    params: { id },
    cookies: { get: () => ({ value: token }) },
  } as unknown as APIContext;
}
const run = async (handler: APIRoute, ctx: APIContext) =>
  (await handler(ctx)) as Response;
function form(overrides: Record<string, string> = {}, files: File[] = [png]) {
  const data = new FormData();
  data.set('type', overrides.type ?? 'toxic');
  data.set(
    'description',
    overrides.description ?? 'They repeatedly insulted me in chat.',
  );
  for (const file of files) data.append('evidence', file);
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  identity.mockResolvedValue({ viewer: { role: 'customer' } });
  rpc.mockResolvedValue({
    data: {
      report: {
        id: reportId,
        reference: 'R-00000000',
        status: 'open',
        type: 'toxic',
        bounty_eur_cents: 5000,
        created_at: '2026-10-24T20:00:00Z',
      },
    },
    error: null,
  });
  vi.mocked(accountContext).mockReturnValue({
    client: { rpc },
    identity,
    json,
    headers: new Headers(),
    config: { origin: 'http://localhost' },
    names: { csrf: 'csrf' },
  } as unknown as ReturnType<typeof accountContext>);
  put.mockResolvedValue(undefined);
  remove.mockResolvedValue(undefined);
  sign.mockResolvedValue('https://signed.invalid/evidence');
  vi.mocked(createReportBackend).mockReturnValue({
    put,
    remove,
    sign,
  } as never);
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(evidenceId);
});
it('uploads validated private evidence and creates a customer report', async () => {
  const res = await run(createReport, context('POST', form()));
  expect(res.status).toBe(201);
  expect(put).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith(
    'order_report_create',
    expect.objectContaining({
      p_order_id: id,
      p_type: 'toxic',
      p_description: 'They repeatedly insulted me in chat.',
      p_evidence: [
        expect.objectContaining({
          id: evidenceId,
          mime: 'image/png',
          byte_size: 9,
        }),
      ],
    }),
  );
});
it.each([
  [form({ type: 'other' }), 400],
  [form({ description: 'short' }), 400],
  [form({}, []), 400],
  [form({}, Array(6).fill(png)), 400],
])('rejects invalid report input before storage', async (body, status) => {
  expect((await run(createReport, context('POST', body))).status).toBe(status);
  expect(put).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
it('requires a customer and compensates uploaded evidence when creation fails', async () => {
  identity.mockResolvedValue({ viewer: { role: 'teammate' } });
  expect((await run(createReport, context('POST', form()))).status).toBe(403);
  rpc.mockResolvedValue({
    data: {
      error: {
        code: 409,
        message: 'You already reported this. Our team is on it.',
      },
    },
    error: null,
  });
  identity.mockResolvedValue({ viewer: { role: 'customer' } });
  const res = await run(createReport, context('POST', form()));
  expect(res.status).toBe(409);
  expect(remove).toHaveBeenCalledTimes(1);
});
it('lists admin reports with short-lived signed evidence URLs and decides with a reason', async () => {
  identity.mockResolvedValue({ viewer: { role: 'admin' } });
  rpc.mockResolvedValueOnce({
    data: {
      reports: [
        {
          id: reportId,
          evidence: [
            { id: evidenceId, storage_key: `${id}/${reportId}/${evidenceId}` },
          ],
        },
      ],
      bounty_eur_cents: 5000,
    },
    error: null,
  });
  let res = await run(
    adminReports,
    context('GET', undefined, '/api/admin/reports'),
  );
  expect(res.status).toBe(200);
  expect((await res.json()).reports[0].evidence[0].url).toBe(
    'https://signed.invalid/evidence',
  );
  rpc.mockResolvedValueOnce({
    data: { report: { id: reportId, status: 'approved', bounty_owed: true } },
    error: null,
  });
  const body = JSON.stringify({
    csrf: token,
    id: reportId,
    decision: 'approved',
    reason: 'Screenshot clearly shows an off-platform payment request.',
  });
  res = await run(adminReports, context('POST', body, '/api/admin/reports'));
  expect(res.status).toBe(200);
  expect(rpc).toHaveBeenLastCalledWith('admin_order_report_decide', {
    p_report_id: reportId,
    p_decision: 'approved',
    p_reason: 'Screenshot clearly shows an off-platform payment request.',
  });
});
