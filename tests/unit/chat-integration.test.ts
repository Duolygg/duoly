import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import CustomerOrderRoom from '../../src/components/account/CustomerOrderRoom';
import {
  DeskView,
  type DeskState,
} from '../../src/components/teammate/OrderDesk';
import {
  CustomerOrderSchema,
  TeammateOrderSchema,
} from '../../src/contracts/orders';

const orderId = '11111111-1111-4111-8111-111111111111';
const assignmentId = '22222222-2222-4222-8222-222222222222';
const booking = {
  id: orderId,
  public_reference: 'DL-1042',
  status: 'in_progress',
  game: 'val',
  service: 'Ranked duo',
  title: 'VALORANT ranked session',
  units: 3,
  unit: 'game',
  gg: false,
  rank: 'Gold III',
  region: 'EU West',
  ign: 'Alex#EUW',
  note: 'A relaxed ranked session, please.',
  voice: false,
  current_assignment_id: assignmentId,
};
const customer = CustomerOrderSchema.parse({
  ...booking,
  amount_eur_cents: 1200,
  created_at: '2026-10-23T18:40:00Z',
  queued_at: '2026-10-23T18:40:00Z',
  accepted_at: '2026-10-23T18:42:00Z',
  completed_at: null,
  cancelled_at: null,
  cancel_reason: null,
  rerolls: 0,
  teammate: {
    name: 'Mina',
    image: '/assets/avatars/avatar-3.png',
    country: 'at',
  },
});
const teammate = TeammateOrderSchema.parse({
  ...booking,
  customer_name: 'Alex',
  customer_image: '/assets/avatars/avatar-1.png',
  customer_country: 'at',
  payout_usd_cents: 900,
});
const queued = TeammateOrderSchema.parse({
  ...teammate,
  id: '33333333-3333-4333-8333-333333333333',
  public_reference: 'DL-1043',
  status: 'queued',
  current_assignment_id: null,
});
const ready: DeskState = {
  assignment: { kind: 'ready', value: teammate },
  queue: { kind: 'ready', value: [queued] },
};
function customerHtml(chatEnabled?: boolean) {
  return renderToStaticMarkup(
    createElement(CustomerOrderRoom, {
      initialOrder: customer,
      csrf: 'fixture-csrf',
      chatEnabled,
    }),
  );
}
function deskHtml(state = ready, chatEnabled?: boolean, pending = false) {
  return renderToStaticMarkup(
    createElement(DeskView, {
      state,
      pending,
      canAccept: false,
      csrf: 'fixture-csrf',
      chatEnabled,
    }),
  );
}

it('evaluates the server flag only in SSR and passes a boolean into both islands', () => {
  for (const [path, component] of [
    ['src/pages/queue/[id].astro', 'CustomerOrderRoom'],
    ['src/pages/teammate.astro', 'OrderDesk'],
  ] as const) {
    const source = readFileSync(path, 'utf8');
    expect(source).toContain('server/chat/config');
    expect(source).toMatch(/const chatEnabled = orderChatEnabled\(\);/);
    expect(source).toMatch(
      new RegExp(`<${component}\\s[\\s\\S]*?chatEnabled=\\{chatEnabled\\}`),
    );
  }
  for (const path of [
    'src/components/account/CustomerOrderRoom.tsx',
    'src/components/teammate/OrderDesk.tsx',
  ]) {
    expect(readFileSync(path, 'utf8')).not.toMatch(
      /server\/chat\/config|ORDER_CHAT_ENABLED|onOrderChanged=/,
    );
  }
});

it('keeps the default-off legacy interfaces and explicit unavailable copy', () => {
  for (const enabled of [undefined, false]) {
    const html = customerHtml(enabled);
    expect(html).not.toContain('class="order-chat"');
    expect(html).not.toContain('co-chat-layout');
    expect(html).toContain(
      'Chat, reviews, tips and completion actions are not available here.',
    );
    expect(html).toContain('Private evidence');
    expect(html).toContain('open=""');
    const desk = deskHtml(ready, enabled);
    expect(desk).not.toContain('class="order-chat"');
    expect(desk).toContain(
      'Completion, chat and payout withdrawals are unavailable.',
    );
    expect(desk).toContain('Private evidence');
  }
});

it('never mounts teammate chat for queued, final, empty, pending or denied assignments', () => {
  for (const assignment of [
    { kind: 'ready', value: queued },
    { kind: 'ready', value: null },
    ...(['completed', 'cancelled'] as const).map((status) => ({
      kind: 'ready',
      value: TeammateOrderSchema.parse({ ...teammate, status }),
    })),
    {
      kind: 'ready',
      value: TeammateOrderSchema.parse({
        ...teammate,
        current_assignment_id: null,
      }),
    },
    ...(['loading', 'denied', 'signed-out', 'unavailable'] as const).map(
      (kind) => ({ kind }),
    ),
  ] as DeskState['assignment'][]) {
    const html = deskHtml({ ...ready, assignment }, true);
    expect(html).not.toContain('class="order-chat"');
    expect(html).not.toContain('Private evidence');
  }
  expect(deskHtml(ready, true, true)).not.toContain('class="order-chat"');
});

it('retains customer queued cancellation and final-order chat inspection without lifecycle actions', () => {
  for (const status of ['queued', 'completed', 'cancelled'] as const) {
    const order = CustomerOrderSchema.parse({
      ...customer,
      status,
      ...(status === 'queued'
        ? { current_assignment_id: null, teammate: null, accepted_at: null }
        : {}),
    });
    const html = renderToStaticMarkup(
      createElement(CustomerOrderRoom, {
        initialOrder: order,
        csrf: 'fixture-csrf',
        chatEnabled: true,
      }),
    );
    expect(html).toContain('class="order-chat"');
    expect(html.includes('Cancel queued order')).toBe(status === 'queued');
    expect(html).not.toMatch(/>Complete order<|>Tip<|>Review</);
  }
});

it('mounts teammate chat only inside the accepted active assignment, before evidence', () => {
  const html = deskHtml(ready, true);
  expect(html).toContain('td-chat-enabled');
  expect(html).toContain('class="order-chat"');
  const [assignment = '', queue = ''] = html.split(
    'aria-labelledby="td-queue"',
  );
  expect(assignment).toContain('class="order-chat"');
  expect(assignment.indexOf('class="order-chat"')).toBeLessThan(
    assignment.indexOf('Private evidence'),
  );
  expect(queue).not.toContain('class="order-chat"');
  expect(queue).toContain('Accept order');
  expect(html).not.toContain(
    'Completion, chat and payout withdrawals are unavailable',
  );
});

it('puts native customer chat after a compact summary and before evidence', () => {
  const html = customerHtml(true);
  expect(html).toContain('class="order-chat"');
  expect(html).toContain('co-chat-layout');
  expect(html.indexOf('Order details')).toBeLessThan(
    html.indexOf('class="order-chat"'),
  );
  expect(html.indexOf('class="order-chat"')).toBeLessThan(
    html.indexOf('Private evidence'),
  );
  expect(html).toMatch(
    /<details[^>]*><summary>More booking details<\/summary>[\s\S]*Your in-game name[\s\S]*<\/details>/,
  );
  expect(html).not.toMatch(/<details[^>]*\sopen/);
  expect(html).not.toContain('Chat, reviews, tips');
  expect(html).toContain(
    'Reviews, tips and completion actions are not available here.',
  );
});
