import CustomerOrderRoom from '../../src/components/account/CustomerOrderRoom';
import { DeskView } from '../../src/components/teammate/OrderDesk';
import type { CustomerOrder, TeammateOrder } from '../../src/contracts/orders';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PrivateProofs, {
  ProofView,
} from '../../src/components/proofs/PrivateProofs';
import { initialProofState } from '../../src/components/proofs/proof-session';
import { ProofSession } from '../../src/components/proofs/proof-session';
import { describe, expect, it, vi } from 'vitest';
import {
  readProofs,
  proofUrl,
  selectUpload,
  uploadProof,
} from '../../src/components/proofs/proof-client';

const order = '12345678-1234-4234-8234-123456789012';
const assignment = '12345678-1234-4234-8234-123456789013';
const id = '12345678-1234-4234-8234-123456789014';
const proof = {
  id,
  order_id: order,
  assignment_id: assignment,
  mime: 'image/png' as const,
  byte_size: 8,
  created_at: '2026-10-22T10:00:00Z',
};

it('integrates only own customer order and current assignment, never the generic queue', () => {
  const common = {
    id: order,
    public_reference: 'DL-42',
    status: 'in_progress' as const,
    current_assignment_id: assignment,
    game: 'lol' as const,
    service: 'duo',
    title: 'Ranked duo',
    units: 1,
    unit: 'game' as const,
    gg: false,
    rank: 'Gold',
    region: 'EUW',
    ign: 'Player',
    note: '',
    voice: false,
  };
  const teammate: TeammateOrder = {
    ...common,
    customer_name: 'Player',
    customer_image: '',
    customer_country: 'at',
    payout_usd_cents: 1000,
  };
  const customer: CustomerOrder = {
    ...common,
    amount_eur_cents: 2000,
    created_at: proof.created_at,
    queued_at: proof.created_at,
    accepted_at: proof.created_at,
    completed_at: null,
    cancelled_at: null,
    cancel_reason: null,
    rerolls: 0,
    teammate: { name: 'Mate', image: '', country: 'at' },
    review: null,
  };
  expect(
    renderToStaticMarkup(
      createElement(CustomerOrderRoom, {
        initialOrder: customer,
        csrf: 'csrf',
      }),
    ),
  ).toContain('Private evidence');
  const base = {
    queue: { kind: 'ready' as const, value: [teammate] },
    assignment: { kind: 'ready' as const, value: null as TeammateOrder | null },
  };
  expect(
    renderToStaticMarkup(
      createElement(DeskView, { state: base, pending: false, canAccept: true }),
    ),
  ).not.toContain('Private evidence');
  expect(
    renderToStaticMarkup(
      createElement(DeskView, {
        state: { ...base, assignment: { kind: 'ready', value: teammate } },
        pending: false,
        canAccept: false,
      }),
    ),
  ).toContain('Private evidence');
});

it('renders accessible private evidence controls, native images, honest loading and stale errors', () => {
  const loading = renderToStaticMarkup(
    createElement(PrivateProofs, {
      orderId: order,
      assignmentId: assignment,
      csrf: 'csrf',
      mode: 'teammate',
    }),
  );
  expect(loading).toContain(
    'Private screenshots are visible only to authorized participants.',
  );
  expect(loading).toContain('Loading private evidence');
  expect(loading).not.toContain('No evidence uploaded');
  expect(loading).toContain('type="file"');
  expect(loading).toContain('Refresh evidence');
  const html = renderToStaticMarkup(
    createElement(ProofView, {
      orderId: order,
      assignmentId: assignment,
      mode: 'teammate',
      state: { ...initialProofState, kind: 'ready', proofs: [proof] },
    }),
  );
  expect(html).toContain(`src="/api/orders/${order}/proof/${id}"`);
  expect(html).toContain('Open evidence image 1');
  expect(html).not.toContain('https://');
  const unavailable = renderToStaticMarkup(
    createElement(ProofView, {
      orderId: order,
      mode: 'customer',
      state: {
        ...initialProofState,
        kind: 'unavailable',
        stale: true,
        proofs: [proof],
        error: 'Private proof service unavailable.',
      },
    }),
  );
  expect(unavailable).toContain('may be stale');
  expect(unavailable).toContain('role="alert"');
  expect(unavailable).not.toContain('type="file"');
  expect(unavailable).not.toContain('No evidence uploaded');
});

it('hides an unknown count and disables writes without a CSRF token', () => {
  const unavailable = renderToStaticMarkup(
    createElement(ProofView, {
      orderId: order,
      assignmentId: assignment,
      mode: 'teammate',
      state: { ...initialProofState, kind: 'unavailable' },
    }),
  );
  expect(unavailable).not.toContain('0 / 5');
  const ready = renderToStaticMarkup(
    createElement(ProofView, {
      orderId: order,
      assignmentId: assignment,
      mode: 'teammate',
      state: {
        ...initialProofState,
        kind: 'ready',
        proofs: [],
        choice: {
          file: new File(['x'], 'x.png', { type: 'image/png' }),
          requestId: id,
        },
      },
    }),
  );
  expect(ready).toMatch(/<button[^>]*disabled[^>]*>Upload selected image/);
});

it('resets React scope keys on assignment changes and suppresses old uploads after unmount', async () => {
  expect(
    PrivateProofs({
      orderId: order,
      assignmentId: assignment,
      mode: 'teammate',
    }).key,
  ).not.toBe(
    PrivateProofs({ orderId: order, assignmentId: id, mode: 'teammate' }).key,
  );
  let finish!: (value: Response) => void;
  const changed = vi.fn();
  const session = new ProofSession(
    order,
    assignment,
    'csrf',
    async (_url, init) =>
      init?.method === 'POST'
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Response.json({ proofs: [] }),
    changed,
  );
  await session.refresh();
  session.select([new File(['png'], 'a.png', { type: 'image/png' })]);
  const upload = session.upload();
  session.dispose();
  changed.mockClear();
  finish(Response.json({ proof }));
  await upload;
  expect(changed).not.toHaveBeenCalled();
  const replacement = new ProofSession(order, id, 'csrf', async () =>
    Response.json({ proofs: [proof] }),
  );
  await replacement.refresh();
  expect(replacement.value.kind).toBe('unavailable');
  expect(replacement.value.proofs).toBeNull();
});

it('validates one selected raw file and reuses its UUID on manual retry without auto retry', async () => {
  const file = new File([new Uint8Array(8)], 'private.png', {
    type: 'image/png',
  });
  const choice = selectUpload([file], [proof], assignment, () => id);
  expect(choice.requestId).toBe(id);
  const fetcher = vi.fn(async () => Response.json({ proof }));
  for (let retry = 0; retry < 2; retry++) {
    expect(
      await uploadProof(fetcher, order, assignment, 'csrf', choice),
    ).toEqual({ kind: 'confirmed', proof });
  }
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher).toHaveBeenLastCalledWith(
    `/api/teammate/orders/${order}/proof`,
    {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      body: file,
      headers: {
        'Content-Type': 'image/png',
        'X-CSRF-Token': 'csrf',
        'X-Assignment-Id': assignment,
        'X-Idempotency-Key': id,
      },
    },
  );
  const lost = vi.fn(async () => {
    throw new Error('lost acknowledgement');
  });
  expect(await uploadProof(lost, order, assignment, 'csrf', choice)).toEqual({
    kind: 'uncertain',
  });
  expect(lost).toHaveBeenCalledTimes(1);
  for (const value of [
    { ...proof, order_id: assignment },
    { ...proof, assignment_id: id },
    { ...proof, url: '/bad' },
  ]) {
    expect(
      await uploadProof(
        async () => Response.json({ proof: value }),
        order,
        assignment,
        'csrf',
        choice,
      ),
    ).toEqual({ kind: 'uncertain' });
  }
  expect(
    await uploadProof(
      async () => new Response('', { status: 503 }),
      order,
      assignment,
      'csrf',
      choice,
    ),
  ).toEqual({ kind: 'unavailable' });
});

it('rejects count, empty, oversized and unsupported files; counts only the current assignment', () => {
  const file = new File([new Uint8Array(1572864)], 'max.webp', {
    type: 'image/webp',
  });
  expect(
    selectUpload(
      [file],
      Array(5).fill({ ...proof, assignment_id: id }),
      assignment,
    ).file,
  ).toBe(file);
  expect(() => selectUpload([file], Array(5).fill(proof), assignment)).toThrow(
    /five/i,
  );
  for (const files of [
    [],
    [file, file],
    [new File([], 'empty.png', { type: 'image/png' })],
    [new File([new Uint8Array(1572865)], 'large.png', { type: 'image/png' })],
    [new File(['bad'], 'renamed.png', { type: 'image/jpg' })],
  ]) {
    expect(() => selectUpload(files, [], assignment)).toThrow();
  }
});

it('locks duplicate writes, refreshes ambiguous outcomes, retains retry identity and never claims unconfirmed success', async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST'
      ? new Promise<Response>((resolve) => {
          finish = resolve;
        })
      : Response.json({ proofs: [proof] }),
  );
  const session = new ProofSession(order, assignment, 'csrf', fetcher);
  await session.refresh();
  session.select([new File(['png'], 'a.png', { type: 'image/png' })]);
  const requestId = session.value.choice?.requestId;
  const uploading = session.upload();
  await session.upload();
  expect(
    fetcher.mock.calls.filter(([, init]) => init?.method === 'POST'),
  ).toHaveLength(1);
  finish(new Response('', { status: 500 }));
  await uploading;
  expect(session.value.choice?.requestId).toBe(requestId);
  expect(session.value.message).toMatch(/not confirmed/i);
  expect(session.value.proofs).toEqual([proof]);
  expect(
    fetcher.mock.calls.filter(([, init]) => init?.method === 'GET'),
  ).toHaveLength(2);
});

it('preserves stale data on failed refresh but clears denied data and ignores late responses after disposal', async () => {
  let response = Response.json({ proofs: [proof] });
  const session = new ProofSession(
    order,
    assignment,
    'csrf',
    async () => response,
  );
  await session.refresh();
  response = new Response('', { status: 503 });
  await session.refresh();
  expect(session.value.proofs).toEqual([proof]);
  expect(session.value.stale).toBe(true);
  response = new Response('', { status: 404 });
  await session.refresh();
  expect(session.value.proofs).toBeNull();
  let finish!: (response: Response) => void;
  const old = new ProofSession(
    order,
    assignment,
    'csrf',
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = old.refresh();
  old.dispose();
  finish(Response.json({ proofs: [proof] }));
  await pending;
  expect(old.value.proofs).toBeNull();
});

describe('private proof reads', () => {
  it('reads strict paired DTOs and constructs only native same-origin URLs', async () => {
    const fetcher = vi.fn(async () => Response.json({ proofs: [proof] }));
    expect(await readProofs(fetcher, order, assignment)).toEqual({
      kind: 'ready',
      proofs: [proof],
    });
    expect(fetcher).toHaveBeenCalledWith(`/api/orders/${order}/proof`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    expect(proofUrl(order, proof, assignment)).toBe(
      `/api/orders/${order}/proof/${id}`,
    );
    expect(() => proofUrl('../bad', proof)).toThrow();
    expect(() => proofUrl(assignment, proof)).toThrow();
    expect(() => proofUrl(order, proof, id)).toThrow();
  });
  it('does not represent unavailable, denied or invalid responses as empty', async () => {
    for (const [status, kind] of [
      [503, 'unavailable'],
      [404, 'denied'],
      [401, 'signed-out'],
    ] as const) {
      expect(
        await readProofs(async () => new Response('', { status }), order),
      ).toEqual({ kind });
    }
    for (const item of [
      { ...proof, url: 'https://example.invalid' },
      { ...proof, order_id: assignment },
      { ...proof, assignment_id: id },
    ]) {
      expect(
        await readProofs(
          async () => Response.json({ proofs: [item] }),
          order,
          assignment,
        ),
      ).toEqual({ kind: 'unavailable' });
    }
    const fetcher = vi.fn();
    expect(await readProofs(fetcher, '../bad')).toEqual({
      kind: 'unavailable',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
