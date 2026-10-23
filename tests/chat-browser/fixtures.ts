import type { Page } from '@playwright/test';
import {
  ChatRoomSchema,
  ChatSendInputSchema,
  ChatSendResultSchema,
  CHAT_BLOCKED_NOTE,
  type ChatMessage,
  type ChatSendInput,
} from '../../src/contracts/chat';
export const orderId = '11111111-1111-4111-8111-111111111111',
  assignmentId = '22222222-2222-4222-8222-222222222222';
export const order = {
  id: orderId,
  public_reference: 'DL-90001',
  status: 'in_progress',
  game: 'val',
  service: 'Ranked duo',
  title: 'VALORANT ×3',
  units: 3,
  unit: 'game',
  gg: false,
  rank: 'Gold III',
  region: 'EU West',
  ign: 'Alex#EUW',
  note: 'Ready for ranked games',
  voice: false,
  amount_eur_cents: 2599,
  created_at: '2026-10-23T08:00:00Z',
  queued_at: '2026-10-23T08:00:00Z',
  accepted_at: '2026-10-23T08:00:00Z',
  completed_at: null,
  cancelled_at: null,
  cancel_reason: null,
  rerolls: 0,
  current_assignment_id: assignmentId,
  teammate: {
    name: 'Mina',
    country: 'at',
    image: '/assets/avatars/avatar-3.png',
  },
};
export function state() {
  return {
    messages: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        sequence: 1,
        kind: 'system',
        sender: 'system',
        name: 'Duoly',
        image: '',
        body: 'Mina accepted this order.',
        created_at: '2026-10-23T08:00:00Z',
        request_id: null,
      },
      {
        id: '55555555-5555-4555-8555-555555555555',
        sequence: 2,
        kind: 'user',
        sender: 'teammate',
        name: 'Mina',
        image: '/assets/avatars/avatar-3.png',
        body: 'Ready for ranked games? 👋',
        created_at: '2026-10-23T08:01:00Z',
        request_id: '66666666-6666-4666-8666-666666666666',
      },
    ] as ChatMessage[],
    denied: false,
    writable: true,
    uncertain: false,
    attempts: [] as ChatSendInput[],
  };
}
export async function mockChat(
  page: Page,
  session: ReturnType<typeof state>,
  role: 'customer' | 'teammate' = 'customer',
) {
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    const reply = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'Cache-Control': 'private,no-store' },
        body: JSON.stringify(data),
      });
    if (path.endsWith('/chat/realtime'))
      return reply(
        { error: 'Fixture uses HTTP catch-up, not hosted Realtime.' },
        503,
      );
    if (path.endsWith('/chat/typing'))
      return reply({
        order_id: orderId,
        assignment_id: assignmentId,
        ok: true,
      });
    if (path.endsWith('/chat')) {
      if (session.denied)
        return reply({ error: 'Conversation not found.' }, 404);
      if (req.method() === 'GET')
        return reply(
          ChatRoomSchema.parse({
            order_id: orderId,
            assignment_id: assignmentId,
            viewer: role,
            writable: session.writable,
            participant: {
              role: role === 'customer' ? 'teammate' : 'customer',
              name: role === 'customer' ? 'Mina' : 'Alex',
              image:
                role === 'customer'
                  ? '/assets/avatars/avatar-3.png'
                  : '/assets/avatars/avatar-1.png',
            },
            messages: session.messages,
            typing: [],
            archives: [],
          }),
        );
      const input = ChatSendInputSchema.parse(req.postDataJSON());
      session.attempts.push(input);
      if (/paypal/i.test(input.body))
        return reply(
          ChatSendResultSchema.parse({
            order_id: orderId,
            assignment_id: assignmentId,
            request_id: input.request_id,
            outcome: 'blocked',
            message: null,
            note: CHAT_BLOCKED_NOTE,
          }),
        );
      let message = session.messages.find(
        (m) => m.request_id === input.request_id && m.sender === role,
      );
      if (!message) {
        message = {
          id: crypto.randomUUID(),
          sequence: session.messages.length + 1,
          kind: 'user',
          sender: role,
          name: role === 'customer' ? 'Alex' : 'Mina',
          image:
            role === 'customer'
              ? '/assets/avatars/avatar-1.png'
              : '/assets/avatars/avatar-3.png',
          body: input.body,
          created_at: new Date().toISOString(),
          request_id: input.request_id,
        };
        session.messages.push(message);
      }
      if (session.uncertain) {
        session.uncertain = false;
        return reply({ error: 'Simulated lost acknowledgement' }, 503);
      }
      return reply(
        ChatSendResultSchema.parse({
          order_id: orderId,
          assignment_id: assignmentId,
          request_id: input.request_id,
          outcome: 'sent',
          message,
          note: null,
        }),
      );
    }
    if (path.endsWith('/proof')) return reply({ proofs: [] });
    if (path === `/api/orders/${orderId}`) return reply({ order });
    if (path === '/api/teammate/queue') return reply({ orders: [] });
    if (path === '/api/teammate/order') {
      const {
        amount_eur_cents: amount,
        created_at: created,
        queued_at: queued,
        accepted_at: accepted,
        completed_at: completed,
        cancelled_at: cancelled,
        cancel_reason: cancel,
        rerolls,
        teammate,
        ...shared
      } = order;
      void [
        amount,
        created,
        queued,
        accepted,
        completed,
        cancelled,
        cancel,
        rerolls,
        teammate,
      ];
      return reply({
        order: {
          ...shared,
          customer_name: 'Alex',
          customer_image: '/assets/avatars/avatar-1.png',
          customer_country: 'at',
          payout_usd_cents: 2000,
        },
      });
    }
    return reply({ error: 'No fixture for this endpoint.' }, 503);
  });
}
