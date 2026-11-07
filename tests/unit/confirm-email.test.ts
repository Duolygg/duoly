import type { SupabaseClient } from '@supabase/supabase-js';
import { expect, it, vi } from 'vitest';
import { renderTransactional } from '../../src/server/email/catalog';
import { confirmEmail } from '../../src/server/payments/confirm-email';
import { sendEmail } from '../../src/server/email/send';

vi.mock('../../src/server/email/send', () => ({ sendEmail: vi.fn() }));

it('renders the UUID room link while retaining the public receipt reference', async () => {
  const orderId = '12345678-1234-4234-8234-123456789abc';
  const eq = vi.fn().mockReturnValue({
    single: async () => ({
      data: {
        public_reference: 'DL-1042',
        game: 'lol',
        title: 'Duo Pro',
        units: 3,
        unit: 'game',
        region: 'EUW',
        rank: 'Gold',
        amount_eur_cents: 1617,
        customer_name: 'Lea Example',
        created_at: '2026-10-22T17:42:00Z',
      },
    }),
  });
  const admin = {
    from: () => ({ select: () => ({ eq }) }),
  } as unknown as SupabaseClient;
  await confirmEmail(admin, orderId, 'lea@example.com', 'card');
  expect(eq).toHaveBeenCalledWith('id', orderId);
  const message = vi.mocked(sendEmail).mock.calls[0]![0];
  expect(message.template).toBe('order_confirmed');
  expect(message.idempotencyKey).toBe('order_confirmed:DL-1042');
  const rendered = renderTransactional(
    'order_confirmed',
    message.data as never,
    {
      siteUrl: 'https://duoly.gg',
      assetOrigin: 'https://duoly.gg',
    },
  );
  expect(rendered.subject).toContain('DL-1042');
  expect(rendered.html).toContain(`href="https://duoly.gg/queue/${orderId}"`);
  expect(rendered.text).toContain(`https://duoly.gg/queue/${orderId}`);
  expect(rendered.text).not.toContain('/queue/DL-1042');
});
