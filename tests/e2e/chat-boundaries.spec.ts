import { expect, test } from '@playwright/test';
const id = '11111111-1111-4111-8111-111111111111';
test('unactivated chat and moderation APIs fail closed without leaking credentials', async ({
  request,
}) => {
  for (const path of [
    `/api/orders/${id}/chat`,
    `/api/orders/${id}/chat/realtime`,
    '/api/admin/chat-flags',
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(503);
    expect(response.headers()['cache-control']).toContain('no-store');
    expect(response.headers()['referrer-policy']).toBe('no-referrer');
    expect(await response.json()).toEqual({
      error: 'Chat service unavailable.',
    });
  }
  const response = await request.post(`/api/orders/${id}/chat`, {
    data: { assignment_id: id, request_id: id, body: 'must not be stored' },
  });
  expect(response.status()).toBe(503);
  expect(response.headers()['referrer-policy']).toBe('no-referrer');
});
