import { expect, test } from '@playwright/test';

const orderId = '12345678-1234-4234-8234-123456789012';

test('report routes stay private and reject untrusted mutations', async ({
  request,
}) => {
  const admin = await request.get('/api/admin/reports');
  expect(admin.status()).toBe(401);
  expect(JSON.stringify(await admin.json())).not.toContain('storage_key');

  const report = await request.post(`/api/orders/${orderId}/report`, {
    headers: { origin: 'https://evil.example' },
    multipart: {
      type: 'toxic',
      description: 'Repeated abusive language in the team chat.',
    },
  });
  expect([401, 403]).toContain(report.status());
  expect((await report.text()).toLowerCase()).not.toContain('service_role');
});
