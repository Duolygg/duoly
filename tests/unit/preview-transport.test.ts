import { describe, expect, it } from 'vitest';
import {
  PREVIEW_FIXTURES,
  PREVIEW_UNAVAILABLE,
  previewFetch,
} from '../../src/design-preview/preview-transport';

describe('preview transport', () => {
  it('shares one sample order across customer, queue, desk, admin and handover reads', async () => {
    const read = async (path: string): Promise<Record<string, unknown>> => {
      const response = await previewFetch(path);
      expect(response.status).toBe(200);
      return response.json() as Promise<Record<string, unknown>>;
    };
    const customer = await read('/api/orders');
    const queue = await read('/api/orders/preview-order');
    const handover = await read('/api/claim/preview-handover');
    const desk = await read('/preview/desk');
    const admin = await read('/api/admin/stats');
    expect(customer.order).toEqual(queue.order);
    expect(handover.order).toEqual(queue.order);
    expect(desk.queue).toEqual([queue.order]);
    expect(admin.orders).toEqual([
      expect.objectContaining({
        id: 'preview-order',
        customer: 'Sample Player',
      }),
    ]);
  });

  it('returns fresh copies and deeply freezes nested source fixtures', async () => {
    const response = await previewFetch('/api/orders/preview-order');
    const data = (await response.json()) as { order: { title: string } };
    data.order.title = 'not persisted';
    const again = await previewFetch('/api/orders/preview-order');
    expect(await again.json()).not.toEqual(data);
    expect(
      Object.isFrozen(PREVIEW_FIXTURES['/api/orders/preview-order'].order),
    ).toBe(true);
    expect((await previewFetch('/api/orders/real-id')).status).toBe(404);
    expect((await previewFetch('/api/claim/real-token')).status).toBe(404);
  });
  it('returns deterministic readonly fixture responses', async () => {
    const first = await previewFetch('/api/fx');
    const second = await previewFetch('/api/fx');

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ customerRate: 1.13 });
    expect(await second.json()).toEqual({ customerRate: 1.13 });
    expect(Object.isFrozen(PREVIEW_FIXTURES)).toBe(true);
    expect(Object.isFrozen(PREVIEW_FIXTURES['/api/fx'])).toBe(true);
  });

  it('fails unknown and external paths closed', async () => {
    const unknown = await previewFetch('/api/not-a-fixture');
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({
      error: 'Unknown design preview fixture.',
    });

    const external = await previewFetch('https://example.invalid/api/fx');
    expect(external.status).toBe(404);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'rejects %s mutations without changing fixtures',
    async (method) => {
      const before = structuredClone(PREVIEW_FIXTURES);
      const response = await previewFetch('/api/orders', {
        method,
        body: JSON.stringify({ title: 'must not be created' }),
      });

      expect(response.status).toBe(405);
      expect(await response.json()).toEqual({ error: PREVIEW_UNAVAILABLE });
      expect(PREVIEW_FIXTURES).toEqual(before);
    },
  );
});
