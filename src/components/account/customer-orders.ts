import {
  OrderResponseSchemas,
  type CustomerOrder,
  type OrderResponse,
  type OrderResponseKind,
} from '../../contracts/orders';

export class OrderRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function orderRequest<K extends OrderResponseKind>(
  kind: K,
  path: string,
  init?: RequestInit,
  fetcher: typeof fetch = fetch,
): Promise<OrderResponse<K>> {
  let response: Response;
  try {
    response = await fetcher(path, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    });
  } catch {
    throw new OrderRequestError(
      0,
      'Could not reach Duoly. Refresh to check the latest state.',
    );
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: 'Your session has ended. Sign in again.',
      403: 'Order access denied. Refresh your session.',
      404: 'Order not found.',
      409: 'Order changed or action unavailable. Latest state requested.',
      410: 'Order expired or cancelled. Latest state requested.',
    };
    throw new OrderRequestError(
      response.status,
      messages[response.status] ?? 'Order service unavailable.',
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new OrderRequestError(502, 'Invalid order response.');
  }
  const parsed = OrderResponseSchemas[kind].safeParse(data);
  if (!parsed.success)
    throw new OrderRequestError(502, 'Invalid order response.');
  return parsed.data as OrderResponse<K>;
}
export const PAGE_SIZE = 10;
export const orderStatus = {
  queued: 'Queued',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
export function canReroll(order: CustomerOrder, now: number): boolean {
  const accepted = order.accepted_at ? Date.parse(order.accepted_at) : NaN;
  return (
    order.status === 'in_progress' &&
    order.rerolls < 2 &&
    !!order.current_assignment_id &&
    Number.isFinite(accepted) &&
    now >= accepted &&
    now <= accepted + 300000
  );
}
export function euro(cents: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}
export async function orderCommand(
  id: string,
  action: 'cancel' | 'reroll',
  csrf: string,
) {
  const result = await orderRequest(
    'customerOrder',
    `/api/orders/${encodeURIComponent(id)}/${action}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csrf }),
    },
  );
  const order = result.order;
  const cleared =
    order.current_assignment_id === null &&
    order.accepted_at === null &&
    order.teammate === null;
  const confirmed =
    order.id === id &&
    cleared &&
    order.completed_at === null &&
    (action === 'cancel'
      ? order.status === 'cancelled' &&
        order.cancelled_at !== null &&
        order.cancel_reason !== null
      : order.status === 'queued' &&
        order.rerolls > 0 &&
        order.cancelled_at === null &&
        order.cancel_reason === null);
  if (!confirmed)
    throw new OrderRequestError(
      502,
      'Order action could not be confirmed. Refresh to check the latest state.',
    );
  return result;
}
