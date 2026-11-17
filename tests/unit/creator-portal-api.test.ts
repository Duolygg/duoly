import type { APIContext, APIRoute } from 'astro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import { mutation } from '../../src/server/auth/handlers';
import { CREATOR_TERMS_VERSION } from '../../src/content/creator-terms';

// Admin permissions (migration 20261105130000): the admin in these tests is an owner.
vi.mock('../../src/server/admin/access', async (original) => ({
  ...(await original<typeof import('../../src/server/admin/access')>()),
  adminAccess: vi.fn(async () => ({ owner: true, sections: [] })),
}));
vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
vi.mock('../../src/server/auth/handlers', async (original) => ({
  ...(await original<typeof import('../../src/server/auth/handlers')>()),
  mutation: vi.fn(),
}));
const notifyCreatorApplication = vi.fn(async () => undefined);
vi.mock('../../src/server/creators/inbox', () => ({
  notifyCreatorApplication: (...args: unknown[]) =>
    notifyCreatorApplication(...(args as [])),
}));
const sendCreatorApproved = vi.fn(async () => undefined);
vi.mock('../../src/server/creators/notify', () => ({
  sendCreatorApproved: (...args: unknown[]) =>
    sendCreatorApproved(...(args as [])),
}));
const trackRequest = vi.fn();
vi.mock('../../src/server/analytics/client', () => ({
  trackRequest: (...args: unknown[]) => trackRequest(...(args as [])),
  serverAnalyticsEnabled: () => false,
}));

const { apply, codeCheck, payoutDetails, portal, qr, allowCreatorApplyCheck } =
  await import('../../src/server/creators/portal');
const { creatorApplications } = await import('../../src/server/admin/handlers');

const csrf = 'csrf-token';
const id = '6f1d2c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const application = {
  csrf,
  name: 'Alex Rivera',
  email: 'alex@example.com',
  platform: 'Twitch',
  channel: 'twitch.tv/alexrivera',
  audience: '1K to 10K',
  game: 'lol',
  country: 'Austria',
  code: 'alex10',
  message: 'I stream ranked every evening.',
  adult: true,
  terms: CREATOR_TERMS_VERSION,
};

const rpc = vi.fn();
let role = 'customer';
let signedIn = true;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const account = () => ({
  json,
  client: { rpc },
  identity: async () =>
    signedIn ? { viewer: { id, role, name: 'Alex', email: 'a@b.c' } } : null,
});
const context = (method: string, path = '/api/creators/portal') =>
  ({
    request: new Request(`http://localhost${path}`, { method }),
    url: new URL(`http://localhost${path}`),
    cookies: { get: () => undefined },
  }) as unknown as APIContext;
const run = async (handler: APIRoute, method: string, path?: string) =>
  (await handler(context(method, path))) as Response;
const post = (body: Record<string, unknown>) =>
  vi.mocked(mutation).mockResolvedValue({
    account: account(),
    body,
    failure: null,
  } as never);

beforeEach(() => {
  vi.clearAllMocks();
  role = 'customer';
  signedIn = true;
  vi.mocked(accountContext).mockImplementation(() => account() as never);
  rpc.mockResolvedValue({ data: { status: 'none' }, error: null });
});

describe('GET /api/creators/portal', () => {
  it('needs an account', async () => {
    signedIn = false;
    const response = await run(portal, 'GET');
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('reads the caller own portal and nothing else', async () => {
    const response = await run(portal, 'GET');
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('creator_portal');
    expect(rpc.mock.calls[0]![1]).toBeUndefined();
  });
  it('counts one dashboard view for an approved creator only', async () => {
    rpc.mockResolvedValue({ data: { status: 'creator' }, error: null });
    await run(portal, 'GET');
    expect(trackRequest).toHaveBeenCalledWith(
      expect.anything(),
      id,
      'creator_dashboard_viewed',
    );
    trackRequest.mockClear();
    rpc.mockResolvedValue({ data: { status: 'applied' }, error: null });
    await run(portal, 'GET');
    expect(trackRequest).not.toHaveBeenCalled();
  });
  it('refuses anything but GET', async () => {
    const response = await run(portal, 'DELETE');
    expect(response.status).toBe(405);
  });
});

describe('POST /api/creators/apply', () => {
  it('needs an account, so the form opens the sign-in popup first', async () => {
    signedIn = false;
    post(application);
    const response = await run(apply, 'POST');
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('passes the checked application to the database', async () => {
    rpc.mockResolvedValue({
      data: { application: { id, code: 'ALEX10', status: 'applied' } },
      error: null,
    });
    post(application);
    const response = await run(apply, 'POST');
    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('creator_apply', {
      p_code: 'ALEX10',
      p_name: 'Alex Rivera',
      p_email: 'alex@example.com',
      p_platform: 'Twitch',
      p_channel: 'twitch.tv/alexrivera',
      p_audience: '1K to 10K',
      p_game: 'lol',
      p_country: 'Austria',
      p_message: 'I stream ranked every evening.',
      p_adult: true,
      p_terms: CREATOR_TERMS_VERSION,
    });
  });
  it('still tells the support inbox and counts one typed event', async () => {
    rpc.mockResolvedValue({
      data: { application: { id, code: 'ALEX10', status: 'applied' } },
      error: null,
    });
    post(application);
    await run(apply, 'POST');
    expect(notifyCreatorApplication).toHaveBeenCalledTimes(1);
    expect(trackRequest).toHaveBeenCalledWith(
      expect.anything(),
      id,
      'creator_applied',
      { platform: 'twitch', audience: '1k_to_10k', game: 'lol' },
    );
  });
  it('answers a filled honeypot with a plain ok and writes nothing', async () => {
    post({ ...application, website: 'https://spam.example' });
    const response = await run(apply, 'POST');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(rpc).not.toHaveBeenCalled();
  });
  it('refuses an incomplete or stale application before the database', async () => {
    for (const body of [
      { ...application, adult: false },
      { ...application, terms: '2000-01-01' },
      { ...application, code: 'no' },
      { ...application, email: 'nope' },
      { ...application, extra: 1 },
    ]) {
      post(body);
      expect((await run(apply, 'POST')).status).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });
  it('passes a database refusal through with its status', async () => {
    rpc.mockResolvedValue({
      data: { error: { code: 409, message: 'That code is taken.' } },
      error: null,
    });
    post(application);
    const response = await run(apply, 'POST');
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'That code is taken.' });
    expect(notifyCreatorApplication).not.toHaveBeenCalled();
  });
});

describe('POST /api/creators/code', () => {
  it('checks one code for a signed-in visitor', async () => {
    rpc.mockResolvedValue({
      data: { code: 'ALEX10', available: true, reason: '' },
      error: null,
    });
    post({ csrf, code: 'alex10' });
    const response = await run(codeCheck, 'POST');
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('creator_code_available', {
      p_code: 'ALEX10',
    });
  });
  it('refuses signed out callers, so codes cannot be enumerated', async () => {
    signedIn = false;
    post({ csrf, code: 'alex10' });
    expect((await run(codeCheck, 'POST')).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('limits how often one account can check', () => {
    const now = Date.now();
    for (let i = 0; i < 20; i++) allowCreatorApplyCheck('burst', now);
    expect(allowCreatorApplyCheck('burst', now)).toBe(false);
    expect(allowCreatorApplyCheck('burst', now + 61_000)).toBe(true);
  });
});

describe('POST /api/creators/payout-details', () => {
  const details = {
    csrf,
    legalName: 'Alex Rivera',
    address: 'Hauptstrasse 1, 1010 Vienna',
    country: 'Austria',
    method: 'wise',
    account: 'alex@example.com',
    business: true,
    vatId: 'ATU12345678',
    selfBilling: true,
  };
  it('saves the caller own details', async () => {
    rpc.mockResolvedValue({ data: { details: {} }, error: null });
    post(details);
    const response = await run(payoutDetails, 'POST');
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('creator_save_payout_details', {
      p_legal_name: 'Alex Rivera',
      p_address: 'Hauptstrasse 1, 1010 Vienna',
      p_country: 'Austria',
      p_method: 'wise',
      p_account: 'alex@example.com',
      p_business: true,
      p_vat_id: 'ATU12345678',
      p_self_billing: true,
    });
  });
  it('refuses details without the self billing agreement', async () => {
    post({ ...details, selfBilling: false });
    expect((await run(payoutDetails, 'POST')).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('admin creator applications', () => {
  it('is invisible to anyone but an admin', async () => {
    expect((await run(creatorApplications, 'GET')).status).toBe(404);
    post({ csrf, action: 'decide', id, approve: true });
    expect((await run(creatorApplications, 'POST')).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('lists the queue and decides one application', async () => {
    role = 'admin';
    rpc.mockResolvedValue({ data: { applications: [] }, error: null });
    expect((await run(creatorApplications, 'GET')).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('admin_creator_applications');
    rpc.mockResolvedValue({
      data: { application: { id, status: 'approved' } },
      error: null,
    });
    post({ csrf, action: 'decide', id, approve: true, code: 'alexgg' });
    expect((await run(creatorApplications, 'POST')).status).toBe(200);
    expect(rpc).toHaveBeenLastCalledWith('admin_decide_creator_application', {
      p_id: id,
      p_approve: true,
      p_code: 'ALEXGG',
      p_reason: '',
    });
  });
  it('emails the creator and counts the approval, once', async () => {
    role = 'admin';
    rpc.mockResolvedValue({
      data: {
        application: { id, status: 'approved' },
        approved: { email: 'alex@example.com', name: 'Alex', code: 'ALEXGG' },
      },
      error: null,
    });
    post({ csrf, action: 'decide', id, approve: true });
    await run(creatorApplications, 'POST');
    expect(sendCreatorApproved).toHaveBeenCalledWith({
      email: 'alex@example.com',
      name: 'Alex',
      code: 'ALEXGG',
    });
    expect(trackRequest).toHaveBeenCalledWith(
      expect.anything(),
      null,
      'creator_approved',
    );
  });
  it('sends nothing when the decision is a rejection', async () => {
    role = 'admin';
    rpc.mockResolvedValue({
      data: { application: { id, status: 'rejected' } },
      error: null,
    });
    post({ csrf, action: 'decide', id, approve: false, reason: 'Not yet.' });
    await run(creatorApplications, 'POST');
    expect(rpc).toHaveBeenLastCalledWith('admin_decide_creator_application', {
      p_id: id,
      p_approve: false,
      p_code: '',
      p_reason: 'Not yet.',
    });
    expect(sendCreatorApproved).not.toHaveBeenCalled();
  });
  it('refuses a rejection without a reason before the database', async () => {
    role = 'admin';
    post({ csrf, action: 'decide', id, approve: false });
    expect((await run(creatorApplications, 'POST')).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('GET /api/creators/qr.png', () => {
  it('draws the caller own short link, as a private download', async () => {
    rpc.mockResolvedValue({
      data: { status: 'creator', creator: { code: 'ALEXGG' } },
      error: null,
    });
    const response = await run(qr, 'GET', '/api/creators/qr.png');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Content-Disposition')).toContain(
      'duoly-alexgg-qr.png',
    );
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const png = new Uint8Array(await response.arrayBuffer());
    expect([...png.subarray(0, 4)]).toEqual([137, 80, 78, 71]);
  });
  it('is nothing without a creator account', async () => {
    rpc.mockResolvedValue({ data: { status: 'applied' }, error: null });
    expect((await run(qr, 'GET', '/api/creators/qr.png')).status).toBe(403);
    signedIn = false;
    expect((await run(qr, 'GET', '/api/creators/qr.png')).status).toBe(401);
  });
});
