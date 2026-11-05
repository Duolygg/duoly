import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '../email/send';
import { GAME } from '../../design-reference/lib/games.js';

// The "order confirmed" email for a paid order, from a checkout (webhook.ts) or Play again
// (play-again.ts).

const METHOD_LABELS: Record<string, string> = {
  card: 'Card',
  paypal: 'PayPal',
  klarna: 'Klarna',
  amazon_pay: 'Amazon Pay',
  revolut_pay: 'Revolut Pay',
  link: 'Link',
  eps: 'EPS',
  ideal: 'iDEAL',
  bancontact: 'Bancontact',
  sepa_debit: 'SEPA Direct Debit',
  p24: 'Przelewy24',
  twint: 'TWINT',
  wero: 'Wero',
  mb_way: 'MB WAY',
  mobilepay: 'MobilePay',
  bizum: 'Bizum',
  satispay: 'Satispay',
  alipay: 'Alipay',
  wechat_pay: 'WeChat Pay',
  pay_by_bank: 'Pay by Bank',
};

/** Sends the order confirmation once per order (idempotent on the order reference). */
export async function confirmEmail(
  admin: SupabaseClient,
  orderId: string,
  email: string | null,
  method: string,
) {
  if (!email) return;
  const { data: order } = await admin
    .from('orders')
    .select(
      'public_reference, game, title, units, unit, region, rank, amount_eur_cents, customer_name, created_at',
    )
    .eq('id', orderId)
    .single();
  if (!order) return;
  const game = (GAME as Record<string, { name: string; img: string }>)[
    order.game
  ];
  const total = { cents: order.amount_eur_cents, currency: 'EUR' as const };
  await sendEmail({
    template: 'order_confirmed',
    to: email,
    idempotencyKey: `order_confirmed:${order.public_reference}`,
    data: {
      firstName: String(order.customer_name).split(' ')[0] || 'there',
      order: {
        id: order.public_reference,
        game: { name: game?.name ?? order.game, icon: game?.img ?? '' },
        service: order.title,
        units: order.units,
        unit: order.unit,
        region: order.region,
        ...(order.rank ? { rank: order.rank } : {}),
      },
      lines: [{ label: order.title, amount: total }],
      total,
      paidWith: METHOD_LABELS[method] ?? 'Online payment',
      paidAt: new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/Vienna',
      }).format(new Date(order.created_at)),
    },
  });
}
